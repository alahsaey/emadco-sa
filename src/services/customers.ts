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
  orderBy,
  limit,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Customer, Sale, Invoice, Payment, Return, StatementEntry } from '../types';
import { logAuditEvent } from './audit';
import { cleanFirestoreData } from './db';

/**
 * جلب جميع العملاء
 */
export async function getCustomers(): Promise<Customer[]> {
  try {
    const snap = await getDocs(collection(db, 'customers'));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer));
    return list.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  } catch (error) {
    console.error('خطأ في جلب بيانات العملاء:', error);
    throw error;
  }
}

/**
 * جلب عميل بواسطة المعرف
 */
export async function getCustomerById(id: string): Promise<Customer | null> {
  try {
    const docRef = doc(db, 'customers', id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Customer;
  } catch (error) {
    console.error(`خطأ في جلب بيانات العميل ${id}:`, error);
    return null;
  }
}

/**
 * إضافة عميل جديد مع التحقق وتوثيق التدقيق
 */
export async function createCustomer(
  data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'currentBalance'> & {
    initialBalance?: number;
  },
  actorName = 'المدير'
): Promise<string> {
  if (!data.name?.trim()) {
    throw new Error('اسم العميل مطلوب.');
  }
  if (!data.phone?.trim()) {
    throw new Error('رقم جوال العميل مطلوب.');
  }

  const now = new Date().toISOString();
  const customerId = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const initialBal = Number(data.initialBalance) || 0;

  const newCustomer: Customer = {
    id: customerId,
    name: data.name.trim(),
    phone: data.phone.trim(),
    email: data.email?.trim() || '',
    customerType: data.customerType || 'individual',
    address: data.address?.trim() || '',
    taxNumber: data.taxNumber?.trim() || '',
    commercialRegister: data.commercialRegister?.trim() || '',
    creditLimit: Math.max(0, Number(data.creditLimit) || 0),
    currentBalance: initialBal,
    priceTier: data.priceTier || 'retail',
    notes: data.notes?.trim() || '',
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, 'customers', customerId), cleanFirestoreData(newCustomer));

  await logAuditEvent({
    userName: actorName,
    action: 'CREATE',
    entity: 'customers',
    entityId: customerId,
    details: `تمت إضافة عميل جديد: ${newCustomer.name} (نوع: ${newCustomer.customerType}، سقف ائتماني: ${newCustomer.creditLimit} ر.س، رصيد افتتاحي: ${initialBal} ر.س)`,
  });

  return customerId;
}

/**
 * تعديل بيانات عميل
 */
export async function updateCustomer(
  id: string,
  updates: Partial<Customer>,
  actorName = 'المدير'
): Promise<void> {
  const docRef = doc(db, 'customers', id);
  const now = new Date().toISOString();

  await updateDoc(docRef, cleanFirestoreData({
    ...updates,
    updatedAt: now,
  }));

  await logAuditEvent({
    userName: actorName,
    action: 'UPDATE',
    entity: 'customers',
    entityId: id,
    details: `تم تعديل بيانات العميل: ${updates.name || id}`,
  });
}

/**
 * حذف عميل (إذا لم يكن عليه رصيد مستحق أو بالحذف القسري)
 */
export async function deleteCustomer(
  id: string,
  customerName: string,
  actorName = 'المدير',
  force = false
): Promise<void> {
  const docRef = doc(db, 'customers', id);
  const snap = await getDoc(docRef);

  if (snap.exists() && !force) {
    const cust = snap.data() as Customer;
    if ((cust.currentBalance || 0) > 0.05) {
      throw new Error(
        `لا يمكن حذف العميل "${customerName}" لوجود رصيد مديونية مستحق عليه بقيمة (${cust.currentBalance.toFixed(2)} ر.س). يجب تصفية الحساب أولاً.`
      );
    }
  }

  await deleteDoc(docRef);

  try {
    await logAuditEvent({
      userName: actorName,
      action: 'DELETE',
      entity: 'customers',
      entityId: id,
      details: `تم حذف العميل: ${customerName}`,
    });
  } catch (logErr) {
    console.warn('Audit log write warning:', logErr);
  }
}

/**
 * جلب فواتير مبيعات العميل
 */
export async function getCustomerSales(customerId: string): Promise<Sale[]> {
  try {
    const q = query(
      collection(db, 'sales'),
      where('customerId', '==', customerId)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sale));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('خطأ في جلب فواتير العميل:', error);
    return [];
  }
}

/**
 * جلب مدفوعات العميل (سندات القبض)
 */
