@echo off
chcp 65001 > nul
echo ========================================================
echo   تشغيل نظام عمادكو ERP محلياً على جهاز المحل
echo ========================================================
echo.

if not exist node_modules (
    echo [1/3] جاري تثبيت المكتبات والتبعات للمرة الأولى...
    call npm install
)

echo [2/3] جاري بناء وتجهيز خادم النظام والواجهة...
call npm run build

echo [3/3] جاري تشغيل النظام السحابي المحلي...
echo يمكنك فتح النظام من هذا الجهاز عبر: http://localhost:3000
echo أو من الجهاز الثاني في المحل عبر: http://[IP_الجهاز_الرئيسي]:3000
echo.
set NODE_ENV=production
set PORT=3000
node dist/server.cjs
pause
