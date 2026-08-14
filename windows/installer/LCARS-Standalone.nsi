Unicode True
!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!ifndef APP_SOURCE
  !error "APP_SOURCE is required"
!endif
!ifndef PROJECT_DIR
  !error "PROJECT_DIR is required"
!endif
!ifndef OUTPUT_FILE
  !define OUTPUT_FILE "LCARS-Windows-Setup-v23.exe"
!endif
Name "LCARS Command Interface"
OutFile "${OUTPUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\LCARS Command Interface"
InstallDirRegKey HKCU "Software\LCARS Command Interface" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
BrandingText "LCARS Command Interface v23"
Icon "${PROJECT_DIR}/desktop/icons/lcars-command-interface.ico"
UninstallIcon "${PROJECT_DIR}/desktop/icons/lcars-command-interface.ico"
Var ResetCheckbox
Var ResetSettings
Var StartupCheckbox
Var StartWithWindows
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\LCARS Command Interface.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch LCARS Command Interface"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
Page custom SettingsPage SettingsPageLeave
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
Function SettingsPage
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 0 100% 28u "Optional LCARS installation settings"
  Pop $0
  ${NSD_CreateCheckbox} 0 38u 100% 30u "Remove existing settings, profiles, themes, notification history, and extensions"
  Pop $ResetCheckbox
  ${NSD_Uncheck} $ResetCheckbox
  ${NSD_CreateLabel} 0 72u 100% 24u "Leave unchecked to preserve your current LCARS customization."
  Pop $0
  ${NSD_CreateCheckbox} 0 108u 100% 24u "Start LCARS automatically when I sign in"
  Pop $StartupCheckbox
  ${NSD_Uncheck} $StartupCheckbox
  nsDialogs::Show
FunctionEnd
Function SettingsPageLeave
  ${NSD_GetState} $ResetCheckbox $ResetSettings
  ${NSD_GetState} $StartupCheckbox $StartWithWindows
FunctionEnd
Section "Install"
  nsExec::ExecToLog 'taskkill.exe /IM "LCARS Command Interface.exe" /F'
  Pop $0
  ${If} $ResetSettings == ${BST_CHECKED}
    RMDir /r "$APPDATA\LCARS Command Interface"
    RMDir /r "$LOCALAPPDATA\LCARS Command Interface"
  ${EndIf}
  SetOutPath "$INSTDIR"
  File /r "${APP_SOURCE}\*.*"
  WriteRegStr HKCU "Software\LCARS Command Interface" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LCARS Command Interface" "DisplayName" "LCARS Command Interface"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LCARS Command Interface" "DisplayVersion" "23.0.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LCARS Command Interface" "DisplayIcon" "$INSTDIR\resources\icons\lcars-command-interface.ico"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LCARS Command Interface" "UninstallString" '"$INSTDIR\Uninstall LCARS.exe"'
  WriteUninstaller "$INSTDIR\Uninstall LCARS.exe"
  CreateDirectory "$SMPROGRAMS\LCARS Command Interface"
  CreateShortcut "$SMPROGRAMS\LCARS Command Interface\LCARS Command Interface.lnk" "$INSTDIR\LCARS Command Interface.exe" "" "$INSTDIR\resources\icons\lcars-command-interface.ico"
  CreateShortcut "$DESKTOP\LCARS Command Interface.lnk" "$INSTDIR\LCARS Command Interface.exe" "" "$INSTDIR\resources\icons\lcars-command-interface.ico"
  ${If} $StartWithWindows == ${BST_CHECKED}
    CreateShortcut "$SMSTARTUP\LCARS Command Interface.lnk" "$INSTDIR\LCARS Command Interface.exe" "" "$INSTDIR\resources\icons\lcars-command-interface.ico"
  ${Else}
    Delete "$SMSTARTUP\LCARS Command Interface.lnk"
  ${EndIf}
  nsExec::ExecToLog 'powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\windows\install-runtime.ps1"'
  Pop $0
SectionEnd
Section "Uninstall"
  nsExec::ExecToLog 'taskkill.exe /IM "LCARS Command Interface.exe" /F'
  Pop $0
  MessageBox MB_YESNO|MB_ICONQUESTION "Also remove LCARS settings and profiles?" IDNO KeepData
  RMDir /r "$APPDATA\LCARS Command Interface"
  RMDir /r "$LOCALAPPDATA\LCARS Command Interface"
  KeepData:
  Delete "$DESKTOP\LCARS Command Interface.lnk"
  Delete "$SMSTARTUP\LCARS Command Interface.lnk"
  RMDir /r "$SMPROGRAMS\LCARS Command Interface"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LCARS Command Interface"
  DeleteRegKey HKCU "Software\LCARS Command Interface"
  RMDir /r "$INSTDIR"
SectionEnd
