; SNARE Windows installer.
;
; Built by scripts/installer/build-installer.ps1, which invokes makensis with:
;   /DPRODUCT_VERSION=<package.json version>
;   /DSTAGE_DIR=<assembled staging tree: app/, runtime/, browsers/, tools/, launch/stop scripts>
;   /DOUTPUT_EXE=<output .exe path>
;
; Installs a fully self-contained SNARE (bundled Node.js runtime + Next.js
; standalone server + native better-sqlite3 binding + trimmed Playwright
; Chromium) — no npm, git, Node, or internet access required on the target
; host at install time.

!ifndef PRODUCT_VERSION
  !define PRODUCT_VERSION "0.0.0"
!endif
!ifndef STAGE_DIR
  !error "STAGE_DIR must be supplied via /DSTAGE_DIR=<path-to-staged-tree>"
!endif
!ifndef OUTPUT_EXE
  !define OUTPUT_EXE "SNARE-Setup-${PRODUCT_VERSION}.exe"
!endif

!define PRODUCT_NAME "SNARE"
!define PRODUCT_PUBLISHER "Webelo Solutions"
!define UNINSTALL_REG_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\SNARE"

!include "MUI2.nsh"
!include "LogicLib.nsh"

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "${OUTPUT_EXE}"
InstallDir "$PROGRAMFILES64\SNARE"
InstallDirRegKey HKLM "Software\SNARE" "InstallDir"
RequestExecutionLevel admin
ShowInstDetails show
ShowUninstDetails show

VIProductVersion "${PRODUCT_VERSION}.0"
VIAddVersionKey "ProductName" "${PRODUCT_NAME}"
VIAddVersionKey "ProductVersion" "${PRODUCT_VERSION}"
VIAddVersionKey "CompanyName" "${PRODUCT_PUBLISHER}"
VIAddVersionKey "FileDescription" "${PRODUCT_NAME} Setup"
VIAddVersionKey "LegalCopyright" "${PRODUCT_PUBLISHER}"

!define MUI_ABORTWARNING

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\launch-snare.cmd"
!define MUI_FINISHPAGE_RUN_TEXT "Launch SNARE now"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "English"

