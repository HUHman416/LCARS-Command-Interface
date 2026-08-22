# LCARS Extension API v2

LCARS extensions are declarative JSON modules. They do not execute arbitrary JavaScript or Python inside the interface. This keeps modules portable across Linux and Windows and lets the host enforce permissions, validate layouts, and isolate stored state.

Install an extension manually by placing a folder containing `lcars-module.json` in the user extension directory shown by **Updates → Extension Hub → Open Module Folder**, then select **Scan Extensions**. Bundled examples live in `extensions/stardate-clock` and `extensions/mission-timer`.

## Version 26.1 Module Repository

Version 26.1 adds a trusted, download-only module repository backed by the repository's dedicated `Modules` branch. The Extension Hub reads `catalog.json` from that branch and merges those downloadable entries with bundled and locally installed modules.

Repository modules remain declarative data only. LCARS accepts module download URLs only from the trusted `Modules` branch, limits remote payload size, verifies the catalog SHA-256 before installation, validates the downloaded manifest with the same API v2 validator used for local modules, and requires the manifest ID and version to match the catalog entry. Installation writes only the validated `lcars-module.json` into that module's isolated extension directory; no archive extraction or executable plug-in code is involved.

The repository is intentionally download-only in 26.1. Module creation, publishing, and arbitrary third-party repository configuration are outside this first implementation.

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

Version 25 added the searchable Extension Hub, local enable/disable controls, and guarded removal of non-bundled modules. Users can assign an extension Overview placement to the Speed Dial or mount a compatible placement as a persistent custom sidebar page. Version 26.1 extends that hub with the trusted remote catalog while retaining the same capability restrictions in every host surface.
