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
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Quotation,
  QuotationItem,
  QuotationStatus,
  Product,
  Customer,
} from '../types';
import { logAuditEvent } from './audit';
import { cleanFirestoreData } from './db';

export interface QuotationItemInput {
  productId: string;
  productName: string;
  sku?: string;
  unitSymbol?: string;
  description?: string;
  quantity: number;
  unitPrice: number; // السعر المعدل
  originalRetailPrice?: number;
  discount: number; // خصم البند
  taxRate: number; // 15
}

export interface CreateQuotationPayload {
  customerId?: string | null;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerTaxNumber?: string;
  customerAddress?: string;
  projectName?: string;
  issueDate: string;
  validUntil: string;
  discountTotal?: number;
  discountType?: 'amount' | 'percent';
  discountPercentValue?: number;
  notes?: string;
  terms?: string;
  createdBy: string;
  items: QuotationItemInput[];
  status?: QuotationStatus;
}

/**
 * جلب جميع عروض الأسعار مع فحص تلقائي لتاريخ انتهاء الصلاحية
 */
export async function getQuotations(): Promise<Quotation[]> {
  try {
    const snap = await getDocs(collection(db, 'quotations'));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Quotation));

    // جلب البنود
    const itemsSnap = await getDocs(collection(db, 'quotation_items'));
    const itemsMap: Record<string, QuotationItem[]> = {};
    itemsSnap.docs.forEach((d) => {
      const it = { id: d.id, ...d.data() } as QuotationItem;
      if (!itemsMap[it.quotationId]) itemsMap[it.quotationId] = [];
      itemsMap[it.quotationId].push(it);
    });

    const now = new Date();
    const processedList = list.map((q) => {
      q.items = itemsMap[q.id] || [];
      // فحص تلقائي لانتهاء الصلاحية إذا كان العرض Draft أو Sent وتجاوز تاريخ الصلاحية
      if ((q.status === 'Draft' || q.status === 'Sent') && q.validUntil) {
        const expiryDate = new Date(q.validUntil);
        if (now > expiryDate) {
          q.status = 'Expired';
        }
      }
      return q;
    });

    return processedList.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error('خطأ في جلب عروض الأسعار:', error);
    return [];
  }
}

/**
 * جلب عرض سعر محدد
 */
export async function getQuotationById(id: string): Promise<Quotation | null> {
  try {
    const docRef = doc(db, 'quotations', id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;

    const quotation = { id: snap.id, ...snap.data() } as Quotation;

    const qItems = query(collection(db, 'quotation_items'), where('quotationId', '==', id));
    const itemsSnap = await getDocs(qItems);
    quotation.items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as QuotationItem));

    return quotation;
  } catch (error) {
    console.error(`خطأ في جلب عرض السعر ${id}:`, error);
    return null;
  }
}

/**
 * إنشاء عرض سعر جديد مع حفظ البنود وتوثيق التدقيق
 */
