/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit as limitTo,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Invoice,
  Sale,
  SaleItem,
  Payment,
  ElectronicInvoice,
} from '../types';
import { CompletedSaleResult } from './pos';
import { generateZatcaTlvBase64 } from './zatca';

export interface InvoiceLookupItem {
  invoice: Invoice;
  sale?: Sale;
  itemsCount: number;
  paymentMethodName?: string;
  cashierName?: string;
}

/**
 * جلب قائمة الفواتير الأخيرة من قاعدة البيانات
 */
export async function fetchRecentInvoices(limitCount: number = 100): Promise<InvoiceLookupItem[]> {
  try {
    const invoicesCol = collection(db, 'invoices');
    const qInv = query(invoicesCol, orderBy('issueDate', 'desc'), limitTo(limitCount));
    const invSnap = await getDocs(qInv);

    if (invSnap.empty) return [];

    const results: InvoiceLookupItem[] = [];

    for (const invDocSnap of invSnap.docs) {
      const invoiceData = { id: invDocSnap.id, ...invDocSnap.data() } as Invoice;
      let saleData: Sale | undefined;

      if (invoiceData.saleId) {
        try {
          const sSnap = await getDoc(doc(db, 'sales', invoiceData.saleId));
          if (sSnap.exists()) {
            saleData = { id: sSnap.id, ...sSnap.data() } as Sale;
          }
        } catch {
          // تجاهل
        }
      }

      const rawSale = saleData as any;
      results.push({
        invoice: invoiceData,
        sale: saleData,
        itemsCount: rawSale?.totalItemsCount || rawSale?.items?.length || 1,
        paymentMethodName: rawSale?.paymentMethodName || (invoiceData.paymentMethodId === 'CASH' ? 'نقداً (كاش)' : invoiceData.paymentMethodId || 'نقداً'),
        cashierName: rawSale?.cashierName || 'الكاشير',
      });
    }

    return results;
  } catch (error) {
    console.error('خطأ في جلب قائمة الفواتير للبحث:', error);
    return [];
  }
}

/**
 * البحث والاستعلام عن فاتورة مفقودة أو محددة
 */
export async function searchInvoices(params: {
  queryText?: string;
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
}): Promise<InvoiceLookupItem[]> {
  try {
    const { queryText = '', startDate, endDate, paymentMethod } = params;
    const cleanQuery = queryText.trim().toLowerCase();

    const invoicesCol = collection(db, 'invoices');
    const qInv = query(invoicesCol, orderBy('issueDate', 'desc'), limitTo(150));
    const invSnap = await getDocs(qInv);

    let list: InvoiceLookupItem[] = [];

    for (const invDocSnap of invSnap.docs) {
      const invoiceData = { id: invDocSnap.id, ...invDocSnap.data() } as Invoice;
      let saleData: Sale | undefined;

      if (invoiceData.saleId) {
        try {
          const sSnap = await getDoc(doc(db, 'sales', invoiceData.saleId));
          if (sSnap.exists()) {
            saleData = { id: sSnap.id, ...sSnap.data() } as Sale;
          }
        } catch {
          // تجاهل
        }
      }

      const rawSale = saleData as any;
      list.push({
        invoice: invoiceData,
        sale: saleData,
        itemsCount: rawSale?.totalItemsCount || rawSale?.items?.length || 1,
        paymentMethodName: rawSale?.paymentMethodName || (invoiceData.paymentMethodId === 'CASH' ? 'نقداً (كاش)' : invoiceData.paymentMethodId || 'نقداً'),
        cashierName: rawSale?.cashierName || 'الكاشير',
      });
    }

    // التطبيق التراكمي للفلاتر
    if (cleanQuery) {
      list = list.filter((item) => {
        const inv = item.invoice;
        const invNum = (inv.invoiceNumber || '').toLowerCase();
        const custName = (inv.customerName || '').toLowerCase();
        const custPhone = (inv.customerPhone || '').toLowerCase();
        const cashier = (item.cashierName || '').toLowerCase();
        const saleNum = (item.sale?.saleNumber || '').toLowerCase();

        return (
          invNum.includes(cleanQuery) ||
          custName.includes(cleanQuery) ||
          custPhone.includes(cleanQuery) ||
          cashier.includes(cleanQuery) ||
          saleNum.includes(cleanQuery)
        );
      });
    }

    if (startDate) {
      const startMs = new Date(startDate).getTime();
      list = list.filter((item) => new Date(item.invoice.issueDate).getTime() >= startMs);
    }

    if (endDate) {
      const endMs = new Date(endDate).setHours(23, 59, 59, 999);
      list = list.filter((item) => new Date(item.invoice.issueDate).getTime() <= endMs);
    }

    if (paymentMethod && paymentMethod !== 'all') {
      list = list.filter((item) => {
        const code = (item.sale as any)?.paymentMethodCode || item.invoice.paymentMethodId || '';
        return code.toUpperCase() === paymentMethod.toUpperCase();
      });
    }

    return list;
  } catch (error) {
    console.error('خطأ في الاستعلام عن الفواتير:', error);
    return [];
  }
}

