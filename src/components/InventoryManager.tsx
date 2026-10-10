/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Product,
  Warehouse,
  Inventory,
  InventoryMovement,
  InventoryMovementType,
} from '../types';
import { getCollectionDocs, getInventoryMovements, sortWarehouses } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { InventoryMovementModal } from './InventoryMovementModal';
import { WarehousesManagerModal } from './inventory/WarehousesManagerModal';
import {
  Boxes,
  Search,
  Plus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Warehouse as WarehouseIcon,
  RefreshCw,
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw,
  Trash2,
  FileText,
  Filter,
  Layers,
  MapPin,
  TrendingDown,
  History,
  Settings2,
} from 'lucide-react';

interface InventoryManagerProps {
  products: Product[];
  warehouses: Warehouse[];
  onRefresh: () => void;
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  products,
  warehouses,
  onRefresh,
}) => {
  const { currentUser, hasPermission } = useAuth();

  const [inventoryList, setInventoryList] = useState<Inventory[]>([]);
  const [movementsList, setMovementsList] = useState<InventoryMovement[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'low' | 'out' | 'sufficient'>('all');
  const [activeSubTab, setActiveSubTab] = useState<'balances' | 'movements'>('balances');
  const [searchTerm, setSearchTerm] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  // Modal State
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isWarehousesModalOpen, setIsWarehousesModalOpen] = useState(false);
  const [targetProductId, setTargetProductId] = useState<string | undefined>(undefined);

  const canAdjustInventory = hasPermission('inventory:adjust') || hasPermission('inventory:view');

  // ضمان فرز المستودعات دائماً بنفس الترتيب المحدد في إدارة المستودعات
  const sortedWarehouses = useMemo(() => sortWarehouses(warehouses), [warehouses]);

  const loadInventoryData = async () => {
    try {
      setIsLoading(true);
      const [inv, movs] = await Promise.all([
        getCollectionDocs<Inventory>('inventory', 200).catch(() => []),
        getInventoryMovements(undefined, 100).catch(() => []),
      ]);
      setInventoryList(inv);
      setMovementsList(movs);
    } catch (error) {
      console.error('فشل تحميل بيانات المخزون:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInventoryData();
  }, []);

  // دمج بيانات المنتجات مع المخزون
  const enrichedProducts = useMemo(() => {
    return products.map((prod) => {
      // البحث عن المخزون التابع للمنتج والمستودع المحدد
      const prodInvs = inventoryList.filter((inv) => inv.productId === prod.id);
      
      let totalOnHand = 0;
      let totalReserved = 0;
      let totalAvailable = 0;

      if (selectedWarehouseId === 'all') {
        totalOnHand = prodInvs.reduce((sum, i) => sum + (i.quantityOnHand || 0), 0);
        totalReserved = prodInvs.reduce((sum, i) => sum + (i.reservedQuantity || 0), 0);
        totalAvailable = prodInvs.reduce((sum, i) => sum + (i.availableQuantity || 0), 0);
      } else {
        const found = prodInvs.find((i) => i.warehouseId === selectedWarehouseId);
        totalOnHand = found ? found.quantityOnHand : 0;
        totalReserved = found ? found.reservedQuantity : 0;
        totalAvailable = found ? found.availableQuantity : 0;
      }

      // تحديد الحالة
      let status: 'out' | 'low' | 'sufficient' = 'sufficient';
      if (totalOnHand <= 0) {
        status = 'out';
      } else if (totalOnHand <= (prod.minStockLevel || 10)) {
        status = 'low';
      }

      return {
        ...prod,
        quantityOnHand: totalOnHand,
        reservedQuantity: totalReserved,
        availableQuantity: totalAvailable,
        stockStatus: status,
      };
    });
  }, [products, inventoryList, selectedWarehouseId]);

  // إحصائيات التنبيهات
  const totalItemsCount = enrichedProducts.length;
  const outOfStockCount = enrichedProducts.filter((p) => p.stockStatus === 'out').length;
  const lowStockCount = enrichedProducts.filter((p) => p.stockStatus === 'low').length;
  const sufficientStockCount = enrichedProducts.filter((p) => p.stockStatus === 'sufficient').length;

  // التصفية والبحث
  const filteredProducts = useMemo(() => {
    return enrichedProducts.filter((p) => {
      const matchesSearch =
        p.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.barcode?.includes(searchTerm);

      const matchesStatus =
        selectedFilter === 'all' ? true : p.stockStatus === selectedFilter;

      return matchesSearch && matchesStatus;
    });
  }, [enrichedProducts, searchTerm, selectedFilter]);

  // تصفية سجل الحركات
  const filteredMovements = useMemo(() => {
    return movementsList.filter((m) => {
      const prod = products.find((p) => p.id === m.productId);
      const matchesSearch =
        !searchTerm ||
        (prod?.nameAr.toLowerCase().includes(searchTerm.toLowerCase())) ||
        m.referenceId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.notes?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType =
        movementTypeFilter === 'all' || m.movementType === movementTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [movementsList, products, searchTerm, movementTypeFilter]);

  const handleOpenMovementModal = (productId?: string) => {
    setTargetProductId(productId);
    setIsMovementModalOpen(true);
  };

  const getMovementBadge = (type: InventoryMovementType) => {
    switch (type) {
      case 'purchase':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
            <ArrowDownRight className="w-3.5 h-3.5" /> توريد / شراء
          </span>
        );
      case 'sale':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
            <ArrowUpRight className="w-3.5 h-3.5" /> صرف / بيع
          </span>
        );
      case 'adjustment':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900">
            <RefreshCw className="w-3.5 h-3.5" /> تسوية جرد
          </span>
        );
      case 'damage':
      case 'waste':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
            <Trash2 className="w-3.5 h-3.5" /> إثبات هالك / تالف
          </span>
        );
      case 'return':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800">
            <RotateCcw className="w-3.5 h-3.5" /> مرتجع مبيعات
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800">
            {type}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* بطاقات التنبيهات الذكية والرقمية */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => setSelectedFilter('all')}
          className={`p-4 rounded-xl border text-right transition-all cursor-pointer ${
            selectedFilter === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold">إجمالي الأصناف المدارة</span>
            <Boxes className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono">{totalItemsCount}</div>
          <div className="text-[11px] opacity-70 mt-0.5">في جميع المستودعات</div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedFilter('low')}
          className={`p-4 rounded-xl border text-right transition-all cursor-pointer ${
            selectedFilter === 'low'
              ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
              : 'bg-white text-slate-800 border-amber-200 hover:bg-amber-50/50'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold">تنبيه: أوشك على النفاد</span>
            <AlertTriangle className={`w-4 h-4 ${selectedFilter === 'low' ? 'text-white' : 'text-amber-500'}`} />
          </div>
          <div className="text-2xl font-black font-mono text-amber-600 group-hover:text-amber-700">
            <span className={selectedFilter === 'low' ? 'text-white' : ''}>{lowStockCount}</span>
          </div>
          <div className={`text-[11px] mt-0.5 ${selectedFilter === 'low' ? 'text-amber-100' : 'text-amber-600 font-medium'}`}>
            أقل من الحد الأدنى للطلب
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedFilter('out')}
          className={`p-4 rounded-xl border text-right transition-all cursor-pointer ${
            selectedFilter === 'out'
              ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
              : 'bg-white text-slate-800 border-rose-200 hover:bg-rose-50/50'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold">تنبيه: نفد من المخزون</span>
            <XCircle className={`w-4 h-4 ${selectedFilter === 'out' ? 'text-white' : 'text-rose-500'}`} />
          </div>
          <div className="text-2xl font-black font-mono text-rose-600">
            <span className={selectedFilter === 'out' ? 'text-white' : ''}>{outOfStockCount}</span>
          </div>
          <div className={`text-[11px] mt-0.5 ${selectedFilter === 'out' ? 'text-rose-100' : 'text-rose-600 font-medium'}`}>
            الرصيد الفعلي = صفر
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedFilter('sufficient')}
          className={`p-4 rounded-xl border text-right transition-all cursor-pointer ${
            selectedFilter === 'sufficient'
              ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
              : 'bg-white text-slate-800 border-emerald-200 hover:bg-emerald-50/50'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold">رصيد آمن ومكتمل</span>
            <CheckCircle2 className={`w-4 h-4 ${selectedFilter === 'sufficient' ? 'text-white' : 'text-emerald-500'}`} />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600">
            <span className={selectedFilter === 'sufficient' ? 'text-white' : ''}>{sufficientStockCount}</span>
          </div>
          <div className={`text-[11px] mt-0.5 ${selectedFilter === 'sufficient' ? 'text-emerald-100' : 'text-emerald-600 font-medium'}`}>
            ضمن المستويات المثالية
          </div>
        </button>
      </div>

      {/* لوحة التحكم والتبويب الفرعي */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Boxes className="w-5 h-5 text-amber-600" />
              <h3 className="text-base font-bold text-slate-900">
                إدارة المخزون والمستودعات والتسويات (Real-Time Firestore)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              متابعة الأرصدة المتوفرة، حركات التوريد والصرف، تسويات الجرد، وإثبات الهالك والتالف
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => loadInventoryData()}
              className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>تحديث الأرصدة</span>
            </button>

            {canAdjustInventory && (
              <button
                type="button"
                onClick={() => handleOpenMovementModal()}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4 text-amber-400" />
                <span>تسجيل حركة مخزون جديدة</span>
              </button>
            )}
          </div>
        </div>

        {/* أشرطة التبديل والفلترة */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* التبديل بين الأرصدة وسجل الحركات */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveSubTab('balances')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'balances'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-amber-600" />
              <span>أرصدة الأصناف بالمستودع</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('movements')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'movements'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5 text-indigo-600" />
              <span>سجل حركات المخزون التاريخي ({movementsList.length})</span>
            </button>
          </div>

          {/* محدد المستودع المستهدف وزر إدارة المستودعات */}
          <div className="flex items-center gap-2">
            <WarehouseIcon className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              aria-label="تحديد المستودع المستهدف"
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-amber-500 cursor-pointer font-bold text-slate-800"
            >
              <option value="all">جميع المستودعات (رصيد تراكمي)</option>
              {sortedWarehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.nameAr} ({w.code}) {w.isPrimary ? '★' : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setIsWarehousesModalOpen(true)}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title="إدارة وتخصيص المستودعات"
            >
              <Settings2 className="w-3.5 h-3.5 text-amber-600" />
              <span>إدارة المستودعات</span>
            </button>
          </div>
        </div>

        {/* البحث وحقل التصفية */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="البحث السريع بالاسم أو الباركود أو رمز SKU أو رقم المرجع..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-4 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-amber-500 transition-all"
            />
          </div>

          {activeSubTab === 'movements' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={movementTypeFilter}
                onChange={(e) => setMovementTypeFilter(e.target.value)}
                aria-label="تصفية حسب نوع الحركة"
                className="w-full sm:w-48 px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white cursor-pointer"
              >
                <option value="all">جميع أنواع الحركات</option>
                <option value="purchase">توريد / شراء (+)</option>
                <option value="sale">صرف / مبيعات (-)</option>
                <option value="adjustment">تسوية جرد</option>
                <option value="waste">إثبات هالك / تالف (-)</option>
                <option value="return">مرتجع مبيعات (+)</option>
              </select>
            </div>
          )}
        </div>

        {/* التبويب الفرعي 1: جدول أرصدة الأصناف */}
        {activeSubTab === 'balances' && (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">الصورة</th>
                  <th className="py-3 px-4">الصنف والمواصفات</th>
                  <th className="py-3 px-4">SKU / الباركود</th>
                  <th className="py-3 px-4">موقع التخزين</th>
                  <th className="py-3 px-4 text-center">حد الطلب (الأدنى)</th>
                  <th className="py-3 px-4 text-center font-bold text-slate-900">الرصيد الإجمالي</th>
                  <th className="py-3 px-4 text-center">المحجوز</th>
                  <th className="py-3 px-4 text-center font-bold text-emerald-800 bg-emerald-50/30">المتاح للبيع</th>
                  <th className="py-3 px-4 text-center">حالة المخزون</th>
                  <th className="py-3 px-4 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      لا توجد أصناف تطابق معايير البحث والفلترة الحالية.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((prod) => (
                    <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        {prod.imageUrl ? (
                          <img
                            src={prod.imageUrl}
                            alt={prod.nameAr}
                            className="w-10 h-10 object-cover rounded-lg border border-slate-200 shadow-2xs"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                            <Boxes className="w-4 h-4" />
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-bold text-slate-900 leading-snug">{prod.nameAr}</div>
                        {prod.specifications && (
                          <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                            {prod.specifications}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px]">
                        <div className="font-bold text-slate-800">{prod.sku}</div>
                        <div className="text-slate-400 text-[10px]">{prod.barcode}</div>
                      </td>

                      <td className="py-3 px-4">
                        {prod.storageLocation ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                            <MapPin className="w-3 h-3 text-amber-500" />
                            <span>{prod.storageLocation}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">غير محدد</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-semibold text-slate-600">
                        {prod.minStockLevel}
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-black text-sm text-slate-900">
                        {prod.quantityOnHand}
                      </td>

                      <td className="py-3 px-4 text-center font-mono text-slate-500">
                        {prod.reservedQuantity}
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-black text-sm text-emerald-700 bg-emerald-50/30">
                        {prod.availableQuantity}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {prod.stockStatus === 'out' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <XCircle className="w-3 h-3" /> نفد من المخزون
                          </span>
                        ) : prod.stockStatus === 'low' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <AlertTriangle className="w-3 h-3" /> منخفض المخزون
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> متوفر
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {canAdjustInventory && (
                          <button
                            type="button"
                            onClick={() => handleOpenMovementModal(prod.id)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            حركة مخزون
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* التبويب الفرعي 2: سجل حركات المخزون الحي */}
        {activeSubTab === 'movements' && (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">التاريخ والوقت</th>
                  <th className="py-3 px-4">الصنف المستهدف</th>
                  <th className="py-3 px-4">نوع الحركة</th>
                  <th className="py-3 px-4">رقم المرجع</th>
                  <th className="py-3 px-4 text-center">الرصيد السابق</th>
                  <th className="py-3 px-4 text-center">الكمية المسجلة</th>
                  <th className="py-3 px-4 text-center">الرصيد الجديد</th>
                  <th className="py-3 px-4 text-center">التكلفة</th>
                  <th className="py-3 px-4">الموظف المسؤول</th>
                  <th className="py-3 px-4">البيان والملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      لا توجد حركات مخزنية مسجلة تطابق التصفية الحالية.
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((mov) => {
                    const prod = products.find((p) => p.id === mov.productId);
                    const isPositive = mov.quantity > 0;
                    return (
                      <tr key={mov.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(mov.createdAt).toLocaleString('ar-SA')}
                        </td>

                        <td className="py-3 px-4 font-bold text-slate-900 max-w-xs">
                          <div>{prod?.nameAr || mov.productId}</div>
                          {prod && (
                            <div className="font-mono text-[10px] text-slate-400">{prod.sku}</div>
                          )}
                        </td>

                        <td className="py-3 px-4">{getMovementBadge(mov.movementType)}</td>

                        <td className="py-3 px-4 font-mono text-[11px] font-bold text-slate-700">
                          {mov.referenceId}
                        </td>

                        <td className="py-3 px-4 text-center font-mono text-slate-500">
                          {mov.previousQty}
                        </td>

                        <td className="py-3 px-4 text-center font-mono font-bold text-sm">
                          <span
                            className={`px-2 py-0.5 rounded-md ${
                              isPositive
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isPositive ? `+${mov.quantity}` : mov.quantity}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center font-mono font-black text-sm text-slate-900">
                          {mov.newQty}
                        </td>

                        <td className="py-3 px-4 text-center font-mono text-slate-600">
                          {mov.unitCost > 0 ? `${mov.unitCost} ر.س` : '-'}
                        </td>

                        <td className="py-3 px-4 text-slate-700 text-[11px]">
                          {mov.createdBy}
                        </td>

                        <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                          {mov.notes || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* نافذة تسجيل الحركة المخزنية */}
      <InventoryMovementModal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        products={products}
        warehouses={warehouses}
        initialProductId={targetProductId}
        onMovementRecorded={() => {
          loadInventoryData();
          onRefresh();
        }}
      />

      {/* نافذة إدارة وتخصيص المستودعات */}
      <WarehousesManagerModal
        isOpen={isWarehousesModalOpen}
        onClose={() => setIsWarehousesModalOpen(false)}
        warehouses={warehouses}
        onWarehousesUpdated={() => {
          onRefresh();
          loadInventoryData();
        }}
      />
    </div>
  );
};
