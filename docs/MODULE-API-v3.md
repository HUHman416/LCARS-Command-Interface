# LCARS Extension API v3

Extension API v3 is the stable declarative module contract introduced in LCARS Command Interface Version 30.3. Modules are JSON manifests rendered by the LCARS host. Repository packages cannot provide executable JavaScript, Python, shell, native libraries, or Android code.

## Compatibility contract

- API v3 is Stable for the Version 30 release line.
- API v2 remains supported through the compatibility renderer.
- Legacy schema v1 checklist modules are migrated by the host.
- Unknown manifest fields are ignored; invalid known fields reject the package.
- An API v3 repository package must have a valid RSA-SHA256 publisher signature.
- Local drafts may be loaded unsigned and are labeled `LOCAL` until exported or published.

## Minimal manifest

```json
{
  "apiVersion": 3,
  "id": "example-module",
  "name": "Example Module",
  "version": "1.0.0",
  "description": "A host-rendered LCARS module.",
  "author": "LCARS Operator",
  "minimumLcarsVersion": "30.3",
  "capabilities": [],
  "settings": [],
  "placements": [
    {
      "id": "primary",
      "type": "overview",
      "title": "Example Module",
      "defaultSize": "standard",
      "ui": [{ "type": "text", "id": "status", "text": "READY" }]
    }
  ]
}
```

IDs use lowercase kebab case. Versions use semantic versioning. Placement IDs and setting keys must be unique inside a manifest.

## Host-rendered UI

Supported placements are `overview`, `header`, `page`, `tray`, and `panel`. Supported primitives are `text`, `button`, `input`, `toggle`, `list`, `progress`, `clock`, `timer`, `tabs`, and `grid`. Nesting is limited to five levels, every collection is bounded, module state is namespaced, and each renderer is isolated by an LCARS error boundary.

## Capabilities

Modules declare every host capability they may use. The operator sees the list before installation or import and may later revoke individual grants.

| Capability | Host access |
| --- | --- |
| `time-date` | Local date and time |
| `system-read` | Read-only system telemetry |
| `notifications` | Create LCARS notices |
| `safe-files` | Operator-selected files only |
| `app-launch` | Launch inventoried applications |
| `network-read` | Read network status |
| `media-read` | Read media session metadata |
| `media-control` | Control media playback |

A revoked capability remains unavailable to the module. Declaring a capability does not grant it.

## Package trust and channels

Module Forge creates a persistent local RSA publisher identity. Exported `.lcars-module` files and generated repository catalogs include a signature over the module ID, semantic version, and SHA-256 digest. The private signing key remains outside packages and repositories.

Repositories may expose:

- `catalog.json` for Stable packages.
- `catalog-development.json` for Development packages.

LCARS confines downloads to the declared public GitHub repository, checks the SHA-256 digest, verifies the publisher signature, validates the manifest, displays requested capabilities, and only then installs the module.

The first signed installation records the publisher key ID. Updates and in-place imports must retain that signer. A changed publisher identity is rejected; the operator must independently verify the new signer and deliberately remove/reinstall the module.

## Lifecycle and recovery

- Updating a local module preserves the previous manifest for one-step rollback.
- Importing over an existing module also preserves the previous manifest.
- Render failures are recorded in the Module Platform health matrix.
- Repeated failures quarantine only the affected module.
- Safe Mode starts without extension modules while preserving their data.
- Portable package imports are limited to 2 MiB and exactly two bounded files: `lcars-module.json` and `package.json`.

Use Updates → Module Platform → Module Forge to create a draft, preview its identity and capabilities, export a signed portable package, or generate a signed Stable/Development GitHub repository.
