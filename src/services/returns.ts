/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Return,
  ReturnItem,
  ReturnReason,
  Sale,
  SaleItem,
  Invoice,
  Customer,
  Inventory,
  InventoryMovement,
  Payment,
  AuditLog,
} from '../types';
import { logAuditEvent } from './audit';
import { cleanFirestoreData } from './db';

export interface ReturnItemInput {
  productId: string;
  productName: string;
  sku?: string;
  unitSymbol?: string;
  quantity: number; // الكمية المرتجعة
  unitPrice: number;
  discount?: number;
  taxRate: number;
  reason?: ReturnReason | string;
  returnCondition?: 'good_as_new' | 'damaged' | 'defective';
}

export interface CreateReturnPayload {
  originalSaleId: string;
  originalInvoiceNumber: string;
  customerId?: string | null;
  customerName: string;
  warehouseId: string;
  warehouseName?: string;
  reason: ReturnReason;
  reasonDetails?: string;
  refundMethod: 'cash' | 'card' | 'customer_balance' | 'bank_transfer';
  processedBy: string;
  items: ReturnItemInput[];
}

export interface SaleWithReturnability {
  sale: Sale;
  invoice?: Invoice;
  customer?: Customer;
  items: {
    saleItem: SaleItem;
    purchasedQuantity: number;
    alreadyReturnedQuantity: number;
    maxReturnableQuantity: number;
    unitPrice: number;
    discount: number;
    taxRate: number;
  }[];
  existingReturns: Return[];
}

/**
 * جلب جميع المرتجعات المسجلة
 */
export async function getReturns(): Promise<Return[]> {
  try {
    const snap = await getDocs(collection(db, 'returns'));
    const returnsList = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Return));

    // جلب البنود الفرعية إن أمكن
    const itemsSnap = await getDocs(collection(db, 'return_items'));
    const itemsMap: Record<string, ReturnItem[]> = {};
    itemsSnap.docs.forEach((d) => {
      const it = { id: d.id, ...d.data() } as ReturnItem;
      if (!itemsMap[it.returnId]) itemsMap[it.returnId] = [];
      itemsMap[it.returnId].push(it);
    });

    returnsList.forEach((r) => {
      r.items = itemsMap[r.id] || [];
    });

    return returnsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('خطأ في جلب المرتجعات:', error);
    return [];
  }
}

/**
 * جلب بيانات الفاتورة الأصلية وحساب الكميات المتاحة للإرجاع
 */
