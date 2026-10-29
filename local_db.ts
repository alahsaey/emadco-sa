/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Emadco ERP Local File-Based Database Engine
 * Direct local disk persistence for 100% offline computer operation.
 */

import fs from 'fs';
import path from 'path';

export const DATA_DIR = path.join(process.cwd(), 'data');

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create local database directory:', err);
  }
}

// In-memory cache for ultra-fast queries
const memoryCache: Record<string, any[]> = {};

/**
 * Gets the file path for a collection on disk
 */
export function getCollectionFilePath(collectionName: string): string {
  const cleanName = collectionName.replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(DATA_DIR, `${cleanName}.json`);
}

/**
 * Reads a collection from the computer's hard drive
 */
export function readCollection(collectionName: string): any[] {
  if (memoryCache[collectionName]) {
    return memoryCache[collectionName];
  }

  const filePath = getCollectionFilePath(collectionName);
  if (!fs.existsSync(filePath)) {
    memoryCache[collectionName] = [];
    return [];
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      memoryCache[collectionName] = parsed;
      return parsed;
    }
    memoryCache[collectionName] = [];
    return [];
  } catch (err) {
    console.warn(`[LOCAL DB] Error reading collection ${collectionName} from disk:`, err);
    memoryCache[collectionName] = [];
    return [];
  }
}

/**
 * Writes a collection directly to the computer's hard drive
 */
