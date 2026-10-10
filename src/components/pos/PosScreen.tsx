/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Product,
  Category,
  Customer,
  Warehouse,
  PaymentMethod,
  Inventory,
} from '../../types';
import {
  PosCartItem,
  SaleSubmissionPayload,
  CompletedSaleResult,
  fetchPosData,
  executePosSaleTransaction,
} from '../../services/pos';
import { sortWarehouses, getWarehouses } from '../../services/db';
import { WarehousesManagerModal } from '../inventory/WarehousesManagerModal';
import { posAudio } from '../../utils/audio';
import { PaymentModal } from './PaymentModal';
import { InvoiceReceiptModal } from './InvoiceReceiptModal';
import { SaudiRiyalSymbol, SaudiReceiptIcon as Receipt } from '../common/SaudiRiyalSymbol';
import { formatSAR, formatNumber } from '../../utils/formatters';
import {
  Search,
  Barcode,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle,
  Tag,
  User,
  Users,
  Warehouse as WarehouseIcon,
  Percent,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowRight,
  AlertTriangle,
  CreditCard,
  Maximize2,
  Minimize2,
  Package,
  Clock,
  Check,
  ChevronDown,
  FileSpreadsheet,
  Settings2,
} from 'lucide-react';

interface PosScreenProps {
  initialProducts?: Product[];
  initialWarehouses?: Warehouse[];
  onBackToDashboard?: () => void;
  onRefreshData?: () => void;
  onOpenPaymentSettings?: () => void;
  onOpenReturns?: () => void;
  onOpenQuotations?: () => void;
  onOpenInvoicesLookup?: () => void;
}

