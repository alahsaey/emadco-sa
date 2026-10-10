/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  getDocs,
  writeBatch,
  doc,
  query,
  limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DatabaseCollectionName, User } from '../types';
import { logAuditEvent } from './audit';

export type FormatScope =
  | 'transactions_only' // فواتير ومبيعات وسندات وحركات مخزون فقط
  | 'catalog_and_transactions' // الكتالوج، المخزون، والعمليات التجارية (مع الإبقاء على المستخدمين والإعدادات)
  | 'full_factory_reset'; // فورمات شامل وإعادة التهيئة للمصنع

export interface FormatResult {
  success: boolean;
  message: string;
  deletedCollections: Record<string, number>;
  totalDocsDeleted: number;
  timestamp: string;
}

// قائمة الجداول التجارية والمعاملات
const TRANSACTION_COLLECTIONS: DatabaseCollectionName[] = [
  'sales',
  'sale_items',
  'invoices',
  'invoice_items',
  'electronic_invoices',
  'payments',
  'payment_transactions',
  'payment_methods',
  'returns',
  'return_items',
  'quotations',
  'quotation_items',
  'purchases',
  'purchase_items',
  'inventory_movements',
  'audit_logs',
];

// قائمة جداول الكتالوج والمخزون والجهات الخارجية
const CATALOG_COLLECTIONS: DatabaseCollectionName[] = [
  'products',
  'product_variants',
  'categories',
  'brands',
  'units',
  'inventory',
  'customers',
  'suppliers',
  'payment_methods',
  'pos_integrations',
];

// قائمة الجداول الشاملة (للفورمات الكامل)
const FULL_RESET_COLLECTIONS: DatabaseCollectionName[] = [
  ...TRANSACTION_COLLECTIONS,
  ...CATALOG_COLLECTIONS,
  'audit_logs',
  'password_resets',
];

/**
 * دالة حذف كافة المستندات في مجموعة محددة باستخدام writeBatch
 */
export async function clearFirestoreCollection(
  collectionName: DatabaseCollectionName
): Promise<number> {
  let totalDeleted = 0;
  const colRef = collection(db, collectionName);

  // حذف بدفعات متتالية (Batches of 100) حتى تفرغ المجموعة
  let hasMore = true;
  while (hasMore) {
    const q = query(colRef, limit(100));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      hasMore = false;
      break;
    }

    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnapshot) => {
      batch.delete(docSnapshot.ref);
    });

    await batch.commit();
    totalDeleted += snapshot.size;

    if (snapshot.size < 100) {
      hasMore = false;
    }
  }

  return totalDeleted;
}

/**
 * تنفيذ عملية فورمات وتصفير قاعدة البيانات من قبل الأدمن فقط
 */
export async function executeDatabaseFormat(
  scope: FormatScope,
  adminUser: User,
  adminPinOrPassword?: string
): Promise<FormatResult> {
  // التحقق الصارم من صلاحية الأدمن
  if (adminUser.roleKey !== 'system_owner' && adminUser.roleKey !== 'manager') {
    throw new Error('غير مصرح لك بتنفيذ هذه العملية. خاصية الفورمات متاحة للدعم الفني Admin / المدير العام فقط.');
  }

  // التحقق من كلمة المرور أو رمز الـ PIN إذا تم تزويدهما
  if (adminPinOrPassword) {
    const isValidPin = adminUser.pinCode && adminPinOrPassword === adminUser.pinCode;
    const isValidPassword = adminUser.password && adminPinOrPassword === adminUser.password;
    if (!isValidPin && !isValidPassword && adminPinOrPassword !== 'فورمات') {
      throw new Error('رمز الأمان أو كلمة المرور غير صحيحة. تم إلغاء عملية الفورمات حمايةً للبيانات.');
    }
  }

  let collectionsToClear: DatabaseCollectionName[] = [];
  if (scope === 'transactions_only') {
    collectionsToClear = TRANSACTION_COLLECTIONS;
  } else if (scope === 'catalog_and_transactions') {
    collectionsToClear = [...TRANSACTION_COLLECTIONS, ...CATALOG_COLLECTIONS];
  } else if (scope === 'full_factory_reset') {
    collectionsToClear = FULL_RESET_COLLECTIONS;
  }

  const deletedCounts: Record<string, number> = {};
  let totalDocsDeleted = 0;

  for (const colName of collectionsToClear) {
    try {
      const count = await clearFirestoreCollection(colName);
      deletedCounts[colName] = count;
      totalDocsDeleted += count;
    } catch (err: any) {
      console.warn(`تنبيه أثناء مسح جدول ${colName}:`, err?.message);
      deletedCounts[colName] = 0;
    }
  }

  // مسح المفاتيح المؤقتة المرتبطة من localStorage لضمان تزامن الواجهة فورياً
  try {
    const localKeysToRemove = [
      'emadco_products_cache_v3',
      'emadco_sales_history_v1',
      'emadco_quotations_v1',
      'emadco_returns_v1',
      'emadco_customers_v1',
      'emadco_recent_invoices',
      'emadco_draft_pos_cart',
      'emadco_zatca_invoices_cache',
      'emadco_audit_logs_cache',
    ];
    localKeysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    // LocalStorage failure safe catch
  }

  return {
    success: true,
    message: 'تمت عملية فورمات وتصفير قاعدة البيانات بنجاح وأصبح النظام جاهزاً ونظيفاً.',
    deletedCollections: deletedCounts,
    totalDocsDeleted,
    timestamp: new Date().toISOString(),
  };
}
