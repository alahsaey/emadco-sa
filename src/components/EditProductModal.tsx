/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Product, Category, Brand, Unit } from '../types';
import { updateProduct } from '../services/db';
import { useAuth } from '../context/AuthContext';
import {
  X,
  Edit3,
  AlertTriangle,
  Image as ImageIcon,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  MapPin,
} from 'lucide-react';

interface EditProductModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  brands: Brand[];
  units: Unit[];
  onProductUpdated: () => void;
}

const PRESET_IMAGES = [
  { label: 'كالون أهرام كمبيوتر', url: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=500&auto=format&fit=crop&q=60' },
  { label: 'قفل بوابة فولاذي', url: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=500&auto=format&fit=crop&q=60' },
  { label: 'زرادية وبنسة صناعية', url: 'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=500&auto=format&fit=crop&q=60' },
  { label: 'سيليكون ومواد عازلة', url: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500&auto=format&fit=crop&q=60' },
  { label: 'مسامير وبراغي جبس', url: 'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?w=500&auto=format&fit=crop&q=60' },
  { label: 'زوايا تثبيت وبراويز', url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=500&auto=format&fit=crop&q=60' },
];

export const EditProductModal: React.FC<EditProductModalProps> = ({
  product,
  isOpen,
  onClose,
  categories,
  brands,
  units,
  onProductUpdated,
}) => {
  const { currentUser } = useAuth();

  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [baseUnitId, setBaseUnitId] = useState('');
  const [costPrice, setCostPrice] = useState<number>(0);
  const [retailPrice, setRetailPrice] = useState<number>(0);
  const [wholesalePrice, setWholesalePrice] = useState<number>(0);
  const [contractorPrice, setContractorPrice] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(15);
  const [minStockLevel, setMinStockLevel] = useState<number>(10);
  const [maxStockLevel, setMaxStockLevel] = useState<number>(200);
  const [storageLocation, setStorageLocation] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [specifications, setSpecifications] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (product) {
      setNameAr(product.nameAr || '');
      setNameEn(product.nameEn || '');
      setSku(product.sku || '');
      setBarcode(product.barcode || '');
      setDescription(product.description || '');
      setCategoryId(product.categoryId || (categories[0]?.id ?? ''));
      setBrandId(product.brandId || (brands[0]?.id ?? ''));
      setBaseUnitId(product.baseUnitId || (units[0]?.id ?? ''));
      setCostPrice(product.costPrice || 0);
      setRetailPrice(product.retailPrice || 0);
      setWholesalePrice(product.wholesalePrice || 0);
      setContractorPrice(product.contractorPrice || 0);
      setTaxRate(product.taxRate ?? 15);
      setMinStockLevel(product.minStockLevel ?? 10);
      setMaxStockLevel(product.maxStockLevel ?? 200);
      setStorageLocation(product.storageLocation || '');
      setImageUrl(product.imageUrl || '');
      setSpecifications(product.specifications || '');
      setIsActive(product.isActive !== false);
      setErrorMsg(null);
    }
  }, [product, categories, brands, units]);

  if (!isOpen || !product) return null;

  const parseFirestoreError = (err: any): string => {
    console.error('تفاصيل خطأ تعديل الصنف:', err);
    const msg = err?.message || String(err);
    if (msg.includes('permission-denied')) {
      return 'ليس لديك صلاحية لتعديل بيانات الأصناف. يرجى مراجعة المشرف.';
    }
    if (msg.includes('unavailable')) {
      return 'تعذر الاتصال بقاعدة البيانات. يرجى التحقق من اتصال الإنترنت.';
    }
    return `حدث خطأ أثناء حفظ التعديل: ${msg}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!nameAr.trim()) {
      setErrorMsg('اسم الصنف بالعربية مطلوب.');
      return;
    }
    if (!sku.trim()) {
      setErrorMsg('رمز الصنف (SKU) مطلوب.');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateProduct(
        product.id,
        {
          nameAr: nameAr.trim(),
          nameEn: nameEn.trim() ? nameEn.trim() : '',
          sku: sku.trim().toUpperCase(),
          barcode: barcode.trim() || product.barcode,
          description: description.trim() ? description.trim() : '',
          categoryId: categoryId || product.categoryId,
          brandId: brandId || product.brandId,
          baseUnitId: baseUnitId || product.baseUnitId,
          costPrice: Number(costPrice) || 0,
          retailPrice: Number(retailPrice) || 0,
          wholesalePrice: Number(wholesalePrice) || Number(retailPrice) || 0,
          contractorPrice: Number(contractorPrice) || Number(retailPrice) || 0,
          taxRate: Number(taxRate) >= 0 ? Number(taxRate) : 15,
          minStockLevel: Math.max(0, Number(minStockLevel) || 0),
          maxStockLevel: Math.max(1, Number(maxStockLevel) || 100),
          storageLocation: storageLocation.trim() ? storageLocation.trim() : '',
          imageUrl: imageUrl.trim() ? imageUrl.trim() : '',
          specifications: specifications.trim() ? specifications.trim() : '',
          isActive,
        },
        currentUser?.fullName || 'المشرف'
      );

      onProductUpdated();
      onClose();
    } catch (err: any) {
      setErrorMsg(parseFirestoreError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col">
        {/* رأس النافذة */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">تعديل بيانات الصنف</h3>
              <p className="text-[11px] text-slate-500 font-mono">ID: {product.id} • SKU: {product.sku}</p>
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

        {/* نموذج التعديل */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* اسم المنتج */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                اسم الصنف (بالعربية) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">الاسم بالإنجليزية (اختياري)</label>
              <input
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-left font-mono"
              />
            </div>
          </div>

          {/* الرموز والباركود */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                رمز الصنف SKU <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden font-mono uppercase"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">الباركود (Barcode)</label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-500" />
                  <span>موقع التخزين في المستودع</span>
                </span>
              </label>
              <input
                type="text"
                placeholder="مثال: هنجر 3 - رف B-14"
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* التصنيف والعلامة التجارية ووحدة القياس */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">التصنيف</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.nameAr}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">العلامة التجارية (البراند)</label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden cursor-pointer"
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.nameAr} ({b.countryOfOrigin || 'مستورد'})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">وحدة القياس</label>
              <select
                value={baseUnitId}
                onChange={(e) => setBaseUnitId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden cursor-pointer"
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.nameAr} ({u.symbolAr})</option>
                ))}
              </select>
            </div>
          </div>

          {/* هيكل الأسعار والضريبة */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-slate-800 block">هيكل الأسعار والتسعير (ر.س)</span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">سعر الشراء (التكلفة)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={costPrice}
                  onChange={(e) => setCostPrice(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-900 font-bold mb-1">سعر البيع (القطاعي)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={retailPrice}
                  onChange={(e) => setRetailPrice(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[11px] text-amber-900 font-bold mb-1">سعر المقاولين</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={contractorPrice}
                  onChange={(e) => setContractorPrice(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50/50 font-mono font-bold text-amber-900"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">سعر الجملة</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={wholesalePrice}
                  onChange={(e) => setWholesalePrice(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">الضريبة (%)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono font-bold"
                />
              </div>
            </div>
          </div>

          {/* حدود المخزون */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">الحد الأدنى للمخزون (نقطة إعادة الطلب)</label>
              <input
                type="number"
                min="0"
                value={minStockLevel}
                onChange={(e) => setMinStockLevel(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">الحد الأقصى للمخزون (الطاقة الاستيعابية)</label>
              <input
                type="number"
                min="1"
                value={maxStockLevel}
                onChange={(e) => setMaxStockLevel(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white font-mono"
              />
            </div>
          </div>

          {/* صورة الصنف */}
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
            {/* صور مقترحة سريعة لمواد البناء */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-[10px] text-slate-400 py-1">نماذج جاهزة:</span>
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

          {/* مواصفات إضافية وحالة المنتج */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">المواصفات الفنية والملاحظات</label>
              <input
                type="text"
                placeholder="مثال: مقاس 70 ملم، لسان نحاس مزدوج، مقاوم للرطوبة"
                value={specifications}
                onChange={(e) => setSpecifications(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">حالة تنشيط المنتج</label>
              <div className="flex items-center gap-2 pt-1.5">
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isActive ? 'منتج متاح ونشط' : 'منتج معطّل / متوقف'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* أزرار الإجراءات */}
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
                  <span>حفظ التعديلات في قاعدة البيانات</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
