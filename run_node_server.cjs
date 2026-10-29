/**
 * خادم Node.js محلي خفيف الوزن ومستقل 100% بدون أي حزم خارجية
 * Emadco ERP - Pure Node.js Offline Local Server
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const EXPENSES_FILE = path.join(ROOT, 'expenses_data.json');

// التأكد من وجود ملف المصروفات
if (!fs.existsSync(EXPENSES_FILE)) {
  try {
    fs.writeFileSync(EXPENSES_FILE, JSON.stringify({ expenses: [] }, null, 2), 'utf8');
  } catch (e) {}
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp'
};

function findFile(urlPath) {
  let clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
  if (!clean || clean === '') clean = 'index.html';

  const candidates = [
    path.join(ROOT, clean),
    path.join(ROOT, 'dist', clean),
    path.join(ROOT, 'public', clean)
  ];

  if (clean.startsWith('assets/')) {
    candidates.unshift(path.join(ROOT, 'public', clean));
    candidates.unshift(path.join(ROOT, 'dist', clean));
  }

  for (const cand of candidates) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
      return cand;
    }
  }

  // SPA fallback
  if (!path.extname(clean)) {
    const indexCandidates = [
      path.join(ROOT, 'index.html'),
      path.join(ROOT, 'dist', 'index.html')
    ];
    for (const cand of indexCandidates) {
      if (fs.existsSync(cand)) return cand;
    }
  }

  return null;
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const url = req.url.split('?')[0];

  // API Endpoints
  if (url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ status: 'ok', mode: 'node_pure_offline', service: 'Emadco ERP' }));
  }

  if (url === '/api/expenses' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    const data = fs.existsSync(EXPENSES_FILE) ? fs.readFileSync(EXPENSES_FILE, 'utf8') : '{"expenses":[]}';
    return res.end(data);
  }

  if (url === '/api/expenses' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const newExp = JSON.parse(body);
        let currentData = { expenses: [] };
        if (fs.existsSync(EXPENSES_FILE)) {
          currentData = JSON.parse(fs.readFileSync(EXPENSES_FILE, 'utf8') || '{"expenses":[]}');
        }
        if (!Array.isArray(currentData.expenses)) currentData.expenses = [];
        currentData.expenses.unshift(newExp);
        fs.writeFileSync(EXPENSES_FILE, JSON.stringify(currentData, null, 2), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  if (url === '/api/whatsapp/status') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ connected: false, status: 'offline', note: 'الخادم يعمل بالنمط المحلي' }));
  }

  // Local Disk Database Engine (Pure Node.js)
  const DATA_DIR = path.join(ROOT, 'data');
  if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
  }

  function getCollFile(name) {
    const clean = (name || '').replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(DATA_DIR, clean + '.json');
  }

  function readColl(name) {
    const fp = getCollFile(name);
    if (!fs.existsSync(fp)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(fp, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function writeColl(name, items) {
    const fp = getCollFile(name);
    try {
      fs.writeFileSync(fp, JSON.stringify(items, null, 2), 'utf8');
      return true;
    } catch (e) {
      return false;
    }
  }

  if (url === '/api/db/health' || url === '/api/db/status') {
    const collections = [
      'products', 'categories', 'brands', 'units', 'inventory', 'inventory_movements',
      'sales', 'sale_items', 'invoices', 'invoice_items', 'customers', 'suppliers',
      'purchases', 'purchase_items', 'payments', 'payment_transactions', 'returns',
      'return_items', 'quotations', 'quotation_items', 'warehouses', 'branches',
      'users', 'roles', 'permissions', 'audit_logs', 'system_settings', 'tax_settings', 'expenses'
    ];
    let totalRecords = 0;
    let totalSizeBytes = 0;
    const report = {};
    for (const name of collections) {
      const fp = getCollFile(name);
      const exists = fs.existsSync(fp);
      let size = 0;
      let count = 0;
      if (exists) {
        try {
          size = fs.statSync(fp).size;
          totalSizeBytes += size;
          const items = readColl(name);
          count = items.length;
          totalRecords += count;
        } catch (e) {}
      }
      report[name] = { count, filePath: fp, sizeBytes: size, exists };
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      success: true,
      databaseLocation: DATA_DIR,
      storageType: 'Direct Local Disk Files (JSON)',
      isOfflineReady: true,
      totalRecords,
      totalSizeBytes,
      totalSizeReadable: (totalSizeBytes / 1024).toFixed(2) + ' KB',
      collections: report,
      timestamp: new Date().toISOString()
    }));
  }

  if (url === '/api/db/export') {
    const collections = [
      'products', 'categories', 'brands', 'units', 'inventory', 'inventory_movements',
      'sales', 'sale_items', 'invoices', 'invoice_items', 'customers', 'suppliers',
      'purchases', 'purchase_items', 'payments', 'payment_transactions', 'returns',
      'return_items', 'quotations', 'quotation_items', 'warehouses', 'branches',
      'users', 'roles', 'permissions', 'audit_logs', 'system_settings', 'tax_settings', 'expenses'
    ];
    const exportData = {};
    for (const name of collections) {
      exportData[name] = readColl(name);
    }
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename=emadco_database_backup.json'
    });
    return res.end(JSON.stringify({
      system: 'Emadco ERP Offline PC Database',
      exportedAt: new Date().toISOString(),
      data: exportData
    }, null, 2));
  }

  if (url === '/api/db-batch' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { operations } = JSON.parse(body);
        if (Array.isArray(operations)) {
          const grouped = {};
          for (const op of operations) {
            const { type, collection, id, data } = op;
            if (!collection) continue;
            if (!grouped[collection]) grouped[collection] = readColl(collection);
            const items = grouped[collection];
            const docId = id || (data && data.id) || ('doc_' + Date.now());
            const idx = items.findIndex(it => String(it.id) === String(docId));
            if (type === 'delete') {
              if (idx >= 0) items.splice(idx, 1);
            } else {
              const fullDoc = { ...data, id: docId, updatedAt: new Date().toISOString() };
              if (idx >= 0) {
                items[idx] = { ...items[idx], ...fullDoc };
              } else {
                fullDoc.createdAt = fullDoc.createdAt || new Date().toISOString();
                items.unshift(fullDoc);
              }
            }
          }
          for (const [coll, items] of Object.entries(grouped)) {
            writeColl(coll, items);
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  if (url.startsWith('/api/db/')) {
    const parts = url.slice('/api/db/'.length).split('/');
    const collName = parts[0];
    const docId = parts[1];

    if (req.method === 'GET' && !docId) {
      const items = readColl(collName);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ success: true, collection: collName, count: items.length, data: items }));
    }

    if (req.method === 'GET' && docId) {
      const items = readColl(collName);
      const doc = items.find(it => String(it.id) === String(docId));
      if (!doc) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: false, error: 'العنصر غير موجود' }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ success: true, data: doc }));
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const docData = JSON.parse(body);
          const items = readColl(collName);
          const did = docData.id || ('doc_' + Date.now());
          const idx = items.findIndex(it => String(it.id) === String(did));
          const fullDoc = { ...docData, id: did, updatedAt: new Date().toISOString() };
          if (idx >= 0) {
            items[idx] = { ...items[idx], ...fullDoc };
          } else {
            fullDoc.createdAt = fullDoc.createdAt || new Date().toISOString();
            items.unshift(fullDoc);
          }
          writeColl(collName, items);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, data: fullDoc }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    if (req.method === 'PUT' && docId) {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const docData = JSON.parse(body);
          const items = readColl(collName);
          const idx = items.findIndex(it => String(it.id) === String(docId));
          const fullDoc = { ...docData, id: docId, updatedAt: new Date().toISOString() };
          if (idx >= 0) {
            items[idx] = { ...items[idx], ...fullDoc };
          } else {
            fullDoc.createdAt = fullDoc.createdAt || new Date().toISOString();
            items.unshift(fullDoc);
          }
          writeColl(collName, items);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, data: fullDoc }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    if (req.method === 'DELETE' && docId) {
      const items = readColl(collName);
      const filtered = items.filter(it => String(it.id) !== String(docId));
      writeColl(collName, filtered);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ success: true, message: 'تم الحذف' }));
    }
  }

  // Static File Serving
  const filePath = findFile(url);
  if (filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    return fs.createReadStream(filePath).pipe(res);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('========================================================');
  console.log('   نظام عمادكو المحاسبي ERP - خادم Node.js المحلي');
  console.log('========================================================');
  console.log(` [✓] الخادم يعمل بنجاح على: http://localhost:${PORT}`);
  console.log(` [✓] العنوان البديل: http://127.0.0.1:${PORT}`);
  console.log(' [i] اترك هذه النافذة مفتوحة طوال فترة عملك على البرنامج');
  console.log('--------------------------------------------------------\n');

  // فتح المتصفح تلقائياً
  const openCmd = process.platform === 'win32' ? `start http://localhost:${PORT}` : `xdg-open http://localhost:${PORT}`;
  exec(openCmd, () => {});
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[!] المنفذ ${PORT} مشغول حالياً، جاري المحاولة على المنفذ 3001...`);
    server.listen(3001, '0.0.0.0');
  } else {
    console.error('خطأ في تشغيل الخادم:', err);
  }
});
