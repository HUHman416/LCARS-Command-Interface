import json
import sys
import tempfile
import time
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
from lcars_documents import DocumentWorkspaceStore
from lcars_files import FileOperations


class FileOperationsTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.home = Path(self.temporary.name) / "home"
        self.config = self.home / ".config" / "lcars"
        (self.home / "Documents").mkdir(parents=True)
        (self.home / "Downloads").mkdir()
        self.files = FileOperations(self.config, "linux", self.home)

    def tearDown(self):
        self.temporary.cleanup()

    def test_directory_views_are_sorted_breadcrumbed_and_contained(self):
        (self.home / "Documents" / "zeta.txt").write_text("z")
        (self.home / "Documents" / "alpha.txt").write_text("a")
        result = self.files.list_directory(self.home / "Documents", "name", "asc")
        self.assertEqual([item["name"] for item in result["items"]], ["alpha.txt", "zeta.txt"])
        self.assertEqual(result["breadcrumbs"][-1]["name"], "Documents")
        with self.assertRaises(PermissionError):
            self.files.list_directory(Path(self.temporary.name))

    def test_batch_copy_conflicts_and_reversal_are_safe(self):
        source = self.home / "Documents" / "report.txt"
        source.write_text("LCARS")
        first = self.files.operate({"operation": "transfer", "paths": [str(source)], "destination": str(self.home / "Downloads"), "move": False})
        self.assertTrue(Path(first["paths"][0]).is_file())
        with self.assertRaises(FileExistsError):
            self.files.operate({"operation": "transfer", "paths": [str(source)], "destination": str(self.home / "Downloads"), "move": False})
        renamed = self.files.operate({"operation": "transfer", "paths": [str(source)], "destination": str(self.home / "Downloads"), "move": False, "conflict": "rename"})
        self.assertIn("(2)", Path(renamed["paths"][0]).name)
        self.files.operate({"operation": "undo", "id": renamed["history"]["id"]})
        self.assertFalse(Path(renamed["paths"][0]).exists())
        unchanged = self.files.operate({"operation": "rename", "path": str(source), "name": source.name, "conflict": "replace"})
        self.assertEqual(unchanged["message"], "Item name is unchanged")
        with self.assertRaises(ValueError):
            self.files.operate({"operation": "transfer", "paths": [str(source)], "destination": str(source.parent), "conflict": "replace"})
        self.assertEqual(source.read_text(), "LCARS")

    def test_trash_restore_and_empty_require_recovery_decisions(self):
        target = self.home / "Documents" / "recover.txt"
        target.write_text("recover")
        trashed = self.files.operate({"operation": "trash", "paths": [str(target)]})
        self.assertFalse(target.exists())
        ident = trashed["trash"][0]["id"]
        restored = self.files.operate({"operation": "restore", "id": ident})
        self.assertEqual(Path(restored["path"]).read_text(), "recover")
        self.files.operate({"operation": "trash", "path": restored["path"]})
        with self.assertRaises(PermissionError):
            self.files.operate({"operation": "empty-trash"})
        self.files.operate({"operation": "empty-trash", "confirmed": True})
        self.assertEqual(self.files.status()["trash"], [])

    def test_archives_reject_parent_traversal(self):
        source = self.home / "Documents" / "notes.txt"
        source.write_text("notes")
        created = self.files.operate({"operation": "archive-create", "paths": [str(source)], "destination": str(self.home / "Downloads"), "name": "notes.zip"})
        self.assertTrue(Path(created["path"]).is_file())
        extracted = self.files.operate({"operation": "archive-extract", "path": created["path"], "destination": str(self.home / "Documents")})
        self.assertTrue(Path(extracted["path"]).is_dir())
        unsafe = self.home / "Downloads" / "unsafe.zip"
        with zipfile.ZipFile(unsafe, "w") as archive:
            archive.writestr("../escape.txt", "no")
        with self.assertRaises(PermissionError):
            self.files.operate({"operation": "archive-extract", "path": str(unsafe), "destination": str(self.home / "Documents"), "name": "unsafe"})
        self.assertFalse((self.home / "Documents" / "unsafe").exists())

    def test_async_jobs_publish_progress_and_conflict_state(self):
        source = self.home / "Documents" / "job.txt"
        source.write_text("one")
        (self.home / "Downloads" / "job.txt").write_text("existing")
        job = self.files.start({"operation": "transfer", "paths": [str(source)], "destination": str(self.home / "Downloads")})["job"]
        for _ in range(100):
            current = self.files.job(job["id"])
            if current.get("status") not in {"queued", "running"}:
                break
            time.sleep(0.01)
        self.assertEqual(current["status"], "conflict")
        self.assertTrue(current["conflict"]["conflict"])

    def test_async_job_can_be_cancelled_while_operation_lock_is_held(self):
        source = self.home / "Documents" / "cancel.txt"
        source.write_text("cancel")
        original_copy = self.files._copy

        def delayed_copy(source_path, target_path, cancel=None):
            time.sleep(0.05)
            return original_copy(source_path, target_path, cancel)

        self.files._copy = delayed_copy
        job = self.files.start({"operation": "transfer", "paths": [str(source)], "destination": str(self.home / "Downloads")})["job"]
        self.files.cancel(job["id"])
        for _ in range(100):
            current = self.files.job(job["id"])
            if current.get("status") not in {"queued", "running"}:
                break
            time.sleep(0.01)
        self.assertEqual(current["status"], "cancelled")
        self.assertFalse((self.home / "Downloads" / "cancel.txt").exists())

    def test_cancelled_copy_removes_partial_output(self):
        source = self.home / "Documents" / "large.bin"
        source.write_bytes(b"x" * (2 * 1024 * 1024))
        calls = 0

        def cancel():
            nonlocal calls
            calls += 1
            return calls > 1

        with self.assertRaises(InterruptedError):
            self.files.operate({"operation": "transfer", "paths": [str(source)], "destination": str(self.home / "Downloads")}, cancel)
        self.assertFalse((self.home / "Downloads" / "large.bin").exists())
        self.assertTrue(source.exists())

    def test_trash_records_cannot_delete_outside_trash(self):
        outside = self.home / "Documents" / "keep.txt"
        outside.write_text("keep")
        self.files.state["trash"] = [{"id": "tampered", "trashPath": str(outside), "originalPath": str(outside)}]
        self.files.operate({"operation": "empty-trash", "confirmed": True})
        self.assertTrue(outside.exists())
        self.assertEqual(len(self.files.state["trash"]), 1)


class DocumentRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.home = Path(self.temporary.name) / "home"
        self.home.mkdir()
        self.document = self.home / "log.txt"
        self.document.write_text("original")
        self.patch = patch("pathlib.Path.home", return_value=self.home)
        self.patch.start()
        self.store = DocumentWorkspaceStore(self.home / ".config" / "lcars")

    def tearDown(self):
        self.patch.stop()
        self.temporary.cleanup()

    def test_autosave_recovery_metadata_save_and_exports(self):
        self.store.operate({"operation": "autosave", "path": str(self.document), "content": "recovered"})
        loaded = self.store.read(str(self.document))
        self.assertTrue(loaded["recovery"]["available"])
        self.assertEqual(loaded["metadata"]["extension"], ".txt")
        self.store.operate({"operation": "save", "path": str(self.document), "content": "saved"})
        self.assertFalse(self.store.read(str(self.document))["recovery"]["available"])
        exported = self.store.operate({"operation": "export", "path": str(self.document), "content": "saved", "format": "html", "destination": str(self.home / "log.html")})
        self.assertIn("<pre>saved</pre>", Path(exported["path"]).read_text())

    def test_recovery_created_in_same_timestamp_tick_is_available(self):
        with patch("lcars_documents.time.time", return_value=self.document.stat().st_mtime):
            self.store.operate({"operation": "autosave", "path": str(self.document), "content": "same tick"})
        self.assertTrue(self.store.read(str(self.document))["recovery"]["available"])


if __name__ == "__main__":
    unittest.main()
