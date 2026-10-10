/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  onSnapshot,
  getDocs,
  doc,
  setDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, Category, Brand, Inventory, QuotationItem } from '../types';
import { createQuotation, CreateQuotationPayload } from './quotations';
import { logAuditEvent } from './audit';

export interface StorefrontProduct extends Product {
  totalStock: number;
  isAvailable: boolean;
  categoryNameAr?: string;
  brandNameAr?: string;
  isFeatured?: boolean;
  isBestSeller?: boolean;
  isNewArrival?: boolean;
  discountPercentage?: number;
  offerPrice?: number;
}

export interface QuotationCartItem {
  product: StorefrontProduct;
  quantity: number;
  notes?: string;
}

export interface QuotationRequestInput {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  projectName?: string;
  notes?: string;
  items: QuotationCartItem[];
}

/**
 * الاشتراك الحي بتحديثات منتجات المتجر والمخزون والتصنيفات في الوقت الفعلي
 * حتى يظهر أي تعديل في السعر أو المخزون فوراً للعملاء
 */
export function subscribeToStorefrontProducts(
  onData: (data: {
    products: StorefrontProduct[];
    categories: Category[];
    brands: Brand[];
    inventoryMap: Record<string, number>;
  }) => void,
  onError?: (error: unknown) => void
): () => void {
  let latestProducts: Product[] = [];
  let latestCategories: Category[] = [];
  let latestBrands: Brand[] = [];
  let latestInventoryMap: Record<string, number> = {};

  const processAndDispatch = () => {
    const catMap = new Map(latestCategories.map((c) => [c.id, c.nameAr]));
    const brMap = new Map(latestBrands.map((b) => [b.id, b.nameAr]));

    const enrichedProducts: StorefrontProduct[] = latestProducts
      .filter((p) => p.isActive && !p.isDeleted)
      .map((p, index) => {
        const stock = latestInventoryMap[p.id] !== undefined ? latestInventoryMap[p.id] : (p.currentStock ?? 25);
        // تمييز الأصناف للعرض التسويقي الاحترافي لمواد البناء
        const isFeatured = index % 3 === 0 || p.retailPrice > 80;
        const isBestSeller = index % 2 === 0 || ['prod_kalon_ahram', 'prod_gate_padlock', 'prod_pliers_total'].includes(p.id);
        const isNewArrival = index % 4 === 1;
        const hasOffer = index % 5 === 0;
        const discountPercentage = hasOffer ? 10 : 0;
        const offerPrice = hasOffer ? Math.round(p.retailPrice * 0.9) : undefined;

        return {
          ...p,
          totalStock: stock,
          isAvailable: stock > 0,
          categoryNameAr: catMap.get(p.categoryId) || 'مواد عامة',
          brandNameAr: brMap.get(p.brandId) || 'صناعي معتمد',
          isFeatured,
          isBestSeller,
          isNewArrival,
          discountPercentage,
          offerPrice,
        };
      });

    onData({
      products: enrichedProducts,
      categories: latestCategories,
      brands: latestBrands,
      inventoryMap: latestInventoryMap,
    });
  };

  // 1. مراقبة المنتجات Products
  const unsubProducts = onSnapshot(
    collection(db, 'products'),
    (snap) => {
      latestProducts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
      processAndDispatch();
    },
    (err) => {
      console.warn('استخدام النسخة المحلية من المنتجات عند تعثر الاشتراك:', err);
      if (onError) onError(err);
    }
  );

  // 2. مراقبة المخزون Inventory لتحديث الكميات لحظياً
  const unsubInventory = onSnapshot(
    collection(db, 'inventory'),
    (snap) => {
      const map: Record<string, number> = {};
      snap.docs.forEach((d) => {
        const inv = d.data() as Inventory;
        if (inv.productId) {
          map[inv.productId] = (map[inv.productId] || 0) + (inv.availableQuantity || 0);
        }
      });
      latestInventoryMap = map;
      processAndDispatch();
    },
    (err) => {
      console.warn('تعثر اشتراك المخزون المباشر:', err);
    }
  );

  // 3. مراقبة التصنيفات Categories
  const unsubCategories = onSnapshot(
    collection(db, 'categories'),
    (snap) => {
      latestCategories = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Category))
        .filter((c) => c.isActive)
        .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      processAndDispatch();
    },
    (err) => {
      console.warn('تعثر اشتراك التصنيفات المباشر:', err);
    }
  );

  // 4. مراقبة الماركات Brands
  const unsubBrands = onSnapshot(
    collection(db, 'brands'),
    (snap) => {
      latestBrands = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Brand));
      processAndDispatch();
    },
    (err) => {
      console.warn('تعثر اشتراك الماركات:', err);
    }
  );

  // دالة الإلغاء
  return () => {
    unsubProducts();
    unsubInventory();
    unsubCategories();
    unsubBrands();
  };
}

