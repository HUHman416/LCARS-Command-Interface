import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
from lcars_data_fabric import DataFabric


class DataFabricTests(unittest.TestCase):
    def test_private_vault_is_opt_in_encrypted_and_metadata_only(self):
        with tempfile.TemporaryDirectory() as folder:
            fabric = DataFabric(Path(folder) / "config", "test")
            with self.assertRaises(PermissionError):
                fabric.operate({"operation": "vault-put", "name": "Command Codes", "content": "delta-seven"})
            status = fabric.operate({"operation": "policy", "categories": {"privateStorage": True}})
            self.assertTrue(status["categories"]["privateStorage"])
            status = fabric.operate({"operation": "vault-put", "name": "Command Codes", "content": "delta-seven"})
            self.assertEqual(status["privateItems"][0]["name"], "Command Codes")
            self.assertNotIn("content", status["privateItems"][0])
            self.assertNotIn("delta-seven", fabric.vault_file.read_text(encoding="utf-8"))
            self.assertEqual(oct(os.stat(fabric.key_file).st_mode & 0o777), "0o600")

    def test_versions_surface_conflicts_and_keep_bounded_history(self):
        with tempfile.TemporaryDirectory() as folder:
            fabric = DataFabric(Path(folder) / "config", "test")
            fabric.merge_version("files", "report", "Report", {"value": 1}, 100, "LOCAL CORE")
            status = fabric.merge_version("files", "report", "Report", {"value": 2}, 101, "PADD ALPHA")
            self.assertEqual(status["diagnostics"]["openConflicts"], 1)
            conflict = status["conflicts"][0]
            resolved = fabric.operate({"operation": "resolve-conflict", "id": conflict["id"], "resolution": "both"})
            self.assertEqual(resolved["diagnostics"]["openConflicts"], 0)
            self.assertGreaterEqual(resolved["diagnostics"]["versionedRecords"], 1)

    def test_recent_items_and_file_search_are_bounded_to_home(self):
        with tempfile.TemporaryDirectory() as folder:
            home = Path(folder) / "home"
            documents = home / "Documents"
            documents.mkdir(parents=True)
            (documents / "Mission Report.txt").write_text("LCARS", encoding="utf-8")
            fabric = DataFabric(Path(folder) / "config", "test")
            fabric.record_recent("files", str(documents / "Mission Report.txt"), "Mission Report.txt", "Documents")
            self.assertEqual(fabric.status()["recent"][0]["name"], "Mission Report.txt")
            with patch("lcars_data_fabric.Path.home", return_value=home):
                results = fabric.search_files("mission")
            self.assertEqual(results["results"][0]["name"], "Mission Report.txt")
            self.assertTrue(Path(results["results"][0]["path"]).is_relative_to(home))


if __name__ == "__main__":
    unittest.main()
