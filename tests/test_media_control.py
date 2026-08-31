#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
BRIDGE=None
if sys.platform != "win32":
    SPEC=importlib.util.spec_from_file_location("lcars_bridge_media",ROOT/"local/lcars_bridge.py")
    BRIDGE=importlib.util.module_from_spec(SPEC)
    SPEC.loader.exec_module(BRIDGE)

@unittest.skipIf(sys.platform == "win32", "playerctl selection is a Linux bridge test")
class MediaControlTests(unittest.TestCase):
    def completed(self,args,code=0,out="",error=""):
        return subprocess.CompletedProcess(args,code,out,error)

    @patch("shutil.which",return_value="/usr/bin/playerctl")
    def test_resume_prefers_paused_session_and_uses_explicit_play(self,_which):
        calls=[];states={"chromium":"Stopped","spotify":"Paused"}
        def run(args,**_kwargs):
            calls.append(args)
            if args==["playerctl","-l"]:return self.completed(args,out="chromium\nspotify\n")
            player=args[2] if len(args)>2 else ""
            if args[-1]=="status":return self.completed(args,out=states.get(player,"Stopped")+"\n")
            if args[-1]=="play":states[player]="Playing"
            return self.completed(args)
        with patch.object(BRIDGE.subprocess,"run",side_effect=run):result=BRIDGE.media_control("","play")
        self.assertTrue(result["ok"])
        self.assertEqual(result["player"],"spotify")
        self.assertIn(["playerctl","--player","spotify","play"],calls)
        self.assertNotIn(["playerctl","--player","spotify","play-pause"],calls)

    @patch("shutil.which",return_value="/usr/bin/playerctl")
    def test_rejected_named_player_does_not_control_another_source(self,_which):
        calls=[]
        def run(args,**_kwargs):
            calls.append(args)
            if args==["playerctl","-l"]:return self.completed(args,out="chromium\nspotify\n")
            if args[-1]=="status":return self.completed(args,out="Paused\n")
            if "chromium" in args:return self.completed(args,code=1,error="Player rejected command")
            return self.completed(args)
        with patch.object(BRIDGE.subprocess,"run",side_effect=run):result=BRIDGE.media_control("chromium","play")
        self.assertFalse(result["ok"])
        self.assertIn("chromium",result["error"])
        self.assertNotIn(["playerctl","--player","spotify","play"],calls)

    @patch("shutil.which",return_value="/usr/bin/playerctl")
    def test_untargeted_resume_falls_back_when_first_session_rejects(self,_which):
        states={"chromium":"Paused","spotify":"Paused"}
        def run(args,**_kwargs):
            if args==["playerctl","-l"]:return self.completed(args,out="chromium\nspotify\n")
            player=args[2] if len(args)>2 else ""
            if args[-1]=="status":return self.completed(args,out=states.get(player,"Stopped")+"\n")
            if player=="chromium":return self.completed(args,code=1,error="Player rejected command")
            if args[-1]=="play":states[player]="Playing"
            return self.completed(args)
        with patch.object(BRIDGE.subprocess,"run",side_effect=run):result=BRIDGE.media_control("","play")
        self.assertTrue(result["ok"])
        self.assertEqual(result["player"],"spotify")

    @patch("shutil.which",return_value="/usr/bin/playerctl")
    def test_acknowledged_without_state_change_is_an_error(self,_which):
        def run(args,**_kwargs):
            if args==["playerctl","-l"]:return self.completed(args,out="spotify\n")
            if args[-1]=="status":return self.completed(args,out="Paused\n")
            return self.completed(args)
        with patch.object(BRIDGE.time,"sleep",return_value=None),patch.object(BRIDGE.subprocess,"run",side_effect=run):
            result=BRIDGE.media_control("spotify","play")
        self.assertFalse(result["ok"])
        self.assertIn("remained paused",result["error"])

    @patch("shutil.which",return_value="/usr/bin/playerctl")
    def test_no_sessions_returns_actionable_error(self,_which):
        with patch.object(BRIDGE.subprocess,"run",return_value=self.completed(["playerctl","-l"])):
            result=BRIDGE.media_control("","play")
        self.assertFalse(result["ok"])
        self.assertIn("No MPRIS media sessions",result["error"])

if __name__=="__main__":
    unittest.main()
