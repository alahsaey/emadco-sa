/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Product, Warehouse, InventoryMovementType } from '../types';
import { recordInventoryMovement, getProductInventory, sortWarehouses } from '../services/db';
import { useAuth } from '../context/AuthContext';
import {
  X,
  Boxes,
  PlusCircle,
  MinusCircle,
  AlertTriangle,
  RotateCcw,
  Trash2,
  CheckCircle2,
  RefreshCw,
  ArrowDownRight,
  ArrowUpRight,
  ClipboardList,
} from 'lucide-react';

interface InventoryMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  warehouses: Warehouse[];
  initialProductId?: string;
  onMovementRecorded: () => void;
}

export const InventoryMovementModal: React.FC<InventoryMovementModalProps> = ({
  isOpen,
  onClose,
  products,
  warehouses,
  initialProductId,
  onMovementRecorded,
}) => {
  const { currentUser } = useAuth();

  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [movementType, setMovementType] = useState<InventoryMovementType>('purchase');
  const [quantity, setQuantity] = useState<number>(10);
  const [unitCost, setUnitCost] = useState<number>(0);
  const [referenceId, setReferenceId] = useState('');
  const [notes, setNotes] = useState('');
  const [currentQty, setCurrentQty] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const pid = initialProductId || (products[0]?.id ?? '');
      setSelectedProductId(pid);
      const sorted = sortWarehouses(warehouses);
      const primary = sorted.find((w) => w.isPrimary) || sorted[0];
      const wid = primary ? primary.id : (warehouses[0]?.id ?? 'wh_main');
      setSelectedWarehouseId(wid);
      setMovementType('purchase');
      setQuantity(10);
      setReferenceId(`MOV-${Date.now().toString().slice(-6)}`);
      setNotes('');
      setErrorMsg(null);
    }
  }, [isOpen, initialProductId, products, warehouses]);

  // تحديث سعر التكلفة والرصيد الحالي عند تغيير الصنف أو المستودع
  useEffect(() => {
    const prod = products.find((p) => p.id === selectedProductId);
    if (prod) {
      setUnitCost(prod.costPrice);
    }

    if (selectedProductId) {
      getProductInventory(selectedProductId).then((invList) => {
        const found = invList.find((i) => i.warehouseId === selectedWarehouseId);
        setCurrentQty(found ? found.quantityOnHand : 0);
      });
    }
  }, [selectedProductId, selectedWarehouseId, products]);

  if (!isOpen) return null;

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // حساب النتيجة المتوقعة للرصيد
  let expectedNewQty = currentQty;
  if (['purchase', 'return', 'transfer_in'].includes(movementType)) {
    expectedNewQty = currentQty + Number(quantity || 0);
  } else if (['sale', 'damage', 'waste', 'transfer_out'].includes(movementType)) {
    expectedNewQty = Math.max(0, currentQty - Number(quantity || 0));
  } else if (movementType === 'adjustment') {
    expectedNewQty = Math.max(0, Number(quantity || 0));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedProductId) {
      setErrorMsg('يرجى اختيار الصنف.');
      return;
    }
    if (!selectedWarehouseId) {
      setErrorMsg('يرجى اختيار المستودع.');
      return;
    }
    if (quantity <= 0 && movementType !== 'adjustment') {
      setErrorMsg('الكمية يجب أن تكون أكبر من الصفر.');
      return;
    }

    setIsSubmitting(true);
    try {
      await recordInventoryMovement({
        productId: selectedProductId,
        productName: selectedProduct?.nameAr || selectedProductId,
        warehouseId: selectedWarehouseId,
        movementType,
        quantity: Number(quantity),
        unitCost: Number(unitCost) || 0,
        referenceId: referenceId.trim() || `REF-${Date.now().toString().slice(-6)}`,
        notes: notes.trim() || undefined,
        actorName: currentUser?.fullName || 'أمين المخزون',
      });

      onMovementRecorded();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'فشل تسجيل حركة المخزون.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[92vh] flex flex-col">
        {/* رأس النافذة */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">تسجيل حركة مخزنية جديدة</h3>
              <p className="text-[11px] text-slate-500">
                إثبات التوريد، الصرف، الهالك، المرتجع أو تسوية الجرد الفعلي
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

        {/* النموذج */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* نوع الحركة */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">نوع الحركة المخزنية</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMovementType('purchase')}
                className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col gap-1 ${
                  movementType === 'purchase'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                  <ArrowDownRight className="w-4 h-4" />
                  <span>توريد / شراء (+)</span>
                </span>
                <span className="text-[10px] text-slate-500 font-normal">استلام بضائع من مورد</span>
              </button>

              <button
                type="button"
                onClick={() => setMovementType('sale')}
                className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col gap-1 ${
                  movementType === 'sale'
                    ? 'border-blue-500 bg-blue-50 text-blue-950 font-bold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span className="flex items-center gap-1.5 text-blue-600 font-bold">
                  <ArrowUpRight className="w-4 h-4" />
                  <span>صرف / مبيعات (-)</span>
                </span>
                <span className="text-[10px] text-slate-500 font-normal">صرف طلبيات المقاولين</span>
              </button>

              <button
                type="button"
                onClick={() => setMovementType('adjustment')}
                className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col gap-1 ${
                  movementType === 'adjustment'
                    ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span className="flex items-center gap-1.5 text-amber-600 font-bold">
                  <ClipboardList className="w-4 h-4" />
                  <span>تسوية جرد (تصحيح)</span>
                </span>
                <span className="text-[10px] text-slate-500 font-normal">إثبات الرصيد الفعلي</span>
              </button>

              <button
                type="button"
                onClick={() => setMovementType('waste')}
                className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col gap-1 ${
                  movementType === 'waste'
                    ? 'border-rose-500 bg-rose-50 text-rose-950 font-bold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span className="flex items-center gap-1.5 text-rose-600 font-bold">
                  <Trash2 className="w-4 h-4" />
                  <span>إثبات هالك / تالف (-)</span>
                </span>
                <span className="text-[10px] text-slate-500 font-normal">بضاعة متضررة أثناء التخزين</span>
              </button>

              <button
                type="button"
                onClick={() => setMovementType('return')}
                className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col gap-1 ${
                  movementType === 'return'
                    ? 'border-purple-500 bg-purple-50 text-purple-950 font-bold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span className="flex items-center gap-1.5 text-purple-600 font-bold">
                  <RotateCcw className="w-4 h-4" />
                  <span>مرتجع مبيعات (+)</span>
                </span>
                <span className="text-[10px] text-slate-500 font-normal">إرجاع بضاعة صالحة للمخزن</span>
              </button>

              <button
                type="button"
                onClick={() => setMovementType('damage')}
                className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col gap-1 ${
                  movementType === 'damage'
                    ? 'border-orange-500 bg-orange-50 text-orange-950 font-bold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span className="flex items-center gap-1.5 text-orange-600 font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>تالف تصنيع / عيب مصنعي</span>
                </span>
                <span className="text-[10px] text-slate-500 font-normal">كالونات أو أقفال بها عيب</span>
              </button>
            </div>
          </div>

          {/* اختيار الصنف والمستودع */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                الصنف المستهدف <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameAr} ({p.sku})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                المستودع المستهدف <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                {sortWarehouses(warehouses).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.nameAr} ({w.code}) {w.isPrimary ? '★' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* بطاقة الرصيد الحالي والتأثير الحسابي */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-500 block">الرصيد الفعلي المسجل حالياً</span>
              <span className="text-lg font-black font-mono text-slate-900">
                {currentQty} <span className="text-xs font-normal">قطعة</span>
              </span>
            </div>
            <div className="text-center font-bold text-slate-400">←</div>
            <div className="text-left">
              <span className="text-[11px] text-slate-500 block">الرصيد المحسوب بعد الحركة</span>
              <span className="text-lg font-black font-mono text-emerald-700">
                {expectedNewQty} <span className="text-xs font-normal">قطعة</span>
              </span>
            </div>
          </div>

          {/* الكمية ورقم السند/المرجع */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {movementType === 'adjustment' ? 'الرصيد الفعلي الجديد (الجرد)' : 'الكمية المراد قيدها'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={movementType === 'adjustment' ? 0 : 1}
                required
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono font-bold text-sm focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">تكلفة الوحدة (ر.س)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={unitCost}
                onChange={(e) => setUnitCost(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">رقم المرجع / الفاتورة</label>
              <input
                type="text"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                placeholder="مثال: PO-9821 أو محضر جرد 04"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono"
              />
            </div>
          </div>

          {/* الملاحظات وسبب الحركة */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">بيان الحركة والملاحظات</label>
            <textarea
              rows={2}
              placeholder="مثال: استلام دفعة جديدة من مصنع أهرام، أو محضر إثبات كسر أثناء التحميل..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* أزرار الإجراء */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
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
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>جاري تسجيل الحركة وتحديث المستودع...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تأكيد وتسجيل الحركة في Firestore</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