export async function getCustomerPayments(customerId: string): Promise<Payment[]> {
  try {
    const q = query(
      collection(db, 'payments'),
      where('partyId', '==', customerId),
      where('partyType', '==', 'customer')
    );
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment));
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('خطأ في جلب مدفوعات العميل:', error);
    return [];
  }
}

/**
 * جلب مرتجعات العميل
 */
export async function getCustomerReturns(customerId: string): Promise<Return[]> {
  try {
    const q = query(
      collection(db, 'returns'),
      where('customerId', '==', customerId)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Return));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('خطأ في جلب مرتجعات العميل:', error);
    return [];
  }
}

/**
 * إنشاء كشف حساب تفصيلي للعميل (Statement of Account)
 * يعرض الحركات التاريخية مرتبة زمنياً:
 * - فواتير البيع (مدين يزيد المديونية)
 * - سندات القبض والدفعات (دائن يخفض المديونية)
 * - مرتجعات المبيعات (دائن يخفض المديونية)
 * ويحتسب الرصيد التراكمي في كل حركة بدقة
 */
export async function getCustomerStatement(
  customerId: string,
  startDate?: string,
  endDate?: string
): Promise<{
  customer: Customer | null;
  entries: StatementEntry[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}> {
  const [customer, sales, payments, returns] = await Promise.all([
    getCustomerById(customerId),
    getCustomerSales(customerId),
    getCustomerPayments(customerId),
    getCustomerReturns(customerId),
  ]);

  const rawEntries: {
    id: string;
    date: string;
    type: 'sale_invoice' | 'payment_receipt' | 'return';
    typeLabel: string;
    referenceNumber: string;
    description: string;
    debit: number;
    credit: number;
  }[] = [];

  // 1. فواتير البيع (مدين: تزيد المديونية المستحقة على العميل)
  for (const s of sales) {
    // إذا كانت الفاتورة آجلة أو جزئية
    rawEntries.push({
      id: s.id,
      date: s.createdAt,
      type: 'sale_invoice',
      typeLabel: 'فاتورة مبيعات',
      referenceNumber: s.saleNumber,
      description: `فاتورة بيع ${s.saleNumber} - الإجمالي ${s.grandTotal.toFixed(2)} ر.س`,
      debit: s.grandTotal,
      credit: 0,
    });
  }

  // 2. سندات القبض والمدفوعات (دائن: تخفض المديونية)
  for (const p of payments) {
    if (p.amount > 0) {
      rawEntries.push({
        id: p.id,
        date: p.date,
        type: 'payment_receipt',
        typeLabel: 'سند قبض / سداد',
        referenceNumber: p.receiptNumber,
        description: p.notes || `سداد دفعة نقدية/بنكية بموجب سند ${p.receiptNumber}`,
        debit: 0,
        credit: p.amount,
      });
    }
  }

  // 3. المرتجعات (دائن: تخفض المديونية)
  for (const r of returns) {
    if (r.refundAmount > 0) {
      rawEntries.push({
        id: r.id,
        date: r.createdAt,
        type: 'return',
        typeLabel: 'مرتجع مبيعات',
        referenceNumber: r.returnNumber,
        description: `مرتجع بضاعة بموجب إشعار ${r.returnNumber} - ${r.reason || ''}`,
        debit: 0,
        credit: r.refundAmount,
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
    runningBalance += (item.debit - item.credit);
    totalDebit += item.debit;
    totalCredit += item.credit;

    entries.push({
      ...item,
      runningBalance: Math.round(runningBalance * 100) / 100,
    });
  }

  return {
    customer,
    entries: entries.reverse(), // عرض الأحدث أولاً في الجدول
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    closingBalance: Math.round(runningBalance * 100) / 100,
  };
}

export interface CreditInvoiceItem {
  id: string;
  invoiceNumber: string;
  saleNumber?: string;
  saleId?: string;
  customerId?: string | null;
  customerName: string;
  customerPhone?: string;
  date: string;
  grandTotal: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: 'unpaid' | 'partially_paid' | 'paid';
  paymentMethodCode?: string;
  zatcaUuid?: string;
}

/**
 * استخراج مفتاح تسلسل الرقم (للربط بين رقم الفاتورة ورقم البيع)
 * مثال: INV-2026-895554 و POS-2026-895554 كلاهما يعيد التسلسل 895554
 */
function extractDocSequenceKey(str?: string): string {
  if (!str) return '';
  const trimmed = str.trim();
  const matchWithYear = trimmed.match(/[A-Za-z]+-(\d{4}-\d+)/);
  if (matchWithYear) return matchWithYear[1];
  const numMatch = trimmed.match(/\d{5,}/);
  if (numMatch) return numMatch[0];
  return trimmed.replace(/^(INV|POS|REC|DIS)-/i, '');
}

/**
 * جلب جميع فواتير الذمم والبيع الآجل غير المحصلة
 * مع معالجة دقيقة تمنع تكرار المعاملات أو احتسابها مرتين
 * والربط المحكم بين مستند الفاتورة (Invoices) ومستند البيع (Sales)
 */
export async function getCreditAndUnpaidInvoices(): Promise<CreditInvoiceItem[]> {
  try {
    const [invoicesSnap, salesSnap] = await Promise.all([
      getDocs(query(collection(db, 'invoices'), orderBy('issueDate', 'desc'), limit(150))).catch(() => ({ docs: [] })),
      getDocs(query(collection(db, 'sales'), orderBy('createdAt', 'desc'), limit(150))).catch(() => ({ docs: [] })),
    ]);

    // 1. خريطة مستندات البيع sales لسرعة الوصول والربط
    const salesById = new Map<string, Sale>();
    const salesByNumber = new Map<string, Sale>();
    const salesBySeq = new Map<string, Sale>();

    salesSnap.docs.forEach((docSnap) => {
      const sale = { id: docSnap.id, ...docSnap.data() } as Sale;
      salesById.set(sale.id, sale);
      if (sale.saleNumber) {
        salesByNumber.set(sale.saleNumber, sale);
        const seq = extractDocSequenceKey(sale.saleNumber);
        if (seq) salesBySeq.set(seq, sale);
      }
    });

    const items: CreditInvoiceItem[] = [];
    const processedSaleIds = new Set<string>();
    const processedInvoiceIds = new Set<string>();
    const processedNumbers = new Set<string>();
    const processedSequences = new Set<string>();

    // 2. معالجة مستندات الفواتير invoices كأولوية للمستندات الرسمية والضريبية
    for (const docSnap of invoicesSnap.docs) {
      const data = docSnap.data() as any;

      // البحث عن مستند البيع المرتبط
      let linkedSale: Sale | undefined;
      if (data.saleId && salesById.has(data.saleId)) {
        linkedSale = salesById.get(data.saleId);
      } else if (data.saleNumber && salesByNumber.has(data.saleNumber)) {
        linkedSale = salesByNumber.get(data.saleNumber);
      } else if (data.invoiceNumber) {
        const seq = extractDocSequenceKey(data.invoiceNumber);
        if (seq && salesBySeq.has(seq)) {
          linkedSale = salesBySeq.get(seq);
        }
      }

      // هل العملية تمثل بيعاً آجلاً أو ذمة غير مسددة بالكامل؟
      const isCreditOrUnpaid =
        data.paymentStatus === 'unpaid' ||
        data.paymentStatus === 'partially_paid' ||
        data.paymentMethodId === 'CREDIT' ||
        data.saleType === 'contractor_credit' ||
        (linkedSale && (linkedSale.saleType === 'contractor_credit' || linkedSale.paidAmount < linkedSale.grandTotal));

      if (isCreditOrUnpaid) {
        const grandTotal = Number(data.totalIncludingTax ?? (linkedSale ? linkedSale.grandTotal : data.grandTotal ?? 0)) || 0;
        
        let paidAmount = 0;
        if (data.paymentStatus === 'paid') {
          paidAmount = grandTotal;
        } else {
          paidAmount = Math.max(
            Number(data.paidAmount) || 0,
            linkedSale ? Number(linkedSale.paidAmount) || 0 : 0
          );
        }

        const remainingAmount = Math.max(0, Math.round((grandTotal - paidAmount) * 100) / 100);

        const paymentStatus: 'unpaid' | 'partially_paid' | 'paid' =
          remainingAmount <= 0
            ? 'paid'
            : paidAmount > 0
            ? 'partially_paid'
            : 'unpaid';

        const invNum = data.invoiceNumber || (linkedSale ? linkedSale.saleNumber : docSnap.id);
        const resolvedCustomerId = data.customerId || (linkedSale ? linkedSale.customerId : null);
        const resolvedCustomerPhone = data.customerPhone || (linkedSale ? linkedSale.customerPhone : null);

        // إصلاح ذاتي لحقول العميل في مستند الفاتورة بفايربيس إذا كانت مفقودة ووجدت في مستند البيع
        if ((!data.customerId || !data.customerPhone) && (linkedSale?.customerId || linkedSale?.customerPhone)) {
          updateDoc(doc(db, 'invoices', docSnap.id), {
            customerId: resolvedCustomerId || null,
            customerPhone: resolvedCustomerPhone || null,
          }).catch(() => {});
        }

        items.push({
          id: docSnap.id,
          invoiceNumber: invNum,
          saleNumber: linkedSale?.saleNumber,
          saleId: data.saleId || linkedSale?.id,
          customerId: resolvedCustomerId,
          customerName: data.customerName || (linkedSale ? linkedSale.customerName : 'حساب آجل (ذمم)'),
          customerPhone: resolvedCustomerPhone,
          date: data.issueDate || data.createdAt || (linkedSale ? linkedSale.createdAt : new Date().toISOString()),
          grandTotal,
          paidAmount,
          remainingAmount,
          paymentStatus,
          paymentMethodCode: data.paymentMethodId || (linkedSale?.saleType === 'contractor_credit' ? 'CREDIT' : 'CREDIT'),
          zatcaUuid: data.zatcaUuid,
        });

        // تسجيل المعرفات والتسلسلات كمكتملة لمنع التكرار
        processedInvoiceIds.add(docSnap.id);
        if (data.invoiceNumber) {
          processedNumbers.add(data.invoiceNumber);
          const seq = extractDocSequenceKey(data.invoiceNumber);
          if (seq) processedSequences.add(seq);
        }
        if (data.saleId) {
          processedSaleIds.add(data.saleId);
        }
        if (linkedSale) {
          processedSaleIds.add(linkedSale.id);
          if (linkedSale.saleNumber) {
            processedNumbers.add(linkedSale.saleNumber);
            const seq = extractDocSequenceKey(linkedSale.saleNumber);
            if (seq) processedSequences.add(seq);
          }
        }
      }
    }

    // 3. معالجة مبيعات sales التي لم يُعثر لها على مستند فاتورة منفصل
    for (const docSnap of salesSnap.docs) {
      const sale = { id: docSnap.id, ...docSnap.data() } as Sale;
      const saleSeq = extractDocSequenceKey(sale.saleNumber);

      // تخطي إذا كانت العملية قد عولجت مسبقاً عبر الفاتورة المرتبطة
      if (
        processedSaleIds.has(sale.id) ||
        (sale.saleNumber && processedNumbers.has(sale.saleNumber)) ||
        (saleSeq && processedSequences.has(saleSeq))
      ) {
        continue;
      }

      const isCredit = sale.saleType === 'contractor_credit' || (sale.paidAmount < sale.grandTotal);
      if (isCredit) {
        const grandTotal = Number(sale.grandTotal) || 0;
        const paidAmount = Number(sale.paidAmount) || 0;
        const remainingAmount = Math.max(0, Math.round((grandTotal - paidAmount) * 100) / 100);

        items.push({
          id: sale.id,
          invoiceNumber: sale.saleNumber || sale.id,
          saleNumber: sale.saleNumber,
          saleId: sale.id,
          customerId: sale.customerId || null,
          customerName: sale.customerName || 'حساب مقاول / آجل',
          customerPhone: sale.customerPhone,
          date: sale.createdAt || new Date().toISOString(),
          grandTotal,
          paidAmount,
          remainingAmount,
          paymentStatus: remainingAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partially_paid' : 'unpaid',
          paymentMethodCode: 'CREDIT',
        });

        processedSaleIds.add(sale.id);
        if (sale.saleNumber) {
          processedNumbers.add(sale.saleNumber);
          if (saleSeq) processedSequences.add(saleSeq);
        }
      }
    }

    // 4. حماية نهائية صارمة ضد أي تكرار ناتج عن تشابه التسلسلات
    const uniqueMap = new Map<string, CreditInvoiceItem>();
    for (const item of items) {
      const seqKey = extractDocSequenceKey(item.invoiceNumber) || extractDocSequenceKey(item.saleNumber);
      const uniqueKey = item.saleId ? `sale_${item.saleId}` : (seqKey ? `seq_${seqKey}` : item.id);

      if (!uniqueMap.has(uniqueKey)) {
        uniqueMap.set(uniqueKey, item);
      } else {
        const existing = uniqueMap.get(uniqueKey)!;
        if (!existing.customerPhone && item.customerPhone) {
          existing.customerPhone = item.customerPhone;
        }
        if (!existing.customerId && item.customerId) {
          existing.customerId = item.customerId;
        }
        if (!existing.saleNumber && item.saleNumber) {
          existing.saleNumber = item.saleNumber;
        }
      }
    }

    const uniqueItems = Array.from(uniqueMap.values());
    return uniqueItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.warn('خطأ في جلب فواتير الذمم والآجل:', error);
    return [];
  }
}

