; ═══════════════════════════════════════════════════════
; Termax 安装器 — NSIS Modern UI 2 模板
; 暗色主题，与 About 页面视觉风格统一
; ═══════════════════════════════════════════════════════

; ── 基础配置 ──
Unicode true
ManifestDPIAware true
!include "MUI2.nsh"
!include "FileFunc.nsh"

; ── 应用信息（由 Tauri 构建时注入） ──
!ifndef PRODUCT_NAME
  !define PRODUCT_NAME "Termax"
!endif
!ifndef PRODUCT_VERSION
  !define PRODUCT_VERSION "0.1.0"
!endif
!ifndef INSTALLER_EXE
  !define INSTALLER_EXE "termax.exe"
!endif

; ── 安装器外观 ──
Name "${PRODUCT_NAME}"
OutFile "..\..\target\release\${PRODUCT_NAME}_${PRODUCT_VERSION}_x64-setup.exe"
InstallDir "$LOCALAPPDATA\Programs\${PRODUCT_NAME}"
InstallDirRegKey HKCU "Software\${PRODUCT_NAME}" ""
RequestExecutionLevel user
ShowInstDetails nevershow
ShowUninstDetails nevershow
SetCompressor lzma

; ── 暗色主题色 ──
; 背景: #121314 强调: #2f81f7
!define MUI_BGCOLOR "121314"
!define MUI_TEXTCOLOR "e6edf3"
!define MUI_HEADER_TEXTCOLOR "e6edf3"
!define MUI_HEADER_BGCOLOR "121314"

; ── 底部品牌栏 ──
BrandingText "Termax · Modern SSH Terminal  |  v${PRODUCT_VERSION}"

; ── 欢迎页 ──
!define MUI_WELCOMEPAGE_TITLE "${PRODUCT_NAME} 安装向导"
!define MUI_WELCOMEPAGE_TEXT "欢迎安装 ${PRODUCT_NAME} v${PRODUCT_VERSION}$\r$\n$\r$\nTermax 是一款现代化的 SSH 终端客户端，$\r$\n支持多标签、分屏、SFTP 文件管理、系统监控等功能。$\r$\n$\r$\n点击「下一步」继续。"

; ── 完成页 ──
!define MUI_FINISHPAGE_TITLE "${PRODUCT_NAME} 安装完成"
!define MUI_FINISHPAGE_TEXT "${PRODUCT_NAME} 已成功安装到你的计算机。$\r$\n$\r$\n点击「完成」关闭安装向导并启动 ${PRODUCT_NAME}。"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${INSTALLER_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "启动 ${PRODUCT_NAME}"
!define MUI_FINISHPAGE_SHOWREADME ""
!define MUI_FINISHPAGE_SHOWREADME_TEXT ""

; ── 卸载确认页 ──
!define MUI_UNWELCOMEFINISHPAGE_TITLE "${PRODUCT_NAME} 卸载"
!define MUI_UNCONFIRMPAGE_TEXT_TOP "即将从你的计算机中移除 ${PRODUCT_NAME}。"

; ── 页面顺序 ──
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\..\LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; ── 语言 ──
!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"

; ═══════════════════════════════════════════════════════
; 安装段
; ═══════════════════════════════════════════════════════

Section "Termax" SectionInstall
  SetOutPath "$INSTDIR"

  ; 复制所有文件
  File /r "..\..\target\release\*"

  ; 开始菜单快捷方式
  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\${INSTALLER_EXE}"
  CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\卸载 ${PRODUCT_NAME}.lnk" "$INSTDIR\uninstall.exe"

  ; 桌面快捷方式
  CreateShortcut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${INSTALLER_EXE}"

  ; 写入卸载信息
  WriteUninstaller "$INSTDIR\uninstall.exe"
  WriteRegStr HKCU "Software\${PRODUCT_NAME}" "" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "UninstallString" "$INSTDIR\uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "Publisher" "Termax Team"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "NoRepair" 1

  ; 估算大小
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "EstimatedSize" "$0"
SectionEnd

; ═══════════════════════════════════════════════════════
; 卸载段
; ═══════════════════════════════════════════════════════

Section "Uninstall"
  Delete "$INSTDIR\*.*"
  RMDir /r "$INSTDIR"

  Delete "$SMPROGRAMS\${PRODUCT_NAME}\*.*"
  RMDir "$SMPROGRAMS\${PRODUCT_NAME}"
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"

  DeleteRegKey HKCU "Software\${PRODUCT_NAME}"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
SectionEnd
