@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title معالج تثبيت وتنصيب نظام عمادكو المحاسبي (Emadco ERP Setup)

cls
echo ======================================================================
echo          معالج تثبيت وتنصيب نظام عمادكو لإدارة المنشآت ومواد البناء
echo                    Emadco ERP & POS - Windows Setup Wizard
echo ======================================================================
echo.
echo  مرحباً بك في معالج التثبيت التلقائي لنظام عمادكو المحاسبي.
echo  يقوم هذا المعالج بتنصيب النظام وقاعدة البيانات المحلية على جهاز الكمبيوتر
echo  وإنشاء أيقونات تشغيل رسمية على سطح المكتب وقائمة ابدأ.
echo ----------------------------------------------------------------------
echo.

set "SOURCE_DIR=%~dp0"
set "TARGET_DIR=C:\Emadco-POS"

echo [i] المسار الافتراضي الموصى به لتثبيت البرنامج هو: %TARGET_DIR%
echo.
set /p USER_CHOICE="هل ترغب في متابعة التثبيت في المسار الافتراضي؟ (Y/N) [الافتراضي: Y]: "
if /i "%USER_CHOICE%"=="N" (
    echo.
    set /p TARGET_DIR="أدخل مسار المجلد الجديد (مثال D:\Emadco-POS): "
)

echo.
echo ======================================================================
echo [*] جاري تهيئة مجلد النظام: %TARGET_DIR% ...
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"
if not exist "%TARGET_DIR%\data" mkdir "%TARGET_DIR%\data"
if not exist "%TARGET_DIR%\assets" mkdir "%TARGET_DIR%\assets"
if not exist "%TARGET_DIR%\dist" mkdir "%TARGET_DIR%\dist"
if not exist "%TARGET_DIR%\public" mkdir "%TARGET_DIR%\public"

echo [*] جاري نقل ملفات البرنامج الأساسية...
xcopy /E /I /Y "%SOURCE_DIR%assets" "%TARGET_DIR%\assets" >nul 2>nul
if exist "%SOURCE_DIR%dist" xcopy /E /I /Y "%SOURCE_DIR%dist" "%TARGET_DIR%\dist" >nul 2>nul
if exist "%SOURCE_DIR%public" xcopy /E /I /Y "%SOURCE_DIR%public" "%TARGET_DIR%\public" >nul 2>nul

echo [*] جاري إعداد قاعدة البيانات المحلية في مسار القرص الصلب...
xcopy /E /I /Y "%SOURCE_DIR%data" "%TARGET_DIR%\data" >nul 2>nul

copy /Y "%SOURCE_DIR%index.html" "%TARGET_DIR%\" >nul 2>nul
copy /Y "%SOURCE_DIR%run_node_server.cjs" "%TARGET_DIR%\" >nul 2>nul
copy /Y "%SOURCE_DIR%offline_server.ps1" "%TARGET_DIR%\" >nul 2>nul
copy /Y "%SOURCE_DIR%local_db.js" "%TARGET_DIR%\" >nul 2>nul
copy /Y "%SOURCE_DIR%START.bat" "%TARGET_DIR%\" >nul 2>nul
copy /Y "%SOURCE_DIR%START.vbs" "%TARGET_DIR%\" >nul 2>nul
copy /Y "%SOURCE_DIR%run_local.bat" "%TARGET_DIR%\" >nul 2>nul
copy /Y "%SOURCE_DIR%run_local.vbs" "%TARGET_DIR%\" >nul 2>nul
copy /Y "%SOURCE_DIR%expenses_data.json" "%TARGET_DIR%\" >nul 2>nul
if exist "%SOURCE_DIR%favicon.png" copy /Y "%SOURCE_DIR%favicon.png" "%TARGET_DIR%\" >nul 2>nul

echo [*] جاري إنشاء اختصار رسمي على سطح المكتب (Desktop Shortcut)...
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\عمادكو ERP - نقاط البيع والمحاسبة.lnk"
set "VBS_SCRIPT=%TEMP%\create_emadco_shortcut.vbs"

echo Set oWS = WScript.CreateObject("WScript.Shell") > "%VBS_SCRIPT%"
echo sLinkFile = "%SHORTCUT_PATH%" >> "%VBS_SCRIPT%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%VBS_SCRIPT%"
echo oLink.TargetPath = "%TARGET_DIR%\START.vbs" >> "%VBS_SCRIPT%"
echo oLink.WorkingDirectory = "%TARGET_DIR%" >> "%VBS_SCRIPT%"
echo oLink.Description = "نظام عمادكو المحاسبي لإدارة نقاط البيع والمخزون أوفلاين" >> "%VBS_SCRIPT%"
echo oLink.WindowStyle = 1 >> "%VBS_SCRIPT%"
if exist "%TARGET_DIR%\favicon.png" (
    echo oLink.IconLocation = "%TARGET_DIR%\favicon.png" >> "%VBS_SCRIPT%"
)
echo oLink.Save >> "%VBS_SCRIPT%"

cscript //nologo "%VBS_SCRIPT%" >nul 2>nul
del "%VBS_SCRIPT%" >nul 2>nul

echo [*] جاري إنشاء اختصار في قائمة ابدأ (Start Menu)...
set "START_MENU_PATH=%APPDATA%\Microsoft\Windows\Start Menu\Programs\عمادكو ERP.lnk"
set "VBS_START=%TEMP%\create_emadco_start.vbs"
echo Set oWS = WScript.CreateObject("WScript.Shell") > "%VBS_START%"
echo sLinkFile = "%START_MENU_PATH%" >> "%VBS_START%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%VBS_START%"
echo oLink.TargetPath = "%TARGET_DIR%\START.vbs" >> "%VBS_START%"
echo oLink.WorkingDirectory = "%TARGET_DIR%" >> "%VBS_START%"
echo oLink.Description = "نظام عمادكو ERP" >> "%VBS_START%"
echo oLink.Save >> "%VBS_START%"
cscript //nologo "%VBS_START%" >nul 2>nul
del "%VBS_START%" >nul 2>nul

echo.
echo ======================================================================
echo   تهانينا! اكتمل تنصيب نظام عمادكو بنجاح تام على جهاز الكمبيوتر!
echo ======================================================================
echo.
echo  [✓] مجلد البرنامج المثبت: %TARGET_DIR%
echo  [✓] مجلد قاعدة البيانات المحلية: %TARGET_DIR%\data
echo  [✓] تم إنشاء أيقونة النظام على سطح المكتب باسم:
echo      "عمادكو ERP - نقاط البيع والمحاسبة"
echo  [✓] تم إنشاء أيقونة في قائمة ابدأ (Start Menu)
echo  [✓] النظام يعمل بشكل مستقل 100%% أوفلاين دون الحاجة لأي إنترنت
echo.
echo ----------------------------------------------------------------------
set /p RUN_NOW="هل ترغب في تشغيل النظام الآن؟ (Y/N) [الافتراضي: Y]: "
if /i not "%RUN_NOW%"=="N" (
    echo [*] جاري تشغيل النظام...
    start "" "%TARGET_DIR%\START.vbs"
)

echo.
echo شكراً لاختياركم نظام عمادكو ERP. نتمنى لكم عملاً موفقاً!
pause
