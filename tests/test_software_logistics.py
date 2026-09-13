import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace

from shared.lcars_software import SoftwareLogistics


class Process:
    def __init__(self):
        self.stdout=iter(["Installing org.example.App\n","Complete\n"]);self.pid=12345
    def wait(self):return 0
    def poll(self):return None
    def terminate(self):return None


class SoftwareLogisticsTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.commands=[]
        def runner(argv,**kwargs):
            self.commands.append(argv)
            if argv[:2]==["flatpak","remotes"]:return SimpleNamespace(returncode=0,stdout="flathub\thttps://flathub.org/repo/flathub.flatpakrepo\t\n",stderr="")
            if argv[:2]==["flatpak","search"]:return SimpleNamespace(returncode=0,stdout="org.example.App\tExample\tExample package\t1.0\tflathub\n",stderr="")
            if argv[:2]==["flatpak","info"]:return SimpleNamespace(returncode=1,stdout="",stderr="not installed")
            if "--assumeno" in argv:return SimpleNamespace(returncode=1,stdout="Install: org.example.App\nDownload Size: 12 MiB\n",stderr="")
            return SimpleNamespace(returncode=0,stdout="",stderr="")
        self.service=SoftwareLogistics(Path(self.temp.name),"linux",runner=runner,popen=lambda argv,**kwargs:Process(),which=lambda name:f"/usr/bin/{name}" if name=="flatpak" else None)

    def tearDown(self):self.temp.cleanup()

    def test_detects_only_real_capabilities_and_never_returns_shell_command(self):
        status=self.service.status(False)
        self.assertEqual([item["id"] for item in status["managers"]],["flatpak"])
        self.assertEqual(status["command"],"")
        self.assertTrue(status["sources"][0]["mutable"])

    def test_search_details_and_reviewed_transaction(self):
        result=self.service.search("example","flatpak")["results"][0]
        self.assertEqual(result["id"],"org.example.App")
        details=self.service.details("flatpak",result["id"])
        self.assertIsNone(details["downloadSize"])
        plan=self.service.plan("install","flatpak",result["id"])["plan"]
        self.assertEqual(plan["storageImpact"],12*1048576)
        with self.assertRaises(PermissionError):self.service.start({"token":plan["token"],"confirmed":False})
        response=self.service.start({"token":plan["token"],"confirmed":True})
        self.assertIn(response["job"]["status"],("queued","running","completed"))
        for _ in range(50):
            job=self.service.job(response["job"]["id"])
            if job["status"] not in ("queued","running"):break
            time.sleep(.01)
        self.assertEqual(job["status"],"completed")
        self.assertTrue(all(isinstance(command,list) for command in self.commands))

    def test_rejects_injection_and_unreviewed_source_changes(self):
        with self.assertRaises(ValueError):self.service.plan("install","flatpak","--command=bad")
        with self.assertRaises(PermissionError):self.service.source_action({"action":"add","manager":"flatpak","name":"test","url":"https://example.invalid/repo","confirmed":False})
        with self.assertRaises(ValueError):self.service.source_action({"action":"add","manager":"flatpak","name":"test","url":"http://example.invalid/repo","confirmed":True})


if __name__=="__main__":unittest.main()
