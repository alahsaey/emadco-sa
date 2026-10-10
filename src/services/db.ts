/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  orderBy,
  getCountFromServer,
  DocumentData,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  DatabaseCollectionName,
  Product,
  Category,
  Brand,
  Unit,
  ProductVariant,
  Inventory,
  InventoryMovement,
  InventoryMovementType,
  Customer,
  Supplier,
  Warehouse,
  Branch,
  User,
  Role,
} from '../types';
import { logAuditEvent } from './audit';

/**
 * تنظيف الكائنات والتخلص تماماً من أي قيم undefined قبل إرسالها لـ Firestore
 * لمنع الخطأ الشهير: Unsupported field value: undefined
 */
export function cleanFirestoreData<T extends Record<string, any>>(obj: T): T {
  if (obj === null || obj === undefined) return {} as T;
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue; // تخطي الحقول غير المعرفة
    }
    if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item !== null && typeof item === 'object' && !(item instanceof Date)
          ? cleanFirestoreData(item)
          : item
      );
    } else if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
      result[key] = cleanFirestoreData(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

const WAREHOUSES_STORAGE_KEY = 'emadco_warehouses_v1';

export const DEFAULT_WAREHOUSES: Warehouse[] = [
  {
    id: 'wh_main',
    nameAr: 'المستودع الرئيسي',
    code: 'WH-01',
    branchId: 'branch_main',
    location: 'المنطقة المركزية - المستودع 1',
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
    location: 'معرض المبيعات',
    managerName: 'سلطان القحطاني',
    isPrimary: false,
    isActive: true,
    order: 2,
  },
];

/**
 * جلب جميع المستندات من مجموعة معينة
 */
export async function getCollectionDocs<T = DocumentData>(collectionName: DatabaseCollectionName, maxResults = 50): Promise<T[]> {
  try {
    const colRef = collection(db, collectionName);
    const q = query(colRef, limit(maxResults));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as T[];
  } catch (error) {
    console.error(`خطأ في جلب بيانات المجموعة ${collectionName}:`, error);
    throw error;
  }
}

/**
 * جلب قائمة المنتجات
 */
export async function getProducts(maxResults = 200): Promise<Product[]> {
  return getCollectionDocs<Product>('products', maxResults);
}

/**
 * دالة مركزية وموحدة لفرز المستودعات بدقة متطابقة في كل أرجاء النظام:
 * 1. المستودعات النشطة أولاً ثم غير النشطة
 * 2. حسب رقم الترتيب اليدوي المعتمد (order: 1, 2, 3...)
 * 3. المستودع الرئيسي أولاً في حال تساوي الترتيب
 * 4. أبجدياً بحسب الاسم العربي
 */
export function sortWarehouses(list: Warehouse[]): Warehouse[] {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    // 1. النشط قبل غير النشط
    const activeA = a.isActive !== false ? 1 : 0;
    const activeB = b.isActive !== false ? 1 : 0;
    if (activeA !== activeB) return activeB - activeA;

    // 2. الترتيب الرقمي المعين
    const orderA = typeof a.order === 'number' && !isNaN(a.order) ? a.order : 999;
    const orderB = typeof b.order === 'number' && !isNaN(b.order) ? b.order : 999;
    if (orderA !== orderB) return orderA - orderB;

    // 3. المستودع الرئيسي أولاً
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;

    // 4. أبجدياً بحسب الاسم العربي
    return (a.nameAr || '').localeCompare(b.nameAr || '', 'ar');
  });
}

/**
 * جلب قائمة المستودعات (مع كاش محلي فوري ومزامنة Firestore مرتبة حسب الترتيب المعتمد)
 */
