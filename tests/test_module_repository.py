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
            self.assertTrue((target/"SHA256SUMS.txt").is_file())
            catalog=json.loads((target/"catalog.json").read_text(encoding="utf-8"))
            self.assertEqual(catalog["modules"][0]["sha256"],result["sha256"])
            self.assertIn("operator/modules",catalog["modules"][0]["manifestUrl"])


if __name__=="__main__":unittest.main()
