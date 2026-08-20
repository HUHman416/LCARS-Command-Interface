!include "nsDialogs.nsh"
!include "LogicLib.nsh"

!ifndef BUILD_UNINSTALLER
Var LcarsAutostartCheckbox
Var LcarsAutostartEnabled
Var LcarsResetCheckbox
Var LcarsResetEnabled

Function LcarsAutostartPage
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 0 100% 26u "LCARS desktop integration"
  Pop $0
  ${NSD_CreateCheckbox} 0 34u 100% 24u "Start LCARS Command Interface when I sign in"
  Pop $LcarsAutostartCheckbox
  ${NSD_Uncheck} $LcarsAutostartCheckbox
  IfFileExists "$SMSTARTUP\LCARS Command Interface.lnk" 0 +2
    ${NSD_Check} $LcarsAutostartCheckbox
  ${NSD_CreateCheckbox} 0 68u 100% 24u "Reset existing LCARS settings, profiles, and installed extensions"
  Pop $LcarsResetCheckbox
  ${NSD_Uncheck} $LcarsResetCheckbox
  ${NSD_CreateLabel} 0 102u 100% 36u "The installer always creates a Start Menu shortcut, so LCARS is searchable from the Windows taskbar. Both choices apply only to this Windows account."
  Pop $0
  nsDialogs::Show
FunctionEnd

Function LcarsAutostartPageLeave
  ${NSD_GetState} $LcarsAutostartCheckbox $LcarsAutostartEnabled
  ${NSD_GetState} $LcarsResetCheckbox $LcarsResetEnabled
FunctionEnd

!macro customPageAfterChangeDir
  Page custom LcarsAutostartPage LcarsAutostartPageLeave
!macroend

!macro customInstall
  ${If} $LcarsResetEnabled == ${BST_CHECKED}
    RMDir /r "$APPDATA\LCARS Command Interface"
    RMDir /r "$LOCALAPPDATA\LCARS Command Interface"
  ${EndIf}
  ${If} $LcarsAutostartEnabled == ${BST_CHECKED}
    CreateShortCut "$SMSTARTUP\LCARS Command Interface.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
  ${Else}
    Delete "$SMSTARTUP\LCARS Command Interface.lnk"
  ${EndIf}
  nsExec::ExecToLog 'powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\windows\install-runtime.ps1"'
  Pop $0
!macroend
!endif

!ifdef BUILD_UNINSTALLER
!macro customUnInstall
  Delete "$SMSTARTUP\LCARS Command Interface.lnk"
  ${IfNot} ${Silent}
    MessageBox MB_YESNO|MB_ICONQUESTION "Also remove LCARS settings, profiles, and installed extensions?" IDNO lcarsKeepUserData
    RMDir /r "$APPDATA\LCARS Command Interface"
    RMDir /r "$LOCALAPPDATA\LCARS Command Interface"
    lcarsKeepUserData:
  ${EndIf}
!macroend
!endif
