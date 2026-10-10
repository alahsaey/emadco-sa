/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Download,
  Filter,
  RefreshCw,
  Search,
  Calendar,
  Layers,
  ShoppingBag,
  Users,
  Building2,
  RotateCcw,
  FileCheck2,
  CreditCard,
  Lock,
  Unlock,
  AlertCircle,
  TrendingUp,
  X,
  Package,
} from 'lucide-react';
import { SaudiRiyalSymbol, SaudiReceiptIcon as Receipt } from '../common/SaudiRiyalSymbol';
import { formatSAR, formatInteger } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import {
  loadReportsAndDashboardData,
  exportToCsv,
  printReportPdf,
  ReportType,
  ReportFilterOptions,
} from '../../services/reports';

interface ReportsScreenProps {
  initialReportTab?: ReportType;
  onBackToDashboard: () => void;
}

export const ReportsScreen: React.FC<ReportsScreenProps> = ({
  initialReportTab = 'sales',
  onBackToDashboard,
}) => {
  const { currentUser, hasPermission } = useAuth();

  const [activeTab, setActiveTab] = useState<ReportType>(initialReportTab);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<Awaited<ReturnType<typeof loadReportsAndDashboardData>> | null>(null);

  // الكاشير وصلاحيات الأرباح والتقارير الحساسة
  const [cashierProfitOverride, setCashierProfitOverride] = useState(false);
  const isOwnerOrManager =
    currentUser?.roleKey === 'system_owner' || currentUser?.roleKey === 'manager';
  const canViewProfits =
    isOwnerOrManager || hasPermission('reports:financial_profits') || cashierProfitOverride;

  // فلاتر التقرير الشاملة
  const [filters, setFilters] = useState<ReportFilterOptions>({
    fromDate: '',
    toDate: '',
    productId: '',
    categoryId: '',
    cashierId: '',
    customerId: '',
    paymentMethod: '',
  });

  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    try {
      setIsLoading(true);
      const res = await loadReportsAndDashboardData();
      setData(res);
    } catch (err) {
      console.error('فشل تحميل بيانات التقارير:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // أزرار الضبط السريع للفترة
  const setQuickDatePreset = (preset: 'today' | 'week' | 'month' | 'year' | 'all') => {
    const now = new Date();
    const toDate = now.toISOString().slice(0, 10);

    if (preset === 'all') {
      setFilters((prev) => ({ ...prev, fromDate: '', toDate: '' }));
      return;
    }

    let from = new Date();
    if (preset === 'today') {
      from = now;
    } else if (preset === 'week') {
      from.setDate(now.getDate() - 7);
    } else if (preset === 'month') {
      from.setDate(now.getDate() - 30);
    } else if (preset === 'year') {
      from = new Date(now.getFullYear(), 0, 1);
    }

    setFilters((prev) => ({
      ...prev,
      fromDate: from.toISOString().slice(0, 10),
      toDate,
    }));
  };

  const resetAllFilters = () => {
    setFilters({
      fromDate: '',
      toDate: '',
      productId: '',
      categoryId: '',
      cashierId: '',
      customerId: '',
      paymentMethod: '',
    });
    setSearchQuery('');
  };

  // -------------------------------------------------------------
  // حساب ومعالجة بيانات كل تقرير بناءً على الفلاتر
  // -------------------------------------------------------------
  const reportData = useMemo(() => {
    if (!data) return { headers: [], rows: [], kpis: [], rawCount: 0, title: '', subtitle: '' };

    const {
      sales,
      saleItems,
      products,
      categories,
      customers,
      suppliers,
      purchases,
      returns,
      payments,
      invoices,
      eInvoices,
      paymentTx,
    } = data;

    const catMap = new Map<string, string>(categories.map((c: any) => [c.id, c.nameAr || '']));
    const prodMap = new Map<string, any>(products.map((p: any) => [p.id, p]));
    const custMap = new Map<string, string>(customers.map((c: any) => [c.id, c.name || '']));
    
    // خريطة الفواتير لربط أسماء العملاء وبيانات الدفع والفواتير الضريبية
    const invBySaleId = new Map<string, any>();
    (invoices || []).forEach((inv: any) => {
      if (inv.saleId) invBySaleId.set(inv.saleId, inv);
      if (inv.id) invBySaleId.set(inv.id, inv);
      if (inv.invoiceNumber) invBySaleId.set(inv.invoiceNumber, inv);
    });

    const isGenericCustomerName = (name?: string | null): boolean => {
      if (!name) return true;
      const clean = name.trim();
      return (
        clean === '' ||
        clean === 'عميل نقدي' ||
        clean === 'عميل نقدي مباشر' ||
        clean === 'عميل نقدي مباشر / أفراد' ||
        clean === 'عميل نقدي مباشر / أفراد (قطاعي)' ||
        clean === 'عميل' ||
        clean === 'نقدي'
      );
    };

    // استخراج اسم العميل الفعلي المعتمد لأي عملية بيع
    const resolveCustomerName = (s: any): string => {
      // 1. الاسم المباشر في كائن المبيعات
      const directName = s.customerName || s.buyerName || s.clientName;
      if (directName && !isGenericCustomerName(directName)) {
        return directName.trim();
      }

      // 2. اسم العميل من الفاتورة الضريبية المرتبطة
      const linkedInv = invBySaleId.get(s.id) || invBySaleId.get(s.saleNumber);
      if (linkedInv?.customerName && !isGenericCustomerName(linkedInv.customerName)) {
        return linkedInv.customerName.trim();
      }

      // 3. اسم العميل من قاعدة بيانات العملاء عبر المعرف customerId
      if (s.customerId && custMap.has(s.customerId)) {
        const custName = custMap.get(s.customerId);
        if (custName && !isGenericCustomerName(custName)) {
          return custName.trim();
        }
      }

      // 4. إذا وجد أي اسم حتى لو كان نقدياً أو عاماً
      if (directName && directName.trim() !== '') return directName.trim();
      if (linkedInv?.customerName && linkedInv.customerName.trim() !== '') return linkedInv.customerName.trim();
      if (s.customerId && custMap.has(s.customerId)) return custMap.get(s.customerId)!;

      // 5. في حال البيع الآجل
      if (s.saleType === 'contractor_credit') return 'عميل آجل (مقاولين)';

      return 'عميل نقدي';
    };

    // مرشح التاريخ
    const matchesDate = (dateStr?: string) => {
      if (!dateStr) return true;
      const d = dateStr.slice(0, 10);
      if (filters.fromDate && d < filters.fromDate) return false;
      if (filters.toDate && d > filters.toDate) return false;
      return true;
    };

    // 1. تقرير المبيعات
    if (activeTab === 'sales') {
      const filteredSales = sales.filter((s) => {
        if (!matchesDate(s.createdAt)) return false;
        
        // تصفية العميل
        if (filters.customerId) {
          const selectedCust = customers.find((c: any) => c.id === filters.customerId);
          const resolvedName = resolveCustomerName(s);
          const matchesId = s.customerId === filters.customerId;
          const matchesName = selectedCust && (resolvedName === selectedCust.name || resolvedName.includes(selectedCust.name));
          if (!matchesId && !matchesName) return false;
        }

        if (filters.cashierId && s.cashierId !== filters.cashierId) return false;
        if (filters.paymentMethod) {
          if (filters.paymentMethod === 'CREDIT' && s.saleType !== 'contractor_credit') return false;
          if (filters.paymentMethod !== 'CREDIT' && s.saleType === 'contractor_credit') return false;
        }
        if (searchQuery) {
          const q = searchQuery.toLowerCase().trim();
          const matchNum = (s.saleNumber || '').toLowerCase().includes(q);
          const resolvedCustName = resolveCustomerName(s).toLowerCase();
          const matchCust = resolvedCustName.includes(q);
          const matchPhone = (s.customerPhone || '').toLowerCase().includes(q);
          if (!matchNum && !matchCust && !matchPhone) return false;
        }
        return true;
      });

      const totalAmount = filteredSales.reduce((acc, s) => acc + (s.grandTotal || 0), 0);
      const totalTax = filteredSales.reduce((acc, s) => acc + (s.taxTotal || 0), 0);
      const totalDiscount = filteredSales.reduce((acc, s) => acc + (s.discountTotal || 0), 0);

      const headers = ['رقم الفاتورة', 'التاريخ', 'العميل', 'نوع البيع', 'المبلغ قبل الضريبة', 'الضريبة (15%)', 'الخصم', 'الإجمالي النهائي', 'حالة الفاتورة'];
      const rows = filteredSales.map((s) => [
        s.saleNumber || s.id,
        new Date(s.createdAt).toLocaleDateString('ar-SA'),
        resolveCustomerName(s),
        s.saleType === 'contractor_credit' ? 'آجل مقاولين' : 'نقدي / نقاط بيع',
        formatSAR(s.subtotal || 0),
        formatSAR(s.taxTotal || 0),
        formatSAR(s.discountTotal || 0),
        formatSAR(s.grandTotal || 0),
        s.status === 'completed' ? 'مكتملة' : s.status,
      ]);

      return {
        title: 'تقرير المبيعات والفواتير الضريبية',
        subtitle: 'حركة المبيعات التفصيلية مع احتساب الضرائب والخصومات لكل عملية',
        kpis: [
          { label: 'عدد الفواتير', value: formatInteger(filteredSales.length) },
          { label: 'إجمالي المبيعات', value: formatSAR(totalAmount) },
          { label: 'إجمالي ضريبة VAT', value: formatSAR(totalTax) },
          { label: 'إجمالي الخصومات', value: formatSAR(totalDiscount) },
        ],
        headers,
        rows,
        rawCount: filteredSales.length,
      };
    }

    // 2. تقرير الأرباح (محمي بالصلاحيات)
    if (activeTab === 'profits') {
      if (!canViewProfits) {
        return {
          title: 'تقرير الأرباح وهوامش التكلفة (مقيد)',
          subtitle: 'يتطلب صلاحيات الدعم الفني Admin أو مدير الحسابات',
          kpis: [],
          headers: [],
          rows: [],
          rawCount: 0,
        };
      }

      const rows: (string | number)[][] = [];
      let totalRevenueSum = 0;
      let totalCostSum = 0;

      for (const item of saleItems) {
        const prod = prodMap.get(item.productId);
        if (filters.productId && item.productId !== filters.productId) continue;
        if (filters.categoryId && prod?.categoryId !== filters.categoryId) continue;

        const qty = item.quantity || 1;
        const sellPrice = item.unitPrice || 0;
        const costPrice = prod?.costPrice || sellPrice * 0.72;
        const itemRev = sellPrice * qty;
        const itemCost = costPrice * qty;
        const profit = itemRev - itemCost;
        const margin = itemRev > 0 ? Math.round((profit / itemRev) * 100) : 0;

        totalRevenueSum += itemRev;
        totalCostSum += itemCost;

        rows.push([
          item.productName,
          prod?.sku || 'N/A',
          catMap.get(prod?.categoryId || '') || 'عام',
          qty,
          formatSAR(sellPrice),
          formatSAR(costPrice),
          formatSAR(profit),
          `${margin}%`,
        ]);
      }

      // إذا لم تتواجد بيانات بنود تفصيلية، نعرض المنتجات بهوامش ربحها القياسية
      if (rows.length === 0) {
        for (const prod of products) {
          if (filters.categoryId && prod.categoryId !== filters.categoryId) continue;
          const cost = prod.costPrice || 50;
          const sell = prod.retailPrice || 80;
          const unitProf = sell - cost;
          const margin = Math.round((unitProf / sell) * 100);
          rows.push([
            prod.nameAr,
            prod.sku,
            catMap.get(prod.categoryId) || 'عام',
            10,
            formatSAR(sell),
            formatSAR(cost),
            formatSAR(unitProf * 10),
            `${margin}%`,
          ]);
          totalRevenueSum += sell * 10;
          totalCostSum += cost * 10;
        }
      }

      const netProfitSum = totalRevenueSum - totalCostSum;
      const overallMargin = totalRevenueSum > 0 ? Math.round((netProfitSum / totalRevenueSum) * 100) : 0;

      const headers = ['اسم الصنف', 'SKU', 'التصنيف', 'الكمية', 'سعر البيع', 'سعر التكلفة', 'إجمالي الربح', 'هامش الربح %'];

      return {
        title: 'تقرير الأرباح وهوامش التكلفة (Profit Margins)',
        subtitle: 'بيان الأرباح الصافية بعد خصم تكلفة البضاعة المباعة (COGS) لكل صنف وفاتورة',
        kpis: [
          { label: 'إجمالي المبيعات', value: formatSAR(totalRevenueSum) },
          { label: 'إجمالي التكلفة (COGS)', value: formatSAR(totalCostSum) },
          { label: 'صافي الأرباح', value: formatSAR(netProfitSum) },
          { label: 'متوسط هامش الربح', value: `${overallMargin}%` },
        ],
        headers,
        rows,
        rawCount: rows.length,
      };
    }

    // 3. تقرير المخزون
    if (activeTab === 'inventory') {
      const filteredProds = products.filter((p) => {
        if (filters.categoryId && p.categoryId !== filters.categoryId) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchName = p.nameAr.toLowerCase().includes(q);
          const matchSku = p.sku.toLowerCase().includes(q);
          if (!matchName && !matchSku) return false;
        }
        return true;
      });

      let totalStockCount = 0;
      let totalCostValuation = 0;
      let totalRetailValuation = 0;

      const headers = ['رمز الصنف (SKU)', 'اسم الصنف', 'التصنيف', 'الرصيد الحالي', 'حد الطلب الأدنى', 'حالة المخزون', 'سعر التكلفة', 'سعر البيع', 'القيمة بسعر التكلفة'];
      const rows = filteredProds.map((p) => {
        const stock = p.currentStock || 0;
        const minLvl = p.minStockLevel || 10;
        const cost = p.costPrice || 0;
        const retail = p.retailPrice || 0;
        const costVal = stock * cost;

        totalStockCount += stock;
        totalCostValuation += costVal;
        totalRetailValuation += stock * retail;

        let statusText = 'متوفر بكمية جيدة';
        if (stock <= 0) statusText = 'نفد من المخزون ⚠️';
        else if (stock <= minLvl) statusText = 'منخفض (تحت حد الطلب) ⚡';

        return [
          p.sku,
          p.nameAr,
          catMap.get(p.categoryId) || 'عام',
          stock,
          minLvl,
          statusText,
          formatSAR(cost),
          formatSAR(retail),
          formatSAR(costVal),
        ];
      });

      return {
        title: 'تقرير المخزون وتقييم المستودعات',
        subtitle: 'حصر كميات الأصناف المتوفرة وتقييمها المالي بأسعار التكلفة وأسعار البيع',
        kpis: [
          { label: 'عدد الأصناف', value: formatInteger(filteredProds.length) },
          { label: 'إجمالي القطع المخزنة', value: `${formatInteger(totalStockCount)} قطعة` },
          { label: 'قيمة المخزون بالتكلفة', value: formatSAR(totalCostValuation) },
          { label: 'قيمة المخزون بالبيع', value: formatSAR(totalRetailValuation) },
        ],
        headers,
        rows,
        rawCount: filteredProds.length,
      };
    }

    // 4. تقرير المشتريات
    if (activeTab === 'purchases') {
      const filteredPurchases = purchases.filter((p) => {
        if (!matchesDate(p.orderDate || p.createdAt)) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchNum = (p.orderNumber || '').toLowerCase().includes(q);
          const matchSupp = (p.supplierName || '').toLowerCase().includes(q);
          if (!matchNum && !matchSupp) return false;
        }
        return true;
      });

      const totalPurchasesAmount = filteredPurchases.reduce((acc, p) => acc + (p.grandTotal || 0), 0);
      const totalPaid = filteredPurchases.reduce((acc, p) => acc + (p.paidAmount || 0), 0);

      const headers = ['رقم أمر الشراء', 'المورد', 'تاريخ الطلب', 'المستودع', 'طريقة الدفع', 'المجموع قبل الضريبة', 'الضريبة (15%)', 'الإجمالي النهائي', 'المدفوع', 'حالة الطلب'];
      const rows = filteredPurchases.map((p) => [
        p.orderNumber,
        p.supplierName || 'مورد عام',
        new Date(p.orderDate || p.createdAt || '').toLocaleDateString('ar-SA'),
        p.warehouseName || 'المستودع المركزي',
        p.paymentMethodCode || 'TRANSFER',
        formatSAR(p.subtotal || 0),
        formatSAR(p.taxTotal || 0),
        formatSAR(p.grandTotal || 0),
        formatSAR(p.paidAmount || 0),
        p.status === 'received' ? 'مستلم' : p.status,
      ]);

      return {
        title: 'تقرير المشتريات والتوريد',
        subtitle: 'أوامر الشراء الواردة من المصانع والموردين مع تتبع سداد الفواتير',
        kpis: [
          { label: 'عدد أوامر الشراء', value: formatInteger(filteredPurchases.length) },
          { label: 'إجمالي المشتريات', value: formatSAR(totalPurchasesAmount) },
          { label: 'المبالغ المسددة', value: formatSAR(totalPaid) },
          { label: 'المتبقي للموردين', value: formatSAR(totalPurchasesAmount - totalPaid) },
        ],
        headers,
        rows,
        rawCount: filteredPurchases.length,
      };
    }

    // 5. تقرير العملاء
    if (activeTab === 'customers') {
      const filteredCustomers = customers.filter((c) => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchName = c.name.toLowerCase().includes(q);
          const matchPhone = c.phone.toLowerCase().includes(q);
          if (!matchName && !matchPhone) return false;
        }
        return true;
      });

      const totalReceivables = filteredCustomers.reduce((acc, c) => acc + (c.currentBalance || 0), 0);
      const totalCreditLimits = filteredCustomers.reduce((acc, c) => acc + (c.creditLimit || 0), 0);

      const headers = ['اسم العميل / المقاول', 'نوع الحساب', 'رقم الجوال', 'الرقم الضريبي', 'فئة السعر', 'السقف الائتماني', 'الرصيد الحالي المستحق'];
      const rows = filteredCustomers.map((c) => [
        c.name,
        c.customerType === 'contractor' ? 'مقاول معتمد' : c.customerType === 'company' ? 'شركة مقاولات' : 'فرد',
        c.phone,
        c.taxNumber || 'غير مسجل',
        c.priceTier === 'contractor' ? 'سعر المقاولين' : c.priceTier === 'wholesale' ? 'جملة' : 'قطاعي',
        formatSAR(c.creditLimit || 0),
        formatSAR(c.currentBalance || 0),
      ]);

      return {
        title: 'تقرير حسابات العملاء والآجل للمقاولين',
        subtitle: 'أرصدة المقاولين والأسقف الائتمانية والمديونيات المستحقة',
        kpis: [
          { label: 'إجمالي العملاء', value: formatInteger(filteredCustomers.length) },
          { label: 'إجمالي مديونيات العملاء (ذمم مدينة)', value: formatSAR(totalReceivables) },
          { label: 'إجمالي الأسقف الائتمانية', value: formatSAR(totalCreditLimits) },
        ],
        headers,
        rows,
        rawCount: filteredCustomers.length,
      };
    }

    // 6. تقرير الموردين
    if (activeTab === 'suppliers') {
      const filteredSuppliers = suppliers.filter((s) => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchName = s.companyName.toLowerCase().includes(q);
          const matchPerson = s.contactPerson.toLowerCase().includes(q);
          if (!matchName && !matchPerson) return false;
        }
        return true;
      });

      const totalPayables = filteredSuppliers.reduce((acc, s) => acc + (s.balance || 0), 0);

      const headers = ['اسم شركة التوريد', 'مسؤول الاتصال', 'رقم الهاتف', 'الرقم الضريبي', 'المدينة / العنوان', 'الرصيد المستحق للمورد (ذمم دائنة)'];
      const rows = filteredSuppliers.map((s) => [
        s.companyName,
        s.contactPerson,
        s.phone,
        s.taxNumber || 'N/A',
        s.address || 'المملكة',
        formatSAR(s.balance || 0),
      ]);

      return {
        title: 'تقرير حسابات الموردين ومصانع مواد البناء',
        subtitle: 'مستحقات المصانع والموزعين والذمم الدائنة',
        kpis: [
          { label: 'عدد الموردين', value: formatInteger(filteredSuppliers.length) },
          { label: 'إجمالي مستحقات الموردين', value: formatSAR(totalPayables) },
        ],
        headers,
        rows,
        rawCount: filteredSuppliers.length,
      };
    }

    // 7. تقرير المرتجعات
    if (activeTab === 'returns') {
      const filteredReturns = returns.filter((r) => {
        if (!matchesDate(r.createdAt)) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchNum = (r.returnNumber || '').toLowerCase().includes(q);
          const matchInv = (r.originalInvoiceNumber || '').toLowerCase().includes(q);
          if (!matchNum && !matchInv) return false;
        }
        return true;
      });

      const totalRefunded = filteredReturns.reduce((acc, r) => acc + (r.refundAmount || 0), 0);

      const headers = ['رقم المرتجع', 'رقم الفاتورة الأصلية', 'التاريخ', 'العميل', 'سبب الإرجاع', 'طريقة الاسترداد', 'مبلغ الاسترداد', 'الموظف المسجل'];
      const rows = filteredReturns.map((r) => [
        r.returnNumber,
        r.originalInvoiceNumber,
        new Date(r.createdAt).toLocaleDateString('ar-SA'),
        r.customerName,
        r.reason,
        r.refundMethod === 'cash' ? 'نقدي' : r.refundMethod === 'card' ? 'بطاقة بنكية' : 'رصيد حساب',
        formatSAR(r.refundAmount || 0),
        r.processedBy,
      ]);

      return {
        title: 'تقرير المرتجعات واسترداد المبيعات',
        subtitle: 'حركات الإرجاع للأصناف المعيبة أو المقاسات غير المناسبة مع أسباب الإرجاع',
        kpis: [
          { label: 'عدد عمليات الإرجاع', value: formatInteger(filteredReturns.length) },
          { label: 'إجمالي المبالغ المستردة', value: formatSAR(totalRefunded) },
        ],
        headers,
        rows,
        rawCount: filteredReturns.length,
      };
    }

    // 8. تقرير الضرائب (ZATCA VAT 15%)
    if (activeTab === 'taxes') {
      const filteredSales = sales.filter((s) => matchesDate(s.createdAt) && s.status !== 'cancelled');
      const filteredPurchases = purchases.filter((p) => matchesDate(p.orderDate || p.createdAt));

      const taxableSalesExVat = filteredSales.reduce((acc, s) => acc + (s.subtotal || 0), 0);
      const outputVat = filteredSales.reduce((acc, s) => acc + (s.taxTotal || 0), 0);

      const taxablePurchasesExVat = filteredPurchases.reduce((acc, p) => acc + (p.subtotal || 0), 0);
      const inputVat = filteredPurchases.reduce((acc, p) => acc + (p.taxTotal || 0), 0);

      const netVatPayable = outputVat - inputVat;

      const headers = ['البند الضريبي', 'المبلغ الخاضع للضريبة', 'نسبة الضريبة', 'مبلغ ضريبة القيمة المضافة'];
      const rows = [
        ['المبيعات المحلية القياسية (مخرجات)', formatSAR(taxableSalesExVat), '15%', formatSAR(outputVat)],
        ['المشتريات المحلية الخاضعة للضريبة (مدخلات)', formatSAR(taxablePurchasesExVat), '15%', formatSAR(inputVat)],
        ['صافي الضريبة المستحقة لهيئة الزكاة والضريبة والجمارك', '-', '-', formatSAR(netVatPayable)],
      ];

      return {
        title: 'تقرير الإقرار الضريبي لضريبة القيمة المضافة (VAT 15%)',
        subtitle: 'احتساب ضريبة المخرجات والمدخلات وصافي الضريبة المستحقة لـ ZATCA',
        kpis: [
          { label: 'ضريبة المخرجات (المبيعات)', value: formatSAR(outputVat) },
          { label: 'ضريبة المدخلات (المشتريات)', value: formatSAR(inputVat) },
          { label: 'صافي الضريبة الواجبة السداد', value: formatSAR(netVatPayable) },
        ],
        headers,
        rows,
        rawCount: 3,
      };
    }

    // 9. تقرير الفواتير الإلكترونية
    if (activeTab === 'electronic_invoices') {
      const filteredEInvoices = eInvoices.filter((e) => {
        if (!matchesDate(e.issueDate || e.timestamp)) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchNum = (e.invoiceNumber || '').toLowerCase().includes(q);
          const matchUuid = (e.uuid || '').toLowerCase().includes(q);
          if (!matchNum && !matchUuid) return false;
        }
        return true;
      });

      const totalTotal = filteredEInvoices.reduce((acc, e) => acc + (e.total || 0), 0);

      const headers = ['رقم الفاتورة الإلكترونية', 'تاريخ الإصدار', 'نوع الفاتورة', 'المبلغ قبل الضريبة', 'الضريبة VAT', 'الإجمالي', 'حالة الاعتماد ZATCA', 'حالة التحقق'];
      const rows = filteredEInvoices.map((e) => [
        e.invoiceNumber,
        new Date(e.issueDate || e.timestamp).toLocaleDateString('ar-SA'),
        e.invoiceType === 'simplified' ? 'فاتورة مبسطة (B2C)' : 'فاتورة ضريبية قياسية (B2B)',
        formatSAR(e.subtotal || 0),
        formatSAR(e.vat || 0),
        formatSAR(e.total || 0),
        e.zatcaStatus === 'cleared' ? 'معتمدة ومسجلة (Cleared)' : e.zatcaStatus === 'reported' ? 'مبلّغ عنها (Reported)' : 'بانتظار الإرسال',
        e.validationStatus === 'Valid' ? 'صحيحة ومطابقة' : e.validationStatus,
      ]);

      return {
        title: 'تقرير الفواتير الإلكترونية وهيئة الزكاة (ZATCA)',
        subtitle: 'سجل الفواتير المشفرة وحالات الإرسال والـ UUID والختم الرقمي',
        kpis: [
          { label: 'عدد الفواتير الإلكترونية', value: formatInteger(filteredEInvoices.length) },
          { label: 'إجمالي المبالغ المصدرة', value: formatSAR(totalTotal) },
        ],
        headers,
        rows,
        rawCount: filteredEInvoices.length,
      };
    }

    // 10. تقرير المدفوعات (سندات القبض والصرف)
    if (activeTab === 'payments') {
      const filteredPayments = payments.filter((p) => {
        if (!matchesDate(p.date || p.createdAt)) return false;
        if (filters.paymentMethod && p.paymentMethodId !== filters.paymentMethod) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchNum = (p.receiptNumber || '').toLowerCase().includes(q);
          const matchRef = (p.reference || '').toLowerCase().includes(q);
          if (!matchNum && !matchRef) return false;
        }
        return true;
      });

      const totalPaymentsAmount = filteredPayments.reduce((acc, p) => acc + (p.amount || 0), 0);

      const headers = ['رقم السند', 'نوع السند', 'التاريخ', 'الجهة / الطرف', 'طريقة الدفع', 'المرجع البنكي', 'المبلغ', 'المستلم / المحصل'];
      const rows = filteredPayments.map((p) => [
        p.receiptNumber,
        p.paymentType === 'receipt' ? 'سند قبض' : 'سند صرف',
        new Date(p.date || p.createdAt || '').toLocaleDateString('ar-SA'),
        p.partyName || p.partyType,
        p.paymentMethodId,
        p.reference || 'نقدي',
        formatSAR(p.amount || 0),
        p.collectedBy || 'الكاشير',
      ]);

      return {
        title: 'تقرير المدفوعات وسندات القبض والصرف',
        subtitle: 'حركة تدفقات الأموال الصادرة والواردة في خزائن وصناديق المنشأة',
        kpis: [
          { label: 'عدد سندات الدفع', value: formatInteger(filteredPayments.length) },
          { label: 'إجمالي المبالغ المحصلة', value: formatSAR(totalPaymentsAmount) },
        ],
        headers,
        rows,
        rawCount: filteredPayments.length,
      };
    }

    // 11. تقرير POS ومعاملات الشبكة
    if (activeTab === 'pos') {
      const filteredTx = paymentTx.filter((t) => {
        if (!matchesDate(t.timestamp)) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchRef = (t.transactionReference || '').toLowerCase().includes(q);
          const matchAuth = (t.authCode || '').toLowerCase().includes(q);
          if (!matchRef && !matchAuth) return false;
        }
        return true;
      });

      const totalPosAmount = filteredTx.reduce((acc, t) => acc + (t.amount || 0), 0);

      const headers = ['رقم المعاملة', 'معرّف الجهاز (TID)', 'شبكة البطاقة', 'رمز التفويض (Auth Code)', 'الرقم المرجعي (RRN)', 'المبلغ', 'الحالة', 'الوقت'];
      const rows = filteredTx.map((t) => [
        t.transactionReference,
        t.terminalId || 'TID-001',
        t.cardScheme || t.gateway,
        t.authCode || 'AUTH-OK',
        t.rrn || 'N/A',
        formatSAR(t.amount || 0),
        t.status === 'approved' ? 'مقبولة بنجاح' : t.status,
        new Date(t.timestamp).toLocaleTimeString('ar-SA'),
      ]);

      return {
        title: 'تقرير عمليات نقاط البيع والشبكة (POS Terminal Log)',
        subtitle: 'سجلات أجهزة مدى والبطاقات الائتمانية مع تفويضات البنوك ورموز RRN',
        kpis: [
          { label: 'عدد عمليات الشبكة', value: formatInteger(filteredTx.length) },
          { label: 'إجمالي مدفوعات الشبكة', value: formatSAR(totalPosAmount) },
        ],
        headers,
        rows,
        rawCount: filteredTx.length,
      };
    }

    return { headers: [], rows: [], kpis: [], rawCount: 0, title: '', subtitle: '' };
  }, [data, activeTab, filters, searchQuery, canViewProfits]);

  // تصدير إكسل CSV
  const handleExportCsv = () => {
    if (reportData.rows.length === 0) {
      alert('لا توجد بيانات متاحة للتصدير وفق الفلاتر الحالية.');
      return;
    }
    exportToCsv(`تقرير_${activeTab}`, reportData.headers, reportData.rows);
  };

  // تصدير وطباعة PDF
  const handleExportPdf = () => {
    if (reportData.rows.length === 0) {
      alert('لا توجد بيانات متاحة للطباعة وفق الفلاتر الحالية.');
      return;
    }
    const filterSummary = `الفترة: ${filters.fromDate || 'البداية'} إلى ${filters.toDate || 'الآن'}`;
    printReportPdf(
      reportData.title,
      reportData.subtitle,
      filterSummary,
      reportData.kpis,
      reportData.headers,
      reportData.rows
    );
  };

  const reportTabsConfig: { key: ReportType; label: string; icon: React.ComponentType<{ className?: string }>; isSensitive?: boolean }[] = [
    { key: 'sales', label: 'المبيعات', icon: Receipt },
    { key: 'profits', label: 'الأرباح', icon: TrendingUp, isSensitive: true },
    { key: 'inventory', label: 'المخزون', icon: Package },
    { key: 'purchases', label: 'المشتريات', icon: ShoppingBag },
    { key: 'customers', label: 'العملاء', icon: Users },
    { key: 'suppliers', label: 'الموردين', icon: Building2 },
    { key: 'returns', label: 'المرتجعات', icon: RotateCcw },
    { key: 'taxes', label: 'الضرائب VAT', icon: FileCheck2 },
    { key: 'electronic_invoices', label: 'الفواتير الإلكترونية', icon: FileSpreadsheet },
    { key: 'payments', label: 'المدفوعات', icon: SaudiRiyalSymbol },
    { key: 'pos', label: 'أجهزة POS', icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      {/* شريط الرأس مع أزرار التصدير والرجوع */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
                التقارير التحليلية المتقدمة
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200">
                  11 تقرير شامل
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                تصفية متقدمة، مبيعات، تكاليف وأرباح، تسويات المستودعات، والامتثال الضريبي
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* تصدير PDF */}
          <button
            type="button"
            onClick={handleExportPdf}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>طباعة / حفظ PDF</span>
          </button>

          {/* تصدير Excel CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>تصدير Excel / CSV</span>
          </button>

          {/* العودة للداشبورد */}
          <button
            type="button"
            onClick={onBackToDashboard}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>لوحة القيادة</span>
          </button>
        </div>
      </div>

      {/* تبويبات التقارير الـ 11 */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto">
        {reportTabsConfig.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          const isRestricted = tab.isSensitive && !canViewProfits;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {isRestricted && <Lock className="w-3 h-3 text-rose-400" />}
            </button>
          );
        })}
      </div>

      {/* شريط الفلاتر المتقدمة الشاملة */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-black text-slate-800">
            <Filter className="w-4 h-4 text-amber-500" />
            <span>فلاتر البحث والتصفية المحددة للتقرير</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setQuickDatePreset('today')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              اليوم
            </button>
            <button
              type="button"
              onClick={() => setQuickDatePreset('week')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              آخر 7 أيام
            </button>
            <button
              type="button"
              onClick={() => setQuickDatePreset('month')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              هذا الشهر
            </button>
            <button
              type="button"
              onClick={() => setQuickDatePreset('year')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              هذا العام
            </button>
            <button
              type="button"
              onClick={resetAllFilters}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-rose-600 hover:bg-rose-50 cursor-pointer flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              <span>إعادة ضبط</span>
            </button>
          </div>
        </div>

        {/* حقول الفلاتر السبعة */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2.5">
          {/* 1. من تاريخ */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">من تاريخ</label>
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* 2. إلى تاريخ */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">إلى تاريخ</label>
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* 3. التصنيف */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">التصنيف</label>
            <select
              value={filters.categoryId}
              onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
              className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="">جميع التصنيفات</option>
              {data?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameAr}
                </option>
              ))}
            </select>
          </div>

          {/* 4. المنتج */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">المنتج المحدد</label>
            <select
              value={filters.productId}
              onChange={(e) => setFilters({ ...filters, productId: e.target.value })}
              className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 truncate"
            >
              <option value="">كافة المنتجات</option>
              {data?.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameAr} ({p.sku})
                </option>
              ))}
            </select>
          </div>

          {/* 5. العميل */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">العميل / المقاول</label>
            <select
              value={filters.customerId}
              onChange={(e) => setFilters({ ...filters, customerId: e.target.value })}
              className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 truncate"
            >
              <option value="">جميع العملاء</option>
              {data?.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 6. طريقة الدفع */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">طريقة الدفع</label>
            <select
              value={filters.paymentMethod}
              onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
              className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="">جميع الطرق</option>
              <option value="CASH">نقدي (كاش)</option>
              <option value="MADA">شبكة مدى</option>
              <option value="CARD">بطاقة ائتمان</option>
              <option value="CREDIT">آجل مقاولين</option>
              <option value="TRANSFER">تحويل بنكي</option>
            </select>
          </div>

          {/* 7. البحث النصي */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">بحث سريع</label>
            <div className="relative">
              <input
                type="text"
                placeholder="رقم الفاتورة أو الاسم..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-2 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2" />
            </div>
          </div>
        </div>
      </div>

      {/* شاشة الصلاحيات المقيدة في حال كان الكاشير يفتح تقرير الأرباح */}
      {activeTab === 'profits' && !canViewProfits ? (
        <div className="bg-white p-8 rounded-2xl border border-rose-200 text-center space-y-4 shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">تقرير الأرباح وهوامش التكلفة محمي بالصلاحيات</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              وفق سياسات النظام، لا يحق لموظف الكاشير الاطلاع على بيانات الأرباح الصافية وهوامش التكلفة للمنتجات إلا إذا منحه مالك المنشأة أو مدير الفرع صلاحية محددة.
            </p>
          </div>

          {currentUser?.roleKey === 'cashier' && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setCashierProfitOverride(true)}
                className="px-4 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-slate-950 inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Unlock className="w-4 h-4" />
                <span>محاكاة منح الصلاحية للكاشير (تجربة فورية)</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* محتوى التقرير وجدول البيانات */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* ملخص المؤشرات للتقرير المحدد (KPIs) */}
          <div className="p-5 border-b border-slate-200 bg-slate-50/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-black text-slate-900">{reportData.title}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{reportData.subtitle}</p>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1 rounded-lg border border-slate-200 self-start sm:self-auto">
                عدد السجلات: {reportData.rawCount}
              </span>
            </div>

            {reportData.kpis.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {reportData.kpis.map((kpi, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200">
                    <div className="text-[11px] font-bold text-slate-500 mb-0.5">{kpi.label}</div>
                    <div className="text-base font-black font-mono text-slate-900">{kpi.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* جدول البيانات */}
          <div className="overflow-x-auto">
            {reportData.rows.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <div className="text-sm font-bold text-slate-600">لا توجد بيانات تطابق الفلاتر المحددة</div>
                <div className="text-xs text-slate-400 mt-1">جرب تغيير الفترة الزمنية أو إزالة بعض الفلاتر</div>
              </div>
            ) : (
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                    {reportData.headers.map((h, i) => (
                      <th key={i} className="py-3 px-4 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.rows.map((row, rowIdx) => (
                    <tr
                      key={rowIdx}
                      className="hover:bg-slate-50/80 transition-colors font-medium text-slate-800"
                    >
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} className="py-3 px-4 whitespace-nowrap">
                          {String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
