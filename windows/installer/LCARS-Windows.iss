#define MyAppName "LCARS Windows Command Interface"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "LCARS Command Interface Project"
#define MyAppExeName "Start-LCARS-Windows.cmd"

[Setup]
AppId={{A1A6A5A4-AC7B-4B60-AF43-CB3839891688}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\LCARS Command Interface
DefaultGroupName=LCARS Command Interface
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=output
OutputBaseFilename=LCARS-Windows-Setup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
RestartApplications=no

[Files]
Source: "..\..\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "node_modules\*,dist\*,.git\*,.npm-cache\*,.sites-runtime\*,windows\installer\output\*"

[Icons]
Name: "{group}\LCARS Command Interface"; Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\start-windows.ps1"""; WorkingDir: "{app}"
Name: "{group}\LCARS Recovery - Stop Services"; Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\stop-windows.ps1"""; WorkingDir: "{app}"
Name: "{userstartup}\LCARS Command Interface"; Filename: "powershell.exe"; Parameters: "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File ""{app}\start-windows.ps1"""; WorkingDir: "{app}"; Tasks: startup

[Tasks]
Name: "startup"; Description: "Start LCARS automatically when I sign in"; GroupDescription: "Desktop integration:"; Flags: checkedonce

[Run]
Filename: "powershell.exe"; Parameters: "-NoLogo -NoProfile -ExecutionPolicy Bypass -File ""{app}\install-windows.ps1"" -SkipStartup"; WorkingDir: "{app}"; StatusMsg: "Installing LCARS prerequisites and local core..."; Flags: waituntilterminated
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\start-windows.ps1"""; WorkingDir: "{app}"; Description: "Launch LCARS Command Interface"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\stop-windows.ps1"" -Quiet"; Flags: runhidden waituntilterminated
