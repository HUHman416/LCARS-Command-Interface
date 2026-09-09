import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location("lcars_bridge_session",ROOT/"local/lcars_bridge.py")
BRIDGE=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BRIDGE)


class SessionAuthorityTests(unittest.TestCase):
    def test_legacy_kiosk_setting_migrates_to_authoritative_mode(self):
        original=BRIDGE.SESSION_CONFIG_FILE
        try:
            with tempfile.TemporaryDirectory() as folder:
                BRIDGE.SESSION_CONFIG_FILE=Path(folder)/"session.json"
                BRIDGE.SESSION_CONFIG_FILE.write_text(json.dumps({"kiosk":True}),encoding="utf-8")
                config=BRIDGE.load_session_config()
                self.assertTrue(config["authoritative"])
                self.assertTrue(config["kiosk"])
                self.assertTrue(config["continuousPlacement"])
        finally:
            BRIDGE.SESSION_CONFIG_FILE=original

    def test_new_authoritative_setting_remains_explicitly_opt_in(self):
        original=BRIDGE.SESSION_CONFIG_FILE
        try:
            with tempfile.TemporaryDirectory() as folder:
                BRIDGE.SESSION_CONFIG_FILE=Path(folder)/"session.json"
                config=BRIDGE.load_session_config()
                self.assertFalse(config["authoritative"])
                saved=BRIDGE.save_session_config({"authoritative":True,"continuousPlacement":False})
                self.assertTrue(saved["authoritative"])
                self.assertTrue(saved["kiosk"])
                self.assertFalse(saved["continuousPlacement"])
        finally:
            BRIDGE.SESSION_CONFIG_FILE=original


if __name__=="__main__":
    unittest.main()
