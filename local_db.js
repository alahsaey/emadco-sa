/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Emadco ERP Local File-Based Database Engine
 * Direct local disk persistence for 100% offline computer operation.
 */
import fs from "fs";
import path from "path";
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create local database directory:", err);
  }
}
const memoryCache = {};
function getCollectionFilePath(collectionName) {
  const cleanName = collectionName.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(DATA_DIR, `${cleanName}.json`);
}
function readCollection(collectionName) {
  if (memoryCache[collectionName]) {
    return memoryCache[collectionName];
  }
  const filePath = getCollectionFilePath(collectionName);
  if (!fs.existsSync(filePath)) {
    memoryCache[collectionName] = [];
    return [];
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
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
function writeCollection(collectionName, items) {
  memoryCache[collectionName] = items;
  const filePath = getCollectionFilePath(collectionName);
  try {
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(items, null, 2), "utf-8");
    fs.renameSync(tempPath, filePath);
    return true;
  } catch (err) {
    console.error(`[LOCAL DB] Error saving collection ${collectionName} to disk:`, err);
    try {
      fs.writeFileSync(filePath, JSON.stringify(items, null, 2), "utf-8");
      return true;
    } catch (fallbackErr) {
      console.error(`[LOCAL DB] Direct write failed for ${collectionName}:`, fallbackErr);
      return false;
    }
  }
}
function getDocument(collectionName, id) {
  const items = readCollection(collectionName);
  return items.find((item) => String(item.id) === String(id)) || null;
}
function saveDocument(collectionName, docData) {
  if (!docData) throw new Error("Document data is required");
  const items = [...readCollection(collectionName)];
  const docId = docData.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const existingIndex = items.findIndex((item) => String(item.id) === String(docId));
  const fullDoc = {
    ...docData,
    id: docId,
    updatedAt: now
  };
  if (existingIndex >= 0) {
    items[existingIndex] = {
      ...items[existingIndex],
      ...fullDoc,
      createdAt: items[existingIndex].createdAt || now
    };
  } else {
    if (!fullDoc.createdAt) fullDoc.createdAt = now;
    items.unshift(fullDoc);
  }
  writeCollection(collectionName, items);
  return fullDoc;
}
function deleteDocument(collectionName, id) {
  const items = readCollection(collectionName);
  const filtered = items.filter((item) => String(item.id) !== String(id));
  if (filtered.length !== items.length) {
    writeCollection(collectionName, filtered);
    return true;
  }
  return false;
}
function applyBatch(operations) {
  const touchedCollections = /* @__PURE__ */ new Set();
  for (const op of operations) {
    const { type, collection, id, data } = op;
    if (!collection) continue;
    touchedCollections.add(collection);
    if (type === "delete" && id) {
      deleteDocument(collection, id);
    } else if ((type === "set" || type === "update") && data) {
      saveDocument(collection, { ...data, id: id || data.id });
    }
  }
  return true;
}
function getDatabaseStatus() {
  const collections = [
    "products",
    "categories",
    "brands",
    "units",
    "inventory",
    "inventory_movements",
    "sales",
    "sale_items",
    "invoices",
    "invoice_items",
    "customers",
    "suppliers",
    "purchases",
    "purchase_items",
    "payments",
    "payment_transactions",
    "returns",
    "return_items",
    "quotations",
    "quotation_items",
    "warehouses",
    "branches",
    "users",
    "roles",
    "permissions",
    "audit_logs",
    "system_settings",
    "tax_settings",
    "expenses"
  ];
  const report = {};
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
      } catch {
      }
    }
    report[name] = {
      count,
      filePath,
      sizeBytes: size,
      exists
    };
  }
  return {
    databaseLocation: DATA_DIR,
    storageType: "Direct Local Disk Files (JSON)",
    isOfflineReady: true,
    totalRecords,
    totalSizeBytes,
    totalSizeReadable: `${(totalSizeBytes / 1024).toFixed(2)} KB`,
    collections: report,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function seedDefaultDataIfEmpty(force = false) {
  const existingProducts = readCollection("products");
  if (existingProducts.length > 0 && !force) {
    return { seeded: false, message: "Database already contains data" };
  }
  console.log("\u{1F331} [LOCAL DB] Seeding initial construction materials catalog and warehouses...");
  const warehouses = [
    {
      id: "wh_main",
      nameAr: "\u0627\u0644\u0645\u0633\u062A\u0648\u062F\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
      code: "WH-01",
      branchId: "branch_main",
      location: "\u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0635\u0646\u0627\u0639\u064A\u0629 - \u0645\u0633\u062A\u0648\u062F\u0639 \u0627\u0644\u0645\u0648\u0627\u062F \u0627\u0644\u0645\u0631\u0643\u0632\u064A\u0629",
      managerName: "\u0623\u0628\u0648 \u0641\u0647\u062F \u0627\u0644\u0639\u062A\u064A\u0628\u064A",
      isPrimary: true,
      isActive: true,
      order: 1
    },
    {
      id: "wh_showroom",
      nameAr: "\u0645\u0633\u062A\u0648\u062F\u0639 \u0635\u0627\u0644\u0629 \u0627\u0644\u0639\u0631\u0636",
      code: "WH-02",
      branchId: "branch_main",
      location: "\u0645\u0639\u0631\u0636 \u0637\u0631\u064A\u0642 \u0627\u0644\u0645\u0644\u0643 \u0641\u0647\u062F",
      managerName: "\u0633\u0644\u0637\u0627\u0646 \u0627\u0644\u0642\u062D\u0637\u0627\u0646\u064A",
      isPrimary: false,
      isActive: true,
      order: 2
    }
  ];
  writeCollection("warehouses", warehouses);
  const categories = [
    { id: "cat_locks", nameAr: "\u0643\u0648\u0627\u0644\u064A\u0646 \u0648\u0623\u0642\u0641\u0627\u0644 \u0648\u0645\u0641\u0635\u0644\u0627\u062A", code: "LCK", isActive: true, order: 1 },
    { id: "cat_tools", nameAr: "\u0639\u062F\u062F \u0648\u0623\u062F\u0648\u0627\u062A \u064A\u062F\u0648\u064A\u0629 \u0648\u0635\u0646\u0627\u0639\u064A\u0629", code: "TLS", isActive: true, order: 2 },
    { id: "cat_sealants", nameAr: "\u0645\u0648\u0627\u062F \u0639\u0627\u0632\u0644\u0629 \u0648\u0633\u064A\u0644\u064A\u0643\u0648\u0646 \u0648\u063A\u0631\u0627\u0621", code: "SIL", isActive: true, order: 3 },
    { id: "cat_fasteners", nameAr: "\u0645\u0633\u0627\u0645\u064A\u0631 \u0648\u0628\u0631\u0627\u063A\u064A \u0648\u0645\u062B\u0628\u062A\u0627\u062A", code: "FST", isActive: true, order: 4 },
    { id: "cat_building", nameAr: "\u0645\u0648\u0627\u062F \u0628\u0646\u0627\u0621 \u0648\u062A\u0634\u0637\u064A\u0628 \u0639\u0627\u0645", code: "BLD", isActive: true, order: 5 }
  ];
  writeCollection("categories", categories);
  const brands = [
    { id: "br_ahram", nameAr: "\u0623\u0647\u0631\u0627\u0645 (Ahram)", country: "\u0645\u0635\u0631", isActive: true },
    { id: "br_stanley", nameAr: "\u0633\u062A\u0627\u0646\u0644\u064A (Stanley)", country: "\u0623\u0645\u0631\u064A\u0643\u0627", isActive: true },
    { id: "br_total", nameAr: "\u062A\u0648\u062A\u0627\u0644 (TOTAL Tools)", country: "\u0627\u0644\u0635\u064A\u0646", isActive: true },
    { id: "br_soudal", nameAr: "\u0633\u0648\u062F\u0627\u0644 (Soudal)", country: "\u0628\u0644\u062C\u064A\u0643\u0627", isActive: true },
    { id: "br_national", nameAr: "\u0627\u0644\u0648\u0637\u0646\u064A (National)", country: "\u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629", isActive: true }
  ];
  writeCollection("brands", brands);
  const units = [
    { id: "unit_piece", nameAr: "\u062D\u0628\u0629", symbol: "\u062D\u0628\u0629", isDefault: true, isActive: true },
    { id: "unit_box", nameAr: "\u0643\u0631\u062A\u0648\u0646", symbol: "\u0643\u0631\u062A\u0648\u0646", isDefault: false, isActive: true },
    { id: "unit_kg", nameAr: "\u0643\u064A\u0644\u0648\u062C\u0631\u0627\u0645", symbol: "\u0643\u062C\u0645", isDefault: false, isActive: true },
    { id: "unit_meter", nameAr: "\u0645\u062A\u0631 \u0637\u0648\u0644\u064A", symbol: "\u0645", isDefault: false, isActive: true },
    { id: "unit_set", nameAr: "\u0637\u0642\u0645", symbol: "\u0637\u0642\u0645", isDefault: false, isActive: true }
  ];
  writeCollection("units", units);
  const products = [
    {
      id: "prod_1",
      nameAr: "\u0643\u0627\u0644\u0648\u0646 \u0643\u0645\u0628\u064A\u0648\u062A\u0631 \u0623\u0647\u0631\u0627\u0645 \u0623\u0635\u0644\u064A \u0646\u062D\u0627\u0633 70 \u0645\u0644\u0645",
      sku: "LCK-AHRAM-70",
      barcode: "628100100001",
      categoryId: "cat_locks",
      brandId: "br_ahram",
      unitId: "unit_piece",
      costPrice: 45,
      retailPrice: 65,
      wholesalePrice: 58,
      contractorPrice: 54,
      minStock: 20,
      taxRate: 15,
      location: "\u0627\u0644\u0631\u0641 A-01",
      imageUrl: "https://images.unsplash.com/photo-1558002038-1055907df827?w=500&auto=format&fit=crop&q=60",
      isActive: true,
      isDeleted: false
    },
    {
      id: "prod_2",
      nameAr: "\u0642\u0641\u0644 \u0628\u0648\u0627\u0628\u0629 \u0641\u0648\u0644\u0627\u0630\u064A \u0635\u0644\u0628 \u0636\u062F \u0627\u0644\u0642\u0635 70 \u0645\u0644\u0645",
      sku: "LCK-STEEL-GATE",
      barcode: "628100100002",
      categoryId: "cat_locks",
      brandId: "br_ahram",
      unitId: "unit_piece",
      costPrice: 30,
      retailPrice: 48,
      wholesalePrice: 42,
      contractorPrice: 38,
      minStock: 15,
      taxRate: 15,
      location: "\u0627\u0644\u0631\u0641 A-02",
      imageUrl: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=500&auto=format&fit=crop&q=60",
      isActive: true,
      isDeleted: false
    },
    {
      id: "prod_3",
      nameAr: "\u0633\u064A\u0644\u064A\u0643\u0648\u0646 \u0623\u0644\u0645\u0627\u0646\u064A \u0645\u0627\u0646\u0639 \u0644\u0644\u062A\u0633\u0631\u0628 \u0634\u0641\u0627\u0641 (\u0623\u0646\u0628\u0648\u0628 300 \u0645\u0644)",
      sku: "SIL-CLEAR-300",
      barcode: "628100100003",
      categoryId: "cat_sealants",
      brandId: "br_soudal",
      unitId: "unit_piece",
      costPrice: 8.5,
      retailPrice: 15,
      wholesalePrice: 12,
      contractorPrice: 11,
      minStock: 50,
      taxRate: 15,
      location: "\u0627\u0644\u0631\u0641 B-01",
      imageUrl: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500&auto=format&fit=crop&q=60",
      isActive: true,
      isDeleted: false
    },
    {
      id: "prod_4",
      nameAr: "\u0645\u0633\u0627\u0645\u064A\u0631 \u0635\u0644\u0628 \u0645\u062C\u0644\u0641\u0646 \u0644\u0644\u062C\u0628\u0633 \u0648\u0627\u0644\u062E\u0634\u0628 3 \u0625\u0646\u0634 (\u0643\u0631\u062A\u0648\u0646 5 \u0643\u062C\u0645)",
      sku: "FST-SCREW-3IN",
      barcode: "628100100004",
      categoryId: "cat_fasteners",
      brandId: "br_national",
      unitId: "unit_box",
      costPrice: 22,
      retailPrice: 36,
      wholesalePrice: 30,
      contractorPrice: 28,
      minStock: 25,
      taxRate: 15,
      location: "\u0627\u0644\u0631\u0641 C-01",
      imageUrl: "https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?w=500&auto=format&fit=crop&q=60",
      isActive: true,
      isDeleted: false
    },
    {
      id: "prod_5",
      nameAr: "\u0632\u0631\u0627\u062F\u064A\u0629 \u0648\u0628\u0646\u0633\u0629 \u0643\u0647\u0631\u0628\u0627\u0621 \u0635\u0646\u0627\u0639\u064A\u0629 \u0645\u0639\u0632\u0648\u0644\u0629 8 \u0625\u0646\u0634",
      sku: "TLS-PLIER-8IN",
      barcode: "628100100005",
      categoryId: "cat_tools",
      brandId: "br_total",
      unitId: "unit_piece",
      costPrice: 18,
      retailPrice: 30,
      wholesalePrice: 25,
      contractorPrice: 22,
      minStock: 10,
      taxRate: 15,
      location: "\u0627\u0644\u0631\u0641 D-01",
      imageUrl: "https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=500&auto=format&fit=crop&q=60",
      isActive: true,
      isDeleted: false
    },
    {
      id: "prod_6",
      nameAr: "\u0637\u0642\u0645 \u0645\u0641\u0643\u0627\u062A \u0628\u0631\u0627\u063A\u064A \u0627\u062D\u062A\u0631\u0627\u0641\u064A 6 \u0642\u0637\u0639 \u0643\u0631\u0648\u0645 \u0641\u0627\u0646\u062F\u064A\u0648\u0645",
      sku: "TLS-SCREWDRIVER-SET",
      barcode: "628100100006",
      categoryId: "cat_tools",
      brandId: "br_stanley",
      unitId: "unit_set",
      costPrice: 38,
      retailPrice: 62,
      wholesalePrice: 52,
      contractorPrice: 48,
      minStock: 12,
      taxRate: 15,
      location: "\u0627\u0644\u0631\u0641 D-02",
      imageUrl: "https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=500&auto=format&fit=crop&q=60",
      isActive: true,
      isDeleted: false
    },
    {
      id: "prod_7",
      nameAr: "\u0634\u0631\u064A\u0637 \u0644\u0627\u0635\u0642 \u0639\u0627\u0632\u0644 \u0644\u0644\u0643\u0647\u0631\u0628\u0627\u0621 \u0648\u0627\u0644\u0631\u0637\u0648\u0628\u0629 (\u0637\u0642\u0645 10 \u0631\u0648\u0644)",
      sku: "SIL-TAPE-ELEC",
      barcode: "628100100007",
      categoryId: "cat_sealants",
      brandId: "br_national",
      unitId: "unit_set",
      costPrice: 12,
      retailPrice: 22,
      wholesalePrice: 18,
      contractorPrice: 16,
      minStock: 30,
      taxRate: 15,
      location: "\u0627\u0644\u0631\u0641 B-02",
      imageUrl: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500&auto=format&fit=crop&q=60",
      isActive: true,
      isDeleted: false
    },
    {
      id: "prod_8",
      nameAr: "\u0632\u0648\u0627\u064A\u0627 \u062A\u062B\u0628\u064A\u062A \u062D\u062F\u064A\u062F \u0645\u062C\u0644\u0641\u0646 \u0645\u0642\u0648\u0649 4\xD74 \u0633\u0645 (\u0637\u0631\u062F 50 \u062D\u0628\u0629)",
      sku: "BLD-ANGLE-4X4",
      barcode: "628100100008",
      categoryId: "cat_building",
      brandId: "br_national",
      unitId: "unit_box",
      costPrice: 28,
      retailPrice: 45,
      wholesalePrice: 38,
      contractorPrice: 34,
      minStock: 20,
      taxRate: 15,
      location: "\u0627\u0644\u0631\u0641 C-02",
      imageUrl: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=500&auto=format&fit=crop&q=60",
      isActive: true,
      isDeleted: false
    }
  ];
  writeCollection("products", products);
  const stockLevels = [
    { prodId: "prod_1", qty: 120, avgCost: 45 },
    { prodId: "prod_2", qty: 85, avgCost: 30 },
    { prodId: "prod_3", qty: 240, avgCost: 8.5 },
    { prodId: "prod_4", qty: 90, avgCost: 22 },
    { prodId: "prod_5", qty: 65, avgCost: 18 },
    { prodId: "prod_6", qty: 45, avgCost: 38 },
    { prodId: "prod_7", qty: 150, avgCost: 12 },
    { prodId: "prod_8", qty: 110, avgCost: 28 }
  ];
  const inventories = [];
  const inventoryMovements = [];
  const now = (/* @__PURE__ */ new Date()).toISOString();
  for (const item of stockLevels) {
    const invId = `inv_${item.prodId}_wh_main`;
    inventories.push({
      id: invId,
      productId: item.prodId,
      warehouseId: "wh_main",
      quantityOnHand: item.qty,
      reservedQuantity: 0,
      availableQuantity: item.qty,
      averageCost: item.avgCost,
      lastUpdated: now
    });
    inventoryMovements.push({
      id: `mov_init_${item.prodId}`,
      productId: item.prodId,
      warehouseId: "wh_main",
      movementType: "purchase",
      referenceId: "INIT-STOCK-001",
      quantity: item.qty,
      unitCost: item.avgCost,
      previousQty: 0,
      newQty: item.qty,
      notes: "\u0631\u0635\u064A\u062F \u0645\u062E\u0632\u0648\u0646 \u0627\u0641\u062A\u062A\u0627\u062D\u064A \u0645\u0639\u062A\u0645\u062F \u0645\u062D\u0644\u064A\u0627\u064B",
      createdAt: now,
      createdBy: "\u0635\u0627\u0644\u062D \u062D\u062C\u064A \u0645\u0628\u0627\u0631\u0643 \u0627\u0644\u064A\u0627\u0633\u064A\u0646"
    });
  }
  writeCollection("inventory", inventories);
  writeCollection("inventory_movements", inventoryMovements);
  const customers = [
    {
      id: "cust_walk_in",
      name: "\u0639\u0645\u064A\u0644 \u0646\u0642\u062F\u064A \u0645\u0628\u0627\u0634\u0631",
      phone: "0500000000",
      customerType: "retail",
      priceTier: "retail",
      creditLimit: 0,
      currentBalance: 0,
      createdAt: now
    },
    {
      id: "cust_contractor_1",
      name: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0645\u0642\u0627\u0648\u0644\u0627\u062A \u0627\u0644\u062D\u062F\u064A\u062B\u0629 \u0644\u0644\u062A\u0637\u0648\u064A\u0631",
      phone: "0551234567",
      customerType: "contractor",
      priceTier: "contractor",
      taxNumber: "310948572100001",
      creditLimit: 75e3,
      currentBalance: 0,
      createdAt: now
    },
    {
      id: "cust_contractor_2",
      name: "\u0645\u0624\u0633\u0633\u0629 \u0627\u0644\u0623\u0641\u0642 \u0644\u0644\u062A\u0639\u0645\u064A\u0631 \u0648\u0627\u0644\u062F\u064A\u0643\u0648\u0631",
      phone: "0569876543",
      customerType: "contractor",
      priceTier: "contractor",
      taxNumber: "310948572100002",
      creditLimit: 5e4,
      currentBalance: 0,
      createdAt: now
    }
  ];
  writeCollection("customers", customers);
  const suppliers = [
    {
      id: "supp_1",
      name: "\u0645\u0635\u0646\u0639 \u0627\u0644\u0623\u0647\u0631\u0627\u0645 \u0644\u0644\u0623\u0642\u0641\u0627\u0644 \u0648\u0627\u0644\u0645\u0641\u0635\u0644\u0627\u062A",
      contactPerson: "\u0645. \u0623\u062D\u0645\u062F \u0627\u0644\u0634\u0646\u0627\u0648\u064A",
      phone: "0501112233",
      email: "ahram-sales@example.com",
      taxNumber: "300123456700003",
      city: "\u0627\u0644\u062F\u0645\u0627\u0645",
      balance: 0,
      createdAt: now
    },
    {
      id: "supp_2",
      name: "\u0634\u0631\u0643\u0629 \u062A\u0648\u0631\u064A\u062F\u0627\u062A \u0633\u0648\u062F\u0627\u0644 \u0644\u0644\u0643\u064A\u0645\u0627\u0648\u064A\u0627\u062A \u0648\u0627\u0644\u0639\u0632\u0644",
      contactPerson: "\u0623. \u0637\u0627\u0631\u0642 \u0631\u0636\u0648\u0627\u0646",
      phone: "0504445566",
      email: "soudal-sa@example.com",
      taxNumber: "300987654300003",
      city: "\u0627\u0644\u0631\u064A\u0627\u0636",
      balance: 0,
      createdAt: now
    },
    {
      id: "supp_3",
      name: "\u0627\u0644\u0645\u0635\u0646\u0639 \u0627\u0644\u0648\u0637\u0646\u064A \u0644\u0644\u0645\u0633\u0627\u0645\u064A\u0631 \u0648\u0627\u0644\u0645\u062B\u0628\u062A\u0627\u062A \u0627\u0644\u062D\u062F\u064A\u062F\u064A\u0629",
      contactPerson: "\u0645. \u062E\u0627\u0644\u062F \u0627\u0644\u062F\u0648\u0633\u0631\u064A",
      phone: "0507778899",
      email: "national-screws@example.com",
      taxNumber: "300555666700003",
      city: "\u0627\u0644\u062C\u0628\u064A\u0644",
      balance: 0,
      createdAt: now
    }
  ];
  writeCollection("suppliers", suppliers);
  const users = [
    {
      id: "user_owner",
      email: "alahsaey@gmail.com",
      fullName: "\u0635\u0627\u0644\u062D \u062D\u062C\u064A \u0645\u0628\u0627\u0631\u0643 \u0627\u0644\u064A\u0627\u0633\u064A\u0646",
      phone: "0500680180",
      roleId: "role_system_owner",
      roleKey: "system_owner",
      branchId: "branch_main",
      warehouseId: "wh_main",
      password: "123456",
      pinCode: "3254",
      isActive: true,
      customPermissions: ["all"],
      createdAt: now,
      updatedAt: now
    },
    {
      id: "user_manager",
      email: "amad.co2009@gmail.com",
      fullName: "\u0639\u0645\u0627\u062F \u0633\u0639\u062F \u0622\u0644 \u0633\u0639\u064A\u062F",
      phone: "0502223344",
      roleId: "role_manager",
      roleKey: "manager",
      branchId: "branch_main",
      warehouseId: "wh_main",
      password: "123456",
      pinCode: "1188",
      isActive: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "user_cashier",
      email: "amad.co2009@gmail.com",
      fullName: "\u0639\u0645\u0627\u062F \u0622\u0644 \u0633\u0639\u064A\u062F",
      phone: "0503334455",
      roleId: "role_cashier",
      roleKey: "cashier",
      branchId: "branch_main",
      warehouseId: "wh_showroom",
      password: "123456",
      pinCode: "1020",
      isActive: true,
      createdAt: now,
      updatedAt: now
    }
  ];
  writeCollection("users", users);
  console.log("\u2705 [LOCAL DB] All default data seeded into local PC files successfully!");
  return { seeded: true, message: "All default data initialized successfully" };
}
export {
  DATA_DIR,
  applyBatch,
  deleteDocument,
  getCollectionFilePath,
  getDatabaseStatus,
  getDocument,
  readCollection,
  saveDocument,
  seedDefaultDataIfEmpty,
  writeCollection
};