export async function getWarehouses(maxResults = 50): Promise<Warehouse[]> {
  try {
    // محاولة الجلب من التخزين المحلي أولاً لسرعة الاستجابة ومراعاة الترتيب الفوري
    let localList: Warehouse[] = [];
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(WAREHOUSES_STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localList = sortWarehouses(parsed);
          }
        } catch {}
      }
    }

    // جلب المستودعات من السحابة
    const cloudWarehouses = await getCollectionDocs<Warehouse>('warehouses', maxResults).catch(() => []);

    if (cloudWarehouses.length > 0) {
      // دمج بيانات السحابة مع الترتيب والبيانات المحلية
      const mergedList = cloudWarehouses.map((cWh) => {
        const localMatch = localList.find((lWh) => lWh.id === cWh.id);
        return {
          ...cWh,
          order: typeof cWh.order === 'number' && !isNaN(cWh.order) ? cWh.order : (localMatch?.order ?? 999),
          isPrimary: cWh.isPrimary !== undefined ? cWh.isPrimary : (localMatch?.isPrimary ?? false),
        };
      });
      const sortedCloud = sortWarehouses(mergedList);
      if (typeof window !== 'undefined') {
        localStorage.setItem(WAREHOUSES_STORAGE_KEY, JSON.stringify(sortedCloud));
      }
      return sortedCloud;
    }

    if (localList.length > 0) {
      return localList;
    }

    // إذا كانت السحابة والمحلي فارغين، نعتمد الافتراضي ونحفظه في السحابة
    const initialList = sortWarehouses(DEFAULT_WAREHOUSES);
    if (typeof window !== 'undefined') {
      localStorage.setItem(WAREHOUSES_STORAGE_KEY, JSON.stringify(initialList));
    }

    // حفظ في Firestore
    for (const wh of initialList) {
      try {
        await setDoc(doc(db, 'warehouses', wh.id), cleanFirestoreData(wh), { merge: true });
      } catch (e) {
        console.warn('تعذر حفظ المستودع المبدئي في Firestore:', e);
      }
    }

    return initialList;
  } catch (error) {
    console.warn('خطأ في جلب المستودعات:', error);
    return sortWarehouses(DEFAULT_WAREHOUSES);
  }
}

/**
 * إنشاء مستودع مخصص جديد
 */
export async function createWarehouse(
  warehouseData: Omit<Warehouse, 'id'>,
  actorName = 'مالك المنشأة'
): Promise<Warehouse> {
  const newId = `wh_${Date.now()}`;
  
  // حساب الترتيب التالي
  let currentList: Warehouse[] = [];
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(WAREHOUSES_STORAGE_KEY);
      currentList = raw ? JSON.parse(raw) : DEFAULT_WAREHOUSES;
    } catch {
      currentList = DEFAULT_WAREHOUSES;
    }
  }

  const nextOrder = (currentList.length > 0 ? Math.max(...currentList.map(w => w.order || 0), currentList.length) : 0) + 1;

  const newWarehouse: Warehouse = {
    id: newId,
    nameAr: warehouseData.nameAr.trim(),
    code: warehouseData.code?.trim() || `WH-${Math.floor(10 + Math.random() * 90)}`,
    branchId: warehouseData.branchId || 'branch_main',
    location: warehouseData.location?.trim() || '',
    managerName: warehouseData.managerName?.trim() || '',
    isPrimary: warehouseData.isPrimary ?? false,
    isActive: warehouseData.isActive ?? true,
    order: warehouseData.order ?? nextOrder,
  };

  // إذا تم تعيين هذا المستودع كرئيسي، نقوم بإلغاء صفة الرئيسي عن باقي المستودعات
  let updatedList = [...currentList.filter((w) => w.id !== newId)];
  if (newWarehouse.isPrimary) {
    updatedList = updatedList.map((w) => ({ ...w, isPrimary: false }));
  }
  updatedList.push(newWarehouse);
  const sorted = sortWarehouses(updatedList);

  // 1. حفظ في التخزين المحلي فوراً وبث الحدث
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(WAREHOUSES_STORAGE_KEY, JSON.stringify(sorted));
      window.dispatchEvent(new CustomEvent('warehouses-changed', { detail: sorted }));
    } catch {}
  }

  // 2. حفظ في Firestore
  try {
    await setDoc(doc(db, 'warehouses', newId), cleanFirestoreData(newWarehouse), { merge: true });
    if (newWarehouse.isPrimary) {
      for (const w of currentList) {
        if (w.id !== newId && w.isPrimary) {
          await setDoc(doc(db, 'warehouses', w.id), { isPrimary: false }, { merge: true });
        }
      }
    }
  } catch (e) {
    console.warn('فشل حفظ المستودع في Firestore:', e);
  }

  await logAuditEvent({
    userName: actorName,
    action: 'CREATE',
    entity: 'warehouses',
    entityId: newId,
    details: `تمت إضافة مستودع جديد مخصص: ${newWarehouse.nameAr} (${newWarehouse.code})`,
  });

  return newWarehouse;
}

