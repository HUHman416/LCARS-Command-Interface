# LCARS 30.1 offline voice runtime

Release packaging downloads the official `whisper.cpp` `b4938` x64 binary for the target desktop platform and the English `tiny.en-q5_1` converted model. Both downloads are pinned and verified before packaging. Generated binaries and model weights are intentionally excluded from source control.

LCARS records mono PCM WAV directly, so the bundled path does not require FFmpeg. A custom whisper.cpp executable and model can still be selected in Settings. FFmpeg is used only as a compatibility fallback for older non-WAV microphone samples.

The bundled voice runtime is desktop-only in Version 30.1. A trusted PADD can submit commands through its paired station, but fully local Android inference is not included in this development milestone.
