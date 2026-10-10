/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Product, ProductVariant } from '../types';
import { getProductVariants, createProductVariant, deleteProductVariant } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { ConfirmDeleteModal } from './common/ConfirmDeleteModal';
import {
  X,
  Layers,
  Plus,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Tag,
  CheckCircle2,
  Barcode as BarcodeIcon,
} from 'lucide-react';

interface ProductVariantsModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ProductVariantsModal: React.FC<ProductVariantsModalProps> = ({
  product,
  isOpen,
  onClose,
}) => {
  const { currentUser, hasPermission } = useAuth();
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // حقول إضافة متغير جديد
  const [variantNameAr, setVariantNameAr] = useState('');
  const [variantSku, setVariantSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [additionalPrice, setAdditionalPrice] = useState<number>(0);
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [typeAttr, setTypeAttr] = useState('');

  // حالة حذف المتغير
  const [variantToDelete, setVariantToDelete] = useState<ProductVariant | null>(null);
  const [isDeletingVariant, setIsDeletingVariant] = useState(false);

  const canManage = hasPermission('products:edit') || hasPermission('products:create');

  const loadVariants = async () => {
    if (!product) return;
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const list = await getProductVariants(product.id);
      setVariants(list);
    } catch (err: any) {
      setErrorMsg('فشل تحميل متغيرات الصنف.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && product) {
      loadVariants();
      // اقتراح تلقائي للرمز
      setVariantSku(`${product.sku}-V${Date.now().toString().slice(-3)}`);
      setBarcode(`${Math.floor(6220000000000 + Math.random() * 900000000000)}`);
      setVariantNameAr('');
      setAdditionalPrice(0);
      setSize('');
      setColor('');
      setTypeAttr('');
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!variantNameAr.trim()) {
      setErrorMsg('اسم المتغير بالعربية مطلوب.');
      return;
    }
    if (!variantSku.trim()) {
      setErrorMsg('رمز Variant SKU مطلوب.');
      return;
    }

    try {
      setIsCreating(true);
      setErrorMsg(null);

      const attributes: Record<string, string> = {};
      if (size.trim()) attributes['المقاس'] = size.trim();
      if (color.trim()) attributes['اللون'] = color.trim();
      if (typeAttr.trim()) attributes['النوع'] = typeAttr.trim();

      await createProductVariant(
        {
          productId: product.id,
          variantSku: variantSku.trim().toUpperCase(),
          variantNameAr: variantNameAr.trim(),
          attributes,
          additionalPrice: Number(additionalPrice) || 0,
          barcode: barcode.trim() || `${Math.floor(1000000000000 + Math.random() * 9000000000000)}`,
        },
        currentUser?.fullName || 'المشرف'
      );

      // إعادة ضبط الحقول وتحديث القائمة
      setVariantNameAr('');
      setSize('');
      setColor('');
      setTypeAttr('');
      setAdditionalPrice(0);
      setVariantSku(`${product.sku}-V${Date.now().toString().slice(-3)}`);
      setBarcode(`${Math.floor(6220000000000 + Math.random() * 900000000000)}`);
      await loadVariants();
    } catch (err: any) {
      setErrorMsg(err?.message || 'فشل إضافة المتغير.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleConfirmDeleteVariant = async () => {
    if (!variantToDelete) return;
    try {
      setIsDeletingVariant(true);
      await deleteProductVariant(variantToDelete.id, variantToDelete.variantNameAr, currentUser?.fullName || 'المشرف');
      setVariantToDelete(null);
      await loadVariants();
    } catch (err: any) {
      setErrorMsg(err?.message || 'فشل حذف المتغير.');
    } finally {
      setIsDeletingVariant(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* الهيدر */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                إدارة خيارات ومتغيرات المنتج (Variants)
              </h3>
              <p className="text-[11px] text-slate-500 line-clamp-1">
                {product.nameAr} ({product.sku})
              </p>
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

        <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* إضافة متغير جديد */}
          {canManage && (
            <form onSubmit={handleAddVariant} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-indigo-600" />
                  <span>إضافة خيار أو مقاس / لون جديد للصنف</span>
                </span>
                <span className="text-[11px] text-slate-400 font-normal">تسجيل مباشر في Firestore</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    اسم المتغير (مثال: مقاس 85 ملم - سلندر ذهبي) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: مقاس 85 ملم - لون نحاسي"
                    value={variantNameAr}
                    onChange={(e) => setVariantNameAr(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    رمز Variant SKU <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={variantSku}
                    onChange={(e) => setVariantSku(e.target.value.toUpperCase())}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono uppercase focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* سمات المقاس، اللون، والنوع */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">المقاس (Size)</label>
                  <input
                    type="text"
                    placeholder="مثال: 70 ملم / 85 ملم"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">اللون / الطلاء (Color)</label>
                  <input
                    type="text"
                    placeholder="مثال: ذهبي / فضي / أسود"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">الشكل / النوع (Type)</label>
                  <input
                    type="text"
                    placeholder="مثال: كمبيوتر مشفر"
                    value={typeAttr}
                    onChange={(e) => setTypeAttr(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    سعر إضافي على السعر الأساسي (ر.س)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={additionalPrice}
                    onChange={(e) => setAdditionalPrice(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">الباركود المخصص</label>
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isCreating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>حفظ المتغير في قاعدة البيانات</span>
                </button>
              </div>
            </form>
          )}

          {/* قائمة المتغيرات الحالية */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-800">
                المتغيرات المسجلة ({variants.length})
              </span>
              <button
                type="button"
                onClick={loadVariants}
                className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                <span>تحديث</span>
              </button>
            </div>

            {variants.length === 0 ? (
              <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                لا توجد متغيرات مضافة لهذا الصنف بعد. يمكنك إضافة مقاسات أو ألوان أو أنواع مختلفة أعلاه.
              </div>
            ) : (
              <div className="space-y-2">
                {variants.map((v) => (
                  <div
                    key={v.id}
                    className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between hover:border-indigo-200 transition-colors"
                  >
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>{v.variantNameAr}</span>
                        {v.additionalPrice > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold">
                            +{v.additionalPrice} ر.س
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono mt-1">
                        <span>SKU: {v.variantSku}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <BarcodeIcon className="w-3 h-3 text-slate-400" />
                          <span>{v.barcode}</span>
                        </span>
                      </div>
                      {v.attributes && Object.keys(v.attributes).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {Object.entries(v.attributes).map(([key, val]) => (
                            <span
                              key={key}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium"
                            >
                              {key}: <span className="font-bold">{val}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setVariantToDelete(v)}
                        className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                        title="حذف المتغير"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-3 border-t border-slate-200 flex justify-end bg-slate-50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>

      {/* تأكيد حذف المتغير */}
      <ConfirmDeleteModal
        isOpen={!!variantToDelete}
        onClose={() => {
          if (!isDeletingVariant) setVariantToDelete(null);
        }}
        onConfirm={handleConfirmDeleteVariant}
        title="تأكيد حذف خيار المتغير"
        itemTypeLabel="إدارة متغيرات وخيارات الأصناف"
        itemName={variantToDelete?.variantNameAr}
        message={`هل أنت متأكد من رغبتك في حذف المتغير "${variantToDelete?.variantNameAr}" (SKU: ${variantToDelete?.variantSku})؟`}
        warningNote="سيتم إزالة هذا المتغير من قاعدة البيانات ولا يمكن استرجاعه."
        isProcessing={isDeletingVariant}
        confirmButtonText="نعم، حذف المتغير"
      />
    </div>
  );
};
