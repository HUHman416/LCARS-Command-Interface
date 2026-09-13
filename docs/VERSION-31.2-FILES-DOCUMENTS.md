# Version 31.2 Development — Files and Documents 2.0

Version 31.2 upgrades the existing Files and Document surfaces in place. It does not replace working Version 30 media playback, previews, search, or safe text saving.

## Existing capability audit

Before this milestone, LCARS already browsed the operator home, created folders, previewed images and text, copied or moved one item, opened audio and video in the integrated Media deck, and read PDF, DOCX, ODT, RTF, Markdown, and plain-text formats without automatically launching a host application. Editable text documents already used atomic replacement on Save.

The missing daily workflows were tabbed navigation, breadcrumbs, Recent and Places, sorting, true batch selection, rename and duplicate, detailed properties, explicit conflict resolution, configurable default applications, Trash and recovery, archives, network shares, progress/cancellation, reversible history, document find/replace, crash recovery, metadata, and print/export routes.

## Files command station

- Up to six live folder tabs with independent paths and compact horizontal controls.
- Breadcrumb navigation, Home/Document/Downloads/Desktop Places, mounted-network Places, current-folder filtering, hidden-file control, and Name/Modified/Size/Type sorting.
- Multi-selection for copy, move, duplicate, archive, and Trash operations.
- LCARS-native dialogs for folder creation, rename, archive naming, and mounted Place entry.
- File metadata and per-extension default-application preferences.
- Portal-backed Open, Save, Select Folder, and Open With request routes.
- Explicit Rename, Replace, or Skip choices when a destination exists.

## Recoverable operations

- Operations run as bounded background jobs and report Queued, Running, Conflict, Completed, Cancelled, or Failed state.
- Long copies and archive work observe cancellation between bounded chunks or entries.
- LCARS Trash preserves original locations for restoration; Empty Trash requires an explicit irreversible confirmation.
- Completed rename, copy, move, duplicate, create-folder, archive, restore, and Trash operations retain bounded history and expose Reverse only where the stored action is safe to undo.
- ZIP, TAR, TAR.GZ, and TGZ extraction is limited to 5,000 entries and 2 GB, rejects path traversal, and refuses archive links.
- File choices remain within the operator home or a mounted Place explicitly added by the operator.

## Document Workspace 2.0

- Find and Replace All with keyboard access through Ctrl/Cmd+F; Ctrl/Cmd+S saves editable text.
- Debounced recovery drafts are stored separately from the source and offered only when newer than the saved document.
- Format, MIME type, size, timestamps, and path metadata are available without a host Properties window.
- Opening a document records it in Files Recent history.
- Save As and Print use the Version 31 Portal queue.
- Text, Markdown, and simple self-contained HTML exports use atomic local writes.

## Platform and safety notes

Linux and Windows bridges use the same file-operation and document-recovery services. Windows and Linux still report platform limitations truthfully. Version 31.2 does not silently grant applications broad filesystem access, register itself as a system-wide portal backend, or claim that every installed application can be embedded inside LCARS.
