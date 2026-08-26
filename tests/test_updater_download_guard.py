import hashlib
import io
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from shared import lcars_updater as updater


class UpdateDownloadGuardTests(unittest.TestCase):
    def setUp(self):
        updater._DOWNLOAD_CACHE.clear()

    def test_verified_download_is_cached_for_the_process_session(self):
        payload = b"verified updater payload"
        digest = hashlib.sha256(payload).hexdigest()
        info = {
            "ok": True,
            "available": True,
            "version": "27.2",
            "asset": {"name": "LCARS.AppImage", "url": "https://example.invalid/LCARS.AppImage"},
            "checksumsUrl": "https://example.invalid/SHA256SUMS.txt",
        }
        with tempfile.TemporaryDirectory() as folder, \
             mock.patch.object(updater, "check_update", return_value=info), \
             mock.patch.object(updater, "_expected_hash", return_value=digest), \
             mock.patch.object(updater.urllib.request, "urlopen", side_effect=lambda *_args, **_kwargs: io.BytesIO(payload)) as urlopen:
            first = updater.download_update("27.1.1-dev.1", "linux", Path(folder), "development")
            second = updater.download_update("27.1.1-dev.1", "linux", Path(folder), "development")
        self.assertEqual(first["sha256"], digest)
        self.assertEqual(second["sha256"], digest)
        self.assertIn("already downloaded and verified", second["message"])
        self.assertEqual(urlopen.call_count, 1)

    def test_parallel_download_is_rejected_before_touching_files(self):
        self.assertTrue(updater._DOWNLOAD_LOCK.acquire(blocking=False))
        try:
            with tempfile.TemporaryDirectory() as folder:
                with self.assertRaisesRegex(RuntimeError, "already in progress"):
                    updater.download_update("27.1.1-dev.1", "linux", Path(folder), "development")
                self.assertEqual(list(Path(folder).iterdir()), [])
        finally:
            updater._DOWNLOAD_LOCK.release()

    def test_failed_transfer_removes_partial_file_and_releases_lock(self):
        info = {
            "ok": True,
            "available": True,
            "version": "27.2",
            "asset": {"name": "LCARS.AppImage", "url": "https://example.invalid/LCARS.AppImage"},
            "checksumsUrl": "https://example.invalid/SHA256SUMS.txt",
        }
        with tempfile.TemporaryDirectory() as folder, \
             mock.patch.object(updater, "check_update", return_value=info), \
             mock.patch.object(updater.urllib.request, "urlopen", side_effect=OSError("connection lost")):
            with self.assertRaisesRegex(OSError, "connection lost"):
                updater.download_update("27.1.1-dev.1", "linux", Path(folder), "development")
            self.assertFalse((Path(folder) / "LCARS.AppImage.part").exists())
            self.assertTrue(updater._DOWNLOAD_LOCK.acquire(blocking=False))
            updater._DOWNLOAD_LOCK.release()


if __name__ == "__main__":
    unittest.main()