/**
 * تحديث بيانات مستودع
 */
export async function updateWarehouse(
  id: string,
  updates: Partial<Warehouse>,
  actorName = 'المدير'
): Promise<void> {
  let updatedList: Warehouse[] = [];
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(WAREHOUSES_STORAGE_KEY);
      const list: Warehouse[] = raw ? JSON.parse(raw) : DEFAULT_WAREHOUSES;
      updatedList = list.map((w) => {
        if (w.id === id) {
          return { ...w, ...updates };
        }
        if (updates.isPrimary) {
          return { ...w, isPrimary: false };
        }
        return w;
      });
      const sorted = sortWarehouses(updatedList);
      localStorage.setItem(WAREHOUSES_STORAGE_KEY, JSON.stringify(sorted));
      window.dispatchEvent(new CustomEvent('warehouses-changed', { detail: sorted }));
    } catch {}
  }

  try {
    const docRef = doc(db, 'warehouses', id);
    await setDoc(docRef, cleanFirestoreData(updates), { merge: true });
    if (updates.isPrimary) {
      for (const w of updatedList) {
        if (w.id !== id && w.isPrimary) {
          await setDoc(doc(db, 'warehouses', w.id), { isPrimary: false }, { merge: true });
        }
      }
    }
  } catch (e) {
    console.warn('تعذر تحديث المستودع في Firestore:', e);
  }

  await logAuditEvent({
    userName: actorName,
    action: 'UPDATE',
    entity: 'warehouses',
    entityId: id,
    details: `تم تعديل بيانات المستودع: ${updates.nameAr || id}`,
  });
}

/**
 * حذف مستودع
 */
export async function deleteWarehouse(id: string, warehouseName: string, actorName = 'المدير'): Promise<void> {
  let remainingSorted: Warehouse[] = [];
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(WAREHOUSES_STORAGE_KEY);
      const list: Warehouse[] = raw ? JSON.parse(raw) : DEFAULT_WAREHOUSES;
      const filtered = list.filter((w) => w.id !== id);
      remainingSorted = sortWarehouses(filtered).map((wh, idx) => ({
        ...wh,
        order: idx + 1,
      }));
      localStorage.setItem(WAREHOUSES_STORAGE_KEY, JSON.stringify(remainingSorted));
      window.dispatchEvent(new CustomEvent('warehouses-changed', { detail: remainingSorted }));
    } catch {}
  }

  try {
    await deleteDoc(doc(db, 'warehouses', id));
  } catch (e) {
    console.warn('تعذر حذف المستودع من Firestore:', e);
  }

  await logAuditEvent({
    userName: actorName,
    action: 'DELETE',
    entity: 'warehouses',
    entityId: id,
    details: `تم حذف المستودع: ${warehouseName}`,
  });
}

/**
 * تحديث ترتيب المستودعات في النظام وقاعدة البيانات
 */
