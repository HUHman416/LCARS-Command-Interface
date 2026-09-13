# Version 31.1 Development — LCARS Portal and Intent Broker

Version 31.1 begins the self-sufficient Version 31 desktop line with a shared request boundary between applications, LCARS, and the host.

## Delivered

- A dedicated, numbered Portal Center page with Requests, Routes, and Validate stations.
- A loopback-only broker shared by Linux and Windows bridges.
- Eleven typed routes: Open File, Save File, Open Folder, Open With, Authorization, Notification, Microphone, Camera, Screen Share, Print, and Share.
- Operator approval and denial with request details, source application, timestamp, result, and reason.
- An LCARS file/folder/application chooser for requests that need a specific destination; Open With results are checked against the current installed-application inventory.
- Ask, Allow, and Deny policies for ordinary routes. Authorization, microphone, camera, screen sharing, printing, and sharing cannot be silently allowed.
- Two-minute expiration, 150-entry bounded history, 8 KiB payload limits, and home-directory containment for returned file paths.
- Electron microphone, camera, notification, and display-capture permission routing through the broker.
- `session/lcars-portal-client`, a small local command-line client for compatible applications and future adapters.
- An opt-in XDG adapter switch that reports actual desktop availability. It does not claim system-wide registration yet.

## Security model

The Local Core continues to listen on `127.0.0.1`. The broker accepts only known intent types and small JSON context. It never accepts shell commands. Applications may submit and cancel their own requests, while approvals and policy changes require a random, per-launch authority held by the trusted LCARS window. Sensitive routes always remain operator-reviewed, file results stay beneath the active operator home directory, unanswered requests expire, and completed history is bounded.

## Development validation

The Portal Center includes harmless route validators. These create requests but do not open files, capture devices, print, share data, or execute protected operations. They exist to verify queueing, policy, approval, denial, expiration, and history without changing the host.
