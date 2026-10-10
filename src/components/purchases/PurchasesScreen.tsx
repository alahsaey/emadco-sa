/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Purchase, Supplier } from '../../types';
import { getPurchases } from '../../services/purchases';
import { CreatePurchaseModal } from './CreatePurchaseModal';
import { PurchaseDetailsModal } from './PurchaseDetailsModal';
import { SaudiRiyalSymbol } from '../common/SaudiRiyalSymbol';
import { formatSAR } from '../../utils/formatters';
import {
  Package,
  Plus,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  TrendingUp,
  RefreshCw,
  Truck,
  Building,
} from 'lucide-react';

interface PurchasesScreenProps {
  initialSupplier?: Supplier | null;
}

export const PurchasesScreen: React.FC<PurchasesScreenProps> = ({ initialSupplier }) => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'received' | 'draft'>('all');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  useEffect(() => {
    loadPurchases();
  }, []);

  useEffect(() => {
    if (initialSupplier) {
      setIsCreateModalOpen(true);
    }
  }, [initialSupplier]);

  const loadPurchases = async () => {
    setIsLoading(true);
    try {
      const data = await getPurchases();
      setPurchases(data);
    } catch (err) {
      console.error('خطأ في تحميل فواتير الشراء:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDetails = (purchaseId: string) => {
    setSelectedPurchaseId(purchaseId);
    setIsDetailsModalOpen(true);
  };

  const filteredPurchases = purchases.filter((p) => {
    const matchesSearch =
      p.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.supplierName && p.supplierName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.supplierInvoiceNumber && p.supplierInvoiceNumber.includes(searchQuery));

    const matchesStatus =
      statusFilter === 'all' || p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPurchasesVolume = purchases.reduce((sum, p) => sum + (p.grandTotal || 0), 0);
  const totalPaidVolume = purchases.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
  const totalUnpaidVolume = Math.max(0, totalPurchasesVolume - totalPaidVolume);

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">إدارة المشتريات وأوامر التوريد</h1>
            <p className="text-xs text-slate-500">
              تسجيل فواتير الشراء من الموردين، استلام وتحديث المخزون ومتوسط التكلفة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadPurchases}
            title="تحديث البيانات"
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء فاتورة شراء جديدة</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">إجمالي حجم المشتريات</div>
            <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
              {totalPurchasesVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xs font-normal">ر.س</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">{purchases.length} فواتير توريد</div>
          </div>
          <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">المسدد للموردين</div>
            <div className="text-2xl font-black text-emerald-600 mt-1 font-mono">
              {formatSAR(totalPaidVolume)}
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">مدفوعات فورية وبنكية مسددة</div>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <SaudiRiyalSymbol className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">الآجل المستحق للموردين</div>
            <div className="text-2xl font-black text-rose-600 mt-1 font-mono">
              {formatSAR(totalUnpaidVolume)}
            </div>
            <div className="text-[10px] text-rose-500 font-semibold mt-0.5">ذمم دائنة واجبة السداد</div>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-3 justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث برقم أمر الشراء، المورد، أو فاتورة المورد..."
            className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-semibold"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <span className="text-xs text-slate-500 font-bold whitespace-nowrap flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            الحالة:
          </span>
          {[
            { id: 'all', label: 'الكل' },
            { id: 'received', label: 'معتمدة ومستلمة' },
            { id: 'draft', label: 'مسودة / انتظار' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span>جاري تحميل فواتير الشراء...</span>
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            لا توجد فواتير شراء مطابقة.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">رقم أمر الشراء</th>
                  <th className="p-3.5">المورد</th>
                  <th className="p-3.5">تاريخ الفاتورة</th>
                  <th className="p-3.5">المستودع المستلم</th>
                  <th className="p-3.5">الإجمالي الشامل</th>
                  <th className="p-3.5">المسدد</th>
                  <th className="p-3.5">حالة الاستلام</th>
                  <th className="p-3.5">حالة السداد</th>
                  <th className="p-3.5 text-center">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredPurchases.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* رقم الأمر */}
                    <td className="p-3.5">
                      <div className="font-mono font-bold text-blue-600">{p.orderNumber}</div>
                      {p.supplierInvoiceNumber && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          فاتورة المورد: {p.supplierInvoiceNumber}
                        </div>
                      )}
                    </td>

                    {/* المورد */}
                    <td className="p-3.5 font-bold text-slate-900">
                      {p.supplierName || p.supplierId}
                    </td>

                    {/* التاريخ */}
                    <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                      {new Date(p.orderDate).toLocaleString('ar-SA')}
                    </td>

                    {/* المستودع */}
                    <td className="p-3.5 text-slate-700">
                      {p.warehouseName || p.warehouseId}
                    </td>

                    {/* الإجمالي */}
                    <td className="p-3.5 font-mono font-black text-slate-900">
                      {formatSAR(p.grandTotal)}
                    </td>

                    {/* المسدد */}
                    <td className="p-3.5 font-mono font-bold text-emerald-600">
                      {formatSAR(p.paidAmount)}
                    </td>

                    {/* حالة الاستلام */}
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          p.status === 'received'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {p.status === 'received' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            مستلمة بالمخزن
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            مسودة قيد المراجعة
                          </>
                        )}
                      </span>
                    </td>

                    {/* حالة السداد */}
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.paymentStatus === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.paymentStatus === 'partially_paid'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {p.paymentStatus === 'paid'
                          ? 'مسددة بالكامل'
                          : p.paymentStatus === 'partially_paid'
                          ? 'مسددة جزئياً'
                          : 'آجل على الحساب'}
                      </span>
                    </td>

                    {/* زر التفاصيل */}
                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenDetails(p.id)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1 mx-auto transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-600" />
                        <span>عرض البنود</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreatePurchaseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onPurchaseCreated={loadPurchases}
        initialSupplier={initialSupplier}
      />

      <PurchaseDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedPurchaseId(null);
        }}
        purchaseId={selectedPurchaseId}
        onPurchaseUpdated={loadPurchases}
      />

    </div>
  );
};
