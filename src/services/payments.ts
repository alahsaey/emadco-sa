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
  runTransaction,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Payment, Customer, Supplier, AuditLog, Invoice, Purchase, Sale } from '../types';
import { logAuditEvent } from './audit';
import { cleanFirestoreData } from './db';

export interface RecordPaymentInput {
  paymentType: 'receipt' | 'disbursement'; // receipt = قبض (من عميل), disbursement = صرف (لمورد)
  partyType: 'customer' | 'supplier';
  partyId: string;
  partyName: string;
  amount: number;
  paymentMethodId: string; // 'CASH' | 'MADA' | 'TRANSFER' | 'CHECK'
  reference?: string;
  date?: string;
  notes?: string;
  invoiceId?: string;
  purchaseId?: string;
  actorName?: string;
}

/**
 * جلب جميع سجلات المدفوعات وسندات القبض والصرف
 */
export async function getPayments(filter?: {
  partyType?: 'customer' | 'supplier';
  partyId?: string;
  paymentType?: 'receipt' | 'disbursement';
}): Promise<Payment[]> {
  try {
    const colRef = collection(db, 'payments');
    let q = query(colRef);

    if (filter?.partyType) {
      q = query(q, where('partyType', '==', filter.partyType));
    }
    if (filter?.partyId) {
      q = query(q, where('partyId', '==', filter.partyId));
    }
    if (filter?.paymentType) {
      q = query(q, where('paymentType', '==', filter.paymentType));
    }

    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment));
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('خطأ في جلب بيانات المدفوعات:', error);
    throw error;
  }
}

/**
 * تسجيل دفعة جديدة (سند قبض للعميل أو سند صرف للمورد)
 * مع تحديث أرصدة الحسابات فورياً في معاملة ذرية (ACID Transaction)
 */
