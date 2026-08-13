#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location("lcars_bridge",ROOT/"local/lcars_bridge.py")
BRIDGE=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BRIDGE)

class KScreenParserTests(unittest.TestCase):
    def test_plasma_ansi_two_monitor_output(self):
        sample=(
            "\x1b[1mOutput:\x1b[0m 1 HDMI-A-3 2dee87d1\n"
            "        \x1b[1menabled\x1b[0m\n"
            "        \x1b[1mconnected\x1b[0m\n"
            "        \x1b[1mpriority 1\x1b[0m\n"
            "        \x1b[1mGeometry:\x1b[0m 1920,0 1920x1080\n"
            "        \x1b[1mHDR:\x1b[0m disabled\n"
            "\x1b[1mOutput:\x1b[0m 2 HDMI-A-2 d9e3e7d7\n"
            "        \x1b[1menabled\x1b[0m\n"
            "        \x1b[1mconnected\x1b[0m\n"
            "        \x1b[1mpriority 2\x1b[0m\n"
            "        \x1b[1mGeometry:\x1b[0m 0,0 1920x1080\n"
            "        \x1b[1mWide Color Gamut:\x1b[0m disabled\n"
        )
        displays=BRIDGE.parse_kscreen_output(sample)
        self.assertEqual([item["name"] for item in displays],["HDMI-A-3","HDMI-A-2"])
        self.assertTrue(all(item["enabled"] for item in displays))
        self.assertEqual([item["primary"] for item in displays],[True,False])
        self.assertEqual(displays[0]["geometry"],"1920,0 · 1920x1080")
        self.assertEqual(displays[1]["geometry"],"0,0 · 1920x1080")
        self.assertTrue(all(item["source"]=="KScreen + DRM" for item in displays))

if __name__=="__main__":
    unittest.main()