/**
 * جلب كائن CompletedSaleResult الكامل لفاتورة معينة لفتح نافذة إعادة الطباعة أو الواتساب
 */
export async function getCompletedSaleResultForInvoice(
  invoiceId: string
): Promise<CompletedSaleResult | null> {
  try {
    const invSnap = await getDoc(doc(db, 'invoices', invoiceId));
    if (!invSnap.exists()) {
      // تجربة البحث برقم الفاتورة
      const qNum = query(collection(db, 'invoices'), where('invoiceNumber', '==', invoiceId));
      const qSnap = await getDocs(qNum);
      if (qSnap.empty) return null;
      return getCompletedSaleResultForInvoice(qSnap.docs[0].id);
    }

    const invoice = { id: invSnap.id, ...invSnap.data() } as Invoice;
    const saleId = invoice.saleId;

    let sale: Sale;
    let saleItems: SaleItem[] = [];
    let payment: Payment;

    if (saleId) {
      const sSnap = await getDoc(doc(db, 'sales', saleId));
      if (sSnap.exists()) {
        sale = { id: sSnap.id, ...sSnap.data() } as Sale;
      } else {
        sale = createFallbackSale(invoice);
      }

      // جلب بنود البيع
      const qItems = query(collection(db, 'sale_items'), where('saleId', '==', saleId));
      const itemsSnap = await getDocs(qItems);
      saleItems = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as SaleItem));

      // جلب الدفعة
      const qPay = query(collection(db, 'payments'), where('reference', '==', invoice.invoiceNumber));
      const paySnap = await getDocs(qPay);
      if (!paySnap.empty) {
        payment = { id: paySnap.docs[0].id, ...paySnap.docs[0].data() } as Payment;
      } else {
        payment = createFallbackPayment(invoice);
      }
    } else {
      sale = createFallbackSale(invoice);
      payment = createFallbackPayment(invoice);
    }

    // جلب فاتورة الزكاة الإلكترونية إن وجدت
    let electronicInvoice: ElectronicInvoice | undefined;
    try {
      const qE = query(collection(db, 'electronic_invoices'), where('invoiceNumber', '==', invoice.invoiceNumber));
      const eSnap = await getDocs(qE);
      if (!eSnap.empty) {
        electronicInvoice = { id: eSnap.docs[0].id, ...eSnap.docs[0].data() } as ElectronicInvoice;
      }
    } catch {
      // تجاهل
    }

    // توليد رمز ZATCA QR
    const totalWithTax = invoice.totalIncludingTax || 0;
    const taxVal = invoice.taxAmount || 0;
    const sellerName = 'مؤسسة عماد سعد آل سعيد لمواد البناء';
    const vatNo = '310948572100003';
    const zatcaQr = generateZatcaTlvBase64(
      sellerName,
      vatNo,
      invoice.issueDate || new Date().toISOString(),
      totalWithTax,
      taxVal
    );

    const subtotal = invoice.totalExcludingTax || (totalWithTax - taxVal);
    const discountTotal = sale?.discountTotal || 0;

    const fallbackItems: SaleItem[] = [
      {
        id: `item_fallback_${invoice.id}`,
        saleId: sale.id,
        productId: 'prod_gen',
        productName: 'مواد ومستلزمات إنشائية متفرقة',
        quantity: 1,
        unitPrice: subtotal,
        discount: 0,
        taxRate: 15,
        lineTotal: totalWithTax,
      },
    ];

    return {
      sale,
      saleItems: saleItems.length > 0 ? saleItems : fallbackItems,
      invoice,
      payment,
      zatcaQr,
      changeAmount: 0,
      subtotal,
      discountTotal,
      taxTotal: taxVal,
      grandTotal: totalWithTax,
      electronicInvoice,
    };
  } catch (error) {
    console.error('خطأ في تجهيز نتيجة الفاتورة لإعادة الطباعة:', error);
    return null;
  }
}

