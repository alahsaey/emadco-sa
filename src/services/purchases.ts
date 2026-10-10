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
import {
  Purchase,
  PurchaseItem,
  PurchaseStatus,
  PaymentStatus,
  Supplier,
  Product,
  Inventory,
  InventoryMovement,
  Payment,
  AuditLog,
} from '../types';
import { logAuditEvent } from './audit';
import { cleanFirestoreData } from './db';

export interface CreatePurchaseItemInput {
  productId: string;
  productName: string;
  sku: string;
  unitSymbol?: string;
  quantity: number;
  unitPrice: number; // سعر الشراء / التكلفة
  taxRate?: number; // افتراضي 15%
}

export interface CreatePurchaseInput {
  supplierId: string;
  supplierName: string;
  warehouseId: string;
  warehouseName: string;
  supplierInvoiceNumber?: string;
  items: CreatePurchaseItemInput[];
  status?: PurchaseStatus; // 'draft' | 'ordered' | 'received'
  paymentMethodCode?: 'CASH' | 'TRANSFER' | 'MADA' | 'CREDIT';
  paidAmount?: number;
  notes?: string;
  actorName?: string;
}

/**
 * جلب جميع فواتير وأوامر الشراء
 */
export async function getPurchases(): Promise<Purchase[]> {
  try {
    const snap = await getDocs(collection(db, 'purchases'));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Purchase));
    return list.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  } catch (error) {
    console.error('خطأ في جلب فواتير الشراء:', error);
    throw error;
  }
}

/**
 * جلب تفاصيل فاتورة شراء مع بنودها
 */
export async function getPurchaseWithItems(purchaseId: string): Promise<{
  purchase: Purchase | null;
  items: PurchaseItem[];
}> {
  try {
    const pRef = doc(db, 'purchases', purchaseId);
    const pSnap = await getDoc(pRef);
    if (!pSnap.exists()) return { purchase: null, items: [] };

    const purchase = { id: pSnap.id, ...pSnap.data() } as Purchase;

    const itemsQ = query(
      collection(db, 'purchase_items'),
      where('purchaseId', '==', purchaseId)
    );
    const itemsSnap = await getDocs(itemsQ);
    const items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PurchaseItem));

    return { purchase, items };
  } catch (error) {
    console.error(`خطأ في جلب بيانات الشراء ${purchaseId}:`, error);
    return { purchase: null, items: [] };
  }
}

/**
 * إنشاء فاتورة شراء جديدة (Purchase Order / Purchase Invoice)
 * إذا كانت الحالة 'received' (معتمدة)، يتم تحديث المخزون وحساب متوسط التكلفة المرجح ورصيد المورد ذرياً
 */
