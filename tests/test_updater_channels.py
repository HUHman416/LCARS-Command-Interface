import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"shared"))
import lcars_updater as updater


class UpdaterChannelTests(unittest.TestCase):
    def test_letter_stable_releases_sort_after_the_base_major(self):
        self.assertGreater(updater._release_key("v25-B"),updater._release_key("v25"))
        self.assertGreater(updater._release_key("v26"),updater._release_key("v25-B"))

    def test_development_candidate_can_transition_to_same_major_stable(self):
        release={"tag_name":"v26","draft":False,"prerelease":False,"html_url":"https://github.com/example/releases/v26","assets":[]}
        with patch.object(updater,"_release_for_channel",return_value=release):
            result=updater.check_update("26.2.0-dev.1","linux","stable-release")
        self.assertTrue(result["available"])
        self.assertTrue(result["stableTransition"])
        self.assertEqual(result["channel"],"stable")

    def test_older_stable_major_is_not_offered_to_newer_development_candidate(self):
        release={"tag_name":"v25-B","draft":False,"prerelease":False,"html_url":"https://github.com/example/releases/v25-B","assets":[]}
        with patch.object(updater,"_release_for_channel",return_value=release):
            result=updater.check_update("26.2.0-dev.1","windows","stable-release")
        self.assertFalse(result["available"])


if __name__=="__main__":unittest.main()
