/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Supplier, StatementEntry, Purchase, Payment } from '../../types';
import {
  getSupplierStatement,
  getSupplierPurchases,
  getSupplierPayments,
} from '../../services/suppliers';
import { SaudiRiyalSymbol } from '../common/SaudiRiyalSymbol';
import { formatSAR, formatNumber } from '../../utils/formatters';
import {
  X,
  FileText,
  Printer,
  Calendar,
  Phone,
  Truck,
  PlusCircle,
  Package,
} from 'lucide-react';

interface SupplierStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: string | null;
  onRecordPayment?: (supplier: Supplier) => void;
  onCreatePurchase?: (supplier: Supplier) => void;
}

export const SupplierStatementModal: React.FC<SupplierStatementModalProps> = ({
  isOpen,
  onClose,
  supplierId,
  onRecordPayment,
  onCreatePurchase,
}) => {
  const [activeTab, setActiveTab] = useState<'statement' | 'purchases' | 'disbursements'>('statement');
  const [isLoading, setIsLoading] = useState(true);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [statementEntries, setStatementEntries] = useState<StatementEntry[]>([]);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    if (isOpen && supplierId) {
      loadData(supplierId);
    }
  }, [isOpen, supplierId]);

  const loadData = async (sId: string) => {
    setIsLoading(true);
    try {
      const [stmt, purchData, payData] = await Promise.all([
        getSupplierStatement(sId),
        getSupplierPurchases(sId),
        getSupplierPayments(sId),
      ]);

      setSupplier(stmt.supplier);
      setStatementEntries(stmt.entries);
      setTotalDebit(stmt.totalDebit);
      setTotalCredit(stmt.totalCredit);
      setClosingBalance(stmt.closingBalance);

      setPurchases(purchData);
      setPayments(payData);
    } catch (error) {
      console.error('خطأ في تحميل كشف حساب المورد:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !supplierId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                <span>كشف حساب المورد / المصنع</span>
                {supplier && (
                  <span className="text-xs font-normal text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md">
                    {supplier.companyName}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">سجل فواتير التوريد، المدفوعات المسددة والأرصدة المستحقة</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Supplier Info & Balance Summary */}
        {supplier && (
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* بيانات المورد */}
              <div className="space-y-1">
                <div className="text-sm font-black text-slate-900">{supplier.companyName}</div>
                <div className="text-xs text-slate-600">المسؤول: <span className="font-semibold text-slate-800">{supplier.contactPerson}</span></div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Phone className="w-3.5 h-3.5" />
                  <span dir="ltr" className="font-mono">{supplier.phone}</span>
                </div>
                {supplier.taxNumber && (
                  <div className="text-xs text-slate-500">
                    الرقم الضريبي: <span dir="ltr" className="font-mono font-bold text-slate-700">{supplier.taxNumber}</span>
                  </div>
                )}
              </div>

              {/* إحصائيات التوريد والمدفوعات */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div className="flex justify-between text-xs text-slate-600 font-semibold mb-2">
                  <span>إجمالي فواتير التوريد:</span>
                  <span className="font-mono font-bold text-slate-900">{formatSAR(totalCredit)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600 font-semibold">
                  <span>إجمالي المسدد للمورد:</span>
                  <span className="font-mono font-bold text-emerald-600">{formatSAR(totalDebit)}</span>
                </div>
              </div>

              {/* الرصيد الحالي المستحق للمورد وأزرار العمليات */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500">الرصيد القائم المستحق للمورد (دائن)</div>
                  <div className="text-xl font-black font-mono text-rose-600 mt-0.5">
                    {formatSAR(closingBalance)}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  {onRecordPayment && (
                    <button
                      type="button"
                      onClick={() => {
                        onRecordPayment(supplier);
                        onClose();
                      }}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>سند صرف</span>
                    </button>
                  )}
                  {onCreatePurchase && (
                    <button
                      type="button"
                      onClick={() => {
                        onCreatePurchase(supplier);
                        onClose();
                      }}
                      className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>فاتورة شراء جديدة</span>
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="flex border-b border-slate-200 bg-white px-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('statement')}
            className={`py-3 px-4 flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'statement'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>كشف الحساب ({statementEntries.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('purchases')}
            className={`py-3 px-4 flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'purchases'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>فواتير الشراء والتوريد ({purchases.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('disbursements')}
            className={`py-3 px-4 flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'disbursements'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <SaudiRiyalSymbol className="w-4 h-4" />
            <span>سندات الصرف والمدفوعات ({payments.length})</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto min-h-[300px]">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span>جاري تحميل سجلات المورد...</span>
            </div>
          ) : (
            <>
              {/* STATEMENT */}
              {activeTab === 'statement' && (
                <div className="space-y-4">
                  {statementEntries.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      لا توجد حركات مسجلة لهذا المورد.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-3">التاريخ</th>
                            <th className="p-3">نوع الحركة</th>
                            <th className="p-3">رقم المرجع</th>
                            <th className="p-3">البيان</th>
                            <th className="p-3 text-emerald-600">مسدد للمورد (مدين -)</th>
                            <th className="p-3 text-rose-600">فاتورة توريد (دائن +)</th>
                            <th className="p-3 text-slate-900">الرصيد القائم</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                          {statementEntries.map((entry) => (
                            <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-3 text-[11px] text-slate-500 font-mono">
                                {new Date(entry.date).toLocaleString('ar-SA')}
                              </td>
                              <td className="p-3 font-semibold">
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                    entry.type === 'purchase_invoice'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {entry.typeLabel}
                                </span>
                              </td>
                              <td className="p-3 font-mono font-bold text-slate-900">{entry.referenceNumber}</td>
                              <td className="p-3 text-slate-600 text-[11px]">{entry.description}</td>
                              <td className="p-3 font-mono font-bold text-emerald-600">
                                {entry.debit > 0 ? formatNumber(entry.debit) : '-'}
                              </td>
                              <td className="p-3 font-mono font-bold text-rose-600">
                                {entry.credit > 0 ? formatNumber(entry.credit) : '-'}
                              </td>
                              <td className="p-3 font-mono font-black text-slate-900">
                                {formatSAR(entry.runningBalance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-100 font-bold text-slate-900 border-t border-slate-200">
                          <tr>
                            <td colSpan={4} className="p-3 text-right">إجمالي الحركات:</td>
                            <td className="p-3 font-mono text-emerald-700">{formatSAR(totalDebit)}</td>
                            <td className="p-3 font-mono text-rose-700">{formatSAR(totalCredit)}</td>
                            <td className="p-3 font-mono text-slate-900 font-black">{formatSAR(closingBalance)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* PURCHASES */}
              {activeTab === 'purchases' && (
                <div className="space-y-2">
                  {purchases.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      لا توجد فواتير شراء سابقة لهذا المورد.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-3">رقم أمر الشراء</th>
                            <th className="p-3">فاتورة المورد الخارجية</th>
                            <th className="p-3">التاريخ</th>
                            <th className="p-3">الإجمالي الشامل</th>
                            <th className="p-3">المسدد</th>
                            <th className="p-3">حالة الاستلام</th>
                            <th className="p-3">حالة السداد</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {purchases.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50">
                              <td className="p-3 font-mono font-bold text-blue-600">{p.orderNumber}</td>
                              <td className="p-3 font-mono text-slate-700">{p.supplierInvoiceNumber || '-'}</td>
                              <td className="p-3 text-slate-500 font-mono text-[11px]">
                                {new Date(p.orderDate).toLocaleString('ar-SA')}
                              </td>
                              <td className="p-3 font-mono font-bold text-slate-900">{formatSAR(p.grandTotal)}</td>
                              <td className="p-3 font-mono font-bold text-emerald-600">{formatSAR(p.paidAmount)}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  p.status === 'received' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {p.status === 'received' ? 'معتمدة ومستلمة' : 'مسودة'}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  p.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {p.paymentStatus === 'paid' ? 'مسددة بالكامل' : p.paymentStatus === 'partially_paid' ? 'مسددة جزئياً' : 'آجل غير مسدد'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* DISBURSEMENTS */}
              {activeTab === 'disbursements' && (
                <div className="space-y-2">
                  {payments.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      لا توجد سندات صرف مسجلة لهذا المورد.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-3">رقم السند</th>
                            <th className="p-3">التاريخ</th>
                            <th className="p-3">المبلغ المصروف</th>
                            <th className="p-3">طريقة الدفع</th>
                            <th className="p-3">المرجع</th>
                            <th className="p-3">المسؤول</th>
                            <th className="p-3">ملاحظات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {payments.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50">
                              <td className="p-3 font-mono font-bold text-amber-700">{p.receiptNumber}</td>
                              <td className="p-3 text-slate-500 font-mono text-[11px]">
                                {new Date(p.date).toLocaleString('ar-SA')}
                              </td>
                              <td className="p-3 font-mono font-black text-emerald-600 text-sm">
                                {formatSAR(p.amount)}
                              </td>
                              <td className="p-3 font-semibold text-slate-800">{p.paymentMethodId}</td>
                              <td className="p-3 font-mono text-slate-600">{p.reference || '-'}</td>
                              <td className="p-3 text-slate-700">{p.collectedBy}</td>
                              <td className="p-3 text-slate-500 text-[11px]">{p.notes || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>تاريخ إصدار الكشف: {new Date().toLocaleDateString('ar-SA')}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
