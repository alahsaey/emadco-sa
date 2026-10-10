/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  doc,
  getDocs,
  query,
  where,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Product,
  Category,
  Customer,
  Warehouse,
  PaymentMethod,
  Sale,
  SaleItem,
  Invoice,
  Payment,
  Inventory,
  InventoryMovement,
  AuditLog,
  ElectronicInvoice,
  PaymentTransaction,
} from '../types';
import { generateZatcaTlvBase64, generateUuidV4 } from './zatca';
import { processElectronicInvoiceCreation } from './zatcaIntegration';
import { cleanFirestoreData, getWarehouses, sortWarehouses } from './db';

export interface PosCartItem {
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  quantity: number;
  unitPrice: number;
  retailPrice: number;
  wholesalePrice: number;
  contractorPrice: number;
  taxRate: number;
  discount: number; // خصم البند الواحد
  unitSymbol?: string;
  imageUrl?: string;
  availableStock: number;
  selectedTier?: 'retail' | 'wholesale' | 'contractor';
  requiresBuyerName?: boolean;
}

export interface SaleSubmissionPayload {
  items: PosCartItem[];
  customerId: string | null;
  customerName: string;
  customerTaxNumber?: string;
  customerPhone?: string;
  branchId: string;
  warehouseId: string;
  cashierId: string;
  cashierName: string;
  paymentMethodCode: string; // 'CASH' | 'MADA' | 'CARD' | 'CREDIT' | 'TRANSFER'
  paymentMethodName: string;
  paymentReference?: string;
  paidAmount: number;
  overallDiscount: number;
  notes?: string;
  // خيارات المرونة في فحص المخزون
  allowNegativeStock?: boolean;
  bypassStockCheck?: boolean;
  // تكامل جهاز الدفع والشبكة (Payment Terminal Integration)
  terminalTransactionId?: string;
  terminalAuthCode?: string;
  terminalRrn?: string;
  terminalId?: string;
  cardScheme?: string;
  cardLast4?: string;
  idempotencyKey?: string;
}

export interface CompletedSaleResult {
  sale: Sale;
  saleItems: SaleItem[];
  invoice: Invoice;
  payment: Payment;
  zatcaQr: string;
  changeAmount: number;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  electronicInvoice?: ElectronicInvoice;
}

/**
 * جلب البيانات الأساسية لبدء شاشة نقاط البيع
 */
export async function fetchPosData(): Promise<{
  products: Product[];
  categories: Category[];
  customers: Customer[];
  warehouses: Warehouse[];
  paymentMethods: PaymentMethod[];
  inventories: Record<string, Inventory>;
}> {
  try {
    const [prodSnap, catSnap, custSnap, rawWarehouses, pmSnap, invSnap] = await Promise.all([
      getDocs(query(collection(db, 'products'), where('isDeleted', '!=', true))),
      getDocs(collection(db, 'categories')),
      getDocs(collection(db, 'customers')),
      getWarehouses(),
      getDocs(collection(db, 'payment_methods')),
      getDocs(collection(db, 'inventory')),
    ]);

    const products = prodSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
    const categories = catSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
    const customers = custSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer));
    const warehouses = sortWarehouses(rawWarehouses);
    const paymentMethods = pmSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentMethod));

    const inventories: Record<string, Inventory> = {};
    invSnap.docs.forEach((d) => {
      const data = d.data() as Inventory;
      inventories[d.id] = { id: d.id, ...data };
    });

    return {
      products,
      categories,
      customers,
      warehouses,
      paymentMethods,
      inventories,
    };
  } catch (error) {
    console.error('خطأ في جلب بيانات POS الأساسية:', error);
    throw error;
  }
}

/**
 * تنفيذ عملية البيع بالكامل في معاملة واحدة ذرية (Firestore Atomic ACID Transaction)
 * مع إعادة التحقق الصارم من الأسعار والكميات والمخزون وسقف الائتمان قبل الحفظ
 */