export async function recordPaymentTransaction(input: RecordPaymentInput): Promise<Payment> {
  const {
    paymentType,
    partyType,
    partyId,
    partyName,
    amount,
    paymentMethodId,
    reference,
    date,
    notes,
    invoiceId,
    purchaseId,
    actorName = 'أمين الصندوق',
  } = input;

  if (!partyId) {
    throw new Error('يرجى تحديد الطرف (العميل أو المورد).');
  }
  if (!amount || Number(amount) <= 0) {
    throw new Error('مبلغ الدفعة يجب أن يكون أكبر من الصفر.');
  }

  const validAmount = Math.round(Number(amount) * 100) / 100;
  const now = date || new Date().toISOString();
  const timestampSuffix = Date.now().toString().slice(-6);
  const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const receiptPrefix = paymentType === 'receipt' ? 'REC' : 'DIS';
  const receiptNumber = `${receiptPrefix}-${new Date().getFullYear()}-${timestampSuffix}`;

  const methodNames: Record<string, string> = {
    CASH: 'نقداً',
    MADA: 'شبكة مدى / نقاط بيع',
    TRANSFER: 'تحويل بنكي',
    CHECK: 'شيك مصرفي',
  };
  const methodName = methodNames[paymentMethodId] || paymentMethodId;

  await runTransaction(db, async (tx) => {
    // -------------------------------------------------------------
    // المرحلة 1: القراءة والتحقق من حساب الطرف
    // -------------------------------------------------------------
    let previousBalance = 0;
    let newBalance = 0;

    if (partyType === 'customer') {
      const custRef = doc(db, 'customers', partyId);
      const custSnap = await tx.get(custRef);
      if (!custSnap.exists()) {
        throw new Error('العميل المحدد غير موجود في قاعدة البيانات.');
      }
      const custData = custSnap.data() as Customer;
      previousBalance = custData.currentBalance || 0;

      // سند قبض من عميل يخفض مديونيته
      newBalance = Math.round((previousBalance - validAmount) * 100) / 100;

      tx.update(custRef, {
        currentBalance: newBalance,
        updatedAt: now,
      });

      // إذا كانت الدفعة مرتبطة بفاتورة مبيعات معينة
      if (invoiceId) {
        const invRef = doc(db, 'invoices', invoiceId);
        const invSnap = await tx.get(invRef);
        if (invSnap.exists()) {
          const invData = invSnap.data() as Invoice;
          const prevPaid = Number(invData.paidAmount) || 0;
          const updatedPaidAmount = Math.round((prevPaid + validAmount) * 100) / 100;
          const totalInc = Number(invData.totalIncludingTax) || 0;
          const isFullyPaid = updatedPaidAmount >= (totalInc - 0.01) || newBalance <= 0;

          tx.update(invRef, {
            paidAmount: updatedPaidAmount,
            paymentStatus: isFullyPaid ? 'paid' : 'partially_paid',
          });

          if (invData.saleId) {
            const saleRef = doc(db, 'sales', invData.saleId);
            const saleSnap = await tx.get(saleRef);
            if (saleSnap.exists()) {
              const saleData = saleSnap.data() as Sale;
              const salePrevPaid = Number(saleData.paidAmount) || 0;
              tx.update(saleRef, {
                paidAmount: Math.round((salePrevPaid + validAmount) * 100) / 100,
              });
            }
          }
        }
      }
    } else {
      // مورد (Supplier)
      const suppRef = doc(db, 'suppliers', partyId);
      const suppSnap = await tx.get(suppRef);
      if (!suppSnap.exists()) {
        throw new Error('المورد المحدد غير موجود في قاعدة البيانات.');
      }
      const suppData = suppSnap.data() as Supplier;
      previousBalance = suppData.balance || 0;

      // سند صرف لمورد يخفض الرصيد المستحق له
      newBalance = Math.round((previousBalance - validAmount) * 100) / 100;

      tx.update(suppRef, {
        balance: newBalance,
        updatedAt: now,
      });

      // إذا كانت الدفعة مرتبطة بفاتورة مشتريات
      if (purchaseId) {
        const poRef = doc(db, 'purchases', purchaseId);
        const poSnap = await tx.get(poRef);
        if (poSnap.exists()) {
          const poData = poSnap.data() as Purchase;
          const updatedPaidAmount = Math.round(((poData.paidAmount || 0) + validAmount) * 100) / 100;
          const isFullyPaid = updatedPaidAmount >= (poData.grandTotal - 0.01);
          tx.update(poRef, {
            paidAmount: updatedPaidAmount,
            paymentStatus: isFullyPaid ? 'paid' : 'partially_paid',
            updatedAt: now,
          });
        }
      }
    }

    // -------------------------------------------------------------
    // المرحلة 2: حفظ مستند السند المالي Payment
    // -------------------------------------------------------------
    const paymentDoc: Payment = {
      id: paymentId,
      receiptNumber,
      paymentType,
      partyType,
      partyId,
      partyName,
      amount: validAmount,
      paymentMethodId,
      reference: reference?.trim() || '',
      date: now,
      collectedBy: actorName,
      notes: notes?.trim() || `${paymentType === 'receipt' ? 'قبض وتحصيل' : 'صرف وسداد'} من ${partyName}`,
      invoiceId: invoiceId || undefined,
      purchaseId: purchaseId || undefined,
      createdAt: now,
    };
    tx.set(doc(db, 'payments', paymentId), cleanFirestoreData(paymentDoc));

    // -------------------------------------------------------------
    // المرحلة 3: توثيق العملية في سجل التدقيق الأمني والمالي
    // -------------------------------------------------------------
    const auditId = `audit_${paymentId}`;
    const auditDoc: AuditLog = {
      id: auditId,
      userId: 'cashier_user',
      userName: actorName,
      action: 'CREATE',
      entity: 'payments',
      entityId: paymentId,
      details: `تسجيل ${paymentType === 'receipt' ? 'سند قبض' : 'سند صرف'} برقم ${receiptNumber} بمبلغ ${validAmount.toFixed(2)} ر.س [طريقة الدفع: ${methodName}] للطرف: ${partyName} (الرصيد السابق: ${previousBalance.toFixed(2)} ر.س ← الرصيد الجديد: ${newBalance.toFixed(2)} ر.س)`,
      ipAddress: 'Finance Office',
      timestamp: now,
    };
    tx.set(doc(db, 'audit_logs', auditId), cleanFirestoreData(auditDoc));
  });

  // إذا كانت دفعة من عميل غير مقيدة برقم فاتورة محدد، نوزعها تلقائياً على فواتيره الآجلة غير المسددة بالأقدمية (FIFO)
  if (partyType === 'customer' && !invoiceId) {
    autoAllocateCustomerPayment(partyId, validAmount).catch((err) => {
      console.warn('تحذير أثناء توزيع دفعة العميل على الفواتير:', err);
    });
  }

  return {
    id: paymentId,
    receiptNumber,
    paymentType,
    partyType,
    partyId,
    partyName,
    amount: validAmount,
    paymentMethodId,
    reference: reference?.trim(),
    date: now,
    collectedBy: actorName,
    notes,
    invoiceId,
    purchaseId,
    createdAt: now,
  };
}

