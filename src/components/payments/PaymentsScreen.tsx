/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Payment, Customer, Supplier } from '../../types';
import { getPayments } from '../../services/payments';
import { RecordPaymentModal } from './RecordPaymentModal';
import { SaudiRiyalSymbol } from '../common/SaudiRiyalSymbol';
import { formatSAR } from '../../utils/formatters';
import {
  Plus,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  Printer,
  Calendar,
  CreditCard,
  Building,
  RefreshCw,
} from 'lucide-react';

interface PaymentsScreenProps {
  initialPartyType?: 'customer' | 'supplier';
  initialParty?: Customer | Supplier | null;
}

export const PaymentsScreen: React.FC<PaymentsScreenProps> = ({
  initialPartyType,
  initialParty,
}) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'receipt' | 'disbursement'>('all');

  // Modal
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

  useEffect(() => {
    loadPayments();
  }, []);

  useEffect(() => {
    if (initialParty) {
      setIsRecordModalOpen(true);
    }
  }, [initialParty]);

  const loadPayments = async () => {
    setIsLoading(true);
    try {
      const data = await getPayments();
      setPayments(data);
    } catch (err) {
      console.error('خطأ في تحميل سجل السندات والمدفوعات:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPayments = payments.filter((p) => {
    const matchesSearch =
      p.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.reference && p.reference.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.notes && p.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = typeFilter === 'all' || p.paymentType === typeFilter;

    return matchesSearch && matchesType;
  });

  const totalReceipts = payments
    .filter((p) => p.paymentType === 'receipt')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalDisbursements = payments
    .filter((p) => p.paymentType === 'disbursement')
    .reduce((sum, p) => sum + p.amount, 0);

  const netCashFlow = totalReceipts - totalDisbursements;

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
            <SaudiRiyalSymbol className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">سندات القبض والصرف المالي</h1>
            <p className="text-xs text-slate-500">
              تسجيل ومتابعة المتحصلات من العملاء والمدفوعات للموردين والشركات
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadPayments}
            title="تحديث البيانات"
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsRecordModalOpen(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل سند مالي جديد</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">إجمالي المقبوضات (تحصيل عملاء)</div>
            <div className="text-2xl font-black text-emerald-600 mt-1 font-mono">
              {formatSAR(totalReceipts)}
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">واردات الصندوق والبنك</div>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">إجمالي المدفوعات (سداد موردين)</div>
            <div className="text-2xl font-black text-blue-600 mt-1 font-mono">
              {formatSAR(totalDisbursements)}
            </div>
            <div className="text-[10px] text-blue-600 font-semibold mt-0.5">سندات صرف لمصانع وموردين</div>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">صافي حركة التحصيل والصرف</div>
            <div className={`text-2xl font-black mt-1 font-mono ${netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              {formatSAR(netCashFlow)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">الفارق بين المقبوض والمصروف</div>
          </div>
          <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
            <SaudiRiyalSymbol className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-3 justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث برقم السند، الطرف، المرجع، أو البيان..."
            className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all font-semibold"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <span className="text-xs text-slate-500 font-bold whitespace-nowrap flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            نوع السند:
          </span>
          {[
            { id: 'all', label: 'كافة السندات' },
            { id: 'receipt', label: 'سندات قبض (عملاء)' },
            { id: 'disbursement', label: 'سندات صرف (موردين)' },
          ].map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => setTypeFilter(type.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                typeFilter === type.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span>جاري تحميل السندات المالية...</span>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            لا توجد سندات مالية مسجلة.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">رقم السند</th>
                  <th className="p-3.5">نوع السند</th>
                  <th className="p-3.5">الطرف (العميل / المورد)</th>
                  <th className="p-3.5">المبلغ</th>
                  <th className="p-3.5">طريقة الدفع</th>
                  <th className="p-3.5">المرجع / الشيك</th>
                  <th className="p-3.5">التاريخ</th>
                  <th className="p-3.5">المستلم / المنفذ</th>
                  <th className="p-3.5">البيان والملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredPayments.map((p) => {
                  const isReceipt = p.paymentType === 'receipt';

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-slate-900">
                        {p.receiptNumber}
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isReceipt
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {isReceipt ? (
                            <>
                              <ArrowDownLeft className="w-3 h-3" />
                              سند قبض
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-3 h-3" />
                              سند صرف
                            </>
                          )}
                        </span>
                      </td>

                      <td className="p-3.5 font-bold text-slate-900">
                        {p.partyName}
                      </td>

                      <td className="p-3.5 font-mono font-black text-sm">
                        <span className={isReceipt ? 'text-emerald-600' : 'text-blue-600'}>
                          {formatSAR(p.amount)}
                        </span>
                      </td>

                      <td className="p-3.5 font-semibold text-slate-800">
                        {p.paymentMethodId}
                      </td>

                      <td className="p-3.5 font-mono text-slate-600">
                        {p.reference || '-'}
                      </td>

                      <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                        {new Date(p.date).toLocaleString('ar-SA')}
                      </td>

                      <td className="p-3.5 text-slate-700">
                        {p.collectedBy}
                      </td>

                      <td className="p-3.5 text-slate-500 text-[11px] max-w-xs truncate">
                        {p.notes || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onPaymentRecorded={loadPayments}
        initialPartyType={initialPartyType}
        initialParty={initialParty}
      />

    </div>
  );
};