export async function reorderWarehouses(
  orderedWarehouses: Warehouse[],
  actorName = 'المدير'
): Promise<Warehouse[]> {
  const updatedList: Warehouse[] = orderedWarehouses.map((wh, idx) => ({
    ...wh,
    order: idx + 1,
  }));

  // 1. حفظ في التخزين المحلي فوراً لسرعة الاستجابة وبث الحدث
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(WAREHOUSES_STORAGE_KEY, JSON.stringify(updatedList));
      window.dispatchEvent(new CustomEvent('warehouses-changed', { detail: updatedList }));
    } catch {}
  }

  // 2. تحديث المستودعات في Firestore
  for (const wh of updatedList) {
    try {
      await setDoc(doc(db, 'warehouses', wh.id), { order: wh.order }, { merge: true });
    } catch (e) {
      console.warn(`تعذر حفظ ترتيب المستودع ${wh.id} في Firestore:`, e);
    }
  }

  await logAuditEvent({
    userName: actorName,
    action: 'UPDATE',
    entity: 'warehouses',
    details: `تم إعادة ترتيب المستودعات: ${updatedList.map((w, idx) => `#${idx + 1} ${w.nameAr}`).join(' | ')}`,
  });

  return updatedList;
}

/**
 * جلب مستند محدد بواسطة الـ ID
 */