export async function createPurchaseInvoice(input: CreatePurchaseInput): Promise<string> {
  const {
    supplierId,
    supplierName,
    warehouseId,
    warehouseName,
    supplierInvoiceNumber,
    items,
    status = 'received', // افتراضياً معتمدة ومستلمة للمشتريات الفورية
    paymentMethodCode = 'CASH',
    paidAmount = 0,
    notes,
    actorName = 'مسؤول المشتريات',
  } = input;

  if (!items || items.length === 0) {
    throw new Error('يرجى إضافة صنف واحد على الأقل في فاتورة الشراء.');
  }

  const now = new Date().toISOString();
  const timestampSuffix = Date.now().toString().slice(-6);
  const purchaseId = `po_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const orderNumber = `PO-${new Date().getFullYear()}-${timestampSuffix}`;

  // احتساب الإجماليات بدقة
  let subtotal = 0;
  let taxTotal = 0;

  const processedItems: {
    productId: string;
    productName: string;
    sku: string;
    unitSymbol?: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    taxAmount: number;
    lineTotal: number;
  }[] = [];

  for (const it of items) {
    const qty = Math.max(0.001, Number(it.quantity) || 1);
    const price = Math.max(0, Number(it.unitPrice) || 0);
    const taxRate = it.taxRate !== undefined ? it.taxRate : 15;

    const lineSubtotal = Math.round(qty * price * 100) / 100;
    const lineTax = Math.round(lineSubtotal * (taxRate / 100) * 100) / 100;
    const lineTotal = lineSubtotal + lineTax;

    subtotal += lineSubtotal;
    taxTotal += lineTax;

    processedItems.push({
      productId: it.productId,
      productName: it.productName,
      sku: it.sku,
      unitSymbol: it.unitSymbol,
      quantity: qty,
      unitPrice: price,
      taxRate,
      taxAmount: lineTax,
      lineTotal,
    });
  }

  subtotal = Math.round(subtotal * 100) / 100;
  taxTotal = Math.round(taxTotal * 100) / 100;
  const grandTotal = Math.round((subtotal + taxTotal) * 100) / 100;

  const validPaidAmount = Math.max(0, Math.min(paidAmount, grandTotal));
  let paymentStatus: PaymentStatus = 'unpaid';
  if (validPaidAmount >= grandTotal - 0.01) {
    paymentStatus = 'paid';
  } else if (validPaidAmount > 0) {
    paymentStatus = 'partially_paid';
  }

  const unpaidDebt = Math.max(0, grandTotal - validPaidAmount);

  // تنفيذ المعاملة الذرية (Atomic ACID Transaction) في Firestore
  await runTransaction(db, async (tx) => {
    // 1. قراءة بيانات المورد
    const suppRef = doc(db, 'suppliers', supplierId);
    const suppSnap = await tx.get(suppRef);
    let currentSupplierBalance = 0;
    if (suppSnap.exists()) {
      const sData = suppSnap.data() as Supplier;
      currentSupplierBalance = sData.balance || 0;
    }

    // 2. إذا كانت الفاتورة معتمدة ومستلمة، قراءة أرصدة المخزون السابقة للأصناف
    const inventoryUpdates: {
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      invRef: any;
      previousQty: number;
      newQty: number;
      newAverageCost: number;
      existingInv: Inventory;
    }[] = [];

    if (status === 'received') {
      for (const it of processedItems) {
        const invId = `inv_${it.productId}_${warehouseId}`;
        const invRef = doc(db, 'inventory', invId);
        const invSnap = await tx.get(invRef);

        let previousQty = 0;
        let reservedQty = 0;
        let previousAvgCost = it.unitPrice;
        let existingInv: Inventory;

        if (invSnap.exists()) {
          existingInv = invSnap.data() as Inventory;
          previousQty = existingInv.quantityOnHand || 0;
          reservedQty = existingInv.reservedQuantity || 0;
          previousAvgCost = existingInv.averageCost || it.unitPrice;
        } else {
          existingInv = {
            id: invId,
            productId: it.productId,
            warehouseId,
            quantityOnHand: 0,
            reservedQuantity: 0,
            availableQuantity: 0,
            averageCost: it.unitPrice,
            lastUpdated: now,
          };
        }

        const newQty = previousQty + it.quantity;
        // حساب متوسط التكلفة المرجح (Weighted Average Cost)
        let newAverageCost = it.unitPrice;
        if (newQty > 0) {
          const totalCostValue = (previousQty * previousAvgCost) + (it.quantity * it.unitPrice);
          newAverageCost = Math.round((totalCostValue / newQty) * 100) / 100;
        }

        inventoryUpdates.push({
          productId: it.productId,
          productName: it.productName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          invRef,
          previousQty,
          newQty,
          newAverageCost,
          existingInv,
        });
      }
    }

    // -------------------------------------------------------------
    // الكتابات الذرية (Writes)
    // -------------------------------------------------------------

    // 3. إنشاء مستند الفاتورة Purchase
    const purchaseDoc: Purchase = {
      id: purchaseId,
      orderNumber,
      supplierInvoiceNumber: supplierInvoiceNumber || '',
      supplierId,
      supplierName,
      warehouseId,
      warehouseName,
      status,
      subtotal,
      taxTotal,
      discountTotal: 0,
      grandTotal,
      paidAmount: validPaidAmount,
      paymentStatus,
      paymentMethodCode: paymentMethodCode || (validPaidAmount > 0 ? 'CASH' : 'CREDIT'),
      orderDate: now,
      receivedDate: status === 'received' ? now : undefined,
      notes: notes || '',
      createdBy: actorName,
      createdAt: now,
      updatedAt: now,
    };
    tx.set(doc(db, 'purchases', purchaseId), cleanFirestoreData(purchaseDoc));

    // 4. إنشاء بنود الفاتورة Purchase Items
    for (let i = 0; i < processedItems.length; i++) {
      const it = processedItems[i];
      const pItemId = `pitem_${purchaseId}_${i + 1}`;
      const itemDoc: PurchaseItem = {
        id: pItemId,
        purchaseId,
        productId: it.productId,
        productName: it.productName,
        sku: it.sku,
        unitSymbol: it.unitSymbol,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        taxRate: it.taxRate,
        taxAmount: it.taxAmount,
        lineTotal: it.lineTotal,
      };
      tx.set(doc(db, 'purchase_items', pItemId), cleanFirestoreData(itemDoc));
    }

    // 5. إذا كانت معتمدة، تحديث المخزون وتسجيل حركات المخزون Inventory Movements
    if (status === 'received') {
      for (let i = 0; i < inventoryUpdates.length; i++) {
        const u = inventoryUpdates[i];

        // تحديث رصيد المخزون
        const updatedInv: Inventory = {
          ...u.existingInv,
          quantityOnHand: u.newQty,
          availableQuantity: Math.max(0, u.newQty - (u.existingInv.reservedQuantity || 0)),
          averageCost: u.newAverageCost,
          lastUpdated: now,
        };
        tx.set(u.invRef, cleanFirestoreData(updatedInv));

        // تحديث سعر التكلفة لبطاقة الصنف الرئيسية
        const prodRef = doc(db, 'products', u.productId);
        tx.update(prodRef, {
          costPrice: u.newAverageCost,
          updatedAt: now,
        });

        // تسجيل حركة مخزون توريد
        const movId = `mov_po_${purchaseId}_${i + 1}`;
        const movDoc: InventoryMovement = {
          id: movId,
          productId: u.productId,
          warehouseId,
          movementType: 'purchase',
          referenceId: orderNumber,
          quantity: u.quantity,
          unitCost: u.unitPrice,
          previousQty: u.previousQty,
          newQty: u.newQty,
          notes: `توريد شراء بموجب أمر توريد ${orderNumber} من المورد ${supplierName}`,
          createdAt: now,
          createdBy: actorName,
        };
        tx.set(doc(db, 'inventory_movements', movId), cleanFirestoreData(movDoc));
      }

      // 6. تحديث رصيد مستحقات المورد بالمبلغ الآجل غير المسدد
      if (unpaidDebt > 0 && suppSnap.exists()) {
        const newSupplierBal = Math.round((currentSupplierBalance + unpaidDebt) * 100) / 100;
        tx.update(suppRef, {
          balance: newSupplierBal,
          updatedAt: now,
        });
      }

      // 7. إذا تم تسجيل دفعة مسددة فوراً للمورد، إنشاء سند صرف
      if (validPaidAmount > 0) {
        const paymentId = `pay_po_${purchaseId}`;
        const receiptNumber = `DIS-${new Date().getFullYear()}-${timestampSuffix}`;
        const paymentDoc: Payment = {
          id: paymentId,
          receiptNumber,
          paymentType: 'disbursement', // سند صرف
          partyType: 'supplier',
          partyId: supplierId,
          partyName: supplierName,
          amount: validPaidAmount,
          paymentMethodId: paymentMethodCode || 'CASH',
          reference: supplierInvoiceNumber || orderNumber,
          date: now,
          collectedBy: actorName,
          notes: `دفعة مشتريات فورية لفاتورة ${orderNumber}`,
          purchaseId,
          createdAt: now,
        };
        tx.set(doc(db, 'payments', paymentId), cleanFirestoreData(paymentDoc));
      }
    }

    // 8. تسجيل في سجل التدقيق المالي Audit Log
    const auditId = `audit_po_${purchaseId}`;
    const auditDoc: AuditLog = {
      id: auditId,
      userId: 'user_purchaser',
      userName: actorName,
      action: 'CREATE',
      entity: 'purchases',
      entityId: purchaseId,
      details: `إنشاء فاتورة مشتريات ${orderNumber} بمبلغ ${grandTotal} ر.س - المورد: ${supplierName} - الحالة: ${status === 'received' ? 'معتمدة ومستلمة وتم تحديث المخزون' : 'مسودة قيد المراجعة'} - المسدد: ${validPaidAmount} ر.س (المتبقي: ${unpaidDebt} ر.س)`,
      ipAddress: 'Procurement Terminal',
      timestamp: now,
    };
    tx.set(doc(db, 'audit_logs', auditId), cleanFirestoreData(auditDoc));
  });

  return purchaseId;
}

/**
 * اعتماد واستلام فاتورة شراء كانت في حالة 'draft' أو 'ordered'
 * وتحديث المخزون ورصيد المورد فورياً
 */
export async function approveAndReceivePurchase(
  purchaseId: string,
  actorName = 'المدير'
): Promise<void> {
  const { purchase, items } = await getPurchaseWithItems(purchaseId);
  if (!purchase) {
    throw new Error('فاتورة الشراء غير موجودة.');
  }
  if (purchase.status === 'received') {
    throw new Error('تم اعتماد واستلام فاتورة الشراء هذه مسبقاً.');
  }
  if (!items || items.length === 0) {
    throw new Error('لا توجد بنود أصناف في فاتورة الشراء.');
  }

  const now = new Date().toISOString();
  const unpaidDebt = Math.max(0, purchase.grandTotal - (purchase.paidAmount || 0));

  await runTransaction(db, async (tx) => {
    // 1. قراءة وتحديث كل صنف في المستودع
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const invId = `inv_${it.productId}_${purchase.warehouseId}`;
      const invRef = doc(db, 'inventory', invId);
      const invSnap = await tx.get(invRef);

      let previousQty = 0;
      let reservedQty = 0;
      let previousAvgCost = it.unitPrice;
      let existingInv: Inventory;

      if (invSnap.exists()) {
        existingInv = invSnap.data() as Inventory;
        previousQty = existingInv.quantityOnHand || 0;
        reservedQty = existingInv.reservedQuantity || 0;
        previousAvgCost = existingInv.averageCost || it.unitPrice;
      } else {
        existingInv = {
          id: invId,
          productId: it.productId,
          warehouseId: purchase.warehouseId,
          quantityOnHand: 0,
          reservedQuantity: 0,
          availableQuantity: 0,
          averageCost: it.unitPrice,
          lastUpdated: now,
        };
      }

      const newQty = previousQty + it.quantity;
      let newAverageCost = it.unitPrice;
      if (newQty > 0) {
        const totalVal = (previousQty * previousAvgCost) + (it.quantity * it.unitPrice);
        newAverageCost = Math.round((totalVal / newQty) * 100) / 100;
      }

      const updatedInv: Inventory = {
        ...existingInv,
        quantityOnHand: newQty,
        availableQuantity: Math.max(0, newQty - reservedQty),
        averageCost: newAverageCost,
        lastUpdated: now,
      };
      tx.set(invRef, updatedInv);

      // تحديث سعر التكلفة بالمنتج
      const prodRef = doc(db, 'products', it.productId);
      tx.update(prodRef, {
        costPrice: newAverageCost,
        updatedAt: now,
      });

      // حركة مخزون
      const movId = `mov_po_appr_${purchaseId}_${i + 1}`;
      const movDoc: InventoryMovement = {
        id: movId,
        productId: it.productId,
        warehouseId: purchase.warehouseId,
        movementType: 'purchase',
        referenceId: purchase.orderNumber,
        quantity: it.quantity,
        unitCost: it.unitPrice,
        previousQty,
        newQty,
        notes: `اعتماد استلام فاتورة شراء ${purchase.orderNumber}`,
        createdAt: now,
        createdBy: actorName,
      };
      tx.set(doc(db, 'inventory_movements', movId), movDoc);
    }

    // 2. تحديث رصيد المورد بالمبلغ الآجل
    if (unpaidDebt > 0) {
      const suppRef = doc(db, 'suppliers', purchase.supplierId);
      const suppSnap = await tx.get(suppRef);
      if (suppSnap.exists()) {
        const sData = suppSnap.data() as Supplier;
        const newBal = Math.round(((sData.balance || 0) + unpaidDebt) * 100) / 100;
        tx.update(suppRef, {
          balance: newBal,
          updatedAt: now,
        });
      }
    }

    // 3. تحديث حالة الفاتورة لتصبح 'received'
    const purchaseRef = doc(db, 'purchases', purchaseId);
    tx.update(purchaseRef, {
      status: 'received',
      receivedDate: now,
      updatedAt: now,
    });

    // 4. توثيق الحدث في سجل التدقيق
    const auditId = `audit_po_appr_${purchaseId}`;
    const auditDoc: AuditLog = {
      id: auditId,
      userId: 'user_manager',
      userName: actorName,
      action: 'UPDATE',
      entity: 'purchases',
      entityId: purchaseId,
      details: `اعتماد واستلام فاتورة شراء ${purchase.orderNumber} بمبلغ ${purchase.grandTotal} ر.س وتحديث أرصدة المخزون والمورد فورياً`,
      ipAddress: 'Management Terminal',
      timestamp: now,
    };
    tx.set(doc(db, 'audit_logs', auditId), auditDoc);
  });
}
