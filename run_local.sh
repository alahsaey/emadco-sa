#!/bin/bash
echo "========================================================"
echo "   تشغيل نظام عمادكو ERP محلياً على جهاز المحل"
echo "========================================================"

if [ ! -d "node_modules" ]; then
    echo "[1/3] جاري تثبيت المكتبات والتبعات للمرة الأولى..."
    npm install
fi

echo "[2/3] جاري بناء وتجهيز خادم النظام والواجهة..."
npm run build

echo "[3/3] جاري تشغيل النظام..."
export NODE_ENV=production
export PORT=3000
node dist/server.cjs
