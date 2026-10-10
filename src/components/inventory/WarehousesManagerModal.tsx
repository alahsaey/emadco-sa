/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Warehouse } from '../../types';
import { createWarehouse, updateWarehouse, deleteWarehouse, reorderWarehouses, sortWarehouses } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import {
  X,
  Warehouse as WarehouseIcon,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Building2,
  MapPin,
  User,
  ShieldCheck,
  RotateCcw,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  GripVertical,
} from 'lucide-react';

interface WarehousesManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
  onWarehousesUpdated: () => void;
  onSelectWarehouse?: (warehouseId: string) => void;
}

export const WarehousesManagerModal: React.FC<WarehousesManagerModalProps> = ({
  isOpen,
  onClose,
  warehouses,
  onWarehousesUpdated,
  onSelectWarehouse,
}) => {
  const { currentUser } = useAuth();
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // حقول النموذج
  const [nameAr, setNameAr] = useState('');
  const [code, setCode] = useState('');
  const [location, setLocation] = useState('');
  const [managerName, setManagerName] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // حالة ترتيب المستودعات
  const [localWarehouses, setLocalWarehouses] = useState<Warehouse[]>([]);
  const [isReorderingMode, setIsReorderingMode] = useState<boolean>(false);
  const [isSavingOrder, setIsSavingOrder] = useState<boolean>(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // مزامنة وترتيب المستودعات محلياً
  useEffect(() => {
    setLocalWarehouses(sortWarehouses(warehouses));
  }, [warehouses]);

  // دالة تحريك المستودع لأعلى أو لأسفل
  const handleMoveWarehouse = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= localWarehouses.length) return;

    const newList = [...localWarehouses];
    const [movedItem] = newList.splice(index, 1);
    newList.splice(targetIndex, 0, movedItem);

    // تحديث فوري بالواجهة
    setLocalWarehouses(newList);
    setIsSavingOrder(true);
    setErrorMsg(null);

    try {
      await reorderWarehouses(newList, currentUser?.fullName || 'المدير');
      setSuccessMsg('تم حفظ وتحديث ترتيب المستودعات بنجاح.');
      onWarehousesUpdated();
    } catch (err: any) {
      setErrorMsg(err?.message || 'تعذر حفظ الترتيب الجديد للمستودعات.');
    } finally {
      setIsSavingOrder(false);
    }
  };

  // معالجات السحب والإفلات
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newList = [...localWarehouses];
    const [draggedItem] = newList.splice(draggedIndex, 1);
    newList.splice(dropIndex, 0, draggedItem);

    setDraggedIndex(null);
    setLocalWarehouses(newList);
    setIsSavingOrder(true);
    setErrorMsg(null);

    try {
      await reorderWarehouses(newList, currentUser?.fullName || 'المدير');
      setSuccessMsg('تم حفظ وتحديث ترتيب المستودعات بنجاح.');
      onWarehousesUpdated();
    } catch (err: any) {
      setErrorMsg(err?.message || 'تعذر حفظ الترتيب الجديد للمستودعات.');
    } finally {
      setIsSavingOrder(false);
    }
  };

  // حالة حذف المستودع
  const [warehouseToDelete, setWarehouseToDelete] = useState<Warehouse | null>(null);
  const [isDeletingWarehouse, setIsDeletingWarehouse] = useState(false);

  if (!isOpen) return null;

  const handleOpenAdd = () => {
    setEditingWarehouse(null);
    setNameAr('');
    setCode(`WH-0${warehouses.length + 1}`);
    setLocation('');
    setManagerName(currentUser?.fullName || '');
    setIsPrimary(warehouses.length === 0);
    setIsActive(true);
    setIsAddingNew(true);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleOpenEdit = (wh: Warehouse) => {
    setEditingWarehouse(wh);
    setNameAr(wh.nameAr);
    setCode(wh.code || '');
    setLocation(wh.location || '');
    setManagerName(wh.managerName || '');
    setIsPrimary(wh.isPrimary);
    setIsActive(wh.isActive !== false);
    setIsAddingNew(true);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!nameAr.trim()) {
      setErrorMsg('يرجى كتابة اسم المستودع بالعربية (مثلاً: مستودع الفرع الرئيسي، هنجر 2، مستودع مواد البناء).');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingWarehouse) {
        await updateWarehouse(
          editingWarehouse.id,
          {
            nameAr: nameAr.trim(),
            code: code.trim(),
            location: location.trim(),
            managerName: managerName.trim(),
            isPrimary,
            isActive,
          },
          currentUser?.fullName || 'المدير'
        );
        setSuccessMsg(`تم تحديث بيانات المستودع (${nameAr}) بنجاح.`);
      } else {
        const created = await createWarehouse(
          {
            nameAr: nameAr.trim(),
            code: code.trim() || `WH-${Math.floor(10 + Math.random() * 90)}`,
            branchId: 'branch_main',
            location: location.trim(),
            managerName: managerName.trim(),
            isPrimary,
            isActive,
          },
          currentUser?.fullName || 'مالك المنشأة'
        );
        setSuccessMsg(`تمت إضافة المستودع (${created.nameAr}) بنجاح.`);
        if (onSelectWarehouse) {
          onSelectWarehouse(created.id);
        }
      }

      onWarehousesUpdated();
      setIsAddingNew(false);
      setEditingWarehouse(null);
    } catch (err: any) {
      setErrorMsg(err?.message || 'حدث خطأ أثناء حفظ المستودع.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (wh: Warehouse) => {
    if (warehouses.length <= 1) {
      setErrorMsg('لا يمكن حذف المستودع الوحيد في النظام. يجب توفر مستودع رئيسي واحد على الأقل.');
      return;
    }
    setErrorMsg(null);
    setWarehouseToDelete(wh);
  };

  const handleConfirmDeleteWarehouse = async () => {
    if (!warehouseToDelete) return;
    try {
      setIsDeletingWarehouse(true);
      await deleteWarehouse(warehouseToDelete.id, warehouseToDelete.nameAr, currentUser?.fullName || 'المدير');
      setSuccessMsg(`تم حذف المستودع (${warehouseToDelete.nameAr}) بنجاح.`);
      setWarehouseToDelete(null);
      onWarehousesUpdated();
    } catch (err: any) {
      setErrorMsg(err?.message || 'تعذر حذف المستودع.');
    } finally {
      setIsDeletingWarehouse(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* رأس النافذة */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <WarehouseIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">إدارة وتخصيص مستودعات المنشأة</h3>
              <p className="text-[11px] text-slate-500">
                حدد مسميات ومواقع مستودعاتك الحقيقية لتوزيع وحصر المخزون بدقة
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

        {/* جسم النافذة */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* نموذج الإضافة أو التعديل */}
          {isAddingNew ? (
            <form onSubmit={handleSave} className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <WarehouseIcon className="w-4 h-4 text-emerald-600" />
                  <span>{editingWarehouse ? 'تعديل بيانات المستودع' : 'إضافة مستودع مخصص جديد'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="text-slate-500 hover:text-slate-800 text-[11px] font-bold"
                >
                  إلغاء
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    اسم المستودع بالعربية <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: المستودع المركزي، هنجر 1، مخزن المعرض"
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">كود المستودع (رمز تعريفي)</label>
                  <input
                    type="text"
                    placeholder="مثال: WH-01 أو MAIN-01"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono uppercase focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">موقع / عنوان المستودع</label>
                  <input
                    type="text"
                    placeholder="مثال: المنطقة الصناعية - بوابة 4"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">أمين المستودع / المسؤول</label>
                  <input
                    type="text"
                    placeholder="اسم الموظف المسؤول عن المستودع"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPrimary}
                    onChange={(e) => setIsPrimary(e.target.checked)}
                    className="rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-700 font-bold text-[11px]">تعيين كمستودع رئيسي افتراضي للمبيعات</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-700 font-bold text-[11px]">مستودع نشط ويعمل</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-emerald-100">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  {isSubmitting ? (
                    <span>جاري الحفظ...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{editingWarehouse ? 'حفظ التعديلات' : 'إضافة المستودع'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap justify-between items-center gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 text-xs">قائمة المستودعات الحالية ({localWarehouses.length})</span>
                  {isSavingOrder && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold animate-pulse border border-amber-300">
                      جاري حفظ الترتيب...
                    </span>
                  )}
                  {isReorderingMode && !isSavingOrder && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold border border-emerald-300">
                      نمط الترتيب مفعّل
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500">
                  استخدم أزرار التحريك لأعلى ولأسفل أو اسحب المستودع لتغيير ترتيب ظهوره بالنظام.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsReorderingMode(!isReorderingMode)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
                    isReorderingMode
                      ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                  title="تفعيل أو إنهاء أزرار ترتيب المستودعات"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>{isReorderingMode ? 'إخفاء أزرار الترتيب' : 'تعديل الترتيب'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer text-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ إضافة مستودع جديد</span>
                </button>
              </div>
            </div>
          )}

          {/* بطاقات المستودعات مع إمكانية إعادة الترتيب */}
          <div className="space-y-2.5">
            {localWarehouses.map((wh, idx) => (
              <div
                key={wh.id}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, idx)}
                className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none ${
                  draggedIndex === idx ? 'opacity-40 border-dashed border-emerald-500 scale-[0.98]' : ''
                } ${
                  wh.isPrimary
                    ? 'bg-emerald-50/40 border-emerald-300'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* أزرار ومقابض الترتيب */}
                  <div className="flex items-center gap-1 shrink-0">
                    <div
                      className="p-1 text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing rounded"
                      title="اسحب لتغيير الترتيب"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        disabled={idx === 0 || isSavingOrder}
                        onClick={() => handleMoveWarehouse(idx, 'up')}
                        className="w-6 h-6 rounded bg-slate-100 hover:bg-emerald-100 disabled:opacity-25 disabled:hover:bg-slate-100 text-slate-700 hover:text-emerald-800 flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed"
                        title="تحريك المستودع لأعلى"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === localWarehouses.length - 1 || isSavingOrder}
                        onClick={() => handleMoveWarehouse(idx, 'down')}
                        className="w-6 h-6 rounded bg-slate-100 hover:bg-emerald-100 disabled:opacity-25 disabled:hover:bg-slate-100 text-slate-700 hover:text-emerald-800 flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed"
                        title="تحريك المستودع لأسفل"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* شارة رقم الترتيب */}
                    <span
                      className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 font-mono font-bold text-[10px] flex items-center justify-center border border-slate-200"
                      title={`الترتيب الحالي: #${idx + 1}`}
                    >
                      {idx + 1}
                    </span>
                  </div>

                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      wh.isPrimary ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <WarehouseIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">{wh.nameAr}</span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono text-[10px] font-bold">
                        {wh.code}
                      </span>
                      {wh.isPrimary && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          المستودع الرئيسي
                        </span>
                      )}
                      {!wh.isActive && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[10px] font-bold">
                          غير نشط
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 mt-1">
                      {wh.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{wh.location}</span>
                        </span>
                      )}
                      {wh.managerName && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>المسؤول: {wh.managerName}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {onSelectWarehouse && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectWarehouse(wh.id);
                        onClose();
                      }}
                      className="px-2.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-[11px] font-bold cursor-pointer"
                    >
                      اختيار
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(wh)}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                    title="تعديل المستودع"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(wh)}
                    className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                    title="حذف المستودع"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* تذييل النافذة */}
        <div className="p-4 border-t border-slate-200 flex justify-end bg-slate-50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* تأكيد حذف المستودع */}
      <ConfirmDeleteModal
        isOpen={!!warehouseToDelete}
        onClose={() => {
          if (!isDeletingWarehouse) setWarehouseToDelete(null);
        }}
        onConfirm={handleConfirmDeleteWarehouse}
        title="تأكيد حذف المستودع"
        itemTypeLabel="إدارة المستودعات والمخازن"
        itemName={warehouseToDelete?.nameAr}
        message={`هل أنت متأكد من رغبتك في حذف المستودع "${warehouseToDelete?.nameAr}" (${warehouseToDelete?.code})؟`}
        warningNote={
          warehouseToDelete?.isPrimary
            ? 'تنبيه: هذا هو المستودع المعين كمستودع رئيسي، يرجى تعيين مستودع رئيسي آخر بعد الحذف.'
            : 'سيتم حذف سجل المستودع نهائياً من النظام.'
        }
        isProcessing={isDeletingWarehouse}
        confirmButtonText="نعم، حذف المستودع"
      />
    </div>
  );
};
