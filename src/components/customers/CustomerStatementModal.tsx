/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Customer, StatementEntry, Sale, Payment, Return } from '../../types';
import {
  getCustomerStatement,
  getCustomerSales,
  getCustomerPayments,
  getCustomerReturns,
} from '../../services/customers';
import { SaudiRiyalSymbol, SaudiReceiptIcon as Receipt } from '../common/SaudiRiyalSymbol';
import { formatSAR, formatNumber } from '../../utils/formatters';
import {
  X,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  Printer,
  Calendar,
  Phone,
  Building,
  RotateCcw,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface CustomerStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string | null;
  onRecordPayment?: (customer: Customer) => void;
}

export const CustomerStatementModal: React.FC<CustomerStatementModalProps> = ({
  isOpen,
  onClose,
  customerId,
  onRecordPayment,
}) => {
  const [activeTab, setActiveTab] = useState<'statement' | 'invoices' | 'payments' | 'returns'>('statement');
  const [isLoading, setIsLoading] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [statementEntries, setStatementEntries] = useState<StatementEntry[]>([]);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);

  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);

  useEffect(() => {
    if (isOpen && customerId) {
      loadData(customerId);
    }
  }, [isOpen, customerId]);

  const loadData = async (cId: string) => {
    setIsLoading(true);
    try {
      const [statementData, salesData, paymentsData, returnsData] = await Promise.all([
        getCustomerStatement(cId),
        getCustomerSales(cId),
        getCustomerPayments(cId),
        getCustomerReturns(cId),
      ]);

      setCustomer(statementData.customer);
      setStatementEntries(statementData.entries);
      setTotalDebit(statementData.totalDebit);
      setTotalCredit(statementData.totalCredit);
      setClosingBalance(statementData.closingBalance);

      setSales(salesData);
      setPayments(paymentsData);
      setReturns(returnsData);
    } catch (error) {
      console.error('خطأ في تحميل كشف حساب العميل:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !customerId) return null;

  const handlePrint = () => {
    window.print();
  };

  const isOverCreditLimit = customer && customer.creditLimit > 0 && closingBalance > customer.creditLimit;
  const creditUsagePercent = customer && customer.creditLimit > 0
    ? Math.min(100, Math.round((closingBalance / customer.creditLimit) * 100))
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header Bar */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                <span>كشف حساب العميل</span>
                {customer && (
                  <span className="text-xs font-normal text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md">
                    {customer.name}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">سجل المعاملات والذمم المدينة، الفواتير، المدفوعات والمرتجعات</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
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

        {/* Customer Information Card & Financial Summary */}
        {customer && (
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              
              {/* بيانات العميل */}
              <div className="md:col-span-2 space-y-1">
                <div className="text-sm font-black text-slate-900">{customer.name}</div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span dir="ltr" className="font-mono">{customer.phone}</span>
                  </span>
                  {customer.taxNumber && (
                    <span className="flex items-center gap-1">
                      <span className="font-semibold text-slate-500">الرقم الضريبي:</span>
                      <span dir="ltr" className="font-mono font-bold text-slate-700">{customer.taxNumber}</span>
                    </span>
                  )}
                  {customer.address && (
                    <span className="text-[11px] text-slate-500 truncate max-w-xs">{customer.address}</span>
                  )}
                </div>
              </div>

              {/* سقف الائتمان */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
                  <span>سقف الائتمان</span>
                  <span className="font-mono font-bold text-slate-800">
                    {customer.creditLimit > 0 ? `${customer.creditLimit.toLocaleString()} ر.س` : 'نقدي فقط'}
                  </span>
                </div>
                {customer.creditLimit > 0 && (
                  <div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-1">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isOverCreditLimit ? 'bg-rose-500' : creditUsagePercent > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, creditUsagePercent)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>المستخدم: {creditUsagePercent}%</span>
                      <span>المتبقي: {formatSAR(Math.max(0, customer.creditLimit - closingBalance))}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* الرصيد المستحق الحالي وزر السداد السريع */}
              <div className={`p-3 rounded-xl border shadow-xs flex items-center justify-between ${
                closingBalance > 0
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                <div>
                  <div className="text-[11px] font-semibold text-slate-600">الرصيد المستحق (المديونية)</div>
                  <div className="text-xl font-black font-mono mt-0.5">
                    {formatSAR(closingBalance)}
                  </div>
                </div>

                {onRecordPayment && (
                  <button
                    type="button"
                    onClick={() => {
                      onRecordPayment(customer);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>سداد دفعة</span>
                  </button>
                )}
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
            <span>كشف الحساب التراكمي ({statementEntries.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('invoices')}
            className={`py-3 px-4 flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'invoices'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>فواتير المبيعات ({sales.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`py-3 px-4 flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'payments'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <SaudiRiyalSymbol className="w-4 h-4" />
            <span>سندات القبض والمدفوعات ({payments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('returns')}
            className={`py-3 px-4 flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'returns'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>المرتجعات ({returns.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 flex-1 overflow-y-auto min-h-[300px]">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span>جاري تحميل السجلات والعمليات...</span>
            </div>
          ) : (
            <>
              {/* TAB 1: STATEMENT (كشف الحساب) */}
              {activeTab === 'statement' && (
                <div className="space-y-4">
                  {statementEntries.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      لا توجد حركات مسجلة على حساب هذا العميل حتى الآن.
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                            <tr>
                              <th className="p-3">التاريخ والوقت</th>
                              <th className="p-3">نوع الحركة</th>
                              <th className="p-3">رقم المرجع</th>
                              <th className="p-3">البيان / الوصف</th>
                              <th className="p-3 text-rose-600">مدين (+)</th>
                              <th className="p-3 text-emerald-600">دائن (-)</th>
                              <th className="p-3 text-slate-900">الرصيد التراكمي</th>
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
                                      entry.type === 'sale_invoice'
                                        ? 'bg-blue-100 text-blue-800'
                                        : entry.type === 'payment_receipt'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {entry.typeLabel}
                                  </span>
                                </td>
                                <td className="p-3 font-mono font-bold text-slate-900">{entry.referenceNumber}</td>
                                <td className="p-3 text-slate-600 text-[11px]">{entry.description}</td>
                                <td className="p-3 font-mono font-bold text-rose-600">
                                  {entry.debit > 0 ? formatNumber(entry.debit) : '-'}
                                </td>
                                <td className="p-3 font-mono font-bold text-emerald-600">
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
                              <td className="p-3 font-mono text-rose-700">{formatSAR(totalDebit)}</td>
                              <td className="p-3 font-mono text-emerald-700">{formatSAR(totalCredit)}</td>
                              <td className="p-3 font-mono text-amber-700 font-black">{formatSAR(closingBalance)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB 2: INVOICES (فواتير المبيعات) */}
              {activeTab === 'invoices' && (
                <div className="space-y-2">
                  {sales.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      لا توجد فواتير مبيعات مسجلة لهذا العميل.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-3">رقم الفاتورة</th>
                            <th className="p-3">تاريخ الإصدار</th>
                            <th className="p-3">المبلغ قبل الضريبة</th>
                            <th className="p-3">ضريبة القيمة المضافة (15%)</th>
                            <th className="p-3">الإجمالي الشامل</th>
                            <th className="p-3">المدفوع</th>
                            <th className="p-3">حالة السداد</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {sales.map((sale) => (
                            <tr key={sale.id} className="hover:bg-slate-50">
                              <td className="p-3 font-mono font-bold text-blue-600">{sale.saleNumber}</td>
                              <td className="p-3 text-slate-500 font-mono text-[11px]">
                                {new Date(sale.createdAt).toLocaleString('ar-SA')}
                              </td>
                              <td className="p-3 font-mono">{formatSAR(sale.subtotal)}</td>
                              <td className="p-3 font-mono">{formatSAR(sale.taxTotal)}</td>
                              <td className="p-3 font-mono font-bold text-slate-900">{formatSAR(sale.grandTotal)}</td>
                              <td className="p-3 font-mono font-bold text-emerald-600">{formatSAR(sale.paidAmount)}</td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    sale.saleType === 'contractor_credit' || sale.paidAmount < sale.grandTotal
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {sale.paidAmount >= sale.grandTotal ? 'مسددة بالكامل' : 'آجل / متبقي'}
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

              {/* TAB 3: PAYMENTS (المدفوعات وسندات القبض) */}
              {activeTab === 'payments' && (
                <div className="space-y-2">
                  {payments.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      لا توجد سندات قبض مسجلة لهذا العميل.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-3">رقم السند</th>
                            <th className="p-3">التاريخ</th>
                            <th className="p-3">المبلغ المسدد</th>
                            <th className="p-3">طريقة الدفع</th>
                            <th className="p-3">المرجع البنكي / الإيصال</th>
                            <th className="p-3">المستلم</th>
                            <th className="p-3">ملاحظات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {payments.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50">
                              <td className="p-3 font-mono font-bold text-emerald-700">{p.receiptNumber}</td>
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

              {/* TAB 4: RETURNS (المرتجعات) */}
              {activeTab === 'returns' && (
                <div className="space-y-2">
                  {returns.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      لا توجد مرتجعات مسجلة لهذا العميل.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-3">رقم إشعار المرتجع</th>
                            <th className="p-3">التاريخ</th>
                            <th className="p-3">المبلغ المسترد</th>
                            <th className="p-3">سبب الإرجاع</th>
                            <th className="p-3">الحالة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {returns.map((r) => (
                            <tr key={r.id} className="hover:bg-slate-50">
                              <td className="p-3 font-mono font-bold text-amber-700">{r.returnNumber}</td>
                              <td className="p-3 text-slate-500 font-mono text-[11px]">
                                {new Date(r.createdAt).toLocaleString('ar-SA')}
                              </td>
                              <td className="p-3 font-mono font-bold text-rose-600">{formatSAR(r.refundAmount)}</td>
                              <td className="p-3 text-slate-700">{r.reason}</td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  {r.status}
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
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>تاريخ إصدار التقرير: {new Date().toLocaleDateString('ar-SA')}</span>
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
