import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"shared"))
import lcars_extensions as extensions


class ModuleRepositoryTests(unittest.TestCase):
    def test_public_github_source_registry_is_strict_and_persistent(self):
        with tempfile.TemporaryDirectory() as folder:
            source_file=Path(folder)/"module-sources.json"
            result=extensions.repository_source_operation(source_file,"add","https://github.com/example/lcars-modules")
            self.assertTrue(result["ok"])
            sources=extensions.repository_sources(source_file)
            self.assertEqual([item["id"] for item in sources],["official","community-example-lcars-modules"])
            self.assertFalse(sources[1]["official"])
            extensions.repository_source_operation(source_file,"disable",ident=sources[1]["id"])
            self.assertFalse(extensions.repository_sources(source_file)[1]["enabled"])
            for invalid in ("http://github.com/example/repo","https://gitlab.com/example/repo","https://github.com/example/repo/tree/main","https://token@github.com/example/repo"):
                with self.assertRaises(ValueError):extensions.repository_source_operation(source_file,"add",invalid)

    def test_community_downloads_cannot_leave_the_declared_repository(self):
        source=extensions._github_source("https://github.com/example/lcars-modules")
        self.assertTrue(extensions._source_url("https://raw.githubusercontent.com/example/lcars-modules/main/modules/demo/lcars-module.json",source))
        self.assertFalse(extensions._source_url("https://raw.githubusercontent.com/attacker/other/main/payload.json",source))

    def test_publisher_generates_a_complete_checksum_verified_repository(self):
        manifest={"apiVersion":2,"id":"publisher-demo","name":"Publisher Demo","version":"1.2.3","description":"Safe declarative demo","author":"Test Operator","capabilities":[],"settings":[],"placements":[{"id":"primary","type":"overview","title":"Publisher Demo","ui":[{"type":"text","text":"Ready"}]}]}
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);extension_dir=root/"extensions";module_dir=extension_dir/manifest["id"];module_dir.mkdir(parents=True)
            (module_dir/"lcars-module.json").write_text(json.dumps(manifest),encoding="utf-8")
            result=extensions.prepare_module_publication(extension_dir,None,root/"publisher",manifest["id"],"operator/modules")
            target=Path(result["path"])
            self.assertTrue((target/"README.md").is_file())
            self.assertTrue((target/"catalog.json").is_file())
            self.assertTrue((target/"catalog-development.json").is_file())
            self.assertTrue((target/"SHA256SUMS.txt").is_file())
            catalog=json.loads((target/"catalog.json").read_text(encoding="utf-8"))
            self.assertEqual(catalog["schemaVersion"],2)
            self.assertEqual(catalog["modules"][0]["sha256"],result["sha256"])
            self.assertIn("operator/modules",catalog["modules"][0]["manifestUrl"])
            payload=(target/"modules"/manifest["id"]/"lcars-module.json").read_bytes()
            self.assertTrue(extensions._signature_state(catalog["modules"][0],payload)["verified"])

    def test_stable_v3_contract_permissions_health_and_rollback(self):
        manifest={"apiVersion":3,"id":"platform-demo","name":"Platform Demo","version":"1.0.0","description":"Stable contract","author":"Test Operator","minimumLcarsVersion":"30.3","capabilities":["time-date","network-read"],"settings":[],"placements":[{"id":"primary","type":"overview","title":"Platform Demo","ui":[{"type":"clock","id":"clock","source":"local"}]}]}
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);extension_dir=root/"extensions";module_dir=extension_dir/manifest["id"];module_dir.mkdir(parents=True);runtime=root/"runtime"
            (module_dir/"lcars-module.json").write_text(json.dumps(manifest),encoding="utf-8")
            status=extensions.module_platform_status(extension_dir,None,runtime)
            self.assertEqual(status["platform"]["apiVersion"],3)
            self.assertEqual(status["platform"]["contract"],"stable")
            self.assertEqual(status["extensions"][0]["grantedCapabilities"],manifest["capabilities"])
            permissions=extensions.module_platform_operation(extension_dir,None,runtime,"permissions",manifest["id"],["time-date"])
            self.assertEqual(permissions["grantedCapabilities"],["time-date"])
            failure=extensions.module_platform_operation(extension_dir,None,runtime,"failure",manifest["id"],detail="test renderer exception")
            self.assertEqual(failure["health"]["status"],"isolated")
            previous={**manifest,"version":"0.9.0"};(module_dir/".previous-lcars-module.json").write_text(json.dumps(previous),encoding="utf-8")
            restored=extensions.module_platform_operation(extension_dir,None,runtime,"rollback",manifest["id"])
            self.assertEqual(restored["version"],"0.9.0")

    def test_repository_sources_keep_stable_and_development_channels_separate(self):
        with tempfile.TemporaryDirectory() as folder:
            source_file=Path(folder)/"module-sources.json"
            added=extensions.repository_source_operation(source_file,"add","https://github.com/example/channel-modules",channel="development")
            source=added["source"]
            self.assertEqual(source["channel"],"development")
            self.assertTrue(source["catalogUrl"].endswith("catalog-development.json"))
            changed=extensions.repository_source_operation(source_file,"channel",ident=source["id"],channel="stable")
            self.assertEqual(changed["sources"][1]["channel"],"stable")
            self.assertTrue(changed["sources"][1]["catalogUrl"].endswith("catalog.json"))

    def test_portable_package_round_trip_preserves_signature_and_permissions(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);source=root/"source";destination=root/"destination";publisher=root/"publisher";runtime=root/"runtime"
            draft=extensions.create_module_draft(source,{"id":"portable-demo","name":"Portable Demo","version":"1.0.0","capabilities":["time-date"],"text":"PACKAGE READY"})
            exported=extensions.module_package_operation(source,None,publisher,runtime,"export",ident=draft["id"])
            inspected=extensions.module_package_operation(destination,None,publisher,runtime,"inspect",path_value=exported["path"])
            self.assertEqual(inspected["signature"]["status"],"verified")
            self.assertEqual(inspected["capabilities"],["time-date"])
            imported=extensions.module_package_operation(destination,None,publisher,runtime,"import",path_value=exported["path"],approved_capabilities=["time-date"])
            self.assertTrue((destination/"portable-demo"/"lcars-module.json").is_file())
            self.assertEqual(imported["signature"]["keyId"],exported["signerKeyId"])
            status=extensions.module_platform_status(destination,None,runtime)
            self.assertEqual(status["records"][0]["grantedCapabilities"],["time-date"])


if __name__=="__main__":unittest.main()