Section "SNARE Application (required)" SEC_APP
  SectionIn RO

  SetOutPath "$INSTDIR\app"
  File /r "${STAGE_DIR}\app\*.*"

  SetOutPath "$INSTDIR\runtime"
  File /r "${STAGE_DIR}\runtime\*.*"

  SetOutPath "$INSTDIR\browsers"
  File /r "${STAGE_DIR}\browsers\*.*"

  SetOutPath "$INSTDIR"
  File "${STAGE_DIR}\launch-snare.cmd"
  File "${STAGE_DIR}\launch-snare.ps1"
  File "${STAGE_DIR}\stop-snare.cmd"
  File "${STAGE_DIR}\stop-snare.ps1"

  CreateDirectory "$SMPROGRAMS\SNARE"
  CreateShortCut "$SMPROGRAMS\SNARE\Start SNARE.lnk" "$INSTDIR\launch-snare.cmd"
  CreateShortCut "$SMPROGRAMS\SNARE\Stop SNARE.lnk" "$INSTDIR\stop-snare.cmd"

  WriteRegStr HKLM "Software\SNARE" "InstallDir" "$INSTDIR"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateShortCut "$SMPROGRAMS\SNARE\Uninstall SNARE.lnk" "$INSTDIR\Uninstall.exe"

  WriteRegStr HKLM "${UNINSTALL_REG_KEY}" "DisplayName" "SNARE Domain Surveillance"
  WriteRegStr HKLM "${UNINSTALL_REG_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKLM "${UNINSTALL_REG_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr HKLM "${UNINSTALL_REG_KEY}" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "${UNINSTALL_REG_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKLM "${UNINSTALL_REG_KEY}" "NoModify" 1
  WriteRegDWORD HKLM "${UNINSTALL_REG_KEY}" "NoRepair" 1
SectionEnd

Section /o "Install as Windows Service (auto-start on boot)" SEC_SERVICE
  SetOutPath "$INSTDIR\tools"
  File "${STAGE_DIR}\tools\nssm.exe"
  CreateDirectory "$INSTDIR\service-logs"

  DetailPrint "Registering SNARE as a Windows service..."
  nsExec::ExecToLog '"$INSTDIR\tools\nssm.exe" install SNARE "$INSTDIR\runtime\node.exe" "$INSTDIR\app\server.js"'
  nsExec::ExecToLog '"$INSTDIR\tools\nssm.exe" set SNARE AppDirectory "$INSTDIR\app"'
  nsExec::ExecToLog '"$INSTDIR\tools\nssm.exe" set SNARE AppEnvironmentExtra "NODE_ENV=production" "PLAYWRIGHT_BROWSERS_PATH=$INSTDIR\browsers" "PORT=3000"'
  nsExec::ExecToLog '"$INSTDIR\tools\nssm.exe" set SNARE AppStdout "$INSTDIR\service-logs\stdout.log"'
  nsExec::ExecToLog '"$INSTDIR\tools\nssm.exe" set SNARE AppStderr "$INSTDIR\service-logs\stderr.log"'
  nsExec::ExecToLog '"$INSTDIR\tools\nssm.exe" set SNARE AppRotateFiles 1'
  nsExec::ExecToLog '"$INSTDIR\tools\nssm.exe" set SNARE AppRotateBytes 10485760'
  nsExec::ExecToLog '"$INSTDIR\tools\nssm.exe" set SNARE Start SERVICE_AUTO_START'
  nsExec::ExecToLog '"$INSTDIR\tools\nssm.exe" set SNARE AppExit Default Restart'
  nsExec::ExecToLog '"$INSTDIR\tools\nssm.exe" set SNARE AppRestartDelay 5000'
  nsExec::ExecToLog '"$INSTDIR\tools\nssm.exe" set SNARE DisplayName "SNARE Domain Surveillance"'
  nsExec::ExecToLog '"$INSTDIR\tools\nssm.exe" set SNARE Description "SNARE typosquat/homoglyph domain monitoring - self-hosted web app (localhost:3000)."'
  nsExec::ExecToLog '"$INSTDIR\tools\nssm.exe" start SNARE'

  WriteRegDWORD HKLM "Software\SNARE" "ServiceInstalled" 1
SectionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_APP} "The SNARE application files, bundled Node.js runtime, and bundled Chromium browser (required)."
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_SERVICE} "Registers SNARE as a Windows service (via NSSM) so it starts automatically on boot and runs without a console window. Requires administrator privileges. Manage it later with Start-Service/Stop-Service SNARE."
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Section "Uninstall"
  ReadRegDWORD $0 HKLM "Software\SNARE" "ServiceInstalled"
  ${If} $0 == 1
    DetailPrint "Removing SNARE Windows service..."
    nsExec::ExecToLog '"$INSTDIR\tools\nssm.exe" stop SNARE confirm'
    nsExec::ExecToLog '"$INSTDIR\tools\nssm.exe" remove SNARE confirm'
  ${EndIf}

  IfFileExists "$INSTDIR\snare.pid" 0 +2
    ExecWait '"powershell" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\stop-snare.ps1"'

  MessageBox MB_YESNO|MB_ICONQUESTION "Also delete SNARE's data (scan history, config, screenshots) stored under %APPDATA%\snare?$\n$\nChoose No to keep it for a future reinstall." IDYES delete_data IDNO keep_data
  delete_data:
    RMDir /r "$APPDATA\snare"
  keep_data:

  Delete "$SMPROGRAMS\SNARE\Start SNARE.lnk"
  Delete "$SMPROGRAMS\SNARE\Stop SNARE.lnk"
  Delete "$SMPROGRAMS\SNARE\Uninstall SNARE.lnk"
  RMDir "$SMPROGRAMS\SNARE"

  RMDir /r "$INSTDIR"

  DeleteRegKey HKLM "${UNINSTALL_REG_KEY}"
  DeleteRegKey HKLM "Software\SNARE"
SectionEnd
