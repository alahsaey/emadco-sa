/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  X,
  Package,
  Search,
  ShoppingCart,
  Truck,
  ArrowUpDown,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  SlidersHorizontal,
  CheckCircle2,
} from 'lucide-react';
import { Product } from '../../types';

interface LowStockAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onCreatePurchaseOrder?: (product: Product) => void;
  onOpenInventoryAdjustment?: (product: Product) => void;
}

export const LowStockAlertsModal: React.FC<LowStockAlertsModalProps> = ({
  isOpen,
  onClose,
  products,
  onCreatePurchaseOrder,
  onOpenInventoryAdjustment,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState<'all' | 'out_of_stock' | 'critical' | 'near_limit'>('all');

  const lowStockItems = useMemo(() => {
    return products
      .filter((p) => {
        const stock = p.currentStock ?? 0;
        const minStock = p.minStockLevel ?? 10;
        return stock <= minStock;
      })
      .map((p) => {
        const stock = p.currentStock ?? 0;
        const minStock = p.minStockLevel ?? 10;
        const deficit = Math.max(0, minStock - stock);
        const status =
          stock <= 0
            ? 'out_of_stock'
            : stock <= Math.ceil(minStock * 0.5)
            ? 'critical'
            : 'near_limit';
        return {
          product: p,
          stock,
          minStock,
          deficit,
          status,
        };
      });
  }, [products]);

  const filteredItems = useMemo(() => {
    return lowStockItems.filter((item) => {
      const matchSearch =
        item.product.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.product.barcode && item.product.barcode.includes(searchTerm));

      const matchLevel =
        filterLevel === 'all' || item.status === filterLevel;

      return matchSearch && matchLevel;
    });
  }, [lowStockItems, searchTerm, filterLevel]);

  if (!isOpen) return null;

  const outOfStockCount = lowStockItems.filter((i) => i.status === 'out_of_stock').length;
  const criticalCount = lowStockItems.filter((i) => i.status === 'critical').length;
  const nearLimitCount = lowStockItems.filter((i) => i.status === 'near_limit').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* ترويسة النافذة */}
        <div className="p-6 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-transparent border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-md">
              <AlertTriangle className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900">
                  شاشة تنبيهات المخزون المنخفض وحد الطلب
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white shadow-xs">
                  {lowStockItems.length} صنف يتطلب إجراء
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                قائمة بالمواد والمنتجات التي نفدت أو اقتربت من حد الأمان وإعادة التوريد
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* بطاقات الإحصائيات السريعة ومفاتيح التصفية */}
        <div className="p-6 pb-3 border-b border-slate-100 bg-slate-50/50 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setFilterLevel('out_of_stock')}
              className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                filterLevel === 'out_of_stock'
                  ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-300/30'
                  : 'bg-white border-slate-200 hover:border-rose-200'
              }`}
            >
              <div>
                <div className="text-xs font-bold text-rose-900">نفد تماماً من المستودع</div>
                <div className="text-[10px] text-slate-500 mt-0.5">الرصيد الحرج = 0</div>
              </div>
              <span className="text-xl font-black font-mono text-rose-600">{outOfStockCount}</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterLevel('critical')}
              className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                filterLevel === 'critical'
                  ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300/30'
                  : 'bg-white border-slate-200 hover:border-amber-200'
              }`}
            >
              <div>
                <div className="text-xs font-bold text-amber-900">حرج جداً (أقل من نصف الحد)</div>
                <div className="text-[10px] text-slate-500 mt-0.5">موشك على النفاد</div>
              </div>
              <span className="text-xl font-black font-mono text-amber-600">{criticalCount}</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterLevel('near_limit')}
              className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                filterLevel === 'near_limit'
                  ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-300/30'
                  : 'bg-white border-slate-200 hover:border-blue-200'
              }`}
            >
              <div>
                <div className="text-xs font-bold text-blue-900">وصل حد الطلب</div>
                <div className="text-[10px] text-slate-500 mt-0.5">يجب جدولة طلب شراء</div>
              </div>
              <span className="text-xl font-black font-mono text-blue-600">{nearLimitCount}</span>
            </button>
          </div>

          {/* شريط البحث والفلترة */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث باسم الصنف، كود SKU، أو الباركود..."
                className="w-full pr-9 pl-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {filterLevel !== 'all' && (
              <button
                type="button"
                onClick={() => setFilterLevel('all')}
                className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 cursor-pointer shrink-0"
              >
                عرض كل التنبيهات ({lowStockItems.length})
              </button>
            )}
          </div>
        </div>

        {/* جدول المنتجات المنخفضة المخزون */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredItems.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <div className="text-sm font-bold text-slate-800">
                {lowStockItems.length === 0
                  ? 'جميع المنتجات والمستودعات في مستويات مخزون آمنة!'
                  : 'لا توجد أصناف تطابق معايير التصفية والبحث الحالية'}
              </div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                يتم فحص كميات المخزون ومقارنتها تلقائياً مع حد الطلب المحدد لكل صنف.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map(({ product, stock, minStock, deficit, status }) => (
                <div
                  key={product.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                    status === 'out_of_stock'
                      ? 'bg-rose-50/50 border-rose-200 hover:border-rose-400'
                      : status === 'critical'
                      ? 'bg-amber-50/50 border-amber-200 hover:border-amber-400'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-slate-900">{product.nameAr}</span>
                      <span className="font-mono text-[11px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-bold">
                        {product.sku}
                      </span>
                      {status === 'out_of_stock' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white">
                          نفد الرصيد 0
                        </span>
                      )}
                      {status === 'critical' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                          حرج جداً
                        </span>
                      )}
                      {status === 'near_limit' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800">
                          عند حد الطلب
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 flex items-center gap-4 flex-wrap">
                      <span>سعر الشراء: <strong className="font-mono text-slate-800">{product.costPrice} ر.س</strong></span>
                      <span>سعر البيع: <strong className="font-mono text-slate-800">{product.salePrice} ر.س</strong></span>
                      <span>المستودع الرئيسي: <strong>المستودع المركزي</strong></span>
                    </div>
                  </div>

                  {/* العدادات والإجراءات */}
                  <div className="flex items-center gap-4 self-end md:self-center">
                    <div className="text-right pl-3 border-l border-slate-200">
                      <div className="text-xs text-slate-500">الرصيد المتبقي:</div>
                      <div className="text-base font-black font-mono text-rose-700">
                        {stock} / <span className="text-xs text-slate-500 font-normal">حد الطلب: {minStock}</span>
                      </div>
                      <div className="text-[10px] text-rose-600 font-bold">
                        العجز: {deficit > 0 ? `${deficit} قطعة` : 'لا يوجد'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {onCreatePurchaseOrder && (
                        <button
                          type="button"
                          onClick={() => {
                            onCreatePurchaseOrder(product);
                            onClose();
                          }}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>أمر شراء</span>
                        </button>
                      )}

                      {onOpenInventoryAdjustment && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenInventoryAdjustment(product);
                            onClose();
                          }}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          <span>تسوية مخزون</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* تذييل النافذة */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            إجمالي التنبيهات المرصودة: <strong className="text-slate-900 font-bold">{lowStockItems.length} صنف</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl font-bold cursor-pointer transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