/**
 * إرسال طلب عرض سعر من قبل العميل في المتجر العام
 * ليظهر مباشرة في لوحة الإدارة ضمن كولكشن عروض الأسعار
 */
export async function submitQuotationRequest(input: QuotationRequestInput) {
  if (!input.items || input.items.length === 0) {
    throw new Error('يرجى إضافة صنف واحد على الأقل لطلب عرض السعر.');
  }
  if (!input.customerName?.trim()) {
    throw new Error('يرجى إدخال اسمك أو اسم المؤسسة.');
  }
  if (!input.customerPhone?.trim()) {
    throw new Error('يرجى إدخال رقم الجوال للتواصل وتأكيد التسعير.');
  }

  // صلاحية العرض الافتراضية 14 يوماً من تاريخ التقديم
  const today = new Date();
  const validUntil = new Date(today.setDate(today.getDate() + 14)).toISOString().split('T')[0];

  const payload: CreateQuotationPayload = {
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.trim(),
    customerEmail: input.customerEmail?.trim() || '',
    projectName: input.projectName?.trim() || 'طلب تسعير من المتجر الإلكتروني',
    issueDate: new Date().toISOString().split('T')[0],
    validUntil,
    notes: input.notes
      ? `طلب وارد عبر المتجر العام للعملاء. ملاحظات العميل: ${input.notes}`
      : 'طلب وارد عبر المتجر الإلكتروني للعملاء والمقاولين.',
    terms: 'الأسعار تشمل ضريبة القيمة المضافة 15%. صلاحية العرض 14 يوماً. يتم تجهيز المواد بعد اعتماد العرض.',
    createdBy: 'المتجر الإلكتروني (العميل)',
    status: 'Sent', // تظهر مباشرة في لوحة الإدارة بحالة مرسلة وجاهزة للتحويل لفاتورة
    items: input.items.map((it) => ({
      productId: it.product.id,
      productName: it.product.nameAr,
      sku: it.product.sku,
      unitSymbol: it.product.baseUnitId || 'حبة',
      description: it.notes || it.product.specifications || '',
      quantity: it.quantity,
      unitPrice: it.product.offerPrice || it.product.retailPrice,
      originalRetailPrice: it.product.retailPrice,
      discount: it.product.offerPrice ? Math.max(0, it.product.retailPrice - it.product.offerPrice) * it.quantity : 0,
      taxRate: it.product.taxRate || 15,
    })),
  };

  const created = await createQuotation(payload);

  // توثيق في سجل التدقيق
  await logAuditEvent({
    userName: `العميل (${input.customerName})`,
    action: 'CREATE',
    entity: 'quotations',
    entityId: created.id,
    details: `طلب عرض سعر إلكتروني جديد رقم ${created.quotationNumber} بإجمالي ${created.grandTotal} ر.س (${input.items.length} أصناف)`,
  });

  return created;
}