export async function createQuotation(payload: CreateQuotationPayload): Promise<Quotation> {
  if (!payload.items || payload.items.length === 0) {
    throw new Error('عرض السعر يجب أن يحتوي على منتج واحد على الأقل.');
  }
  if (!payload.customerName?.trim()) {
    throw new Error('اسم العميل مطلوب.');
  }

  const now = new Date().toISOString();
  const timestampSuffix = Date.now().toString().slice(-6);
  const quotationId = `quo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const quotationNumber = `QUO-${new Date().getFullYear()}-${timestampSuffix}`;

  // حساب البنود والإجماليات بدقة
  let subtotal = 0;
  let itemDiscountsTotal = 0;

  const processedItems: QuotationItem[] = payload.items.map((it, idx) => {
    const rawLine = it.unitPrice * it.quantity;
    const discount = Math.max(0, it.discount || 0);
    const lineAfterDiscount = Math.max(0, rawLine - discount);
    const taxRate = it.taxRate !== undefined ? it.taxRate : 15;
    const taxAmount = Math.round(lineAfterDiscount * (taxRate / 100) * 100) / 100;
    const lineTotal = Math.round((lineAfterDiscount + taxAmount) * 100) / 100;

    subtotal += lineAfterDiscount;
    itemDiscountsTotal += discount;

    return {
      id: `qitem_${quotationId}_${idx + 1}`,
      quotationId,
      productId: it.productId,
      productName: it.productName,
      sku: it.sku,
      unitSymbol: it.unitSymbol,
      description: it.description || '',
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      originalRetailPrice: it.originalRetailPrice,
      discount,
      taxRate,
      taxAmount,
      lineTotal,
    };
  });

  // الخصم الإضافي على مستوى العرض
  const extraDiscount = Math.max(0, payload.discountTotal || 0);
  const totalDiscount = itemDiscountsTotal + extraDiscount;
  const taxableSubtotal = Math.max(0, subtotal - extraDiscount);
  const taxTotal = Math.round(taxableSubtotal * 0.15 * 100) / 100;
  const grandTotal = Math.round((taxableSubtotal + taxTotal) * 100) / 100;

  const newQuotation: Quotation = {
    id: quotationId,
    quotationNumber,
    customerId: payload.customerId || null,
    customerName: payload.customerName.trim(),
    customerPhone: payload.customerPhone?.trim() || '',
    customerEmail: payload.customerEmail?.trim() || '',
    customerTaxNumber: payload.customerTaxNumber?.trim() || '',
    customerAddress: payload.customerAddress?.trim() || '',
    projectName: payload.projectName?.trim() || '',
    issueDate: payload.issueDate || now.split('T')[0],
    validUntil: payload.validUntil,
    subtotal: taxableSubtotal,
    discountTotal: totalDiscount,
    discountType: payload.discountType || 'amount',
    discountPercentValue: payload.discountPercentValue || 0,
    taxRate: 15,
    taxTotal,
    grandTotal,
    status: payload.status || 'Draft',
    notes: payload.notes || '',
    terms: payload.terms || 'الأسعار تشمل ضريبة القيمة المضافة 15%. صلاحية العرض حسب التاريخ المحدد.',
    createdBy: payload.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  // كتابة العرض في Firestore
  await setDoc(doc(db, 'quotations', quotationId), cleanFirestoreData(newQuotation));

  // كتابة البنود
  for (const it of processedItems) {
    await setDoc(doc(db, 'quotation_items', it.id), cleanFirestoreData(it));
  }

  // توثيق في سجل التدقيق
  await logAuditEvent({
    userName: payload.createdBy,
    action: 'CREATE',
    entity: 'quotations',
    entityId: quotationId,
    details: `إنشاء عرض سعر رقم ${quotationNumber} للعميل ${newQuotation.customerName} بقيمة ${grandTotal} ر.س - الحالة: ${newQuotation.status}`,
  });

  return {
    ...newQuotation,
    items: processedItems,
  };
}

/**
 * تحديث حالة عرض السعر (Draft -> Sent -> Accepted -> Rejected -> Expired -> Converted)
 */
export async function updateQuotationStatus(
  quotationId: string,
  newStatus: QuotationStatus,
  actorName = 'المدير',
  conversionInfo?: { saleId: string; invoiceNumber: string }
): Promise<void> {
  const docRef = doc(db, 'quotations', quotationId);
  const now = new Date().toISOString();

  const updates: Partial<Quotation> = {
    status: newStatus,
    updatedAt: now,
  };

  if (conversionInfo) {
    updates.convertedSaleId = conversionInfo.saleId;
    updates.convertedInvoiceNumber = conversionInfo.invoiceNumber;
    updates.convertedAt = now;
  }

  await updateDoc(docRef, cleanFirestoreData(updates));

  await logAuditEvent({
    userName: actorName,
    action: 'UPDATE',
    entity: 'quotations',
    entityId: quotationId,
    details: `تحديث حالة عرض السعر إلى "${newStatus}"${
      conversionInfo ? ` مع التحويل لفاتورة رقم ${conversionInfo.invoiceNumber}` : ''
    }`,
  });
}

/**
 * حذف مسودة عرض سعر
 */
export async function deleteQuotation(quotationId: string, actorName = 'المدير'): Promise<void> {
  const docRef = doc(db, 'quotations', quotationId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return;

  const data = snap.data() as Quotation;
  if (data.status === 'Converted') {
    throw new Error('لا يمكن حذف عرض سعر تم تحويله بالفعل إلى فاتورة بيع.');
  }

  // حذف البنود
  const qItems = query(collection(db, 'quotation_items'), where('quotationId', '==', quotationId));
  const itemsSnap = await getDocs(qItems);
  for (const d of itemsSnap.docs) {
    await deleteDoc(d.ref);
  }

  await deleteDoc(docRef);

  await logAuditEvent({
    userName: actorName,
    action: 'DELETE',
    entity: 'quotations',
    entityId: quotationId,
    details: `حذف عرض السعر رقم ${data.quotationNumber} للعميل ${data.customerName}`,
  });
}