export async function executePosSaleTransaction(
  payload: SaleSubmissionPayload
): Promise<CompletedSaleResult> {
  if (!payload.items || payload.items.length === 0) {
    throw new Error('سلة المبيعات فارغة، يرجى إضافة منتج واحد على الأقل.');
  }

  const now = new Date().toISOString();
  const companyName = 'مؤسسة عماد سعد آل سعيد لمواد البناء';
  const companyTaxNumber = '310948572100003';

  // معرّفات المعاملة الموحدة
  const timestampSuffix = Date.now().toString().slice(-6);
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const saleId = `sale_${Date.now()}_${randomSuffix}`;
  const saleNumber = `POS-${new Date().getFullYear()}-${timestampSuffix}`;
  const invoiceId = `inv_${saleId}`;
  const invoiceNumber = `INV-${new Date().getFullYear()}-${timestampSuffix}`;
  const paymentId = `pay_${saleId}`;
  const receiptNumber = `REC-${new Date().getFullYear()}-${timestampSuffix}`;
  const zatcaUuid = generateUuidV4();

  const result = await runTransaction(db, async (tx) => {
    // -------------------------------------------------------------
    // المرحلة 1: القراءة والتحقق الصارم في قاعدة البيانات (Reads First)
    // -------------------------------------------------------------
    const verifiedItems: {
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      costPrice: number;
      taxRate: number;
      discount: number;
      lineTotalExcludingTax: number;
      taxAmount: number;
      lineTotal: number;
      previousStock: number;
      newStock: number;
      invRef: any;
      existingInv: Inventory;
    }[] = [];

    // قراءة والتحقق من كل منتج ومخزونه
    for (const item of payload.items) {
      if (item.quantity <= 0) {
        throw new Error(`الكمية للصنف "${item.productName}" غير صالحة.`);
      }

      const prodRef = doc(db, 'products', item.productId);
      const prodSnap = await tx.get(prodRef);

      let prodData: Product;
      if (!prodSnap.exists()) {
        // في حال كان الصنف مخصصاً أو تم إنشاؤه عبر عرض سعر ولم يُسجل بعد
        prodData = {
          id: item.productId,
          nameAr: item.productName || 'صنف غير معرف',
          sku: item.sku || `SKU-${Date.now().toString().slice(-6)}`,
          retailPrice: item.unitPrice || 0,
          wholesalePrice: item.unitPrice || 0,
          contractorPrice: item.unitPrice || 0,
          costPrice: 0,
          taxRate: item.taxRate !== undefined ? item.taxRate : 15,
          unitId: item.unitSymbol || 'حبة',
          baseUnitId: item.unitSymbol || 'حبة',
          categoryId: 'cat_general',
          isActive: true,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        } as unknown as Product;
        tx.set(prodRef, prodData);
      } else {
        prodData = prodSnap.data() as Product;
        if (prodData.isDeleted) {
          throw new Error(`المنتج "${prodData.nameAr}" محذوف من النظام.`);
        }
      }

      // فحص المخزون الفعلي في المستودع المحدد
      const invId = `inv_${item.productId}_${payload.warehouseId}`;
      const invRef = doc(db, 'inventory', invId);
      const invSnap = await tx.get(invRef);

      let currentOnHand = 0;
      let reservedQty = 0;
      let existingInvData: Inventory;

      if (invSnap.exists()) {
        existingInvData = invSnap.data() as Inventory;
        currentOnHand = existingInvData.quantityOnHand || 0;
        reservedQty = existingInvData.reservedQuantity || 0;
      } else {
        existingInvData = {
          id: invId,
          productId: item.productId,
          warehouseId: payload.warehouseId,
          quantityOnHand: 0,
          reservedQuantity: 0,
          availableQuantity: 0,
          averageCost: prodData.costPrice || 0,
          lastUpdated: now,
        };
      }

      const availableQty = Math.max(0, currentOnHand - reservedQty);
      const allowNegative = Boolean(payload.allowNegativeStock || payload.bypassStockCheck);

      if (!allowNegative && availableQty < item.quantity) {
        throw new Error(
          `رصيد المخزون غير كافٍ للصنف "${prodData.nameAr || item.productName}". المتوفر في المستودع: ${availableQty}، والكمية المطلوبة: ${item.quantity}.`
        );
      }

      // اعتماد السعر الصحيح من قاعدة البيانات
      let unitPrice = prodData.retailPrice;
      if (item.selectedTier === 'contractor' && prodData.contractorPrice > 0) {
        unitPrice = prodData.contractorPrice;
      } else if (item.selectedTier === 'wholesale' && prodData.wholesalePrice > 0) {
        unitPrice = prodData.wholesalePrice;
      } else if (item.unitPrice > 0) {
        unitPrice = item.unitPrice;
      }

      const itemDiscount = Math.max(0, item.discount || 0);
      const lineTotalExcludingTax = Math.max(0, unitPrice * item.quantity - itemDiscount);
      const taxRate = prodData.taxRate !== undefined ? prodData.taxRate : 15;
      const taxAmount = Math.round(lineTotalExcludingTax * (taxRate / 100) * 100) / 100;
      const lineTotal = lineTotalExcludingTax + taxAmount;

      const newStock = allowNegative ? currentOnHand - item.quantity : Math.max(0, currentOnHand - item.quantity);

      verifiedItems.push({
        productId: item.productId,
        productName: prodData.nameAr || item.productName,
        quantity: item.quantity,
        unitPrice,
        costPrice: prodData.costPrice || 0,
        taxRate,
        discount: itemDiscount,
        lineTotalExcludingTax,
        taxAmount,
        lineTotal,
        previousStock: currentOnHand,
        newStock,
        invRef,
        existingInv: existingInvData,
      });
    }

    // التحقق من حساب العميل وسقف الائتمان (إذا كان الدفع آجل)
    let customerDoc: Customer | null = null;
    let customerRef: any = null;

    if (payload.customerId) {
      customerRef = doc(db, 'customers', payload.customerId);
      const custSnap = await tx.get(customerRef);
      if (custSnap.exists()) {
        customerDoc = custSnap.data() as Customer;
      }
    }

    // إذا تم اختيار بيع آجل ولم يكن هناك مستند عميل محدد أو مسجل مسبقاً، يتم إنشاء / ربط حساب الذمة تلقائياً لضمان عدم إيقاف المعاملة
    if (payload.paymentMethodCode === 'CREDIT' && !customerDoc) {
      const generatedCustId = payload.customerId && payload.customerId !== 'cust_walk_in'
        ? payload.customerId
        : `cust_credit_${Date.now()}`;
      customerRef = doc(db, 'customers', generatedCustId);
      const validName = (payload.customerName && payload.customerName !== 'عميل نقدي مباشر' && payload.customerName !== 'عميل نقدي')
        ? payload.customerName
        : 'حساب آجل (ذمم ومقاولين)';

      customerDoc = {
        id: generatedCustId,
        name: validName,
        phone: payload.customerPhone || '0500000000',
        customerType: 'contractor',
        priceTier: 'contractor',
        creditLimit: 100000,
        currentBalance: 0,
        createdAt: now,
        updatedAt: now,
      };
      tx.set(customerRef, cleanFirestoreData(customerDoc));
    }

    // -------------------------------------------------------------
    // المرحلة 2: إعادة احتساب المبالغ والضريبة بدقة (Financial Backend Verification)
    // -------------------------------------------------------------
    const subtotalRaw = verifiedItems.reduce((acc, it) => acc + (it.unitPrice * it.quantity), 0);
    const itemDiscounts = verifiedItems.reduce((acc, it) => acc + it.discount, 0);
    const overallDiscount = Math.max(0, payload.overallDiscount || 0);
    const totalDiscount = itemDiscounts + overallDiscount;

    const subtotalAfterDiscount = Math.max(0, subtotalRaw - totalDiscount);
    const taxTotal = Math.round(subtotalAfterDiscount * 0.15 * 100) / 100;
    const grandTotal = Math.round((subtotalAfterDiscount + taxTotal) * 100) / 100;

    // التحقق من السقف الائتماني في البيع الآجل
    if (payload.paymentMethodCode === 'CREDIT' && customerDoc) {
      if (customerDoc.creditLimit > 0) {
        const potentialBalance = (customerDoc.currentBalance || 0) + grandTotal;
        if (potentialBalance > customerDoc.creditLimit) {
          throw new Error(
            `لا يمكن إتمام البيع الآجل: رصيد العميل الحالي (${customerDoc.currentBalance} ر.س) مع الفاتورة الحالية (${grandTotal} ر.س) يتجاوز السقف الائتماني المحدد (${customerDoc.creditLimit} ر.س).`
          );
        }
      }
    }

    // التحقق الصارم من تطابق مبالغ الدفع مع إجمالي الفاتورة لمنع الأخطاء المالية
    if (payload.paymentMethodCode === 'MADA') {
      if (Math.abs(payload.paidAmount - grandTotal) > 0.01) {
        throw new Error(
          `خطأ في مطابقة الدفع: المبلغ المعتمد من جهاز نقاط البيع (${payload.paidAmount.toFixed(2)} ر.س) لا يطابق إجمالي الفاتورة المطلوب سداده (${grandTotal.toFixed(2)} ر.س).`
        );
      }
    }

    const paidAmount = payload.paymentMethodCode === 'CREDIT' ? 0 : payload.paidAmount;
    const changeAmount = payload.paymentMethodCode === 'CASH' && paidAmount > grandTotal
      ? Math.round((paidAmount - grandTotal) * 100) / 100
      : 0;

    // توليد ZATCA QR Code المشفر
    const zatcaQr = generateZatcaTlvBase64(
      companyName,
      companyTaxNumber,
      now,
      grandTotal,
      taxTotal
    );

    // -------------------------------------------------------------
    // المرحلة 3: التنفيذ والكتابة الذرية (Atomic Writes)
    // -------------------------------------------------------------

    // تحديد اسم المشتري / العميل النهائي بدقة ليوثق في الفاتورة وسند الدفع وسجلات البيع
    let effectiveCustomerName: string;
    const isGenericCash = !payload.customerName ||
      payload.customerName.trim() === '' ||
      payload.customerName === 'عميل نقدي مباشر' ||
      payload.customerName === 'عميل نقدي مباشر / أفراد' ||
      payload.customerName === 'عميل نقدي مباشر / أفراد (قطاعي)' ||
      payload.customerName === 'عميل نقدي';

    if (!isGenericCash) {
      // إذا قام الكاشير بكتابة اسم المشتري (مثلاً: أحمد فهد أو شركة النور)
      effectiveCustomerName = payload.customerName.trim();
    } else if (customerDoc && customerDoc.id !== 'cust_walk_in') {
      effectiveCustomerName = customerDoc.name;
    } else if (payload.paymentMethodCode === 'CREDIT') {
      effectiveCustomerName = 'حساب آجل (ذمم ومقاولين)';
    } else {
      effectiveCustomerName = 'عميل نقدي';
    }

    // 1. إنشاء مستند البيع Sale
    const saleDoc: Sale = {
      id: saleId,
      saleNumber,
      customerId: customerDoc?.id || payload.customerId || null,
      customerName: effectiveCustomerName,
      customerPhone: payload.customerPhone || customerDoc?.phone,
      branchId: payload.branchId,
      warehouseId: payload.warehouseId,
      cashierId: payload.cashierId,
      saleType: payload.paymentMethodCode === 'CREDIT' ? 'contractor_credit' : 'pos_cash',
      status: 'completed',
      subtotal: subtotalAfterDiscount,
      taxTotal,
      discountTotal: totalDiscount,
      grandTotal,
      paidAmount: payload.paymentMethodCode === 'CREDIT' ? 0 : Math.min(paidAmount, grandTotal),
      createdAt: now,
    };
    tx.set(doc(db, 'sales', saleId), cleanFirestoreData(saleDoc));

    // 2. إنشاء بنود البيع Sale Items
    const createdSaleItems: SaleItem[] = [];
    for (let i = 0; i < verifiedItems.length; i++) {
      const v = verifiedItems[i];
      const sItemId = `sitem_${saleId}_${i + 1}`;
      const sItem: SaleItem = {
        id: sItemId,
        saleId,
        productId: v.productId,
        productName: v.productName,
        quantity: v.quantity,
        unitPrice: v.unitPrice,
        discount: v.discount || 0,
        taxRate: v.taxRate !== undefined ? v.taxRate : 15,
        lineTotal: v.lineTotal,
      };
      tx.set(doc(db, 'sale_items', sItemId), cleanFirestoreData(sItem));
      createdSaleItems.push(sItem);
    }

    // 3. إنشاء الفاتورة الضريبية المبسطة Invoice
    const invoiceDoc: Invoice = {
      id: invoiceId,
      invoiceNumber,
      saleId,
      invoiceType: 'simplified_tax_invoice',
      issueDate: now,
      customerId: customerDoc?.id || payload.customerId || null,
      customerName: effectiveCustomerName,
      customerPhone: payload.customerPhone || customerDoc?.phone || null,
      customerTaxNumber: payload.customerTaxNumber ? payload.customerTaxNumber.trim() : null,
      totalExcludingTax: subtotalAfterDiscount,
      taxAmount: taxTotal,
      totalIncludingTax: grandTotal,
      paidAmount: payload.paymentMethodCode === 'CREDIT' ? 0 : grandTotal,
      paymentStatus: payload.paymentMethodCode === 'CREDIT' ? 'unpaid' : 'paid',
      paymentMethodId: payload.paymentMethodCode,
      zatcaUuid,
    };
    tx.set(doc(db, 'invoices', invoiceId), cleanFirestoreData(invoiceDoc));

    // 4. تسجيل سند / عملية الدفع Payment
    const paymentDoc: Payment = {
      id: paymentId,
      receiptNumber,
      paymentType: 'receipt',
      partyType: 'customer',
      partyId: customerDoc?.id || payload.customerId || 'walk_in',
      partyName: effectiveCustomerName,
      amount: payload.paymentMethodCode === 'CREDIT' ? 0 : grandTotal,
      paymentMethodId: payload.paymentMethodCode,
      reference: payload.paymentReference || (payload.paymentMethodCode === 'CASH' ? 'CASH-COUNTER' : null),
      date: now,
      collectedBy: payload.cashierName || 'الكاشير',
      notes: payload.notes || `دفعة بيع POS فاتورة ${invoiceNumber}`,
      createdAt: now,
    };
    tx.set(doc(db, 'payments', paymentId), cleanFirestoreData(paymentDoc));

    // 4.1 تسجيل معاملة جهاز الدفع والشبكة (Payment Terminal Transaction Record)
    if (payload.paymentMethodCode === 'MADA' || payload.terminalTransactionId) {
      const pTxId = payload.terminalTransactionId || `ptx_${saleId}`;
      const pTxDoc: PaymentTransaction = {
        id: pTxId,
        paymentId,
        saleId,
        invoiceId,
        gateway: (payload.cardScheme as any) || 'pos_terminal',
        transactionReference: payload.terminalRrn || payload.paymentReference || receiptNumber,
        authCode: payload.terminalAuthCode || null,
        rrn: payload.terminalRrn || null,
        cardScheme: payload.cardScheme || null,
        cardLast4: payload.cardLast4 || null,
        amount: grandTotal,
        status: 'approved',
        idempotencyKey: payload.idempotencyKey || null,
        terminalId: payload.terminalId || 'TID-POS-DEFAULT',
        timestamp: now,
      };
      tx.set(doc(db, 'payment_transactions', pTxId), cleanFirestoreData(pTxDoc));
    }

    // 5. خصم المخزون وتسجيل حركات المخزون Inventory & Movements
    for (let i = 0; i < verifiedItems.length; i++) {
      const v = verifiedItems[i];
      // تحديث رصيد المخزون
      const updatedInv: Inventory = {
        ...v.existingInv,
        quantityOnHand: v.newStock,
        availableQuantity: Math.max(0, v.newStock - (v.existingInv.reservedQuantity || 0)),
        lastUpdated: now,
      };
      tx.set(v.invRef, cleanFirestoreData(updatedInv));

      // تسجيل حركة المخزون
      const movId = `mov_sale_${saleId}_${i + 1}`;
      const movDoc: InventoryMovement = {
        id: movId,
        productId: v.productId,
        productName: v.productName,
        warehouseId: payload.warehouseId,
        movementType: 'sale',
        referenceId: invoiceNumber,
        quantity: -v.quantity,
        unitCost: v.costPrice || 0,
        previousQty: v.previousStock || 0,
        newQty: v.newStock,
        notes: `مبيعات نقطة البيع - فاتورة رقم ${invoiceNumber}`,
        createdAt: now,
        createdBy: payload.cashierName || 'الكاشير',
      };
      tx.set(doc(db, 'inventory_movements', movId), cleanFirestoreData(movDoc));
    }

    // 6. تحديث رصيد العميل إذا كانت العملية بالآجل
    if (payload.paymentMethodCode === 'CREDIT' && customerDoc && customerRef) {
      const newCustomerBalance = (customerDoc.currentBalance || 0) + grandTotal;
      tx.set(
        customerRef,
        cleanFirestoreData({
          ...customerDoc,
          currentBalance: newCustomerBalance,
          updatedAt: now,
        }),
        { merge: true }
      );
    }

    // 7. توثيق المعاملة في سجل التدقيق الأمني Audit Log
    const auditLogId = `audit_${saleId}`;
    const auditDoc: AuditLog = {
      id: auditLogId,
      userId: payload.cashierId,
      userName: payload.cashierName,
      action: 'CREATE',
      entity: 'sales',
      entityId: saleId,
      details: `إتمام بيع POS فاتورة ${invoiceNumber} بمبلغ ${grandTotal} ر.س - طريقة الدفع: ${payload.paymentMethodName} (${payload.paymentMethodCode}) - العميل: ${payload.customerName}`,
      ipAddress: 'POS Counter 01',
      timestamp: now,
    };
    tx.set(doc(db, 'audit_logs', auditLogId), cleanFirestoreData(auditDoc));

    return {
      sale: saleDoc,
      saleItems: createdSaleItems,
      invoice: invoiceDoc,
      payment: paymentDoc,
      zatcaQr,
      changeAmount,
      subtotal: subtotalAfterDiscount,
      discountTotal: totalDiscount,
      taxTotal,
      grandTotal,
    };
  });

  // تكامل الفوترة الإلكترونية السعودية (ZATCA Integration Layer)
  // ملاحظة معمارية حاسمة: فشل ZATCA لا يؤدي إطلاقاً إلى فقدان أو إلغاء عملية البيع المسجلة
  let electronicInvoiceRecord: ElectronicInvoice | undefined = undefined;
  try {
    electronicInvoiceRecord = await processElectronicInvoiceCreation({
      invoice: result.invoice,
      sale: result.sale,
      saleItems: result.saleItems,
    });
  } catch (zatcaErr) {
    console.warn('تنبيه: تعذر إرسال الفاتورة إلكترونياً إلى ZATCA لحظياً، تم الاحتفاظ بالبيع وسيتاح إعادة المحاولة:', zatcaErr);
  }

  return {
    ...result,
    electronicInvoice: electronicInvoiceRecord,
  };
}
