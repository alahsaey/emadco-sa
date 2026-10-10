/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Customer, CustomerType } from '../../types';
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCreditAndUnpaidInvoices,
  CreditInvoiceItem,
} from '../../services/customers';
import { CustomerFormModal } from './CustomerFormModal';
import { CustomerStatementModal } from './CustomerStatementModal';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { SaudiRiyalSymbol, SaudiReceiptIcon as Receipt } from '../common/SaudiRiyalSymbol';
import { formatSAR } from '../../utils/formatters';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  FileText,
  Phone,
  Mail,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  Building,
  RefreshCw,
  Clock,
  MessageSquare,
  ArrowUpRight,
  Send,
} from 'lucide-react';

interface CustomersScreenProps {
  onRecordPaymentClick?: (customer: Customer) => void;
}

export const CustomersScreen: React.FC<CustomersScreenProps> = ({ onRecordPaymentClick }) => {
  const [activeTab, setActiveTab] = useState<'accounts' | 'credit_invoices'>('accounts');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [creditInvoices, setCreditInvoices] = useState<CreditInvoiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [creditStatusFilter, setCreditStatusFilter] = useState<'all' | 'unpaid' | 'partially_paid' | 'paid'>('all');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [statementCustomerId, setStatementCustomerId] = useState<string | null>(null);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);

  // Deletion modal state
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [custData, invData] = await Promise.all([
        getCustomers(),
        getCreditAndUnpaidInvoices(),
      ]);
      setCustomers(custData);
      setCreditInvoices(invData);
    } catch (err: any) {
      setErrorMessage('تعذر تحميل بيانات العملاء والذمم من قاعدة البيانات.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrUpdate = async (formData: any) => {
    if (editingCustomer) {
      await updateCustomer(editingCustomer.id, formData);
      setSuccessMessage(`تم تحديث بيانات العميل "${formData.name}" بنجاح.`);
    } else {
      await createCustomer(formData);
      setSuccessMessage(`تمت إضافة العميل الجديد "${formData.name}" بنجاح.`);
    }
    await loadAllData();
  };

  const handleDeleteClick = (customer: Customer) => {
    setErrorMessage(null);
    setCustomerToDelete(customer);
  };

  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    try {
      setIsDeletingCustomer(true);
      await deleteCustomer(customerToDelete.id, customerToDelete.name, 'المدير', true);
      setSuccessMessage(`تم حذف العميل "${customerToDelete.name}" بنجاح من قاعدة البيانات.`);
      setCustomerToDelete(null);
      await loadAllData();
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حذف العميل.');
    } finally {
      setIsDeletingCustomer(false);
    }
  };

  const handleOpenStatement = (customer: Customer) => {
    setStatementCustomerId(customer.id);
    setIsStatementModalOpen(true);
  };

  const handleOpenStatementById = (customerId: string) => {
    setStatementCustomerId(customerId);
    setIsStatementModalOpen(true);
  };

  // Filter & Search for Customers
  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      (c.taxNumber && c.taxNumber.includes(searchQuery)) ||
      (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = selectedType === 'all' || c.customerType === selectedType;

    return matchesSearch && matchesType;
  });

  // Filter & Search for Credit Invoices
  const filteredCreditInvoices = creditInvoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.customerPhone && inv.customerPhone.includes(searchQuery));

    const matchesStatus =
      creditStatusFilter === 'all' || inv.paymentStatus === creditStatusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate KPIs
  const totalReceivables = customers.reduce((sum, c) => sum + (c.currentBalance || 0), 0);
  const totalUnpaidCreditInvoicesAmount = creditInvoices.reduce((sum, inv) => sum + (inv.remainingAmount || 0), 0);
  const totalEffectiveReceivables = totalReceivables > 0 ? totalReceivables : totalUnpaidCreditInvoicesAmount;

  const overCreditLimitCount = customers.filter(
    (c) => c.creditLimit > 0 && (c.currentBalance || 0) > c.creditLimit
  ).length;
  const totalContractors = customers.filter((c) => c.customerType === 'contractor').length;
  const unpaidInvoicesCount = creditInvoices.filter((i) => i.remainingAmount > 0).length;

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header & Stats Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">إدارة العملاء والذمم المدينة</h1>
            <p className="text-xs text-slate-500">
              متابعة حسابات العملاء، فواتير الآجل غير المحصلة، وسقف الائتمان للمقاولين والشركات
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadAllData}
            title="تحديث البيانات"
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingCustomer(null);
              setIsFormModalOpen(true);
            }}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة عميل جديد</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">إجمالي العملاء المسجلين</div>
            <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{customers.length}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">حسابات قائمة في النظام</div>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">إجمالي الذمم المدينة القائمة</div>
            <div className="text-2xl font-black text-rose-600 mt-1 font-mono">
              {formatSAR(totalEffectiveReceivables)}
            </div>
            <div className="text-[10px] text-rose-500 font-semibold mt-0.5">مبالغ مستحقة التحصيل من العملاء</div>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">فواتير الآجل غير المحصلة</div>
            <div className="text-2xl font-black text-amber-600 mt-1 font-mono">{unpaidInvoicesCount}</div>
            <div className="text-[10px] text-amber-600 font-semibold mt-0.5">فواتير بانتظار سداد الدفعات</div>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">تجاوز السقف الائتماني</div>
            <div className={`text-2xl font-black mt-1 font-mono ${overCreditLimitCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {overCreditLimitCount}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">عملاء بحاجة للمتابعة والتحصيل</div>
          </div>
          <div className={`p-3 rounded-xl ${overCreditLimitCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
            <CreditCard className="w-5 h-5" />
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

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('accounts')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'accounts'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>قائمة حسابات العملاء والمقاولين ({customers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('credit_invoices')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'credit_invoices'
              ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>سجل فواتير الآجل والذمم غير المحصلة ({creditInvoices.length})</span>
          {unpaidInvoicesCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-mono">
              {unpaidInvoicesCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-3 justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'accounts'
                ? 'بحث باسم العميل، الجوال، أو الرقم الضريبي...'
                : 'بحث برقم الفاتورة، اسم العميل، أو الجوال...'
            }
            className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all font-semibold"
          />
        </div>

        {activeTab === 'accounts' ? (
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
            <span className="text-xs text-slate-500 font-bold whitespace-nowrap flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              تصنيف:
            </span>
            {[
              { id: 'all', label: 'الكل' },
              { id: 'contractor', label: 'مقاولون' },
              { id: 'company', label: 'شركات' },
              { id: 'individual', label: 'أفراد / نقدي' },
              { id: 'wholesale', label: 'جملة' },
            ].map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setSelectedType(type.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  selectedType === type.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
            <span className="text-xs text-slate-500 font-bold whitespace-nowrap flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              حالة السداد:
            </span>
            {[
              { id: 'all', label: 'الكل' },
              { id: 'unpaid', label: 'غير مسددة' },
              { id: 'partially_paid', label: 'مسددة جزئياً' },
              { id: 'paid', label: 'مسددة بالكامل' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setCreditStatusFilter(st.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  creditStatusFilter === st.id
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 1. Tab 1: Customers Table */}
      {activeTab === 'accounts' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span>جاري تحميل العملاء...</span>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-600">لا توجد سجلات عملاء مسجلة حالياً</p>
              <p className="text-[11px] text-slate-400 mt-1">
                يمكنك الضغط على زر "إضافة عميل جديد" بالأعلى لإنشاء حساب عميل أو مقاول وربط الذمم به.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">اسم العميل والنوع</th>
                    <th className="p-3.5">بيانات التواصل</th>
                    <th className="p-3.5">الرقم الضريبي / السجل</th>
                    <th className="p-3.5">فئة السعر</th>
                    <th className="p-3.5">سقف الائتمان</th>
                    <th className="p-3.5 text-slate-900">الرصيد المستحق (مدين)</th>
                    <th className="p-3.5 text-center">الإجراءات والعمليات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredCustomers.map((cust) => {
                    const isOverLimit = cust.creditLimit > 0 && (cust.currentBalance || 0) > cust.creditLimit;
                    const hasDebt = (cust.currentBalance || 0) > 0;

                    return (
                      <tr key={cust.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* الاسم ونوعه */}
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900 text-xs">{cust.name}</div>
                          <div className="flex items-center gap-1 mt-1">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              cust.customerType === 'contractor'
                                ? 'bg-amber-100 text-amber-800'
                                : cust.customerType === 'company'
                                ? 'bg-blue-100 text-blue-800'
                                : cust.customerType === 'wholesale'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {cust.customerType === 'contractor'
                                ? 'مقاول'
                                : cust.customerType === 'company'
                                ? 'شركة'
                                : cust.customerType === 'wholesale'
                                ? 'تاجر جملة'
                                : 'أفراد'}
                            </span>
                            {cust.notes && (
                              <span className="text-[10px] text-slate-400 truncate max-w-[150px]">
                                {cust.notes}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* التواصل */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-1 text-slate-800 font-mono font-bold" dir="ltr">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{cust.phone}</span>
                          </div>
                          {cust.email && (
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5" dir="ltr">
                              {cust.email}
                            </div>
                          )}
                        </td>

                        {/* الرقم الضريبي */}
                        <td className="p-3.5">
                          {cust.taxNumber ? (
                            <div className="font-mono text-slate-800 font-semibold" dir="ltr">
                              {cust.taxNumber}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                          {cust.commercialRegister && (
                            <div className="text-[10px] text-slate-500 font-mono">
                              س.ت: {cust.commercialRegister}
                            </div>
                          )}
                        </td>

                        {/* فئة السعر */}
                        <td className="p-3.5">
                          <span className="text-[11px] font-bold text-slate-700">
                            {cust.priceTier === 'contractor'
                              ? 'سعر المقاولين'
                              : cust.priceTier === 'wholesale'
                              ? 'سعر الجملة'
                              : 'سعر التجزئة'}
                          </span>
                        </td>

                        {/* سقف الائتمان */}
                        <td className="p-3.5 font-mono">
                          {cust.creditLimit > 0 ? (
                            <span className="font-bold text-slate-800">
                              {cust.creditLimit.toLocaleString()} ر.س
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">نقدي فقط</span>
                          )}
                        </td>

                        {/* الرصيد المستحق */}
                        <td className="p-3.5 font-mono">
                          <div className={`font-black text-sm ${hasDebt ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {formatSAR(cust.currentBalance || 0)}
                          </div>
                          {isOverLimit && (
                            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[9px] font-bold mt-0.5">
                              <AlertCircle className="w-2.5 h-2.5" />
                              تجاوز السقف
                            </div>
                          )}
                        </td>

                        {/* العمليات */}
                        <td className="p-3.5">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* كشف حساب */}
                            <button
                              type="button"
                              onClick={() => handleOpenStatement(cust)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="عرض كشف الحساب والفواتير"
                            >
                              <FileText className="w-3.5 h-3.5 text-amber-600" />
                              <span>كشف حساب</span>
                            </button>

                            {/* تسجيل دفعة سداد */}
                            {onRecordPaymentClick && (
                              <button
                                type="button"
                                onClick={() => onRecordPaymentClick(cust)}
                                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                title="تسجيل سند قبض / سداد"
                              >
                                <SaudiRiyalSymbol className="w-3.5 h-3.5 text-amber-600" />
                                <span>قبض دفعة</span>
                              </button>
                            )}

                            {/* تعديل */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCustomer(cust);
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
                              onClick={() => handleDeleteClick(cust)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="حذف العميل"
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
      )}

      {/* 2. Tab 2: Credit & Unpaid Invoices Ledger */}
      {activeTab === 'credit_invoices' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span>جاري تحميل فواتير وسندات الذمم...</span>
            </div>
          ) : filteredCreditInvoices.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <Receipt className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-600">لا توجد فواتير آجل أو ذمم مدينة مسجلة تطابق بحثك</p>
              <p className="text-[11px] text-slate-400 mt-1">
                عند إتمام أي عملية بيع بنظام "حساب آجل (ذمم)" في الكاشير، ستظهر هنا مباشرة مع تفاصيل المبالغ المتبقية.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">رقم الفاتورة</th>
                    <th className="p-3.5">تاريخ ووقت الإصدار</th>
                    <th className="p-3.5">اسم العميل / المستفيد</th>
                    <th className="p-3.5">إجمالي الفاتورة</th>
                    <th className="p-3.5">المبلغ المسدد</th>
                    <th className="p-3.5 text-rose-700">المتبقي كمديونية (الذمة)</th>
                    <th className="p-3.5 text-center">حالة السداد</th>
                    <th className="p-3.5 text-center">الإجراءات والتحصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredCreditInvoices.map((inv) => {
                    const isUnpaid = inv.paymentStatus === 'unpaid';
                    const isPartiallyPaid = inv.paymentStatus === 'partially_paid';
                    const isFullyPaid = inv.paymentStatus === 'paid';

                    // ربط بالعميل إن وجد
                    const linkedCust = customers.find((c) => c.id === inv.customerId || c.name === inv.customerName);

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* رقم الفاتورة */}
                        <td className="p-3.5">
                          <div className="font-mono font-bold text-slate-900">{inv.invoiceNumber}</div>
                          {inv.saleNumber && inv.saleNumber !== inv.invoiceNumber && (
                            <div className="text-[10px] text-slate-400 font-mono">مرجع: {inv.saleNumber}</div>
                          )}
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-bold">
                            بيع بالآجل
                          </span>
                        </td>

                        {/* التاريخ */}
                        <td className="p-3.5 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                          {new Date(inv.date).toLocaleString('ar-SA')}
                        </td>

                        {/* العميل */}
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900">{inv.customerName}</div>
                          {inv.customerPhone && (
                            <div className="text-[11px] text-slate-400 font-mono" dir="ltr">
                              {inv.customerPhone}
                            </div>
                          )}
                        </td>

                        {/* الإجمالي */}
                        <td className="p-3.5 font-mono font-bold text-slate-900">
                          {formatSAR(inv.grandTotal)}
                        </td>

                        {/* المسدد */}
                        <td className="p-3.5 font-mono text-emerald-600 font-bold">
                          {formatSAR(inv.paidAmount)}
                        </td>

                        {/* المتبقي */}
                        <td className="p-3.5 font-mono font-black text-rose-600 text-sm">
                          {formatSAR(inv.remainingAmount)}
                        </td>

                        {/* الحالة */}
                        <td className="p-3.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              isFullyPaid
                                ? 'bg-emerald-100 text-emerald-800'
                                : isPartiallyPaid
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isFullyPaid && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                            {isPartiallyPaid && <Clock className="w-3 h-3 text-amber-600" />}
                            {isUnpaid && <AlertCircle className="w-3 h-3 text-rose-600" />}
                            <span>
                              {isFullyPaid ? 'مسددة بالكامل' : isPartiallyPaid ? 'مسددة جزئياً' : 'غير مسددة (ذمة)'}
                            </span>
                          </span>
                        </td>

                        {/* الإجراءات */}
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* سداد دفعة للعميل */}
                            {linkedCust && onRecordPaymentClick && inv.remainingAmount > 0 && (
                              <button
                                type="button"
                                onClick={() => onRecordPaymentClick(linkedCust)}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                                title="تحصيل دفعة وتسجيل سند قبض"
                              >
                                <SaudiRiyalSymbol className="w-3.5 h-3.5" />
                                <span>سداد دفعة</span>
                              </button>
                            )}

                            {/* كشف حساب العميل */}
                            {linkedCust && (
                              <button
                                type="button"
                                onClick={() => handleOpenStatement(linkedCust)}
                                className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                title="عرض كشف حساب العميل"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                            )}
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
      )}

      {/* Form Modal */}
      <CustomerFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingCustomer(null);
        }}
        onSave={handleCreateOrUpdate}
        customer={editingCustomer}
      />

      {/* Statement Modal */}
      <CustomerStatementModal
        isOpen={isStatementModalOpen}
        onClose={() => {
          setIsStatementModalOpen(false);
          setStatementCustomerId(null);
        }}
        customerId={statementCustomerId}
        onRecordPayment={onRecordPaymentClick}
      />

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!customerToDelete}
        onClose={() => {
          if (!isDeletingCustomer) setCustomerToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="تأكيد حذف العميل"
        itemTypeLabel="إدارة حسابات العملاء"
        itemName={customerToDelete?.name}
        message={`هل أنت متأكد من رغبتك في حذف العميل "${customerToDelete?.name}" من قاعدة البيانات السحابية؟`}
        warningNote={
          customerToDelete && (customerToDelete.currentBalance || 0) > 0
            ? `تنبيه: هذا العميل لديه رصيد مديونية بقيمة (${formatSAR(customerToDelete.currentBalance)}). سيتم حذف حسابه من قائمة العملاء.`
            : 'سيتم حذف حساب العميل وسجل بياناته نهائياً من النظام.'
        }
        isProcessing={isDeletingCustomer}
        confirmButtonText="نعم، حذف العميل نهائياً"
      />

    </div>
  );
};