export async function getSaleForReturn(searchKey: string): Promise<SaleWithReturnability | null> {
  const trimmed = searchKey.trim();
  if (!trimmed) return null;

  try {
    let saleDoc: Sale | null = null;
    let saleId = '';

    // 1. محاولة البحث بواسطة معرف البيع أو رقم الفاتورة أو رقم البيع
    const salesCol = collection(db, 'sales');
    const invoicesCol = collection(db, 'invoices');

    // بحث بالـ id المباشر
    const directSaleSnap = await getDoc(doc(salesCol, trimmed));
    if (directSaleSnap.exists()) {
      saleDoc = { id: directSaleSnap.id, ...directSaleSnap.data() } as Sale;
      saleId = directSaleSnap.id;
    }

    if (!saleDoc) {
      // بحث برقم البيع saleNumber
      const qSaleNum = query(salesCol, where('saleNumber', '==', trimmed));
      const snapSaleNum = await getDocs(qSaleNum);
      if (!snapSaleNum.empty) {
        saleDoc = { id: snapSaleNum.docs[0].id, ...snapSaleNum.docs[0].data() } as Sale;
        saleId = snapSaleNum.docs[0].id;
      }
    }

    if (!saleDoc) {
      // بحث برقم الفاتورة في invoices
      const qInvNum = query(invoicesCol, where('invoiceNumber', '==', trimmed));
      const snapInvNum = await getDocs(qInvNum);
      if (!snapInvNum.empty) {
        const invData = snapInvNum.docs[0].data() as Invoice;
        if (invData.saleId) {
          const sSnap = await getDoc(doc(salesCol, invData.saleId));
          if (sSnap.exists()) {
            saleDoc = { id: sSnap.id, ...sSnap.data() } as Sale;
            saleId = sSnap.id;
          }
        }
      }
    }

    if (!saleDoc) return null;

    // جلب بنود الفاتورة الأصلية
    const qItems = query(collection(db, 'sale_items'), where('saleId', '==', saleId));
    const itemsSnap = await getDocs(qItems);
    const saleItems = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as SaleItem));

    // جلب الفاتورة المرتبطة
    let invoice: Invoice | undefined;
    const qInv = query(invoicesCol, where('saleId', '==', saleId));
    const invSnap = await getDocs(qInv);
    if (!invSnap.empty) {
      invoice = { id: invSnap.docs[0].id, ...invSnap.docs[0].data() } as Invoice;
    }

    // جلب العميل إن وجد
    let customer: Customer | undefined;
    if (saleDoc.customerId) {
      const cSnap = await getDoc(doc(db, 'customers', saleDoc.customerId));
      if (cSnap.exists()) {
        customer = { id: cSnap.id, ...cSnap.data() } as Customer;
      }
    }

    // جلب أي مرتجعات سابقة لنفس الفاتورة
    const qReturns = query(collection(db, 'returns'), where('originalSaleId', '==', saleId));
    const returnsSnap = await getDocs(qReturns);
    const existingReturns = returnsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Return));

    // حساب الكميات المرتجعة مسبقاً لكل منتج
    const returnedQtyMap: Record<string, number> = {};
    for (const ret of existingReturns) {
      const qRetItems = query(collection(db, 'return_items'), where('returnId', '==', ret.id));
      const retItemsSnap = await getDocs(qRetItems);
      retItemsSnap.docs.forEach((d) => {
        const rit = d.data() as ReturnItem;
        returnedQtyMap[rit.productId] = (returnedQtyMap[rit.productId] || 0) + rit.quantity;
      });
    }

    const items = saleItems.map((si) => {
      const alreadyReturned = returnedQtyMap[si.productId] || 0;
      const maxReturnable = Math.max(0, si.quantity - alreadyReturned);
      return {
        saleItem: si,
        purchasedQuantity: si.quantity,
        alreadyReturnedQuantity: alreadyReturned,
        maxReturnableQuantity: maxReturnable,
        unitPrice: si.unitPrice,
        discount: si.discount || 0,
        taxRate: si.taxRate !== undefined ? si.taxRate : 15,
      };
    });

    return {
      sale: saleDoc,
      invoice,
      customer,
      items,
      existingReturns,
    };
  } catch (error) {
    console.error('خطأ في جلب بيانات الفاتورة للإرجاع:', error);
    throw error;
  }
}

/**
 * تنفيذ عملية المرتجع ذرياً (Atomic Firestore Transaction)
 * - إنشاء سجل المرتجع Return
 * - إنشاء بنود المرتجع ReturnItems
 * - زيادة المخزون في المستودع
 * - تسجيل حركة المخزون من نوع return
 * - تحديث رصيد العميل
 * - توثيق العملية في سجل التدقيق Audit Log
 */
