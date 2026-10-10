/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Product, Category, Brand, Unit } from '../types';
import {
  Package,
  Search,
  Plus,
  Filter,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Edit3,
  Trash2,
  Layers,
  Power,
  RotateCcw,
  Barcode as BarcodeIcon,
  MapPin,
  Eye,
  Boxes,
  Printer,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  toggleProductActive,
  softDeleteProduct,
  restoreProduct,
  hardDeleteProduct,
} from '../services/db';
import { EditProductModal } from './EditProductModal';
import { ProductVariantsModal } from './ProductVariantsModal';
import { BarcodeModal } from './BarcodeModal';
import { InventoryMovementModal } from './InventoryMovementModal';
import { ConfirmDeleteModal } from './common/ConfirmDeleteModal';

interface ProductsViewerProps {
  products: Product[];
  categories: Category[];
  brands?: Brand[];
  units?: Unit[];
  onOpenAddModal: () => void;
  onRefresh: () => void;
}

export const ProductsViewer: React.FC<ProductsViewerProps> = ({
  products,
  categories,
  brands = [],
  units = [],
  onOpenAddModal,
  onRefresh,
}) => {
  const { currentUser, hasPermission } = useAuth();

  // الفلاتر والبحث
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'deleted' | 'all'>('active');

  // نوافذ المودال
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);

  // حالة حذف المنتجات
  const [productToDeleteAction, setProductToDeleteAction] = useState<{
    type: 'soft' | 'hard';
    product: Product;
  } | null>(null);
  const [isProcessingDelete, setIsProcessingDelete] = useState(false);
  const [operationFeedback, setOperationFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const canCreate = hasPermission('products:create');
  const canEdit = hasPermission('products:edit');
  const canDelete = hasPermission('products:delete');

  // فلترة المنتجات
  const filtered = useMemo(() => {
    return products.filter((p) => {
      // فلتر الحذف المنطقي
      if (statusFilter === 'deleted') {
        if (!p.isDeleted) return false;
      } else if (statusFilter === 'active') {
        if (p.isDeleted || !p.isActive) return false;
      } else if (statusFilter === 'inactive') {
        if (p.isDeleted || p.isActive) return false;
      } else if (statusFilter === 'all') {
        if (p.isDeleted) return false;
      }

      // البحث
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !term ||
        p.nameAr.toLowerCase().includes(term) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(term)) ||
        p.sku.toLowerCase().includes(term) ||
        (p.barcode && p.barcode.includes(term)) ||
        (p.storageLocation && p.storageLocation.toLowerCase().includes(term));

      // فلتر التصنيف
      const matchesCat = selectedCat === 'all' || p.categoryId === selectedCat;

      // فلتر البراند
      const matchesBrand = selectedBrand === 'all' || p.brandId === selectedBrand;

      return matchesSearch && matchesCat && matchesBrand;
    });
  }, [products, searchTerm, selectedCat, selectedBrand, statusFilter]);

  const getCategoryName = (catId: string) => {
    const found = categories.find((c) => c.id === catId);
    return found ? found.nameAr : catId;
  };

  const getBrandName = (brandId: string) => {
    const found = brands.find((b) => b.id === brandId);
    return found ? found.nameAr : brandId;
  };

  const handleToggleActive = async (prod: Product) => {
    try {
      await toggleProductActive(
        prod.id,
        prod.isActive,
        prod.nameAr,
        currentUser?.fullName || 'المشرف'
      );
      onRefresh();
    } catch (err: any) {
      alert('حدث خطأ أثناء تعديل حالة المنتج: ' + err?.message);
    }
  };

  const handleConfirmDeleteProduct = async () => {
    if (!productToDeleteAction) return;
    setIsProcessingDelete(true);
    setOperationFeedback(null);
    try {
      const { type, product } = productToDeleteAction;
      if (type === 'soft') {
        await softDeleteProduct(product.id, product.nameAr, currentUser?.fullName || 'الدعم الفني Admin');
        setOperationFeedback({
          type: 'success',
          message: `تم نقل الصنف "${product.nameAr}" إلى سلة المحذوفات بنجاح.`,
        });
      } else {
        await hardDeleteProduct(product.id, product.nameAr, currentUser?.fullName || 'الدعم الفني Admin');
        setOperationFeedback({
          type: 'success',
          message: `تم حذف الصنف "${product.nameAr}" نهائياً من قاعدة البيانات.`,
        });
      }
      setProductToDeleteAction(null);
      onRefresh();
    } catch (err: any) {
      setOperationFeedback({
        type: 'error',
        message: err?.message || 'فشل حذف المنتج.',
      });
    } finally {
      setIsProcessingDelete(false);
    }
  };

  const handleRestore = async (prod: Product) => {
    try {
      await restoreProduct(prod.id, prod.nameAr, currentUser?.fullName || 'الدعم الفني Admin');
      setOperationFeedback({
        type: 'success',
        message: `تمت استعادة الصنف "${prod.nameAr}" إلى قائمة الأصناف النشطة.`,
      });
      onRefresh();
    } catch (err: any) {
      setOperationFeedback({
        type: 'error',
        message: 'حدث خطأ أثناء استعادة المنتج: ' + err?.message,
      });
    }
  };

  // إحصائيات سريعة للحالات
  const activeCount = products.filter((p) => !p.isDeleted && p.isActive).length;
  const inactiveCount = products.filter((p) => !p.isDeleted && !p.isActive).length;
  const deletedCount = products.filter((p) => p.isDeleted).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
      {/* الهيدر وعناصر التحكم الرئيسية */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-600" />
            <h3 className="text-base font-bold text-slate-900">
              إدارة المنتجات وكتالوج مواد البناء (Emadco Products Management)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            جدول كامل مع البحث الفوري، الفلترة حسب الماركة والتصنيف، دعم قارئ الباركود، المتغيرات، وتعديل الأسعار
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canCreate ? (
            <button
              type="button"
              id="add-product-btn"
              onClick={onOpenAddModal}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>إضافة صنف جديد</span>
            </button>
          ) : (
            <div className="text-[11px] px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 font-medium">
              صلاحية الإضافة تتطلب دور مسؤول
            </div>
          )}
        </div>
      </div>

      {/* شريط تبويب حالات الأصناف وسلة المحذوفات */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'active'
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>الأصناف النشطة ({activeCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('inactive')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'inactive'
                ? 'bg-rose-100 text-rose-900 border border-rose-300'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>المعطلة ({inactiveCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('deleted')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'deleted'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5 text-amber-400" />
            <span>المحذوفة منطقياً ({deletedCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-200 text-slate-900'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            جميع القائمة
          </button>
        </div>

        <span className="text-[11px] text-slate-400 font-mono">
          النتائج المعروضة: {filtered.length} صنف
        </span>
      </div>

      {operationFeedback && (
        <div
          className={`p-3 rounded-xl flex items-center justify-between text-xs font-bold ${
            operationFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {operationFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{operationFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setOperationFeedback(null)}
            className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* البحث وفلاتر التصنيف والماركة */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        {/* حقل البحث السريع مع دعم الباركود */}
        <div className="relative sm:col-span-6">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ابحث بالاسم، SKU، الباركود (جاهز للمسح الضوئي)، أو موقع التخزين..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-4 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-all"
          />
        </div>

        {/* تصفية التصنيف */}
        <div className="sm:col-span-3">
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            aria-label="تصفية المنتجات حسب التصنيف"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            <option value="all">جميع التصنيفات</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameAr}
              </option>
            ))}
          </select>
        </div>

        {/* تصفية الماركة */}
        <div className="sm:col-span-3">
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            aria-label="تصفية المنتجات حسب العلامة التجارية"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            <option value="all">جميع العلامات التجارية</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nameAr} ({b.countryOfOrigin || 'مستورد'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* جدول المنتجات */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-right text-xs">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              <th className="py-3 px-3">الصورة</th>
              <th className="py-3 px-4">الصنف والمواصفات</th>
              <th className="py-3 px-3">التصنيف والماركة</th>
              <th className="py-3 px-3">SKU / الباركود</th>
              <th className="py-3 px-3">موقع التخزين</th>
              <th className="py-3 px-3 text-center">التكلفة</th>
              <th className="py-3 px-3 text-center">القطاعي</th>
              <th className="py-3 px-3 text-center bg-amber-50/50 text-amber-900">سعر المقاول</th>
              <th className="py-3 px-3 text-center">الضريبة</th>
              <th className="py-3 px-3 text-center">الحالة</th>
              <th className="py-3 px-4 text-center">الإجراءات والعمليات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-slate-400">
                  {statusFilter === 'deleted'
                    ? 'سلة المحذوفات فارغة حالياً.'
                    : 'لا توجد أصناف مطابقة للبحث أو الفلتر المختار.'}
                </td>
              </tr>
            ) : (
              filtered.map((prod) => (
                <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* الصورة */}
                  <td className="py-3 px-3">
                    {prod.imageUrl ? (
                      <img
                        src={prod.imageUrl}
                        alt={prod.nameAr}
                        className="w-11 h-11 object-cover rounded-lg border border-slate-200 shadow-2xs"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                        <Package className="w-5 h-5" />
                      </div>
                    )}
                  </td>

                  {/* اسم الصنف والمواصفات */}
                  <td className="py-3 px-4 max-w-xs">
                    <div className="font-bold text-slate-900 leading-snug">{prod.nameAr}</div>
                    {prod.nameEn && (
                      <div className="text-[10px] text-slate-400 font-mono text-left">{prod.nameEn}</div>
                    )}
                    {prod.specifications && (
                      <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                        {prod.specifications}
                      </div>
                    )}
                  </td>

                  {/* التصنيف والماركة */}
                  <td className="py-3 px-3">
                    <div className="space-y-1">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200">
                        {getCategoryName(prod.categoryId)}
                      </span>
                      {prod.brandId && (
                        <div className="text-[10px] text-slate-500 font-medium">
                          {getBrandName(prod.brandId)}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* SKU والباركود */}
                  <td className="py-3 px-3 font-mono text-[11px]">
                    <div className="font-bold text-slate-800">{prod.sku}</div>
                    <div className="text-slate-400 text-[10px] flex items-center gap-1">
                      <BarcodeIcon className="w-3 h-3" />
                      <span>{prod.barcode}</span>
                    </div>
                  </td>

                  {/* موقع التخزين */}
                  <td className="py-3 px-3">
                    {prod.storageLocation ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                        <MapPin className="w-3 h-3 text-amber-600" />
                        <span>{prod.storageLocation}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">-</span>
                    )}
                  </td>

                  {/* أسعار التكلفة والبيع */}
                  <td className="py-3 px-3 text-center font-bold font-mono text-slate-600">
                    {prod.costPrice} ر.س
                  </td>
                  <td className="py-3 px-3 text-center font-bold font-mono text-slate-900">
                    {prod.retailPrice} ر.س
                  </td>
                  <td className="py-3 px-3 text-center font-bold font-mono bg-amber-50/40 text-amber-900">
                    {prod.contractorPrice} ر.س
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-slate-500">
                    %{prod.taxRate}
                  </td>

                  {/* حالة المنتج */}
                  <td className="py-3 px-3 text-center">
                    {prod.isDeleted ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                        <Trash2 className="w-3 h-3" /> محذوف
                      </span>
                    ) : prod.isActive ? (
                      <button
                        type="button"
                        onClick={() => canEdit && handleToggleActive(prod)}
                        title="انقر لتعطيل المنتج"
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-3 h-3" /> نشط
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => canEdit && handleToggleActive(prod)}
                        title="انقر لتفعيل المنتج"
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 hover:bg-rose-200 text-rose-800 transition-colors cursor-pointer"
                      >
                        <Power className="w-3 h-3" /> معطل
                      </button>
                    )}
                  </td>

                  {/* الإجراءات والعمليات */}
                  <td className="py-3 px-4 text-center">
                    {prod.isDeleted ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRestore(prod)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="استعادة الصنف"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>استعادة</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setProductToDeleteAction({ type: 'hard', product: prod })}
                          className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="حذف نهائي"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>حذف نهائي</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        {/* تعديل */}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => setEditingProduct(prod)}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-amber-100 hover:text-amber-800 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                            title="تعديل بيانات الصنف"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* المتغيرات */}
                        <button
                          type="button"
                          onClick={() => setVariantProduct(prod)}
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-indigo-100 hover:text-indigo-800 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                          title="إدارة خيارات المقاسات والألوان (Variants)"
                        >
                          <Layers className="w-3.5 h-3.5" />
                        </button>

                        {/* ملصق الباركود */}
                        <button
                          type="button"
                          onClick={() => setBarcodeProduct(prod)}
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                          title="طباعة وعرض باركود الصنف"
                        >
                          <BarcodeIcon className="w-3.5 h-3.5" />
                        </button>

                        {/* حركة مخزون سريعة */}
                        <button
                          type="button"
                          onClick={() => setMovementProduct(prod)}
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-blue-100 hover:text-blue-800 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                          title="تسجيل حركة مخزون للصنف"
                        >
                          <Boxes className="w-3.5 h-3.5" />
                        </button>

                        {/* حذف منطقي */}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setProductToDeleteAction({ type: 'soft', product: prod })}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-rose-100 hover:text-rose-800 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                            title="حذف الصنف (نقل لسلة المحذوفات)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* نافذة التعديل */}
      <EditProductModal
        isOpen={Boolean(editingProduct)}
        product={editingProduct}
        onClose={() => setEditingProduct(null)}
        categories={categories}
        brands={brands}
        units={units}
        onProductUpdated={() => {
          onRefresh();
          setEditingProduct(null);
        }}
      />

      {/* نافذة المتغيرات */}
      <ProductVariantsModal
        isOpen={Boolean(variantProduct)}
        product={variantProduct}
        onClose={() => setVariantProduct(null)}
      />

      {/* نافذة الباركود */}
      <BarcodeModal
        isOpen={Boolean(barcodeProduct)}
        product={barcodeProduct}
        onClose={() => setBarcodeProduct(null)}
      />

      {/* نافذة حركة المخزون السريعة */}
      <InventoryMovementModal
        isOpen={Boolean(movementProduct)}
        onClose={() => setMovementProduct(null)}
        products={products}
        warehouses={[
          { id: 'wh_main', nameAr: 'المستودع الرئيسي (هنجر 3)', code: 'WH-MAIN', branchId: 'branch_main', isPrimary: true, isActive: true },
          { id: 'wh_locks', nameAr: 'مخزن الأقفال والكالونات', code: 'WH-LOCKS', branchId: 'branch_main', isPrimary: false, isActive: true },
          { id: 'wh_chemical', nameAr: 'مستودع الكيماويات والعوازل', code: 'WH-CHEM', branchId: 'branch_main', isPrimary: false, isActive: true },
        ]}
        initialProductId={movementProduct?.id}
        onMovementRecorded={() => {
          onRefresh();
          setMovementProduct(null);
        }}
      />

      {/* نافذة تأكيد حذف الصنف */}
      <ConfirmDeleteModal
        isOpen={!!productToDeleteAction}
        onClose={() => {
          if (!isProcessingDelete) setProductToDeleteAction(null);
        }}
        onConfirm={handleConfirmDeleteProduct}
        title={productToDeleteAction?.type === 'hard' ? 'تأكيد الحذف النهائي للصنف' : 'نقل الصنف إلى المحذوفات'}
        itemTypeLabel="إدارة أصناف ومخزون مواد البناء"
        itemName={productToDeleteAction?.product.nameAr}
        message={
          productToDeleteAction?.type === 'hard'
            ? `هل أنت متأكد من رغبتك في حذف الصنف "${productToDeleteAction?.product.nameAr}" نهائياً من قاعدة البيانات السحابية؟`
            : `هل تريد نقل الصنف "${productToDeleteAction?.product.nameAr}" إلى سلة المحذوفات؟ يمكنك استعادته في أي وقت لاحقاً.`
        }
        warningNote={
          productToDeleteAction?.type === 'hard'
            ? 'تحذير: لا يمكن التراجع عن هذا الإجراء وسيتم حذف بيانات الصنف وسجلاته نهائياً.'
            : 'سيتم إخفاء الصنف من شاشة المبيعات ونقاط البيع، مع الاحتفاظ ببياناته في سلة المحذوفات.'
        }
        isProcessing={isProcessingDelete}
        confirmButtonText={productToDeleteAction?.type === 'hard' ? 'نعم، حذف نهائي' : 'نقل للمحذوفات'}
      />
    </div>
  );
};
