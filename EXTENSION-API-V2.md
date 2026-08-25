# LCARS Extension API v2

LCARS extensions are declarative JSON modules. They do not execute arbitrary JavaScript or Python inside the interface. This keeps modules portable across Linux and Windows and lets the host enforce permissions, validate layouts, and isolate stored state.

Install an extension manually by placing a folder containing `lcars-module.json` in the user extension directory shown by **Updates → Extension Hub → Open Module Folder**, then select **Scan Extensions**. Bundled examples live in `extensions/stardate-clock` and `extensions/mission-timer`.

## Version 26.3 Module Repository

Version 26.1 added the official, download-only module repository backed by the project's dedicated `Modules` branch. Version 26.2 added operator-configured public GitHub repositories. Version 26.3 includes those community sources in the main LCARS configuration backup and restore flow. Each community repository exposes a root `catalog.json`; LCARS labels it as community content and lets the operator add, disable, refresh, diagnose, or remove the source.

Repository modules remain declarative data only. LCARS accepts public `https://github.com/OWNER/REPOSITORY` source URLs without credentials or tokens. Catalog and manifest downloads are confined to that same repository, remote payload size is limited, SHA-256 is verified before installation, and the downloaded manifest must pass the same API v2 validator used for local modules with a matching ID and version. Installation writes only `lcars-module.json` into that module's isolated extension directory; no archive extraction or executable plug-in code is involved.

Module Publisher can validate an installed module and generate a repository-ready `catalog.json`, `SHA256SUMS.txt`, README, and `modules/ID/lcars-module.json` folder. It does not push code or collect GitHub credentials; the operator creates a public repository and uploads the generated files through GitHub.

## Manifest outline

```json
{
  "apiVersion": 2,
  "id": "example-timer",
  "name": "Example Timer",
  "version": "1.0.0",
  "capabilities": ["time-date"],
  "settings": [],
  "placements": [{
    "id": "timer",
    "type": "overview",
    "title": "MISSION TIMER",
    "ui": [{"type": "timer", "id": "elapsed", "label": "ELAPSED"}]
  }]
}
```

Supported placement types are `overview`, `header`, `page`, `tray`, and `panel`. Each placement's `ui` array accepts `text`, `button`, `input`, `toggle`, `list`, `progress`, `clock`, `timer`, `tabs`, and `grid` primitives. Unknown placements, primitives, capabilities, and malformed fields are rejected by the local bridge.

State is namespaced by extension ID, stored as JSON, and limited to 64 KiB per extension. Declared settings are rendered by LCARS. A module should request only the capabilities it needs. Existing API v1 mission-checklist modules are normalized into the v2 host and remain usable.

The API is intentionally data-only. Extensions may compose host-provided controls and actions, but cannot inject scripts, access arbitrary files, or bypass LCARS protected-action prompts.

Version 25 added the searchable Extension Hub, local enable/disable controls, and guarded removal of non-bundled modules. Users can assign an extension Overview placement to the Speed Dial or mount a compatible placement as a persistent custom sidebar page. Version 26.1 added the official remote catalog; Version 26.2 adds constrained community catalogs and the publisher helper while retaining the same capability restrictions in every host surface.