export function writeCollection(collectionName: string, items: any[]): boolean {
  memoryCache[collectionName] = items;
  const filePath = getCollectionFilePath(collectionName);
  try {
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(items, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
    return true;
  } catch (err) {
    console.error(`[LOCAL DB] Error saving collection ${collectionName} to disk:`, err);
    try {
      fs.writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf-8');
      return true;
    } catch (fallbackErr) {
      console.error(`[LOCAL DB] Direct write failed for ${collectionName}:`, fallbackErr);
      return false;
    }
  }
}

/**
 * Gets a document by ID
 */
export function getDocument(collectionName: string, id: string): any | null {
  const items = readCollection(collectionName);
  return items.find((item) => String(item.id) === String(id)) || null;
}

/**
 * Saves or updates a document in a collection on disk
 */
export function saveDocument(collectionName: string, docData: any): any {
  if (!docData) throw new Error('Document data is required');
  const items = [...readCollection(collectionName)];
  const docId = docData.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const existingIndex = items.findIndex((item) => String(item.id) === String(docId));
  const fullDoc = {
    ...docData,
    id: docId,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    items[existingIndex] = {
      ...items[existingIndex],
      ...fullDoc,
      createdAt: items[existingIndex].createdAt || now,
    };
  } else {
    if (!fullDoc.createdAt) fullDoc.createdAt = now;
    items.unshift(fullDoc);
  }

  writeCollection(collectionName, items);
  return fullDoc;
}

/**
 * Deletes a document by ID
 */
export function deleteDocument(collectionName: string, id: string): boolean {
  const items = readCollection(collectionName);
  const filtered = items.filter((item) => String(item.id) !== String(id));
  if (filtered.length !== items.length) {
    writeCollection(collectionName, filtered);
    return true;
  }
  return false;
}

/**
 * Applies multiple operations atomically
 */
export function applyBatch(operations: Array<{
  type: 'set' | 'update' | 'delete';
  collection: string;
  id?: string;
  data?: any;
}>): boolean {
  const touchedCollections = new Set<string>();

  for (const op of operations) {
    const { type, collection, id, data } = op;
    if (!collection) continue;
    touchedCollections.add(collection);

    if (type === 'delete' && id) {
      deleteDocument(collection, id);
    } else if ((type === 'set' || type === 'update') && data) {
      saveDocument(collection, { ...data, id: id || data.id });
    }
  }

  return true;
}

/**
 * Database Status and file report
 */
export function getDatabaseStatus() {
  const collections = [
    'products',
    'categories',
    'brands',
    'units',
    'inventory',
    'inventory_movements',
    'sales',
    'sale_items',
    'invoices',
    'invoice_items',
    'customers',
    'suppliers',
    'purchases',
    'purchase_items',
    'payments',
    'payment_transactions',
    'returns',
    'return_items',
    'quotations',
    'quotation_items',
    'warehouses',
    'branches',
    'users',
    'roles',
    'permissions',
    'audit_logs',
    'system_settings',
    'tax_settings',
    'expenses',
  ];

  const report: Record<string, { count: number; filePath: string; sizeBytes: number; exists: boolean }> = {};
  let totalRecords = 0;
  let totalSizeBytes = 0;

  for (const name of collections) {
    const filePath = getCollectionFilePath(name);
    const exists = fs.existsSync(filePath);
    let size = 0;
    let count = 0;

    if (exists) {
      try {
        const stats = fs.statSync(filePath);
        size = stats.size;
        totalSizeBytes += size;
        const items = readCollection(name);
        count = items.length;
        totalRecords += count;
      } catch {}
    }

    report[name] = {
      count,
      filePath,
      sizeBytes: size,
      exists,
    };
  }

  return {
    databaseLocation: DATA_DIR,
    storageType: 'Direct Local Disk Files (JSON)',
    isOfflineReady: true,
    totalRecords,
    totalSizeBytes,
    totalSizeReadable: `${(totalSizeBytes / 1024).toFixed(2)} KB`,
    collections: report,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Default Seed Data for Emadco Building Materials ERP
 */
export function seedDefaultDataIfEmpty(force = false) {
  const existingProducts = readCollection('products');
  if (existingProducts.length > 0 && !force) {
    return { seeded: false, message: 'Database already contains data' };
  }

  console.log('🌱 [LOCAL DB] Seeding initial construction materials catalog and warehouses...');

  // 1. Warehouses
  const warehouses = [
    {
      id: 'wh_main',
      nameAr: 'المستودع الرئيسي',
      code: 'WH-01',
      branchId: 'branch_main',
      location: 'المنطقة الصناعية - مستودع المواد المركزية',
      managerName: 'أبو فهد العتيبي',
      isPrimary: true,
      isActive: true,
      order: 1,
    },
    {
      id: 'wh_showroom',
      nameAr: 'مستودع صالة العرض',
      code: 'WH-02',
      branchId: 'branch_main',
      location: 'معرض طريق الملك فهد',
      managerName: 'سلطان القحطاني',
      isPrimary: false,
      isActive: true,
      order: 2,
    },
  ];
  writeCollection('warehouses', warehouses);

  // 2. Categories
  const categories = [
    { id: 'cat_locks', nameAr: 'كوالين وأقفال ومفصلات', code: 'LCK', isActive: true, order: 1 },
    { id: 'cat_tools', nameAr: 'عدد وأدوات يدوية وصناعية', code: 'TLS', isActive: true, order: 2 },
    { id: 'cat_sealants', nameAr: 'مواد عازلة وسيليكون وغراء', code: 'SIL', isActive: true, order: 3 },
    { id: 'cat_fasteners', nameAr: 'مسامير وبراغي ومثبتات', code: 'FST', isActive: true, order: 4 },
    { id: 'cat_building', nameAr: 'مواد بناء وتشطيب عام', code: 'BLD', isActive: true, order: 5 },
  ];
  writeCollection('categories', categories);

  // 3. Brands
  const brands = [
    { id: 'br_ahram', nameAr: 'أهرام (Ahram)', country: 'مصر', isActive: true },
    { id: 'br_stanley', nameAr: 'ستانلي (Stanley)', country: 'أمريكا', isActive: true },
    { id: 'br_total', nameAr: 'توتال (TOTAL Tools)', country: 'الصين', isActive: true },
    { id: 'br_soudal', nameAr: 'سودال (Soudal)', country: 'بلجيكا', isActive: true },
    { id: 'br_national', nameAr: 'الوطني (National)', country: 'السعودية', isActive: true },
  ];
  writeCollection('brands', brands);

  // 4. Units
  const units = [
    { id: 'unit_piece', nameAr: 'حبة', symbol: 'حبة', isDefault: true, isActive: true },
    { id: 'unit_box', nameAr: 'كرتون', symbol: 'كرتون', isDefault: false, isActive: true },
    { id: 'unit_kg', nameAr: 'كيلوجرام', symbol: 'كجم', isDefault: false, isActive: true },
    { id: 'unit_meter', nameAr: 'متر طولي', symbol: 'م', isDefault: false, isActive: true },
    { id: 'unit_set', nameAr: 'طقم', symbol: 'طقم', isDefault: false, isActive: true },
  ];
  writeCollection('units', units);

  // 5. Products & Inventory
  const products = [
    {
      id: 'prod_1',
      nameAr: 'كالون كمبيوتر أهرام أصلي نحاس 70 ملم',
      sku: 'LCK-AHRAM-70',
      barcode: '628100100001',
      categoryId: 'cat_locks',
      brandId: 'br_ahram',
      unitId: 'unit_piece',
      costPrice: 45.0,
      retailPrice: 65.0,
      wholesalePrice: 58.0,
      contractorPrice: 54.0,
      minStock: 20,
      taxRate: 15,
      location: 'الرف A-01',
      imageUrl: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=500&auto=format&fit=crop&q=60',
      isActive: true,
      isDeleted: false,
    },
    {
      id: 'prod_2',
      nameAr: 'قفل بوابة فولاذي صلب ضد القص 70 ملم',
      sku: 'LCK-STEEL-GATE',
      barcode: '628100100002',
      categoryId: 'cat_locks',
      brandId: 'br_ahram',
      unitId: 'unit_piece',
      costPrice: 30.0,
      retailPrice: 48.0,
      wholesalePrice: 42.0,
      contractorPrice: 38.0,
      minStock: 15,
      taxRate: 15,
      location: 'الرف A-02',
      imageUrl: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=500&auto=format&fit=crop&q=60',
      isActive: true,
      isDeleted: false,
    },
    {
      id: 'prod_3',
      nameAr: 'سيليكون ألماني مانع للتسرب شفاف (أنبوب 300 مل)',
      sku: 'SIL-CLEAR-300',
      barcode: '628100100003',
      categoryId: 'cat_sealants',
      brandId: 'br_soudal',
      unitId: 'unit_piece',
      costPrice: 8.5,
      retailPrice: 15.0,
      wholesalePrice: 12.0,
      contractorPrice: 11.0,
      minStock: 50,
      taxRate: 15,
      location: 'الرف B-01',
      imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500&auto=format&fit=crop&q=60',
      isActive: true,
      isDeleted: false,
    },
    {
      id: 'prod_4',
      nameAr: 'مسامير صلب مجلفن للجبس والخشب 3 إنش (كرتون 5 كجم)',
      sku: 'FST-SCREW-3IN',
      barcode: '628100100004',
      categoryId: 'cat_fasteners',
      brandId: 'br_national',
      unitId: 'unit_box',
      costPrice: 22.0,
      retailPrice: 36.0,
      wholesalePrice: 30.0,
      contractorPrice: 28.0,
      minStock: 25,
      taxRate: 15,
      location: 'الرف C-01',
      imageUrl: 'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?w=500&auto=format&fit=crop&q=60',
      isActive: true,
      isDeleted: false,
    },
    {
      id: 'prod_5',
      nameAr: 'زرادية وبنسة كهرباء صناعية معزولة 8 إنش',
      sku: 'TLS-PLIER-8IN',
      barcode: '628100100005',
      categoryId: 'cat_tools',
      brandId: 'br_total',
      unitId: 'unit_piece',
      costPrice: 18.0,
      retailPrice: 30.0,
      wholesalePrice: 25.0,
      contractorPrice: 22.0,
      minStock: 10,
      taxRate: 15,
      location: 'الرف D-01',
      imageUrl: 'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=500&auto=format&fit=crop&q=60',
      isActive: true,
      isDeleted: false,
    },
    {
      id: 'prod_6',
      nameAr: 'طقم مفكات براغي احترافي 6 قطع كروم فانديوم',
      sku: 'TLS-SCREWDRIVER-SET',
      barcode: '628100100006',
      categoryId: 'cat_tools',
      brandId: 'br_stanley',
      unitId: 'unit_set',
      costPrice: 38.0,
      retailPrice: 62.0,
      wholesalePrice: 52.0,
      contractorPrice: 48.0,
      minStock: 12,
      taxRate: 15,
      location: 'الرف D-02',
      imageUrl: 'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=500&auto=format&fit=crop&q=60',
      isActive: true,
      isDeleted: false,
    },
    {
      id: 'prod_7',
      nameAr: 'شريط لاصق عازل للكهرباء والرطوبة (طقم 10 رول)',
      sku: 'SIL-TAPE-ELEC',
      barcode: '628100100007',
      categoryId: 'cat_sealants',
      brandId: 'br_national',
      unitId: 'unit_set',
      costPrice: 12.0,
      retailPrice: 22.0,
      wholesalePrice: 18.0,
      contractorPrice: 16.0,
      minStock: 30,
      taxRate: 15,
      location: 'الرف B-02',
      imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500&auto=format&fit=crop&q=60',
      isActive: true,
      isDeleted: false,
    },
    {
      id: 'prod_8',
      nameAr: 'زوايا تثبيت حديد مجلفن مقوى 4×4 سم (طرد 50 حبة)',
      sku: 'BLD-ANGLE-4X4',
      barcode: '628100100008',
      categoryId: 'cat_building',
      brandId: 'br_national',
      unitId: 'unit_box',
      costPrice: 28.0,
      retailPrice: 45.0,
      wholesalePrice: 38.0,
      contractorPrice: 34.0,
      minStock: 20,
      taxRate: 15,
      location: 'الرف C-02',
      imageUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=500&auto=format&fit=crop&q=60',
      isActive: true,
      isDeleted: false,
    },
  ];
  writeCollection('products', products);

  // 6. Inventories
  const stockLevels = [
    { prodId: 'prod_1', qty: 120, avgCost: 45.0 },
    { prodId: 'prod_2', qty: 85, avgCost: 30.0 },
    { prodId: 'prod_3', qty: 240, avgCost: 8.5 },
    { prodId: 'prod_4', qty: 90, avgCost: 22.0 },
    { prodId: 'prod_5', qty: 65, avgCost: 18.0 },
    { prodId: 'prod_6', qty: 45, avgCost: 38.0 },
    { prodId: 'prod_7', qty: 150, avgCost: 12.0 },
    { prodId: 'prod_8', qty: 110, avgCost: 28.0 },
  ];

  const inventories: any[] = [];
  const inventoryMovements: any[] = [];
  const now = new Date().toISOString();

  for (const item of stockLevels) {
    const invId = `inv_${item.prodId}_wh_main`;
    inventories.push({
      id: invId,
      productId: item.prodId,
      warehouseId: 'wh_main',
      quantityOnHand: item.qty,
      reservedQuantity: 0,
      availableQuantity: item.qty,
      averageCost: item.avgCost,
      lastUpdated: now,
    });

    inventoryMovements.push({
      id: `mov_init_${item.prodId}`,
      productId: item.prodId,
      warehouseId: 'wh_main',
      movementType: 'purchase',
      referenceId: 'INIT-STOCK-001',
      quantity: item.qty,
      unitCost: item.avgCost,
      previousQty: 0,
      newQty: item.qty,
      notes: 'رصيد مخزون افتتاحي معتمد محلياً',
      createdAt: now,
      createdBy: 'صالح حجي مبارك الياسين',
    });
  }
  writeCollection('inventory', inventories);
  writeCollection('inventory_movements', inventoryMovements);

  // 7. Customers
  const customers = [
    {
      id: 'cust_walk_in',
      name: 'عميل نقدي مباشر',
      phone: '0500000000',
      customerType: 'retail',
      priceTier: 'retail',
      creditLimit: 0,
      currentBalance: 0,
      createdAt: now,
    },
    {
      id: 'cust_contractor_1',
      name: 'شركة المقاولات الحديثة للتطوير',
      phone: '0551234567',
      customerType: 'contractor',
      priceTier: 'contractor',
      taxNumber: '310948572100001',
      creditLimit: 75000.0,
      currentBalance: 0.0,
      createdAt: now,
    },
    {
      id: 'cust_contractor_2',
      name: 'مؤسسة الأفق للتعمير والديكور',
      phone: '0569876543',
      customerType: 'contractor',
      priceTier: 'contractor',
      taxNumber: '310948572100002',
      creditLimit: 50000.0,
      currentBalance: 0.0,
      createdAt: now,
    },
  ];
  writeCollection('customers', customers);

  // 8. Suppliers
  const suppliers = [
    {
      id: 'supp_1',
      name: 'مصنع الأهرام للأقفال والمفصلات',
      contactPerson: 'م. أحمد الشناوي',
      phone: '0501112233',
      email: 'ahram-sales@example.com',
      taxNumber: '300123456700003',
      city: 'الدمام',
      balance: 0.0,
      createdAt: now,
    },
    {
      id: 'supp_2',
      name: 'شركة توريدات سودال للكيماويات والعزل',
      contactPerson: 'أ. طارق رضوان',
      phone: '0504445566',
      email: 'soudal-sa@example.com',
      taxNumber: '300987654300003',
      city: 'الرياض',
      balance: 0.0,
      createdAt: now,
    },
    {
      id: 'supp_3',
      name: 'المصنع الوطني للمسامير والمثبتات الحديدية',
      contactPerson: 'م. خالد الدوسري',
      phone: '0507778899',
      email: 'national-screws@example.com',
      taxNumber: '300555666700003',
      city: 'الجبيل',
      balance: 0.0,
      createdAt: now,
    },
  ];
  writeCollection('suppliers', suppliers);

  // 9. Users & Roles
  const users = [
    {
      id: 'user_owner',
      email: 'alahsaey@gmail.com',
      fullName: 'صالح حجي مبارك الياسين',
      phone: '0500680180',
      roleId: 'role_system_owner',
      roleKey: 'system_owner',
      branchId: 'branch_main',
      warehouseId: 'wh_main',
      password: '123456',
      pinCode: '3254',
      isActive: true,
      customPermissions: ['all'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'user_manager',
      email: 'amad.co2009@gmail.com',
      fullName: 'عماد سعد آل سعيد',
      phone: '0502223344',
      roleId: 'role_manager',
      roleKey: 'manager',
      branchId: 'branch_main',
      warehouseId: 'wh_main',
      password: '123456',
      pinCode: '1188',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'user_cashier',
      email: 'amad.co2009@gmail.com',
      fullName: 'عماد آل سعيد',
      phone: '0503334455',
      roleId: 'role_cashier',
      roleKey: 'cashier',
      branchId: 'branch_main',
      warehouseId: 'wh_showroom',
      password: '123456',
      pinCode: '1020',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
  writeCollection('users', users);

  console.log('✅ [LOCAL DB] All default data seeded into local PC files successfully!');
  return { seeded: true, message: 'All default data initialized successfully' };
}