export async function getDocumentById<T = DocumentData>(collectionName: DatabaseCollectionName, id: string): Promise<T | null> {
  try {
    const docRef = doc(db, collectionName, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as T;
  } catch (error) {
    console.error(`خطأ في جلب المستند ${id} من ${collectionName}:`, error);
    throw error;
  }
}

/**
 * جلب إحصائيات وعدد المستندات في كافة الجداول
 */
export async function getCollectionsOverview(): Promise<Record<DatabaseCollectionName, number>> {
  const collectionList: DatabaseCollectionName[] = [
    'users',
    'roles',
    'permissions',
    'user_roles',
    'products',
    'categories',
    'brands',
    'units',
    'product_variants',
    'customers',
    'suppliers',
    'warehouses',
    'branches',
    'inventory',
    'inventory_movements',
    'purchases',
    'purchase_items',
    'sales',
    'sale_items',
    'invoices',
    'invoice_items',
    'payments',
    'payment_transactions',
    'returns',
    'return_items',
    'quotations',
    'quotation_items',
    'tax_settings',
    'electronic_invoices',
    'pos_integrations',
    'payment_methods',
    'audit_logs',
    'system_settings',
  ];

  const results: Partial<Record<DatabaseCollectionName, number>> = {};

  await Promise.all(
    collectionList.map(async (colName) => {
      try {
        const coll = collection(db, colName);
        const snapshot = await getCountFromServer(coll);
        results[colName] = snapshot.data().count;
      } catch (e) {
        // في حال عدم توفر المستند بعد
        results[colName] = 0;
      }
    })
  );

  return results as Record<DatabaseCollectionName, number>;
}

/**
 * إضافة منتج جديد مع المخزون الافتتاحي وسجل التدقيق
 */
export async function createProduct(
  productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>,
  actorName = 'المدير',
  initialStock = 0,
  warehouseId = 'wh_main'
): Promise<string> {
  // التحقق من صحة المدخلات (Validation)
  if (!productData.nameAr?.trim()) {
    throw new Error('اسم المنتج بالعربية مطلوب.');
  }
  if (!productData.sku?.trim()) {
    throw new Error('رمز الصنف (SKU) مطلوب.');
  }
  if (productData.costPrice < 0 || productData.retailPrice < 0) {
    throw new Error('أسعار التكلفة والبيع يجب أن تكون قيماً موجبة.');
  }

  const now = new Date().toISOString();
  const newDoc: Omit<Product, 'id'> = cleanFirestoreData({
    ...productData,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  });

  const docRef = await addDoc(collection(db, 'products'), newDoc);
  const productId = docRef.id;

  // إنشاء سجل المخزون الأولي في المستودع
  const initialQty = Math.max(0, Number(initialStock) || 0);
  const invId = `inv_${productId}_${warehouseId}`;
  const invDoc: Inventory = cleanFirestoreData({
    id: invId,
    productId,
    warehouseId,
    quantityOnHand: initialQty,
    reservedQuantity: 0,
    availableQuantity: initialQty,
    averageCost: productData.costPrice,
    lastUpdated: now,
  });
  await setDoc(doc(db, 'inventory', invId), invDoc, { merge: true });

  // إذا كان هناك رصيد افتتاحي، تسجيل حركة مخزون
  if (initialQty > 0) {
    const movId = `mov_init_${productId}_${Date.now()}`;
    const movDoc: InventoryMovement = cleanFirestoreData({
      id: movId,
      productId,
      warehouseId,
      movementType: 'purchase',
      referenceId: `INIT-${productId.substring(0, 6).toUpperCase()}`,
      quantity: initialQty,
      unitCost: productData.costPrice,
      previousQty: 0,
      newQty: initialQty,
      notes: 'رصيد افتتاحي معتمد عند إضافة المنتج',
      createdAt: now,
      createdBy: actorName,
    });
    await setDoc(doc(db, 'inventory_movements', movId), movDoc, { merge: true });
  }

  await logAuditEvent({
    userName: actorName,
    action: 'CREATE',
    entity: 'products',
    entityId: productId,
    details: `تمت إضافة منتج جديد: ${productData.nameAr} برمز ${productData.sku} ورصيد افتتاحي ${initialQty}`,
  });

  return productId;
}

/**
 * تحديث بيانات منتج
 */
export async function updateProduct(id: string, updates: Partial<Product>, actorName = 'المشرف'): Promise<void> {
  const docRef = doc(db, 'products', id);
  await setDoc(docRef, cleanFirestoreData({
    ...updates,
    updatedAt: new Date().toISOString(),
  }), { merge: true });

  await logAuditEvent({
    userName: actorName,
    action: 'UPDATE',
    entity: 'products',
    entityId: id,
    details: `تم تحديث بيانات المنتج: ${updates.nameAr || id}`,
  });
}

/**
 * تعطيل أو تفعيل منتج (Toggle Active)
 */
export async function toggleProductActive(id: string, currentStatus: boolean, productName: string, actorName = 'المشرف'): Promise<void> {
  const newStatus = !currentStatus;
  await updateDoc(doc(db, 'products', id), {
    isActive: newStatus,
    updatedAt: new Date().toISOString(),
  });

  await logAuditEvent({
    userName: actorName,
    action: 'UPDATE',
    entity: 'products',
    entityId: id,
    details: `تم ${newStatus ? 'تفعيل' : 'تعطيل'} المنتج: ${productName}`,
  });
}

/**
 * حذف منطقي للمنتج (Soft Delete)
 */
export async function softDeleteProduct(id: string, productName: string, actorName = 'الدعم الفني Admin'): Promise<void> {
  await updateDoc(doc(db, 'products', id), {
    isDeleted: true,
    isActive: false,
    updatedAt: new Date().toISOString(),
  });

  await logAuditEvent({
    userName: actorName,
    action: 'DELETE',
    entity: 'products',
    entityId: id,
    details: `تم حذف المنتج منطقياً (Soft Delete): ${productName}`,
  });
}

/**
 * استعادة منتج محذوف منطقياً (Restore)
 */
export async function restoreProduct(id: string, productName: string, actorName = 'الدعم الفني Admin'): Promise<void> {
  await updateDoc(doc(db, 'products', id), {
    isDeleted: false,
    isActive: true,
    updatedAt: new Date().toISOString(),
  });

  await logAuditEvent({
    userName: actorName,
    action: 'UPDATE',
    entity: 'products',
    entityId: id,
    details: `تم استعادة المنتج المحذوف: ${productName}`,
  });
}

/**
 * حذف نهائي لمنتج من قاعدة البيانات (Hard Delete)
 */
export async function hardDeleteProduct(id: string, productName: string, actorName = 'الدعم الفني Admin'): Promise<void> {
  await deleteDoc(doc(db, 'products', id));
  await logAuditEvent({
    userName: actorName,
    action: 'DELETE',
    entity: 'products',
    entityId: id,
    details: `تم الحذف النهائي للمنتج من النظام: ${productName}`,
  });
}

/**
 * جلب خيارات ومتغيرات المنتج (Variants)
 */
export async function getProductVariants(productId: string): Promise<ProductVariant[]> {
  try {
    const q = query(
      collection(db, 'product_variants'),
      where('productId', '==', productId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProductVariant));
  } catch (error) {
    console.error(`خطأ في جلب متغيرات المنتج ${productId}:`, error);
    return [];
  }
}

/**
 * إضافة خيار/متغير جديد لمنتج (Variant)
 */
export async function createProductVariant(
  variantData: Omit<ProductVariant, 'id'>,
  actorName = 'المدير'
): Promise<string> {
  const docRef = await addDoc(collection(db, 'product_variants'), variantData);
  await logAuditEvent({
    userName: actorName,
    action: 'CREATE',
    entity: 'product_variants',
    entityId: docRef.id,
    details: `تمت إضافة متغير جديد: ${variantData.variantNameAr} برمز ${variantData.variantSku}`,
  });
  return docRef.id;
}

/**
 * حذف متغير لمنتج
 */
export async function deleteProductVariant(variantId: string, variantName: string, actorName = 'المدير'): Promise<void> {
  await deleteDoc(doc(db, 'product_variants', variantId));
  await logAuditEvent({
    userName: actorName,
    action: 'DELETE',
    entity: 'product_variants',
    entityId: variantId,
    details: `تم حذف المتغير: ${variantName}`,
  });
}

/**
 * جلب بيانات المخزون لمنتج معين
 */
export async function getProductInventory(productId: string): Promise<Inventory[]> {
  try {
    const q = query(
      collection(db, 'inventory'),
      where('productId', '==', productId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Inventory));
  } catch (error) {
    console.error('خطأ في جلب مخزون المنتج:', error);
    return [];
  }
}

/**
 * جلب جميع حركات المخزون مع إمكانية التصفية
 */
export async function getInventoryMovements(productId?: string, maxResults = 100): Promise<InventoryMovement[]> {
  try {
    const colRef = collection(db, 'inventory_movements');
    let q = query(colRef, limit(maxResults));
    if (productId) {
      q = query(colRef, where('productId', '==', productId), limit(maxResults));
    }
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryMovement));
    // ترتيب تنازلي حسب التاريخ
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('خطأ في جلب حركات المخزون:', error);
    return [];
  }
}