export async function executeReturnTransaction(payload: CreateReturnPayload): Promise<Return> {
  const validItems = payload.items.filter((it) => it.quantity > 0);
  if (validItems.length === 0) {
    throw new Error('يجب تحديد كمية صالحة لمنتج واحد على الأقل لإتمام المرتجع.');
  }

  const now = new Date().toISOString();
  const timestampSuffix = Date.now().toString().slice(-6);
  const returnId = `ret_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const returnNumber = `RET-${new Date().getFullYear()}-${timestampSuffix}`;

  // حساب المبالغ بدقة
  let subtotal = 0;
  let taxTotal = 0;
  const processedItems: (ReturnItem & { previousStock: number; newStock: number; invRef: any })[] = [];

  const createdReturn = await runTransaction(db, async (tx) => {
    // 1. التحقق من المستند الأصلي
    const saleRef = doc(db, 'sales', payload.originalSaleId);
    const saleSnap = await tx.get(saleRef);
    if (!saleSnap.exists()) {
      throw new Error('فاتورة البيع الأصلية غير موجودة.');
    }
    const saleData = saleSnap.data() as Sale;

    // 2. قراءة والتحقق من المنتجات والمخزون
    for (let i = 0; i < validItems.length; i++) {
      const it = validItems[i];
      const invId = `inv_${it.productId}_${payload.warehouseId}`;
      const invRef = doc(db, 'inventory', invId);
      const invSnap = await tx.get(invRef);

      let currentOnHand = 0;
      let reservedQty = 0;
      let existingCost = it.unitPrice;

      if (invSnap.exists()) {
        const invData = invSnap.data() as Inventory;
        currentOnHand = invData.quantityOnHand || 0;
        reservedQty = invData.reservedQuantity || 0;
        existingCost = invData.averageCost || it.unitPrice;
      }

      const itemSubtotal = it.unitPrice * it.quantity;
      const itemTax = Math.round(itemSubtotal * (it.taxRate / 100) * 100) / 100;
      const itemTotal = Math.round((itemSubtotal + itemTax) * 100) / 100;

      subtotal += itemSubtotal;
      taxTotal += itemTax;

      // إعادة المخزون بحسب الحالة (سليم يعاد للمخزون الصالح، تالف يستبعد لحماية الجودة)
      const isDamaged = it.returnCondition === 'damaged';
      const newStock = isDamaged ? currentOnHand : currentOnHand + it.quantity;

      const returnItemId = `ritem_${returnId}_${i + 1}`;
      processedItems.push({
        id: returnItemId,
        returnId,
        productId: it.productId,
        productName: it.productName,
        sku: it.sku,
        unitSymbol: it.unitSymbol,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        taxRate: it.taxRate,
        taxAmount: itemTax,
        refundTotal: itemTotal,
        reason: it.reason || payload.reason,
        returnCondition: it.returnCondition || 'good_as_new',
        previousStock: currentOnHand,
        newStock,
        invRef,
      });
    }

    const refundGrandTotal = Math.round((subtotal + taxTotal) * 100) / 100;

    // 3. التحقق من العميل إن وجد
    let customerDoc: Customer | null = null;
    let customerRef: any = null;
    if (payload.customerId) {
      customerRef = doc(db, 'customers', payload.customerId);
      const custSnap = await tx.get(customerRef);
      if (custSnap.exists()) {
        customerDoc = custSnap.data() as Customer;
      }
    }

    // 4. إنشاء مستند المرتجع
    const returnDoc: Return = {
      id: returnId,
      returnNumber,
      originalSaleId: payload.originalSaleId,
      originalInvoiceNumber: payload.originalInvoiceNumber,
      customerId: payload.customerId || null,
      customerName: payload.customerName || 'عميل نقدي',
      warehouseId: payload.warehouseId,
      warehouseName: payload.warehouseName,
      subtotal,
      taxTotal,
      refundAmount: refundGrandTotal,
      refundMethod: payload.refundMethod,
      reason: payload.reason,
      reasonDetails: payload.reasonDetails || '',
      status: 'approved',
      processedBy: payload.processedBy,
      createdAt: now,
    };
    tx.set(doc(db, 'returns', returnId), cleanFirestoreData(returnDoc));

    // 5. حفظ بنود المرتجع وتحديث المخزون بحسب الحالة
    for (const pi of processedItems) {
      const { previousStock, newStock, invRef, ...itemData } = pi;
      tx.set(doc(db, 'return_items', pi.id), cleanFirestoreData(itemData));

      const isDamaged = pi.returnCondition === 'damaged';

      // إذا كان المنتج سليماً، يعاد رصيده إلى المخزون المتاح للبيع
      if (!isDamaged) {
        tx.set(
          invRef,
          cleanFirestoreData({
            id: `inv_${pi.productId}_${payload.warehouseId}`,
            productId: pi.productId,
            warehouseId: payload.warehouseId,
            quantityOnHand: newStock,
            availableQuantity: newStock,
            lastUpdated: now,
          }),
          { merge: true }
        );
      }

      // تسجيل حركة مخزون مرتجع
      const movId = `mov_ret_${returnId}_${pi.productId}`;
      const movDoc: InventoryMovement = {
        id: movId,
        productId: pi.productId,
        warehouseId: payload.warehouseId,
        movementType: isDamaged ? 'adjustment' : 'return',
        referenceId: returnNumber,
        quantity: isDamaged ? 0 : pi.quantity,
        unitCost: pi.unitPrice,
        previousQty: previousStock,
        newQty: newStock,
        notes: isDamaged
          ? `مرتجع بضاعة تالفة (مستبعدة من المخزون الصالح للبيع لحماية الجودة) - إشعار ${returnNumber} للفاتورة ${payload.originalInvoiceNumber} [السبب: ${payload.reason}]`
          : `مرتجع مبيعات سليم (أُعيد للمخزون الصالح للبيع) - إشعار ${returnNumber} للفاتورة ${payload.originalInvoiceNumber} [السبب: ${payload.reason}]`,
        createdAt: now,
        createdBy: payload.processedBy,
      };
      tx.set(doc(db, 'inventory_movements', movId), cleanFirestoreData(movDoc));
    }

    // 6. تحديث رصيد العميل
    // إذا كانت طريقة الإرجاع رصيد دائن على حساب العميل أو إذا كانت الفاتورة آجلة:
    // تخفيض مديونية العميل (أو زيادة رصيده الدائن) بمقدار قيمة المرتجع
    if (customerDoc && customerRef) {
      if (payload.refundMethod === 'customer_balance' || saleData.saleType === 'contractor_credit') {
        const currentBal = customerDoc.currentBalance || 0;
        const newBal = Math.round((currentBal - refundGrandTotal) * 100) / 100;
        tx.update(customerRef, {
          currentBalance: newBal,
          updatedAt: now,
        });
      }
    }

    // 7. إذا كان الاسترداد نقدي، توثيق سند صرف نقدي من الخزينة
    if (payload.refundMethod === 'cash') {
      const payId = `pay_refund_${returnId}`;
      const paymentDoc: Payment = {
        id: payId,
        receiptNumber: `DIS-${new Date().getFullYear()}-${timestampSuffix}`,
        paymentType: 'disbursement', // سند صرف
        partyType: 'customer',
        partyId: payload.customerId || 'walk_in',
        partyName: payload.customerName,
        amount: refundGrandTotal,
        paymentMethodId: 'CASH',
        reference: returnNumber,
        date: now,
        collectedBy: payload.processedBy,
        notes: `صرف نقدي لمرتجع مبيعات إشعار ${returnNumber} للفاتورة ${payload.originalInvoiceNumber}`,
      };
      tx.set(doc(db, 'payments', payId), cleanFirestoreData(paymentDoc));
    }

    // 8. تسجيل العملية في سجل التدقيق الأمني Audit Log
    const auditId = `audit_${returnId}`;
    const auditDoc: AuditLog = {
      id: auditId,
      userId: 'user_active',
      userName: payload.processedBy,
      action: 'CREATE',
      entity: 'returns',
      entityId: returnId,
      details: `إصدار إشعار مرتجع ${returnNumber} للفاتورة ${payload.originalInvoiceNumber} بإجمالي ${refundGrandTotal} ر.س - السبب: ${payload.reason} (${payload.reasonDetails || 'بدون تفاصيل إضافية'}) - طريقة الاسترداد: ${payload.refundMethod}`,
      ipAddress: 'POS Terminal Counter',
      timestamp: now,
    };
    tx.set(doc(db, 'audit_logs', auditId), cleanFirestoreData(auditDoc));

    return {
      ...returnDoc,
      items: processedItems.map(({ previousStock, newStock, invRef, ...rest }) => rest),
    };
  });

  return createdReturn;
}
