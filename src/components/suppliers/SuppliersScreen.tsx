/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Supplier } from '../../types';
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../../services/suppliers';
import { SupplierFormModal } from './SupplierFormModal';
import { SupplierStatementModal } from './SupplierStatementModal';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import {
  Truck,
  Plus,
  Search,
  Phone,
  Mail,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FileText,
  Package,
  RefreshCw,
  Building,
} from 'lucide-react';
import { SaudiRiyalSymbol } from '../common/SaudiRiyalSymbol';
import { formatSAR } from '../../utils/formatters';

interface SuppliersScreenProps {
  onRecordDisbursementClick?: (supplier: Supplier) => void;
  onCreatePurchaseClick?: (supplier: Supplier) => void;
}

export const SuppliersScreen: React.FC<SuppliersScreenProps> = ({
  onRecordDisbursementClick,
  onCreatePurchaseClick,
}) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [statementSupplierId, setStatementSupplierId] = useState<string | null>(null);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);

  // Deletion modal state
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [isDeletingSupplier, setIsDeletingSupplier] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await getSuppliers();
      setSuppliers(data);
    } catch (err: any) {
      setErrorMessage('تعذر تحميل بيانات الموردين.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrUpdate = async (formData: any) => {
    if (editingSupplier) {
      await updateSupplier(editingSupplier.id, formData);
      setSuccessMessage(`تم تحديث بيانات المورد "${formData.companyName}" بنجاح.`);
    } else {
      await createSupplier(formData);
      setSuccessMessage(`تمت إضافة المورد الجديد "${formData.companyName}" بنجاح.`);
    }
    await loadSuppliers();
  };

  const handleDeleteClick = (supplier: Supplier) => {
    setErrorMessage(null);
    setSupplierToDelete(supplier);
  };

  const handleConfirmDeleteSupplier = async () => {
    if (!supplierToDelete) return;
    try {
      setIsDeletingSupplier(true);
      await deleteSupplier(supplierToDelete.id, supplierToDelete.companyName, 'المدير', true);
      setSuccessMessage(`تم حذف المورد "${supplierToDelete.companyName}" بنجاح من النظام.`);
      setSupplierToDelete(null);
      await loadSuppliers();
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حذف المورد.');
    } finally {
      setIsDeletingSupplier(false);
    }
  };

  const handleOpenStatement = (supplier: Supplier) => {
    setStatementSupplierId(supplier.id);
    setIsStatementModalOpen(true);
  };

  const filteredSuppliers = suppliers.filter((s) => {
    return (
      s.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone.includes(searchQuery) ||
      (s.taxNumber && s.taxNumber.includes(searchQuery))
    );
  });

  const totalPayables = suppliers.reduce((sum, s) => sum + (s.balance || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">إدارة الموردين والشركات المصنعة</h1>
            <p className="text-xs text-slate-500">
              متابعة حسابات الموردين، أوامر التوريد، الأرصدة المستحقة وسندات الصرف
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadSuppliers}
            title="تحديث البيانات"
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingSupplier(null);
              setIsFormModalOpen(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة مورد جديد</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">إجمالي الموردين والمصانع</div>
            <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{suppliers.length}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">شركات توريد معتمدة</div>
          </div>
          <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
            <Building className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">إجمالي مستحقات الموردين (ذمم دائنة)</div>
            <div className="text-2xl font-black text-rose-600 mt-1 font-mono">
              {formatSAR(totalPayables)}
            </div>
            <div className="text-[10px] text-rose-500 font-semibold mt-0.5">مبالغ واجبة السداد للشركات</div>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <SaudiRiyalSymbol className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">موردون بحسابات مصفاة</div>
            <div className="text-2xl font-black text-emerald-600 mt-1 font-mono">
              {suppliers.filter((s) => (s.balance || 0) <= 0).length}
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">لا توجد عليهم التزامات متأخرة</div>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-900">×</button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-900">×</button>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بشركة المورد، الشخص المسؤول، الجوال، أو الرقم الضريبي..."
            className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold"
          />
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span>جاري تحميل الموردين...</span>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            لا توجد نتائج مطابقة لبحثك.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">اسم المورد / الشركة</th>
                  <th className="p-3.5">المسؤول والمندوب</th>
                  <th className="p-3.5">بيانات التواصل</th>
                  <th className="p-3.5">الرقم الضريبي</th>
                  <th className="p-3.5">العنوان</th>
                  <th className="p-3.5 text-slate-900">الرصيد المستحق (دائن)</th>
                  <th className="p-3.5 text-center">الإجراءات والعمليات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredSuppliers.map((supp) => {
                  const hasPayable = (supp.balance || 0) > 0.01;

                  return (
                    <tr key={supp.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* اسم الشركة */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 text-xs">{supp.companyName}</div>
                        {supp.notes && (
                          <div className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">
                            {supp.notes}
                          </div>
                        )}
                      </td>

                      {/* المسؤول */}
                      <td className="p-3.5 font-semibold text-slate-800">
                        {supp.contactPerson}
                      </td>

                      {/* التواصل */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-1 text-slate-800 font-mono font-bold" dir="ltr">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{supp.phone}</span>
                        </div>
                        {supp.email && (
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5" dir="ltr">
                            {supp.email}
                          </div>
                        )}
                      </td>

                      {/* الرقم الضريبي */}
                      <td className="p-3.5">
                        {supp.taxNumber ? (
                          <span className="font-mono text-slate-800 font-semibold" dir="ltr">
                            {supp.taxNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* العنوان */}
                      <td className="p-3.5 text-slate-500 text-[11px] truncate max-w-xs">
                        {supp.address || '-'}
                      </td>

                      {/* الرصيد */}
                      <td className="p-3.5 font-mono">
                        <div className={`font-black text-sm ${hasPayable ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {formatSAR(supp.balance || 0)}
                        </div>
                      </td>

                      {/* العمليات */}
                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* كشف حساب */}
                          <button
                            type="button"
                            onClick={() => handleOpenStatement(supp)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="كشف حساب المورد"
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                            <span>كشف حساب</span>
                          </button>

                          {/* صرف دفعة */}
                          {onRecordDisbursementClick && (
                            <button
                              type="button"
                              onClick={() => onRecordDisbursementClick(supp)}
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="تسجيل سند صرف للمورد"
                            >
                              <SaudiRiyalSymbol className="w-3.5 h-3.5 text-emerald-600" />
                              <span>صرف دفعة</span>
                            </button>
                          )}

                          {/* إنشاء فاتورة شراء */}
                          {onCreatePurchaseClick && (
                            <button
                              type="button"
                              onClick={() => onCreatePurchaseClick(supp)}
                              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="فاتورة شراء وتوريد جديدة"
                            >
                              <Package className="w-3.5 h-3.5 text-blue-600" />
                              <span>أمر شراء</span>
                            </button>
                          )}

                          {/* تعديل */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSupplier(supp);
                              setIsFormModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="تعديل"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* حذف */}
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(supp)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="حذف المورد"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <SupplierFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingSupplier(null);
        }}
        onSave={handleCreateOrUpdate}
        supplier={editingSupplier}
      />

      <SupplierStatementModal
        isOpen={isStatementModalOpen}
        onClose={() => {
          setIsStatementModalOpen(false);
          setStatementSupplierId(null);
        }}
        supplierId={statementSupplierId}
        onRecordPayment={onRecordDisbursementClick}
        onCreatePurchase={onCreatePurchaseClick}
      />

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!supplierToDelete}
        onClose={() => {
          if (!isDeletingSupplier) setSupplierToDelete(null);
        }}
        onConfirm={handleConfirmDeleteSupplier}
        title="تأكيد حذف المورد"
        itemTypeLabel="إدارة الموردين والتوريد"
        itemName={supplierToDelete?.companyName}
        message={`هل أنت متأكد من رغبتك في حذف المورد "${supplierToDelete?.companyName}" نهائياً من قاعدة البيانات السحابية؟`}
        warningNote={
          supplierToDelete && Math.abs(supplierToDelete.balance || 0) > 0.05
            ? `تنبيه: هذا المورد لديه رصيد مسجل بقيمة (${formatSAR(supplierToDelete.balance)}). سيتم إزالة حسابه من قائمة الموردين النشطين.`
            : 'سيتم حذف حساب المورد وسجل بياناته نهائياً من النظام.'
        }
        isProcessing={isDeletingSupplier}
        confirmButtonText="نعم، حذف المورد نهائياً"
      />

    </div>
  );
};