/**
 * توزيع دفعات العميل غير المخصصة على الفواتير الآجلة المفتوحة بنظام الأقدمية أولاً (FIFO)
 */
async function autoAllocateCustomerPayment(customerId: string, paymentAmount: number): Promise<void> {
  try {
    let remainingToAllocate = paymentAmount;
    if (remainingToAllocate <= 0) return;

    // جلب فواتير العميل المفتوحة
    const [invSnap, salesSnap] = await Promise.all([
      getDocs(query(collection(db, 'invoices'), where('customerId', '==', customerId))),
      getDocs(query(collection(db, 'sales'), where('customerId', '==', customerId))),
    ]);

    // معالجة الفواتير غير المسددة
    const unpaidInvoices = invSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Invoice))
      .filter((inv) => inv.paymentStatus !== 'paid')
      .sort((a, b) => new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime());

    for (const inv of unpaidInvoices) {
      if (remainingToAllocate <= 0) break;

      const total = Number(inv.totalIncludingTax) || 0;
      const currentPaid = Number(inv.paidAmount) || 0;
      const remainingOnInv = Math.max(0, total - currentPaid);

      if (remainingOnInv > 0) {
        const alloc = Math.min(remainingOnInv, remainingToAllocate);
        const newPaid = Math.round((currentPaid + alloc) * 100) / 100;
        const isPaid = newPaid >= (total - 0.01);

        await updateDoc(doc(db, 'invoices', inv.id), {
          paidAmount: newPaid,
          paymentStatus: isPaid ? 'paid' : 'partially_paid',
        });

        if (inv.saleId) {
          await updateDoc(doc(db, 'sales', inv.saleId), {
            paidAmount: newPaid,
          }).catch(() => {});
        }

        remainingToAllocate = Math.round((remainingToAllocate - alloc) * 100) / 100;
      }
    }

    // إذا تبقى مبلغ، نتحقق من مستندات sales التي ليس لها فواتير منفصلة
    if (remainingToAllocate > 0) {
      const unpaidSales = salesSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Sale))
        .filter((s) => s.saleType === 'contractor_credit' && (s.paidAmount || 0) < s.grandTotal)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      for (const sale of unpaidSales) {
        if (remainingToAllocate <= 0) break;
        const total = Number(sale.grandTotal) || 0;
        const currentPaid = Number(sale.paidAmount) || 0;
        const rem = Math.max(0, total - currentPaid);
        if (rem > 0) {
          const alloc = Math.min(rem, remainingToAllocate);
          const newPaid = Math.round((currentPaid + alloc) * 100) / 100;
          await updateDoc(doc(db, 'sales', sale.id), {
            paidAmount: newPaid,
          }).catch(() => {});
          remainingToAllocate = Math.round((remainingToAllocate - alloc) * 100) / 100;
        }
      }
    }
  } catch (error) {
    console.warn('خطأ في autoAllocateCustomerPayment:', error);
  }
}