function createFallbackSale(invoice: Invoice): Sale {
  return {
    id: invoice.saleId || `sale_${invoice.id}`,
    saleNumber: invoice.invoiceNumber,
    customerId: invoice.customerId || 'walk_in',
    customerName: invoice.customerName || 'عميل نقدي',
    customerPhone: invoice.customerPhone || undefined,
    branchId: 'branch_main',
    warehouseId: 'wh_main',
    cashierId: 'cashier_main',
    saleType: 'pos_cash',
    status: 'completed',
    subtotal: invoice.totalExcludingTax || 0,
    discountTotal: 0,
    taxTotal: invoice.taxAmount || 0,
    grandTotal: invoice.totalIncludingTax || 0,
    paidAmount: invoice.totalIncludingTax || 0,
    createdAt: invoice.issueDate,
  };
}

function createFallbackPayment(invoice: Invoice): Payment {
  return {
    id: `pay_${invoice.id}`,
    receiptNumber: `REC-${invoice.invoiceNumber}`,
    paymentType: 'receipt',
    partyType: 'customer',
    partyId: invoice.customerId || 'walk_in',
    partyName: invoice.customerName || 'عميل نقدي',
    amount: invoice.totalIncludingTax || 0,
    paymentMethodId: invoice.paymentMethodId || 'CASH',
    reference: invoice.invoiceNumber,
    date: invoice.issueDate,
    collectedBy: 'الكاشير',
    createdAt: invoice.issueDate,
  };
}

/**
 * تحديث حالة الفاتورة في قاعدة بيانات Firestore
 * مثل 'Sent via WhatsApp' عند مشاركتها أو إرسالها للعميل
 */
export async function updateInvoiceStatus(
  invoiceId: string,
  newStatus: string,
  extra?: {
    whatsappSentAt?: string;
    whatsappStatus?: string;
    updatedBy?: string;
    [key: string]: any;
  }
): Promise<{ success: boolean; invoiceId: string; status: string; sentAt?: string }> {
  try {
    let targetDocId = invoiceId;
    const invRef = doc(db, 'invoices', invoiceId);
    const snap = await getDoc(invRef);

    if (!snap.exists()) {
      // البحث برقم الفاتورة في حال تم تمرير الرقم بدلاً من الـ ID
      const qNum = query(collection(db, 'invoices'), where('invoiceNumber', '==', invoiceId));
      const qSnap = await getDocs(qNum);
      if (!qSnap.empty) {
        targetDocId = qSnap.docs[0].id;
      }
    }

    const timestamp = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      status: newStatus,
      updatedAt: timestamp,
      ...(extra || {}),
    };

    if (newStatus === 'Sent via WhatsApp' || newStatus === 'تم الإرسال عبر الواتساب') {
      updatePayload.status = 'Sent via WhatsApp';
      updatePayload.whatsappStatus = 'sent';
      if (!updatePayload.whatsappSentAt) {
        updatePayload.whatsappSentAt = timestamp;
      }
    }

    await updateDoc(doc(db, 'invoices', targetDocId), updatePayload);

    return {
      success: true,
      invoiceId: targetDocId,
      status: updatePayload.status,
      sentAt: updatePayload.whatsappSentAt,
    };
  } catch (error) {
    console.error('خطأ أثناء تحديث حالة الفاتورة في Firestore:', error);
    throw error;
  }
}

