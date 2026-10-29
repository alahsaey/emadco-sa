; =====================================================================
; Emadco ERP - Professional Inno Setup Installer Script
; يتيح إنشاء ملف تثبيت تنفيذي واحد بصيغة EXE (Emadco_Setup.exe)
; =====================================================================

[Setup]
AppId={{9B7F1B3C-4C8D-4E38-B9F2-5A384DE88E52}
AppName=عمادكو ERP - نقاط البيع والمحاسبة
AppVersion=2.5.0
AppPublisher=شركة عمادكو لإدارة المنشآت ومواد البناء
AppPublisherURL=http://localhost:3000
AppSupportURL=http://localhost:3000
AppUpdatesURL=http://localhost:3000
DefaultDirName=C:\Emadco-POS
DefaultGroupName=عمادكو ERP
DisableProgramGroupPage=yes
OutputBaseFilename=Emadco_ERP_Setup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64 compatible
PrivilegesRequired=lowest
OutputDir=.

[Languages]
Name: "arabic"; MessagesFile: "compiler:Languages\Arabic.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "index.html"; DestDir: "{app}"; Flags: ignoreversion
Source: "run_node_server.cjs"; DestDir: "{app}"; Flags: ignoreversion
Source: "offline_server.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "local_db.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "START.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "START.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "expenses_data.json"; DestDir: "{app}"; Flags: ignoreversion onlyifdoesntexist
Source: "assets\*"; DestDir: "{app}\assets"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "data\*"; DestDir: "{app}\data"; Flags: ignoreversion recursesubdirs createallsubdirs onlyifdoesntexist
Source: "public\*"; DestDir: "{app}\public"; Flags: ignoreversion recursesubdirs createallsubdirs; Flags: skipifsourcedoesntexist
Source: "dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs; Flags: skipifsourcedoesntexist

[Icons]
Name: "{group}\عمادكو ERP - نقاط البيع والمحاسبة"; Filename: "{app}\START.vbs"; WorkingDir: "{app}"
Name: "{group}\{cm:UninstallProgram,عمادكو ERP}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\عمادكو ERP - نقاط البيع والمحاسبة"; Filename: "{app}\START.vbs"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\START.vbs"; Description: "{cm:LaunchProgram,عمادكو ERP}"; Flags: shellexec postinstall skipifsilent