/**
 * تسجيل حركة مخزون جديدة وتحديث رصيد المستودع فوراً
 */
export interface RecordMovementParams {
  productId: string;
  productName: string;
  warehouseId: string;
  movementType: InventoryMovementType;
  quantity: number; // قيمة مطلقة موجبة يحددها المستخدم
  unitCost: number;
  referenceId: string;
  notes?: string;
  actorName: string;
}

export async function recordInventoryMovement(params: RecordMovementParams): Promise<InventoryMovement> {
  const {
    productId,
    productName,
    warehouseId,
    movementType,
    quantity,
    unitCost,
    referenceId,
    notes,
    actorName,
  } = params;

  if (quantity <= 0 && movementType !== 'adjustment') {
    throw new Error('الكمية يجب أن تكون أكبر من الصفر.');
  }

  const now = new Date().toISOString();
  const invId = `inv_${productId}_${warehouseId}`;
  const invRef = doc(db, 'inventory', invId);
  const invSnap = await getDoc(invRef);

  let previousQty = 0;
  let reservedQty = 0;

  if (invSnap.exists()) {
    const existing = invSnap.data() as Inventory;
    previousQty = existing.quantityOnHand || 0;
    reservedQty = existing.reservedQuantity || 0;
  }

  // حساب الكمية الجديدة حسب نوع الحركة:
  // إضافة (وارد): purchase, return, transfer_in
  // صرف (صادر): sale, damage, waste, transfer_out
  // تسوية جردية: adjustment (تحديد الرصيد الفعلي الجديد أو فرق التعديل)
  let newQty = previousQty;
  let actualDelta = quantity;

  if (['purchase', 'return', 'transfer_in'].includes(movementType)) {
    newQty = previousQty + quantity;
    actualDelta = quantity;
  } else if (['sale', 'damage', 'waste', 'transfer_out'].includes(movementType)) {
    if (quantity > previousQty) {
      throw new Error(`الكمية المطلوبة (${quantity}) تفوق الرصيد الحالي المتوفر (${previousQty}).`);
    }
    newQty = Math.max(0, previousQty - quantity);
    actualDelta = -quantity;
  } else if (movementType === 'adjustment') {
    // في التسوية، quantity هي الكمية الفعلية المحصورة في الجرد
    newQty = Math.max(0, quantity);
    actualDelta = newQty - previousQty;
  }

  const availableQty = Math.max(0, newQty - reservedQty);

  // 1. تحديث أو إنشاء سجل المخزون
  const updatedInv: Inventory = {
    id: invId,
    productId,
    warehouseId,
    quantityOnHand: newQty,
    reservedQuantity: reservedQty,
    availableQuantity: availableQty,
    averageCost: unitCost > 0 ? unitCost : (invSnap.exists() ? (invSnap.data() as Inventory).averageCost : 0),
    lastUpdated: now,
  };
  await setDoc(invRef, updatedInv);

  // 2. تسجيل حركة المخزون
  const movDocRef = await addDoc(collection(db, 'inventory_movements'), {
    productId,
    warehouseId,
    movementType,
    referenceId: referenceId || `MOV-${Date.now().toString().slice(-6)}`,
    quantity: actualDelta,
    unitCost,
    previousQty,
    newQty,
    notes: notes || '',
    createdAt: now,
    createdBy: actorName,
  });

  // 3. توثيق في سجل التدقيق
  const typeLabels: Record<InventoryMovementType, string> = {
    purchase: 'توريد / شراء',
    sale: 'صرف / بيع',
    transfer_in: 'تحويل وارد',
    transfer_out: 'تحويل صادر',
    adjustment: 'تسوية جرد',
    damage: 'إثبات تالف',
    waste: 'إثبات هالك',
    return: 'مرتجع',
  };

  await logAuditEvent({
    userName: actorName,
    action: 'INVENTORY_ADJUST',
    entity: 'inventory',
    entityId: productId,
    details: `حركة مخزون [${typeLabels[movementType]}]: صنف ${productName} - الرصيد السابق: ${previousQty} ← الرصيد الجديد: ${newQty} (فارق ${actualDelta > 0 ? '+' : ''}${actualDelta})`,
  });

  return {
    id: movDocRef.id,
    productId,
    warehouseId,
    movementType,
    referenceId: referenceId || `MOV-${Date.now().toString().slice(-6)}`,
    quantity: actualDelta,
    unitCost,
    previousQty,
    newQty,
    notes,
    createdAt: now,
    createdBy: actorName,
  };
}

/**
 * توريد سريع لرصيد صنف في مستودع محدد (Quick Stock Replenishment)
 */
export async function quickReplenishProductStock(
  productId: string,
  productName: string,
  warehouseId: string,
  quantityToAdd: number,
  unitCost = 0,
  actorName = 'مسؤول المبيعات'
): Promise<InventoryMovement> {
  return recordInventoryMovement({
    productId,
    productName,
    warehouseId,
    movementType: 'purchase',
    quantity: Math.max(1, quantityToAdd),
    unitCost,
    referenceId: `QUICK-SUPPLY-${Date.now().toString().slice(-6)}`,
    notes: `توريد وتغذية رصيد عاجل لتغطية المبيعات / عروض الأسعار`,
    actorName,
  });
}
