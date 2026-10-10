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
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Supplier, Purchase, Payment, StatementEntry } from '../types';
import { logAuditEvent } from './audit';

/**
 * جلب جميع الموردين
 */
export async function getSuppliers(): Promise<Supplier[]> {
  try {
    const snap = await getDocs(collection(db, 'suppliers'));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Supplier));
    return list.sort((a, b) => a.companyName.localeCompare(b.companyName, 'ar'));
  } catch (error) {
    console.error('خطأ في جلب بيانات الموردين:', error);
    throw error;
  }
}

/**
 * جلب مورد بواسطة المعرف
 */
export async function getSupplierById(id: string): Promise<Supplier | null> {
  try {
    const docRef = doc(db, 'suppliers', id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Supplier;
  } catch (error) {
    console.error(`خطأ في جلب المورد ${id}:`, error);
    return null;
  }
}

/**
 * إضافة مورد جديد
 */
export async function createSupplier(
  data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt' | 'balance'> & {
    initialBalance?: number;
  },
  actorName = 'المدير'
): Promise<string> {
  if (!data.companyName?.trim()) {
    throw new Error('اسم شركة / مؤسسة المورد مطلوب.');
  }
  if (!data.contactPerson?.trim()) {
    throw new Error('اسم الشخص المسؤول / ممثل المورد مطلوب.');
  }
  if (!data.phone?.trim()) {
    throw new Error('رقم هاتف المورد مطلوب.');
  }

  const now = new Date().toISOString();
  const supplierId = `supp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const initialBal = Number(data.initialBalance) || 0;

  const newSupplier: Supplier = {
    id: supplierId,
    companyName: data.companyName.trim(),
    contactPerson: data.contactPerson.trim(),
    phone: data.phone.trim(),
    email: data.email?.trim() || undefined,
    taxNumber: data.taxNumber?.trim() || undefined,
    address: data.address?.trim() || undefined,
    balance: initialBal,
    notes: data.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, 'suppliers', supplierId), newSupplier);

  await logAuditEvent({
    userName: actorName,
    action: 'CREATE',
    entity: 'suppliers',
    entityId: supplierId,
    details: `تمت إضافة مورد جديد: ${newSupplier.companyName} (المسؤول: ${newSupplier.contactPerson}، رصيد افتتاحي: ${initialBal} ر.س)`,
  });

  return supplierId;
}

/**
 * تعديل بيانات مورد
 */
export async function updateSupplier(
  id: string,
  updates: Partial<Supplier>,
  actorName = 'المدير'
): Promise<void> {
  const docRef = doc(db, 'suppliers', id);
  const now = new Date().toISOString();

  await updateDoc(docRef, {
    ...updates,
    updatedAt: now,
  });

  await logAuditEvent({
    userName: actorName,
    action: 'UPDATE',
    entity: 'suppliers',
    entityId: id,
    details: `تم تعديل بيانات المورد: ${updates.companyName || id}`,
  });
}

/**
 * حذف مورد (إذا كان حسابه مصفراً أو بالحذف القسري)
 */
export async function deleteSupplier(
  id: string,
  supplierName: string,
  actorName = 'المدير',
  force = false
): Promise<void> {
  const docRef = doc(db, 'suppliers', id);
  const snap = await getDoc(docRef);

  if (snap.exists() && !force) {
    const supp = snap.data() as Supplier;
    if (Math.abs(supp.balance || 0) > 0.05) {
      throw new Error(
        `لا يمكن حذف المورد "${supplierName}" لوجود رصيد مستحق له بقيمة (${supp.balance.toFixed(2)} ر.س). يجب تصفية الحساب أولاً.`
      );
    }
  }

  await deleteDoc(docRef);

  try {
    await logAuditEvent({
      userName: actorName,
      action: 'DELETE',
      entity: 'suppliers',
      entityId: id,
      details: `تم حذف المورد: ${supplierName}`,
    });
  } catch (err) {
    console.warn('Audit log write error:', err);
  }
}

/**
 * جلب فواتير الشراء الخاصة بالمورد
 */
export async function getSupplierPurchases(supplierId: string): Promise<Purchase[]> {
  try {
    const q = query(
      collection(db, 'purchases'),
      where('supplierId', '==', supplierId)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Purchase));
    return list.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  } catch (error) {
    console.error('خطأ في جلب مشتريات المورد:', error);
    return [];
  }
}

/**
 * جلب سندات الصرف والمدفوعات المسددة للمورد
 */
export async function getSupplierPayments(supplierId: string): Promise<Payment[]> {
  try {
    const q = query(
      collection(db, 'payments'),
      where('partyId', '==', supplierId),
      where('partyType', '==', 'supplier')
    );
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment));
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('خطأ في جلب مدفوعات المورد:', error);
    return [];
  }
}

/**
 * إنشاء كشف حساب تفصيلي للمورد (Statement of Account)
 * الحركات:
 * - فواتير الشراء المستلمة (دائن: تزيد مستحقات المورد لدينا)
 * - سندات الصرف والمدفوعات (مدين: تخفض مستحقات المورد لدينا بالسداد)
 */
export async function getSupplierStatement(
  supplierId: string
): Promise<{
  supplier: Supplier | null;
  entries: StatementEntry[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}> {
  const [supplier, purchases, payments] = await Promise.all([
    getSupplierById(supplierId),
    getSupplierPurchases(supplierId),
    getSupplierPayments(supplierId),
  ]);

  const rawEntries: {
    id: string;
    date: string;
    type: 'purchase_invoice' | 'payment_disbursement';
    typeLabel: string;
    referenceNumber: string;
    description: string;
    debit: number;  // سداد للمورد (يخفض رصيده)
    credit: number; // توريد بضاعة (يزيد رصيد مستحقاته)
  }[] = [];

  // 1. فواتير الشراء
  for (const p of purchases) {
    // ندرج الفواتير المعتمدة أو أوامر الشراء
    rawEntries.push({
      id: p.id,
      date: p.orderDate || p.createdAt || '',
      type: 'purchase_invoice',
      typeLabel: 'فاتورة شراء / توريد',
      referenceNumber: p.orderNumber,
      description: `فاتورة شراء ${p.orderNumber} ${p.supplierInvoiceNumber ? `(فاتورة المورد: ${p.supplierInvoiceNumber})` : ''} - الحالة: ${p.status === 'received' ? 'مستلمة ومعتمدة' : 'قيد المعالجة'}`,
      debit: 0,
      credit: p.grandTotal, // مستحق للمورد
    });
  }

  // 2. سندات الصرف والمدفوعات المسددة للمورد
  for (const pay of payments) {
    if (pay.amount > 0) {
      rawEntries.push({
        id: pay.id,
        date: pay.date,
        type: 'payment_disbursement',
        typeLabel: 'سند صرف / دفعة مسددة',
        referenceNumber: pay.receiptNumber,
        description: pay.notes || `سداد دفعة للمورد بموجب سند ${pay.receiptNumber}`,
        debit: pay.amount, // سداد للمورد
        credit: 0,
      });
    }
  }

  // ترتيب زمني تصاعدي لحساب الرصيد التراكمي
  rawEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let runningBalance = 0;
  const entries: StatementEntry[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const item of rawEntries) {
    // في حساب المورد: الرصيد = دائن (مستحق له) - مدين (مسدد له)
    runningBalance += (item.credit - item.debit);
    totalDebit += item.debit;
    totalCredit += item.credit;

    entries.push({
      ...item,
      runningBalance: Math.round(runningBalance * 100) / 100,
    });
  }

  return {
    supplier,
    entries: entries.reverse(),
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    closingBalance: Math.round(runningBalance * 100) / 100,
  };
}
