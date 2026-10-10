/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Category, Brand, Unit, Warehouse } from '../types';
import { createProduct, getWarehouses, sortWarehouses } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { WarehousesManagerModal } from './inventory/WarehousesManagerModal';
import {
  X,
  PackagePlus,
  AlertTriangle,
  Image as ImageIcon,
  Sparkles,
  Barcode as BarcodeIcon,
  RefreshCw,
  MapPin,
  Boxes,
  Warehouse as WarehouseIcon,
  Plus,
  Settings2,
  Info,
} from 'lucide-react';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  brands: Brand[];
  units: Unit[];
  warehouses?: Warehouse[];
  onProductCreated: () => void;
  onWarehousesUpdated?: () => void;
}

const PRESET_IMAGES = [
  { label: 'كالون أهرام كمبيوتر', url: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=500&auto=format&fit=crop&q=60' },
  { label: 'قفل بوابة ساب إيطالي', url: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=500&auto=format&fit=crop&q=60' },
  { label: 'زرادية وبنسة Total', url: 'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=500&auto=format&fit=crop&q=60' },
  { label: 'سيليكون باتكس ألماني', url: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500&auto=format&fit=crop&q=60' },
  { label: 'مسامير جبس بورد صلب', url: 'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?w=500&auto=format&fit=crop&q=60' },
  { label: 'رغوة ولاصق فلين سافيتو', url: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500&auto=format&fit=crop&q=60' },
  { label: 'زوايا تثبيت براويز Stanley', url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=500&auto=format&fit=crop&q=60' },
];

export const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  categories,
  brands,
  units,
  warehouses = [],
  onProductCreated,
  onWarehousesUpdated,
}) => {
  const { currentUser } = useAuth();
  const [localWarehouses, setLocalWarehouses] = useState<Warehouse[]>(warehouses);
  const [isWarehousesModalOpen, setIsWarehousesModalOpen] = useState(false);

  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [baseUnitId, setBaseUnitId] = useState('');
  const [costPrice, setCostPrice] = useState<number>(50);
  const [retailPrice, setRetailPrice] = useState<number>(85);
  const [contractorPrice, setContractorPrice] = useState<number>(70);
  const [wholesalePrice, setWholesalePrice] = useState<number>(75);
  const [taxRate, setTaxRate] = useState<number>(15);
  const [minStockLevel, setMinStockLevel] = useState<number>(15);
  const [maxStockLevel, setMaxStockLevel] = useState<number>(250);
  const [initialStock, setInitialStock] = useState<number>(50);
  const [warehouseId, setWarehouseId] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [specifications, setSpecifications] = useState('');
  
  // حالة الأخطاء المفصلة
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // تحديث أو جلب المستودعات
  const refreshWarehousesList = async () => {
    try {
      const whs = await getWarehouses();
      if (whs && whs.length > 0) {
        const sorted = sortWarehouses(whs);
        setLocalWarehouses(sorted);
        if (!warehouseId || !sorted.some((w) => w.id === warehouseId)) {
          const primary = sorted.find((w) => w.isPrimary) || sorted[0];
          setWarehouseId(primary.id);
        }
      }
    } catch (e) {
      console.warn('تعذر جلب المستودعات في نافذة الصنف:', e);
    }
  };

  useEffect(() => {
    if (warehouses && warehouses.length > 0) {
      const sorted = sortWarehouses(warehouses);
      setLocalWarehouses(sorted);
      if (!warehouseId || !sorted.some((w) => w.id === warehouseId)) {
        const primary = sorted.find((w) => w.isPrimary) || sorted[0];
        setWarehouseId(primary.id);
      }
    } else {
      refreshWarehousesList();
    }
  }, [warehouses]);

  // الاستماع لحدث تغيير المستودعات
  useEffect(() => {
    const handleWarehousesChanged = (e: any) => {
      const updated = e.detail;
      if (Array.isArray(updated) && updated.length > 0) {
        const sorted = sortWarehouses(updated);
        setLocalWarehouses(sorted);
        if (!warehouseId || !sorted.some((w) => w.id === warehouseId)) {
          const primary = sorted.find((w) => w.isPrimary) || sorted[0];
          setWarehouseId(primary.id);
        }
      } else {
        refreshWarehousesList();
      }
    };
    window.addEventListener('warehouses-changed', handleWarehousesChanged);
    return () => window.removeEventListener('warehouses-changed', handleWarehousesChanged);
  }, [warehouseId]);

  // توليد تلقائي للـ SKU والباركود عند الفتح
  useEffect(() => {
    if (isOpen) {
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      setSku(`ITM-${randomSuffix}`);
      setBarcode(`628${Math.floor(1000000000 + Math.random() * 9000000000)}`);
      setCategoryId(categories[0]?.id || 'cat_locks');
      setBrandId(brands[0]?.id || 'br_ahram');
      setBaseUnitId(units[0]?.id || 'unit_piece');
      setImageUrl(PRESET_IMAGES[0].url);
      setStorageLocation('المستودع الرئيسي - الرف A-01');
      setErrorMsg(null);
      setErrorField(null);
      refreshWarehousesList();
    }
  }, [isOpen, categories, brands, units]);

  if (!isOpen) return null;

  const handleGenerateBarcode = () => {
    setBarcode(`628${Math.floor(1000000000 + Math.random() * 9000000000)}`);
  };

  const handleGenerateSku = () => {
    const prefix = categoryId.includes('lock')
      ? 'LCK'
      : categoryId.includes('tool')
      ? 'TLS'
      : categoryId.includes('seal')
      ? 'SIL'
      : categoryId.includes('fast')
      ? 'SCR'
      : 'MAT';
    setSku(`${prefix}-${Math.floor(1000 + Math.random() * 9000)}`);
  };

  const parseFirestoreError = (err: any): { message: string; field?: string } => {
    console.error('تفاصيل خطأ إضافة الصنف:', err);
    const msg = err?.message || String(err);

    if (msg.includes('permission-denied')) {
      return { message: 'ليس لديك صلاحية لإضافة أصناف جديدة. يرجى التحقق من صلاحيات دورك مع المشرف.' };
    }
    if (msg.includes('unavailable')) {
      return { message: 'تعذر الاتصال بخادم قاعدة البيانات. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.' };
    }
    if (msg.includes('invalid-argument') || msg.includes('undefined')) {
      return { message: 'تم إرسال قيمة غير صحيحة أو حقل فارغ غير متوافق. تم تصحيح البيانات تلقائياً، يرجى إعادة المحاولة.' };
    }
    if (msg.includes('SKU') || msg.includes('sku')) {
      return { message: 'رمز الصنف (SKU) غير صالح أو مستخدم مسبقاً. يرجى توليد رمز جديد.', field: 'sku' };
    }
    return { message: `حدث خطأ: ${msg}` };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setErrorField(null);

    // 1. التحقق المسبق الدقيق من الحقول
    if (!nameAr.trim()) {
      setErrorMsg('يرجى كتابة اسم الصنف بالعربية.');
      setErrorField('nameAr');
      return;
    }
    if (!sku.trim()) {
      setErrorMsg('يرجى تحديد أو توليد رمز الصنف (SKU).');
      setErrorField('sku');
      return;
    }
    if (!categoryId) {
      setErrorMsg('يرجى اختيار التصنيف التابع له الصنف.');
      setErrorField('categoryId');
      return;
    }
    if (costPrice < 0 || retailPrice < 0) {
      setErrorMsg('سعر التكلفة وسعر البيع يجب أن يكونا أرقاماً موجبة.');
      setErrorField('costPrice');
      return;
    }

    const selectedWh = localWarehouses.find((w) => w.id === warehouseId) || localWarehouses[0];
    const targetWhId = selectedWh?.id || 'wh_main';

    setIsSubmitting(true);
    try {
      await createProduct(
        {
          nameAr: nameAr.trim(),
          nameEn: nameEn.trim() ? nameEn.trim() : '',
          sku: sku.trim().toUpperCase(),
          barcode: barcode.trim() || `${Math.floor(1000000000000 + Math.random() * 9000000000000)}`,
          description: description.trim() ? description.trim() : '',
          categoryId: categoryId || (categories[0]?.id ?? 'cat_general'),
          brandId: brandId || (brands[0]?.id ?? 'br_general'),
          baseUnitId: baseUnitId || (units[0]?.id ?? 'unit_piece'),
          costPrice: Number(costPrice) || 0,
          retailPrice: Number(retailPrice) || 0,
          wholesalePrice: Number(wholesalePrice) || Number(retailPrice) || 0,
          contractorPrice: Number(contractorPrice) || Number(retailPrice) || 0,
          taxRate: Number(taxRate) >= 0 ? Number(taxRate) : 15,
          minStockLevel: Math.max(0, Number(minStockLevel) || 0),
          maxStockLevel: Math.max(1, Number(maxStockLevel) || 100),
          storageLocation: storageLocation.trim() ? storageLocation.trim() : '',
          imageUrl: imageUrl.trim() ? imageUrl.trim() : '',
          isActive: true,
          specifications: specifications.trim() ? specifications.trim() : '',
        },
        currentUser?.fullName || 'الدعم الفني Admin',
        Math.max(0, Number(initialStock) || 0),
        targetWhId
      );

      onProductCreated();
      onClose();
    } catch (err: any) {
      const parsed = parseFirestoreError(err);
      setErrorMsg(parsed.message);
      if (parsed.field) {
        setErrorField(parsed.field);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col">
          {/* رأس النافذة */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center">
                <PackagePlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">إضافة صنف جديد لكتالوج ومخزون المتجر</h3>
                <p className="text-[11px] text-slate-500">حفظ فوري في السحابة مع تأسيس رصيد المخزون في المستودع المختار</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* نموذج الإدخال */}
          <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
            {/* رسالة الخطأ المفصلة */}
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5 shadow-xs">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold text-xs mb-0.5">تنبيه أثناء إضافة الصنف:</div>
                  <div className="text-[11px] leading-relaxed">{errorMsg}</div>
                </div>
              </div>
            )}

            {/* الاسم بالعربي والإنجليزي */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  اسم الصنف (بالعربية) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: كالون أهرام كمبيوتر أصلي 3 لسان"
                  value={nameAr}
                  onChange={(e) => {
                    setNameAr(e.target.value);
                    if (errorField === 'nameAr') setErrorMsg(null);
                  }}
                  className={`w-full px-3 py-2 rounded-xl border bg-slate-50 focus:bg-white focus:outline-hidden transition-all ${
                    errorField === 'nameAr' ? 'border-rose-500 ring-2 ring-rose-200' : 'border-slate-200 focus:border-amber-400'
                  }`}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">اسم الصنف بالإنجليزية (اختياري)</label>
                <input
                  type="text"
                  placeholder="مثال: Ahram Mortise Lock 3-Bolt Computer"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden text-left font-mono text-[11px]"
                />
              </div>
            </div>

            {/* رمز الصنف والباركود */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">
                    رمز الصنف SKU <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateSku}
                    className="text-amber-700 hover:text-amber-800 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>توليد تلقائي</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={sku}
                  onChange={(e) => {
                    setSku(e.target.value.toUpperCase());
                    if (errorField === 'sku') setErrorMsg(null);
                  }}
                  className={`w-full px-3 py-2 rounded-xl border bg-slate-50 focus:bg-white font-mono uppercase font-bold text-slate-800 ${
                    errorField === 'sku' ? 'border-rose-500 ring-2 ring-rose-200' : 'border-slate-200'
                  }`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">الباركود الدولي / المحلي</label>
                  <button
                    type="button"
                    onClick={handleGenerateBarcode}
                    className="text-amber-700 hover:text-amber-800 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <BarcodeIcon className="w-3 h-3" />
                    <span>توليد EAN-13</span>
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="6281234567890"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white font-mono"
                />
              </div>
            </div>

            {/* التصنيف والماركة ووحدة القياس */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">التصنيف الرئيسي</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white cursor-pointer"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">العلامة التجارية / الماركة</label>
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white cursor-pointer"
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">وحدة القياس الأساسية</label>
                <select
                  value={baseUnitId}
                  onChange={(e) => setBaseUnitId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white cursor-pointer"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nameAr} ({u.symbolAr})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* هيكل الأسعار والضريبة */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-[11px]">
                  تسعير الصنف (شامل سياسات البيع والضريبة)
                </span>
                <span className="text-[10px] text-slate-500">ضريبة القيمة المضافة 15%</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-700 mb-1">سعر التكلفة (شراء)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={costPrice}
                      onChange={(e) => setCostPrice(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono font-bold"
                    />
                    <span className="absolute left-2 top-1.5 text-[10px] text-slate-400">ر.س</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-emerald-800 font-bold mb-1">سعر التجزئة (مفرق)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={retailPrice}
                      onChange={(e) => setRetailPrice(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-white font-mono font-bold text-emerald-900"
                    />
                    <span className="absolute left-2 top-1.5 text-[10px] text-emerald-600 font-bold">ر.س</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-700 mb-1">سعر الجملة</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={wholesalePrice}
                      onChange={(e) => setWholesalePrice(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                    />
                    <span className="absolute left-2 top-1.5 text-[10px] text-slate-400">ر.س</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-700 mb-1">سعر المقاولين</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={contractorPrice}
                      onChange={(e) => setContractorPrice(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                    />
                    <span className="absolute left-2 top-1.5 text-[10px] text-slate-400">ر.س</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-700 mb-1">نسبة الضريبة</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                    />
                    <span className="absolute left-2 top-1.5 text-[10px] text-slate-400">%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* إعدادات المخزون والمستودعات الديناميكية */}
            <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-950 text-[11px] flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تأسيس رصيد المخزون وتحديد المستودع</span>
                </span>
                
                {/* زر إدارة وتخصيص المستودعات بناءً على طلب المستخدم */}
                <button
                  type="button"
                  onClick={() => setIsWarehousesModalOpen(true)}
                  className="px-2.5 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Settings2 className="w-3 h-3 text-emerald-600" />
                  <span>+ إدارة وتخصيص المستودعات</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-800 mb-1">
                    الرصيد الافتتاحي (الكمية)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={initialStock}
                    onChange={(e) => setInitialStock(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-white font-mono font-bold text-emerald-900"
                  />
                </div>

                {/* قائمة المستودعات الحقيقية المخصصة */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    المستودع الأولي <span className="text-emerald-700">({localWarehouses.length} متاح)</span>
                  </label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-white font-bold text-slate-800 cursor-pointer"
                  >
                    {localWarehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.nameAr} {wh.code ? `(${wh.code})` : ''} {wh.isPrimary ? '★ رئيسي' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-700 mb-1">الحد الأدنى (إعادة الطلب)</label>
                  <input
                    type="number"
                    min="0"
                    value={minStockLevel}
                    onChange={(e) => setMinStockLevel(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-700 mb-1">موقع التخزين (الرف / الهنجر)</label>
                  <input
                    type="text"
                    placeholder="مثال: الرف A-10 / هنجر 2"
                    value={storageLocation}
                    onChange={(e) => setStorageLocation(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px]"
                  />
                </div>
              </div>
            </div>

            {/* صورة الصنف ونماذج سريعة */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">رابط صورة الصنف (URL)</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden font-mono text-[11px]"
                />
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt="معاينة"
                    className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                  />
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-[10px] text-slate-400 py-1">نماذج جاهزة لمواد البناء:</span>
                {PRESET_IMAGES.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setImageUrl(preset.url)}
                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-medium transition-colors cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* المواصفات والوصف */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">المواصفات الفنية</label>
                <input
                  type="text"
                  placeholder="مثال: مقاس 70 ملم، لسان نحاس مزدوج، مفاتيح كمبيوتر"
                  value={specifications}
                  onChange={(e) => setSpecifications(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">الوصف العام للصنف</label>
                <input
                  type="text"
                  placeholder="كالون دفن عالي الأمان مناسب للأبواب الخشبية والمعدنية"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>

            {/* أزرار الإجراء */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                    <span>جاري الحفظ في Firestore...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>حفظ الصنف وتأسيس الرصيد</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* نافذة إدارة وتخصيص المستودعات */}
      <WarehousesManagerModal
        isOpen={isWarehousesModalOpen}
        onClose={() => setIsWarehousesModalOpen(false)}
        warehouses={localWarehouses}
        onWarehousesUpdated={() => {
          refreshWarehousesList();
          if (onWarehousesUpdated) onWarehousesUpdated();
        }}
        onSelectWarehouse={(whId) => {
          setWarehouseId(whId);
        }}
      />
    </>
  );
};