export const PosScreen: React.FC<PosScreenProps> = ({
  initialProducts = [],
  initialWarehouses = [],
  onBackToDashboard,
  onRefreshData,
  onOpenPaymentSettings,
  onOpenReturns,
  onOpenQuotations,
  onOpenInvoicesLookup,
}) => {
  // الحالة الأساسية للبيانات
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(() => sortWarehouses(initialWarehouses));
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [inventories, setInventories] = useState<Record<string, Inventory>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // حالة الاختيارات النشطة في نقطة البيع
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(() => {
    const sorted = sortWarehouses(initialWarehouses);
    const primary = sorted.find((w) => w.isPrimary) || sorted[0];
    return primary ? primary.id : 'wh_main';
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('cust_walk_in');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [buyerName, setBuyerName] = useState<string>('');
  const [buyerPhone, setBuyerPhone] = useState<string>('');
  const [buyerTaxNumber, setBuyerTaxNumber] = useState<string>('');
  const [overallDiscount, setOverallDiscount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [discountPercentValue, setDiscountPercentValue] = useState<number>(0);
  const [heldCarts, setHeldCarts] = useState<{ id: string; time: string; customerName: string; items: PosCartItem[] }[]>([]);
  const [mobilePosTab, setMobilePosTab] = useState<'catalog' | 'cart'>('catalog');

  // التحقق مما إذا كانت السلة تحتوي على صنف كالون سلندر أو صنف يتطلب اسم المشتري
  const cartRequiresBuyerName = useMemo(() => {
    return cart.some(
      (item) =>
        item.requiresBuyerName ||
        item.productName?.includes('سلندر') ||
        item.productName?.includes('كالون') ||
        item.productName?.includes('قفل')
    );
  }, [cart]);

  // حالات النوافذ المنبثقة
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [isWarehousesModalOpen, setIsWarehousesModalOpen] = useState<boolean>(false);
  const [completedSale, setCompletedSale] = useState<CompletedSaleResult | null>(null);
  const [isProcessingSale, setIsProcessingSale] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // مراجع عناصر الإدخال
  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeScanBuffer = useRef<string>('');
  const lastKeyTime = useRef<number>(0);

  // إظهار إشعار سريع
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // مزامنة المستودعات عند تغير الخاصية الأولية
  useEffect(() => {
    if (initialWarehouses && initialWarehouses.length > 0) {
      const sorted = sortWarehouses(initialWarehouses);
      setWarehouses(sorted);
      setSelectedWarehouseId((prev) => {
        if (prev && sorted.some((w) => w.id === prev)) return prev;
        const primary = sorted.find((w) => w.isPrimary) || sorted[0];
        return primary ? primary.id : sorted[0].id;
      });
    }
  }, [initialWarehouses]);

  // تحميل البيانات الأولية
  const loadPosInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchPosData();
      if (data.products.length > 0) setProducts(data.products);
      setCategories(data.categories);
      setCustomers(data.customers);
      if (data.warehouses.length > 0) {
        const sorted = sortWarehouses(data.warehouses);
        setWarehouses(sorted);
        setSelectedWarehouseId((prev) => {
          if (prev && sorted.some((w) => w.id === prev)) return prev;
          const primary = sorted.find((w) => w.isPrimary) || sorted[0];
          return primary ? primary.id : sorted[0].id;
        });
      }
      setPaymentMethods(data.paymentMethods);
      setInventories(data.inventories);
    } catch (err) {
      console.error('خطأ في تحميل بيانات نقطة البيع:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosInitialData();
  }, [loadPosInitialData]);

  // الاستماع لحدث تغيير وترتيب المستودعات لتحديث القائمة فوراً
  useEffect(() => {
    const handleWarehousesChanged = (e: any) => {
      const updated = e.detail;
      if (Array.isArray(updated) && updated.length > 0) {
        const sorted = sortWarehouses(updated);
        setWarehouses(sorted);
        setSelectedWarehouseId((prev) => {
          if (prev && sorted.some((w) => w.id === prev)) return prev;
          const primary = sorted.find((w) => w.isPrimary) || sorted[0];
          return primary ? primary.id : sorted[0].id;
        });
      } else {
        getWarehouses().then((fresh) => {
          const sorted = sortWarehouses(fresh);
          setWarehouses(sorted);
        });
      }
    };

    window.addEventListener('warehouses-changed', handleWarehousesChanged);
    return () => window.removeEventListener('warehouses-changed', handleWarehousesChanged);
  }, []);

  // التركيز التلقائي على شريط البحث عند بدء الشاشة
  useEffect(() => {
    searchInputRef.current?.focus();
  }, [isLoading]);

  // تحديد العميل الحالي
  const currentCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // جلب رصيد المستودع الحالي لصنف معين
  const getProductStockInWarehouse = useCallback((productId: string, whId: string): number => {
    const invKey = `inv_${productId}_${whId}`;
    if (inventories[invKey]) {
      return inventories[invKey].availableQuantity || 0;
    }
    // احتياطي: إذا لم يوجد سجل، فحص currentStock
    const prod = products.find((p) => p.id === productId);
    return prod?.currentStock || 0;
  }, [inventories, products]);

  // إضافة منتج إلى سلة المبيعات
  const addToCart = useCallback((product: Product, customQty = 1) => {
    const availableStock = getProductStockInWarehouse(product.id, selectedWarehouseId);

    if (availableStock <= 0) {
      posAudio.beepWarning();
      showToast(`الصنف "${product.nameAr}" نافذ من المستودع المحدد.`);
      return;
    }

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.productId === product.id);

      if (existingIndex > -1) {
        const existingItem = prevCart[existingIndex];
        const newQty = existingItem.quantity + customQty;

        if (newQty > availableStock) {
          posAudio.beepWarning();
          showToast(`الكمية القصوى المتوفرة في المخزن هي ${availableStock}.`);
          return prevCart;
        }

        posAudio.beepAdd();
        const updated = [...prevCart];
        updated[existingIndex] = {
          ...existingItem,
          quantity: newQty,
          lineTotal: (existingItem.unitPrice * newQty) - existingItem.discount,
        };
        return updated;
      } else {
        // تحديد السعر حسب فئة العميل المختار (سعر المقاولين أو التجزئة)
        let unitPrice = product.retailPrice;
        let selectedTier: 'retail' | 'wholesale' | 'contractor' = 'retail';

        if (currentCustomer?.priceTier === 'contractor' && product.contractorPrice > 0) {
          unitPrice = product.contractorPrice;
          selectedTier = 'contractor';
        } else if (currentCustomer?.priceTier === 'wholesale' && product.wholesalePrice > 0) {
          unitPrice = product.wholesalePrice;
          selectedTier = 'wholesale';
        }

        posAudio.beepAdd();
        const newItem: PosCartItem = {
          productId: product.id,
          productName: product.nameAr,
          sku: product.sku,
          barcode: product.barcode,
          quantity: customQty,
          unitPrice,
          retailPrice: product.retailPrice,
          wholesalePrice: product.wholesalePrice,
          contractorPrice: product.contractorPrice,
          taxRate: product.taxRate || 15,
          discount: 0,
          unitSymbol: 'قطعة',
          imageUrl: product.imageUrl,
          availableStock,
          selectedTier,
          requiresBuyerName:
            product.requiresBuyerName ||
            product.nameAr?.includes('سلندر') ||
            product.nameAr?.includes('كالون') ||
            product.nameAr?.includes('قفل'),
        };

        return [newItem, ...prevCart];
      }
    });
  }, [currentCustomer, getProductStockInWarehouse, selectedWarehouseId, showToast]);

  // معالجة البحث والباركود السريع
  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanQuery = searchQuery.trim().toLowerCase();
    if (!cleanQuery) return;

    // 1. مطابقة دقيقة بالباركود
    const exactBarcodeMatch = products.find(
      (p) => p.barcode && p.barcode.trim().toLowerCase() === cleanQuery
    );
    if (exactBarcodeMatch) {
      posAudio.beepScan();
      addToCart(exactBarcodeMatch);
      setSearchQuery('');
      return;
    }

    // 2. مطابقة دقيقة بالـ SKU
    const exactSkuMatch = products.find(
      (p) => p.sku && p.sku.trim().toLowerCase() === cleanQuery
    );
    if (exactSkuMatch) {
      posAudio.beepScan();
      addToCart(exactSkuMatch);
      setSearchQuery('');
      return;
    }

    // 3. إذا كانت نتيجة البحث تظهر منتجاً واحداً فقط في الفلترة
    if (filteredProducts.length === 1) {
      posAudio.beepAdd();
      addToCart(filteredProducts[0]);
      setSearchQuery('');
    }
  };

  // تعديل كمية الصنف في السلة
  const updateItemQuantity = (productId: string, delta: number) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null; // سيتم حذفه
            if (newQty > item.availableStock) {
              posAudio.beepWarning();
              showToast(`الكمية القصوى المتوفرة في المخزن هي ${item.availableStock}.`);
              return item;
            }
            return {
              ...item,
              quantity: newQty,
              lineTotal: item.unitPrice * newQty - item.discount,
            };
          }
          return item;
        })
        .filter(Boolean) as PosCartItem[];
    });
  };

  // تعيين الكمية مباشرة
  const setItemDirectQuantity = (productId: string, qty: number) => {
    if (qty <= 0) {
      removeItemFromCart(productId);
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.productId === productId) {
          const validatedQty = Math.min(qty, item.availableStock);
          return {
            ...item,
            quantity: validatedQty,
            lineTotal: item.unitPrice * validatedQty - item.discount,
          };
        }
        return item;
      })
    );
  };

  // تعديل سعر الوحدة لبند معين (مثلاً خصم خاص للمقاول)
  const updateItemPrice = (productId: string, newPrice: number) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.productId === productId) {
          const safePrice = Math.max(0, newPrice);
          return {
            ...item,
            unitPrice: safePrice,
            lineTotal: safePrice * item.quantity - item.discount,
          };
        }
        return item;
      })
    );
  };

  // تطبيق خصم على بند منفصل
  const updateItemDiscount = (productId: string, discountVal: number) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.productId === productId) {
          const safeDiscount = Math.max(0, discountVal);
          return {
            ...item,
            discount: safeDiscount,
            lineTotal: item.unitPrice * item.quantity - safeDiscount,
          };
        }
        return item;
      })
    );
  };

  // حذف بند من السلة
  const removeItemFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.productId !== productId));
  };

  // مسح السلة بالكامل
  const clearCart = () => {
    if (cart.length > 0) {
      setCart([]);
      setBuyerName('');
      setBuyerPhone('');
      setBuyerTaxNumber('');
      setOverallDiscount(0);
      setDiscountPercentValue(0);
      searchInputRef.current?.focus();
    }
  };

  // تعليق الفاتورة الحالية لاستئنافها لاحقاً
  const holdCurrentCart = () => {
    if (cart.length === 0) return;
    const newHold = {
      id: `hold_${Date.now()}`,
      time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      customerName: buyerName.trim() || currentCustomer?.name || 'عميل نقدي',
      items: [...cart],
    };
    setHeldCarts((prev) => [newHold, ...prev]);
    clearCart();
    showToast('تم تعليق الفاتورة بنجاح. يمكنك استعادتها بأي وقت.');
  };

  // استعادة فاتورة معلقة
  const restoreHeldCart = (holdId: string) => {
    const target = heldCarts.find((h) => h.id === holdId);
    if (target) {
      setCart(target.items);
      setHeldCarts((prev) => prev.filter((h) => h.id !== holdId));
      showToast('تم استعادة الفاتورة المعلقة بنجاح.');
    }
  };

  // الحسابات المالية اللحظية (Frontend Preview)
  const financialTotals = useMemo(() => {
    const rawSubtotal = cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
    const itemDiscountsTotal = cart.reduce((acc, item) => acc + item.discount, 0);

    let finalOverallDiscount = overallDiscount;
    if (discountType === 'percent' && discountPercentValue > 0) {
      finalOverallDiscount = Math.round(((rawSubtotal - itemDiscountsTotal) * (discountPercentValue / 100)) * 100) / 100;
    }

    const totalDiscounts = itemDiscountsTotal + finalOverallDiscount;
    const subtotalAfterDiscount = Math.max(0, rawSubtotal - totalDiscounts);
    const taxTotal = Math.round(subtotalAfterDiscount * 0.15 * 100) / 100;
    const grandTotal = Math.round((subtotalAfterDiscount + taxTotal) * 100) / 100;

    return {
      rawSubtotal,
      totalDiscounts,
      subtotalAfterDiscount,
      taxTotal,
      grandTotal,
    };
  }, [cart, overallDiscount, discountType, discountPercentValue]);

  // فلترة المنتجات في القائمة
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (product.isDeleted || product.isActive === false) return false;

      // فلترة التصنيف
      if (selectedCategoryId !== 'all' && product.categoryId !== selectedCategoryId) {
        return false;
      }

      // فلترة البحث بالنص
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = product.nameAr.toLowerCase().includes(query);
        const matchesSku = product.sku.toLowerCase().includes(query);
        const matchesBarcode = product.barcode.toLowerCase().includes(query);
        const matchesEn = product.nameEn?.toLowerCase().includes(query);
        return matchesName || matchesSku || matchesBarcode || matchesEn;
      }

      return true;
    });
  }, [products, selectedCategoryId, searchQuery]);

  // فتح نافذة الدفع
  const handleOpenCheckout = () => {
    if (cart.length === 0) {
      showToast('يرجى إضافة منتجات إلى سلة المبيعات أولاً.');
      return;
    }
    setIsPaymentModalOpen(true);
  };

  // اعتماد عملية البيع عبر المعاملة الذرية
  const handleConfirmSale = async (paymentData: {
    paymentMethodCode: string;
    paymentMethodName: string;
    paymentReference?: string;
    paidAmount: number;
    notes?: string;
    customerId?: string;
    customerName?: string;
    customerTaxNumber?: string;
    customerPhone?: string;
    terminalTransactionId?: string;
    terminalAuthCode?: string;
    terminalRrn?: string;
    terminalId?: string;
    cardScheme?: string;
    cardLast4?: string;
    idempotencyKey?: string;
  }) => {
    setIsProcessingSale(true);
    try {
      const effectiveCustomerId = paymentData.customerId || (selectedCustomerId === 'cust_walk_in' ? null : selectedCustomerId);
      const effectiveName =
        paymentData.customerName?.trim() ||
        buyerName.trim() ||
        (currentCustomer && currentCustomer.id !== 'cust_walk_in' ? currentCustomer.name : '') ||
        'عميل نقدي';

      const payload: SaleSubmissionPayload = {
        items: cart,
        customerId: effectiveCustomerId,
        customerName: effectiveName,
        customerTaxNumber: paymentData.customerTaxNumber || buyerTaxNumber.trim() || currentCustomer?.taxNumber,
        customerPhone: paymentData.customerPhone || buyerPhone.trim() || currentCustomer?.phone,
        branchId: 'branch_main',
        warehouseId: selectedWarehouseId,
        cashierId: 'user_cashier',
        cashierName: 'كاشير المحل',
        paymentMethodCode: paymentData.paymentMethodCode,
        paymentMethodName: paymentData.paymentMethodName,
        paymentReference: paymentData.paymentReference,
        paidAmount: paymentData.paidAmount,
        overallDiscount: financialTotals.totalDiscounts,
        notes: paymentData.notes,
        terminalTransactionId: paymentData.terminalTransactionId,
        terminalAuthCode: paymentData.terminalAuthCode,
        terminalRrn: paymentData.terminalRrn,
        terminalId: paymentData.terminalId,
        cardScheme: paymentData.cardScheme,
        cardLast4: paymentData.cardLast4,
        idempotencyKey: paymentData.idempotencyKey,
      };

      const result = await executePosSaleTransaction(payload);
      posAudio.chimeSuccess();

      setCompletedSale(result);
      setIsPaymentModalOpen(false);
      setIsReceiptModalOpen(true);

      // إعادة تعيين السلة وبيانات المشتري
      setCart([]);
      setBuyerName('');
      setBuyerPhone('');
      setBuyerTaxNumber('');
      setOverallDiscount(0);
      setDiscountPercentValue(0);

      // تحديث المخزون محلياً في واجهة POS فورا
      setInventories((prev) => {
        const updated = { ...prev };
        cart.forEach((cItem) => {
          const k = `inv_${cItem.productId}_${selectedWarehouseId}`;
          if (updated[k]) {
            updated[k] = {
              ...updated[k],
              quantityOnHand: Math.max(0, updated[k].quantityOnHand - cItem.quantity),
              availableQuantity: Math.max(0, updated[k].availableQuantity - cItem.quantity),
            };
          }
        });
        return updated;
      });

      // إخطار الأب بتحديث الإحصائيات العامة
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      posAudio.beepWarning();
      console.error('فشل إتمام عملية البيع:', err);
      throw err;
    } finally {
      setIsProcessingSale(false);
    }
  };

  // بدء فاتورة جديدة
  const handleStartNewSale = () => {
    clearCart();
    setIsReceiptModalOpen(false);
    setCompletedSale(null);
    searchInputRef.current?.focus();
  };

  // دعم اختصارات لوحة المفاتيح
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F1: التركيز على حقل البحث
      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      // F2: فاتورة جديدة
      else if (e.key === 'F2') {
        e.preventDefault();
        handleStartNewSale();
      }
      // F9: فتح نافذة الدفع
      else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0 && !isPaymentModalOpen && !isReceiptModalOpen) {
          handleOpenCheckout();
        }
      }
      // Escape: إغلاق النوافذ المنبثقة
      else if (e.key === 'Escape') {
        if (isPaymentModalOpen) setIsPaymentModalOpen(false);
        if (isReceiptModalOpen) setIsReceiptModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart.length, isPaymentModalOpen, isReceiptModalOpen]);

  return (
    <div
      className={`bg-slate-100 flex flex-col font-sans select-none ${
        isFullscreen ? 'fixed inset-0 z-50 overflow-hidden' : 'rounded-2xl border border-slate-200 overflow-hidden shadow-xl min-h-[85vh]'
      }`}
    >
      {/* ------------------------------------------------------------- */}
      {/* 1. الشريط العلوي السريع (POS Topbar) */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-800 gap-4">
        {/* معلومات الكاشير والفرع */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wide">كاشير نقطة البيع POS</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-mono">
                مباشر متصل
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              الفرع الرئيسي • طريق الخرج الصناعي
            </div>
          </div>
        </div>

        {/* اختيار المستودع المصروف منه */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 sm:px-3 py-1 rounded-xl border border-slate-700">
          <WarehouseIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="hidden sm:inline text-[11px] text-slate-300 font-semibold">المستودع:</span>
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="bg-transparent text-xs font-bold text-amber-300 focus:outline-hidden cursor-pointer max-w-[130px] sm:max-w-none truncate"
          >
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id} className="bg-slate-800 text-white">
                {wh.nameAr} ({wh.code}) {wh.isPrimary ? '★' : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setIsWarehousesModalOpen(true)}
            className="p-1 hover:bg-slate-700 text-slate-400 hover:text-amber-300 rounded-lg transition-colors cursor-pointer"
            title="إدارة وتخصيص ترتيب المستودعات"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* شريط الإشعارات أو الفواتير المعلقة + ملء الشاشة */}
        <div className="flex items-center gap-2">
          {heldCarts.length > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/40 px-2.5 py-1 rounded-xl text-amber-300 text-xs">
              <Clock className="w-3.5 h-3.5" />
              <span>معلقة ({heldCarts.length}):</span>
              <button
                type="button"
                onClick={() => restoreHeldCart(heldCarts[0].id)}
                className="underline font-bold hover:text-amber-200 cursor-pointer"
              >
                استعادة آخر فاتورة
              </button>
            </div>
          )}

          {/* اختصارات لوحة المفاتيح للتذكير */}
          <div className="hidden lg:flex items-center gap-2 text-[10px] text-slate-400 font-mono">
            <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-300">F1: بحث</span>
            <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-300">F2: جديدة</span>
            <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-300">F9: دفع</span>
          </div>

          {onOpenInvoicesLookup && (
            <button
              type="button"
              onClick={onOpenInvoicesLookup}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-medium cursor-pointer transition-colors"
              title="استعلام وإعادة طباعة الفواتير المفقودة"
            >
              <Search className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">إعادة طباعة الفواتير</span>
            </button>
          )}

          {onOpenQuotations && (
            <button
              type="button"
              onClick={onOpenQuotations}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium cursor-pointer transition-colors"
              title="عروض الأسعار"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">عروض الأسعار</span>
            </button>
          )}

          {onOpenReturns && (
            <button
              type="button"
              onClick={onOpenReturns}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-medium cursor-pointer transition-colors"
              title="تسجيل مرتجع مبيعات"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">المرتجعات</span>
            </button>
          )}

          {onOpenPaymentSettings && (
            <button
              type="button"
              onClick={onOpenPaymentSettings}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 text-xs font-medium cursor-pointer transition-colors"
              title="إعدادات جهاز الدفع ونقاط البيع"
            >
              <CreditCard className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">جهاز الدفع POS</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title="تبديل ملء الشاشة"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* تنبيه سريع عائم Toast */}
      {toastMessage && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xl border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. منطقة العمل الرئيسية المقسمة (Layout 60/40) */}
      {/* ------------------------------------------------------------- */}
      {/* مبدل وضع العرض لشاشات الجوال والأجهزة اللوحية الصغيرة */}
      <div className="lg:hidden flex border-b border-slate-200 bg-slate-100 p-1.5 gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setMobilePosTab('catalog')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            mobilePosTab === 'catalog'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-black'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Package className="w-4 h-4 text-amber-500" />
          <span>الكتالوج والبحث</span>
        </button>

        <button
          type="button"
          onClick={() => setMobilePosTab('cart')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            mobilePosTab === 'cart'
              ? 'bg-slate-900 text-white shadow-xs font-black'
              : 'text-slate-800 bg-amber-50/80 border border-amber-200 hover:bg-amber-100'
          }`}
        >
          <ShoppingCart className="w-4 h-4 text-amber-400" />
          <span>السلة والدفع ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
          {financialTotals.netPayable > 0 && (
            <span className="font-mono text-[10px] bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-md font-black mr-1">
              {formatNumber(financialTotals.netPayable)} ر.س
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* ------------------------------------------------------------- */}
        {/* القسم الأيمن / الأوسط: البحث السريع وكتالوج المنتجات المقترحة */}
        {/* ------------------------------------------------------------- */}
        <div className={`flex-1 flex flex-col border-b lg:border-b-0 lg:border-l border-slate-200 bg-white overflow-hidden ${mobilePosTab === 'cart' ? 'hidden lg:flex' : 'flex'}`}>
          
          {/* شريط البحث الميداني فائق السرعة مع دعم الباركود */}
          <div className="p-3 border-b border-slate-200 bg-slate-50/70">
            <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم، كود الصنف (SKU)، أو امسح الباركود مباشرة... (F1)"
                  className="w-full pl-24 pr-10 py-2.5 bg-white border border-slate-300 focus:border-slate-900 rounded-xl text-xs font-semibold placeholder:text-slate-400 shadow-2xs focus:ring-2 focus:ring-slate-900/10 focus:outline-hidden"
                />
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] text-slate-400 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  <Barcode className="w-3 h-3 text-slate-500" />
                  <span>Scanner Ready</span>
                </div>
              </div>

              <button
                type="submit"
                className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
              >
                إضافة
              </button>
            </form>

            {/* تصنيفات سريعة للفلترة الفورية */}
            <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategoryId('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  selectedCategoryId === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                جميع الأصناف ({products.length})
              </button>

              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                    selectedCategoryId === cat.id
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {cat.nameAr}
                </button>
              ))}
            </div>
          </div>

          {/* شبكة بطاقات المنتجات المقترحة والسريعة */}
          <div className="flex-1 overflow-y-auto p-3.5 bg-slate-100/50">
            {isLoading ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
                <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
                <span className="text-xs">جاري تحميل كتالوج الأصناف والمخزون...</span>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Package className="w-10 h-10 text-slate-300" />
                <p className="text-xs font-medium">لم يتم العثور على أي صنف مطابق للبحث.</p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-amber-600 underline font-bold"
                >
                  مسح البحث وعرض الكل
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {filteredProducts.map((product) => {
                  const stock = getProductStockInWarehouse(product.id, selectedWarehouseId);
                  const isOutOfStock = stock <= 0;
                  const isContractorActive = currentCustomer?.priceTier === 'contractor';
                  const displayPrice = isContractorActive && product.contractorPrice > 0
                    ? product.contractorPrice
                    : product.retailPrice;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => addToCart(product)}
                      className={`group relative text-right p-2.5 rounded-xl border bg-white flex flex-col justify-between transition-all cursor-pointer ${
                        isOutOfStock
                          ? 'opacity-60 border-slate-200 bg-slate-50 cursor-not-allowed'
                          : 'border-slate-200/80 hover:border-slate-900 hover:shadow-md'
                      }`}
                    >
                      {/* صورة أو أيقونة الصنف */}
                      <div className="relative w-full h-24 rounded-lg bg-slate-100 overflow-hidden mb-2 flex items-center justify-center">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.nameAr}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            loading="lazy"
                          />
                        ) : (
                          <Package className="w-8 h-8 text-slate-300" />
                        )}

                        {/* مؤشر رصيد المخزون */}
                        <div
                          className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            isOutOfStock
                              ? 'bg-rose-600 text-white'
                              : stock < (product.minStockLevel || 10)
                              ? 'bg-amber-500 text-white'
                              : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {isOutOfStock ? 'نفد' : `${stock} متوفر`}
                        </div>
                      </div>

                      {/* تفاصيل الصنف */}
                      <div className="flex-1">
                        <div className="text-[11px] font-bold text-slate-900 line-clamp-2 leading-snug">
                          {product.nameAr}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {product.sku}
                        </div>
                      </div>

                      {/* السعر والشراء */}
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-sm font-black font-mono text-slate-900">
                            {formatNumber(displayPrice || 0)}
                          </span>
                          <span className="text-[10px] text-slate-500 mr-1">ر.س</span>
                          {isContractorActive && (
                            <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded block mt-0.5">
                              سعر مقاولين
                            </span>
                          )}
                        </div>

                        <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center group-hover:bg-emerald-600 transition-colors">
                          <Plus className="w-4 h-4" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {/* زر عائم للانتقال السريع إلى السلة على الجوال */}
            {cart.length > 0 && (
              <div className="lg:hidden p-2.5 bg-white/95 backdrop-blur-xs border-t border-slate-200 sticky bottom-0 z-20 shadow-md">
                <button
                  type="button"
                  onClick={() => setMobilePosTab('cart')}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-between transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-amber-400" />
                    <span>عرض سلة الفاتورة والدفع ({cart.reduce((s, i) => s + i.quantity, 0)} قطعة)</span>
                  </div>
                  <div className="font-mono text-xs font-black text-amber-300">
                    {formatNumber(financialTotals.netPayable)} ر.س ←
                  </div>
                </button>
              </div>
            )}
          </div>

        </div>

        {/* ------------------------------------------------------------- */}
        {/* القسم الأيسر: سلة المبيعات، الحسابات المالية، والدفع */}
        {/* ------------------------------------------------------------- */}
        <div className={`w-full lg:w-[420px] xl:w-[460px] bg-white flex flex-col justify-between shadow-xs overflow-y-auto ${mobilePosTab === 'catalog' ? 'hidden lg:flex' : 'flex'}`}>
          {/* شريط عودة للكتالوج على الجوال */}
          <div className="lg:hidden p-2.5 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
            <button
              type="button"
              onClick={() => setMobilePosTab('catalog')}
              className="text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
            >
              <span>← العودة لإضافة أصناف أخرى من الكتالوج</span>
            </button>
            <span className="text-[11px] font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
              {cart.length} أصناف
            </span>
          </div>
          
          {/* رأس السلة + اختيار العميل */}
          <div className="p-3.5 border-b border-slate-200 bg-slate-50/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-slate-700" />
                <span className="text-xs font-bold text-slate-900">
                  سلة المبيعات الحالية ({cart.reduce((s, i) => s + i.quantity, 0)} قطعة)
                </span>
              </div>

              {cart.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={holdCurrentCart}
                    className="text-[11px] text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    تعليق
                  </button>
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-[11px] text-rose-600 hover:text-rose-700 px-2 py-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    مسح السلة
                  </button>
                </div>
              )}
            </div>

            {/* محدد العميل والمقاول */}
            <div className={`p-2.5 rounded-xl bg-white border shadow-2xs flex flex-col gap-2 transition-all ${
              cartRequiresBuyerName && !buyerName.trim()
                ? 'border-amber-300 ring-2 ring-amber-400/20 bg-amber-50/20'
                : 'border-slate-200'
            }`}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-500" />
                  <span>العميل:</span>
                </span>

                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-transparent border-none focus:outline-hidden text-left max-w-[240px] truncate cursor-pointer"
                >
                  <option value="cust_walk_in">عميل نقدي مباشر / أفراد (قطاعي)</option>
                  {customers
                    .filter((c) => c.id !== 'cust_walk_in')
                    .map((cust) => (
                      <option key={cust.id} value={cust.id}>
                        {cust.name} ({cust.customerType === 'contractor' ? 'مقاول' : 'شركة'})
                      </option>
                    ))}
                </select>
              </div>

              {/* إذا كان العميل نقدي مباشر: حقل فوري لإدخال اسم المشتري */}
              {selectedCustomerId === 'cust_walk_in' && (
                <div className="pt-2 border-t border-slate-100 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <span>اسم المشتري للفاتورة:</span>
                      {cartRequiresBuyerName && (
                        <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300 animate-pulse">
                          إلزامي للصنف
                        </span>
                      )}
                    </span>
                    {buyerName && (
                      <button
                        type="button"
                        onClick={() => setBuyerName('')}
                        className="text-[10px] text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        مسح
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      placeholder="سجل اسم المشتري (مثلاً: أحمد، أبو فهد...)"
                      className={`w-full text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                        cartRequiresBuyerName && !buyerName.trim()
                          ? 'bg-amber-50/70 border-amber-400 text-amber-950 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 placeholder:text-amber-700/60'
                          : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400'
                      } focus:outline-hidden`}
                    />
                  </div>

                  {cartRequiresBuyerName && !buyerName.trim() && (
                    <p className="text-[10px] text-amber-800 font-medium">
                      ⚠️ الصنف المباع (كالون سلندر) يتطلب تسجيل اسم المشتري.
                    </p>
                  )}
                </div>
              )}

              {/* إذا كان العميل شركة أو مقاول: إظهار الرصيد والحد الائتماني */}
              {currentCustomer && currentCustomer.id !== 'cust_walk_in' && (
                <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>
                    الرصيد القائم:{' '}
                    <strong className="text-slate-800 font-bold">
                      {formatSAR(currentCustomer.currentBalance || 0)}
                    </strong>
                  </span>
                  <span>
                    الحد:{' '}
                    <strong className="text-slate-800 font-bold">
                      {Number(currentCustomer.creditLimit || 0) > 0
                        ? formatSAR(currentCustomer.creditLimit || 0)
                        : 'مفتوح'}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* قائمة بنود السلة (جدول البنود التفاعلي السريع) */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/30 min-h-[220px] max-h-[420px] lg:max-h-none">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12 gap-2 text-center">
                <ShoppingCart className="w-10 h-10 text-slate-300" />
                <p className="text-xs font-bold text-slate-600">السلة فارغة حالياً</p>
                <p className="text-[11px] text-slate-400 max-w-[200px]">
                  امسح باركود المنتج أو انقر على أي صنف من الكتالوج لإضافته فوراً
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.productId}
                  className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-2xs hover:border-slate-300 transition-colors"
                >
                  {/* رأس البند */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="text-xs font-bold text-slate-900 leading-snug">
                        {item.productName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {item.sku} {item.selectedTier === 'contractor' && '• سعر مقاول'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItemFromCart(item.productId)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                      title="حذف من السلة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* تحكم الكمية والسعر والإجمالي */}
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    {/* أزرار الكمية السريعة */}
                    <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => updateItemQuantity(item.productId, -1)}
                        className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-200 active:bg-slate-300 transition-colors cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={item.availableStock}
                        value={item.quantity}
                        onChange={(e) => setItemDirectQuantity(item.productId, parseInt(e.target.value) || 0)}
                        className="w-10 text-center text-xs font-bold font-mono bg-white border-x border-slate-200 py-1 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => updateItemQuantity(item.productId, 1)}
                        className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-200 active:bg-slate-300 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* سعر الوحدة وإمكانية تعديله */}
                    <div className="text-left flex flex-col items-end">
                      <div className="text-[10px] text-slate-400">سعر الوحدة:</div>
                      <div className="flex items-center gap-1 font-mono text-xs text-slate-700">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) => updateItemPrice(item.productId, parseFloat(e.target.value) || 0)}
                          className="w-14 text-left font-mono font-bold bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-xs focus:bg-white focus:outline-hidden"
                        />
                        <span className="text-[10px] text-slate-400">ر.س</span>
                      </div>
                    </div>

                    {/* إجمالي البند */}
                    <div className="text-left">
                      <div className="text-[10px] text-slate-400">الإجمالي:</div>
                      <div className="text-xs font-black font-mono text-slate-900">
                        {formatSAR(item.lineTotal || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ------------------------------------------------------------- */}
          {/* لوحة الحسابات المالية الدقيقة (Subtotal, Discount, VAT, Grand Total) */}
          {/* ------------------------------------------------------------- */}
          <div className="p-4 border-t border-slate-200 bg-white space-y-3">
            
            {/* خيارات الخصم الإجمالي للفاتورة */}
            <div className="flex items-center justify-between text-xs pt-1">
              <div className="flex items-center gap-1 text-slate-600">
                <Percent className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-semibold">تطبيق خصم إضافي:</span>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setDiscountType('amount')}
                    className={`px-2 py-1 font-bold ${
                      discountType === 'amount' ? 'bg-slate-900 text-white' : 'text-slate-600'
                    }`}
                  >
                    ر.س
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('percent')}
                    className={`px-2 py-1 font-bold ${
                      discountType === 'percent' ? 'bg-slate-900 text-white' : 'text-slate-600'
                    }`}
                  >
                    %
                  </button>
                </div>

                {discountType === 'amount' ? (
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={overallDiscount || ''}
                    onChange={(e) => setOverallDiscount(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-16 p-1 text-center font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
                  />
                ) : (
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={discountPercentValue || ''}
                    onChange={(e) => setDiscountPercentValue(parseFloat(e.target.value) || 0)}
                    placeholder="0%"
                    className="w-14 p-1 text-center font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
                  />
                )}
              </div>
            </div>

            {/* تفاصيل المبالغ */}
            <div className="space-y-1.5 text-xs text-slate-600 pt-1 border-t border-slate-100">
              <div className="flex justify-between">
                <span>المجموع الفرعي (قبل الضريبة):</span>
                <span className="font-mono font-bold text-slate-800">
                  {formatSAR(financialTotals.subtotalAfterDiscount || 0)}
                </span>
              </div>

              {financialTotals.totalDiscounts > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>إجمالي الخصم الممنوح:</span>
                  <span className="font-mono font-bold">
                    -{formatSAR(financialTotals.totalDiscounts || 0)}
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span>ضريبة القيمة المضافة (15% VAT):</span>
                <span className="font-mono font-bold text-slate-800">
                  {formatSAR(financialTotals.taxTotal || 0)}
                </span>
              </div>
            </div>

            {/* الإجمالي النهائي البارز والأصيل */}
            <div className="pt-2 border-t-2 border-slate-900 flex items-center justify-between">
              <div>
                <div className="text-xs font-black text-slate-900">المجموع الكلي النهائي:</div>
                <div className="text-[10px] text-slate-400">شامل ضريبة القيمة المضافة</div>
              </div>
              <div className="text-3xl font-black font-mono tracking-tight text-emerald-600 inline-flex items-center gap-1.5">
                <span>{formatNumber(financialTotals.grandTotal || 0)}</span>
                <SaudiRiyalSymbol className="w-6 h-6 text-emerald-600 inline-block" />
              </div>
            </div>

            {/* زر إتمام البيع والدفع الرئيسي الكبير جداً */}
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={handleOpenCheckout}
              className={`w-full py-4 px-5 rounded-2xl text-base font-extrabold flex items-center justify-between shadow-lg transition-all cursor-pointer ${
                cart.length === 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white shadow-emerald-600/25'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                <span>إتمام البيع والدفع (F9)</span>
              </div>
              <div className="font-mono text-lg font-black bg-white/20 px-3 py-1 rounded-xl flex items-center gap-1.5">
                <span>{formatNumber(financialTotals.grandTotal || 0)}</span>
                <SaudiRiyalSymbol className="w-4 h-4 text-white inline-block" />
              </div>
            </button>
          </div>

        </div>

      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. النوافذ المنبثقة التفاعلية */}
      {/* ------------------------------------------------------------- */}
      
      {/* نافذة طرق الدفع */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        grandTotal={financialTotals.grandTotal}
        subtotal={financialTotals.subtotalAfterDiscount}
        taxTotal={financialTotals.taxTotal}
        discountTotal={financialTotals.totalDiscounts}
        selectedCustomer={currentCustomer}
        paymentMethods={paymentMethods}
        onConfirmSale={handleConfirmSale}
        isProcessing={isProcessingSale}
        onSelectCustomer={(c) => setSelectedCustomerId(c ? c.id : '')}
        cartItems={cart}
        defaultBuyerName={buyerName}
        defaultBuyerPhone={buyerPhone}
        defaultBuyerTaxNumber={buyerTaxNumber}
        onUpdateBuyerInfo={(info) => {
          setBuyerName(info.buyerName);
          setBuyerPhone(info.buyerPhone);
          setBuyerTaxNumber(info.buyerTaxNumber);
        }}
      />

      {/* نافذة الفاتورة وطباعة الإيصال ZATCA */}
      <InvoiceReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        saleResult={completedSale}
        onNewSale={handleStartNewSale}
      />

      {/* نافذة إدارة وتخصيص وترتيب المستودعات مباشرة من نقطة البيع */}
      <WarehousesManagerModal
        isOpen={isWarehousesModalOpen}
        onClose={() => setIsWarehousesModalOpen(false)}
        warehouses={warehouses}
        onWarehousesUpdated={async () => {
          const fresh = await getWarehouses();
          const sorted = sortWarehouses(fresh);
          setWarehouses(sorted);
          if (onRefreshData) onRefreshData();
        }}
        onSelectWarehouse={(wid) => setSelectedWarehouseId(wid)}
      />

    </div>
  );
};
