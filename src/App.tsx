/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider, useSystemSettings } from './context/SettingsContext';
import { Header } from './components/Header';
import { ConnectionBanner } from './components/ConnectionBanner';
import { ProductsViewer } from './components/ProductsViewer';
import { RoleMatrix } from './components/RoleMatrix';
import { AuditTrail } from './components/AuditTrail';
import { AddProductModal } from './components/AddProductModal';
import { InventoryManager } from './components/InventoryManager';
import { PosScreen } from './components/pos/PosScreen';
import { InvoicesLookupScreen } from './components/pos/InvoicesLookupScreen';
import { ZatcaScreen } from './components/zatca/ZatcaScreen';
import { PaymentSettingsScreen } from './components/settings/PaymentSettingsScreen';
import { CustomersScreen } from './components/customers/CustomersScreen';
import { SuppliersScreen } from './components/suppliers/SuppliersScreen';
import { PurchasesScreen } from './components/purchases/PurchasesScreen';
import { PaymentsScreen } from './components/payments/PaymentsScreen';
import { ReturnsScreen } from './components/returns/ReturnsScreen';
import { QuotationsScreen } from './components/quotations/QuotationsScreen';
import { DashboardScreen } from './components/dashboard/DashboardScreen';
import { ReportsScreen } from './components/reports/ReportsScreen';
import { SettingsScreen } from './components/settings/SettingsScreen';
import { LoginScreen } from './components/auth/LoginScreen';
import { AccessDeniedView } from './components/common/AccessDeniedView';
import { FloatingPwaInstallButton } from './components/common/FloatingPwaInstallButton';
import { ReportType } from './services/reports';
import { getCollectionsOverview, getCollectionDocs, getWarehouses, sortWarehouses } from './services/db';
import { testFirestoreConnection } from './lib/firebase';
import { updateAppFavicon, getStoredLogoUrl } from './utils/favicon';
import { Product, Category, Brand, Unit, Warehouse, Customer, Supplier, DatabaseCollectionName, RoleKey } from './types';
import {
  Layers,
  Package,
  ShieldCheck,
  ShieldAlert,
  BarChart3,
  TrendingUp,
  Warehouse as WarehouseIcon,
  Users,
  CheckCircle2,
  RefreshCw,
  Boxes,
  Store,
  FileCheck2,
  CreditCard,
  Truck,
  ShoppingCart,
  RotateCcw,
  FileSpreadsheet,
  Settings,
  Lock,
} from 'lucide-react';
import { SaudiRiyalSymbol, SaudiReceiptIcon as Receipt } from './components/common/SaudiRiyalSymbol';

type TabType =
  | 'dashboard'
  | 'pos'
  | 'invoices_lookup'
  | 'quotations'
  | 'returns'
  | 'reports'
  | 'payments'
  | 'zatca'
  | 'payment_terminals'
  | 'customers'
  | 'suppliers'
  | 'purchases'
  | 'catalog'
  | 'inventory'
  | 'roles'
  | 'audit'
  | 'settings';

const DashboardContent: React.FC = () => {
  const { currentUser, canAccessTab } = useAuth();
  const { facility } = useSystemSettings();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedReportTab, setSelectedReportTab] = useState<ReportType>('sales');
  const [paymentTargetCustomer, setPaymentTargetCustomer] = useState<Customer | null>(null);
  const [paymentTargetSupplier, setPaymentTargetSupplier] = useState<Supplier | null>(null);
  const [purchaseTargetSupplier, setPurchaseTargetSupplier] = useState<Supplier | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionSuccess, setConnectionSuccess] = useState(true);

  const getDefaultTabForRole = useCallback((roleKey?: RoleKey): TabType => {
    switch (roleKey) {
      case 'cashier':
        return 'pos';
      case 'sales_rep':
        return 'quotations';
      case 'inventory_officer':
        return 'inventory';
      case 'manager':
      case 'system_owner':
      default:
        return 'dashboard';
    }
  }, []);

  // توجيه المستخدم تلقائياً وتحديث أيقونة الموقع (Favicon)
  useEffect(() => {
    updateAppFavicon(getStoredLogoUrl() || undefined);
    if (currentUser) {
      if (!canAccessTab(activeTab)) {
        setActiveTab(getDefaultTabForRole(currentUser.roleKey));
      }
    }
  }, [currentUser?.id, currentUser?.roleKey, canAccessTab, getDefaultTabForRole]);

  const loadData = useCallback(async () => {
    try {
      setIsConnecting(true);
      const [collCounts, prods, cats, brs, uns, whs] = await Promise.all([
        getCollectionsOverview().catch(() => ({} as Record<DatabaseCollectionName, number>)),
        getCollectionDocs<Product>('products', 100).catch(() => []),
        getCollectionDocs<Category>('categories', 50).catch(() => []),
        getCollectionDocs<Brand>('brands', 50).catch(() => []),
        getCollectionDocs<Unit>('units', 50).catch(() => []),
        getWarehouses().catch(() => []),
      ]);

      setCounts(collCounts);
      setProducts(prods);
      setCategories(cats);
      setBrands(brs);
      setUnits(uns);
      setWarehouses(sortWarehouses(whs));
    } catch (error) {
      console.error('خطأ في تحميل بيانات لوحة التحكم:', error);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    testFirestoreConnection().then((res) => {
      setConnectionSuccess(res.success);
    });
  }, [loadData]);

  // الاستماع لتغييرات وترتيب المستودعات لتحديث الحالة العامة فوراً
  useEffect(() => {
    const handleWarehousesChanged = (e: any) => {
      const updated = e.detail;
      if (Array.isArray(updated) && updated.length > 0) {
        setWarehouses(sortWarehouses(updated));
      } else {
        getWarehouses().then((whList) => setWarehouses(sortWarehouses(whList)));
      }
    };
    window.addEventListener('warehouses-changed', handleWarehousesChanged);
    return () => window.removeEventListener('warehouses-changed', handleWarehousesChanged);
  }, []);

  // إحصائيات سريعة للبطاقات
  const totalProducts = counts['products'] || products.length;
  const totalCustomers = counts['customers'] || 0;
  const totalWarehouses = counts['warehouses'] || 0;
  const totalSales = counts['sales'] || 0;
  const totalAuditLogs = counts['audit_logs'] || 0;

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={() => setActiveTab(getDefaultTabForRole(currentUser?.roleKey))} />;
  }

  const isCurrentTabAuthorized = canAccessTab(activeTab);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900 font-sans">
      <Header
        onRefreshData={loadData}
        isConnecting={isConnecting}
        connectionSuccess={connectionSuccess}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-20 lg:pb-8">
        {/* بنر الاتصال السحابي وبطاقات المؤشرات العامة (تظهر في لوحة التحكم للحفاظ على اتساع شاشات العمليات) */}
        {activeTab === 'dashboard' && (
          <>
            <ConnectionBanner
              onSeedCompleted={loadData}
              collectionsCount={counts}
            />

            {/* بطاقات المؤشرات الرقمية العامة */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
              <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">أصناف الكتالوج</span>
                  <Package className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono text-slate-900">{totalProducts}</div>
                <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">كالونات، أقفال، عدد، عوازل</div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">العملاء والمقاولون</span>
                  <Users className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono text-slate-900">{totalCustomers}</div>
                <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">شركات مقاولات وورش</div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">المستودعات والمخازن</span>
                  <WarehouseIcon className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono text-slate-900">{totalWarehouses}</div>
                <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">المركزي، الأقفال، الكيماويات</div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">فواتير ونقاط البيع</span>
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono text-slate-900">{totalSales}</div>
                <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">فواتير ضريبية مبسطة</div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">سجلات التدقيق</span>
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono text-slate-900">{totalAuditLogs}</div>
                <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">حركات أمان موثقة</div>
              </div>
            </div>
          </>
        )}

        {/* أشرطة التنقل والتبويب بين أركان النظام المحاسبي المتكامل لمواد البناء */}
        <div className="flex items-center gap-1.5 sm:gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar scroll-smooth">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'dashboard'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span>لوحة القيادة والمؤشرات 📊</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pos')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'pos'
                ? 'bg-emerald-600 text-white shadow-xs font-black'
                : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>نقطة البيع (POS) ⚡</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('returns')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'returns'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'text-rose-900 bg-rose-50/80 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-rose-600" />
            <span>المرتجعات وإشعار دائن</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'payments'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-purple-900 bg-purple-50/70 hover:bg-purple-100 border border-purple-200'
            }`}
          >
            <SaudiRiyalSymbol className="w-4 h-4 text-purple-600" />
            <span>سندات القبض والصرف</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payment_terminals')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'payment_terminals'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-blue-900 bg-blue-50/70 hover:bg-blue-100 border border-blue-200'
            }`}
          >
            <CreditCard className="w-4 h-4 text-blue-600" />
            <span>طرق الدفع وأجهزة POS</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'customers'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-900 bg-amber-50/70 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <Users className="w-4 h-4 text-amber-600" />
            <span>العملاء والذمم</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('suppliers')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'suppliers'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-blue-900 bg-blue-50/70 hover:bg-blue-100 border border-blue-200'
            }`}
          >
            <Truck className="w-4 h-4 text-blue-600" />
            <span>الموردون والمصانع</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('purchases')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'purchases'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-emerald-900 bg-emerald-50/70 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <Package className="w-4 h-4 text-emerald-600" />
            <span>المشتريات والتوريد</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'catalog'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>كتالوج مواد البناء</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'inventory'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <WarehouseIcon className="w-4 h-4" />
            <span>المخزون والمستودعات</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('roles')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'roles'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>المستخدمين والأدوار</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'audit'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>سجلات التدقيق</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'settings'
                ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                : 'text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-300'
            }`}
          >
            <Settings className="w-4 h-4 text-amber-700" />
            <span>إعدادات النظام والنسخ ⚙️</span>
          </button>
        </div>

        {/* محتوى التبويب النشط مع التحقق الصارم من الصلاحيات */}
        {!isCurrentTabAuthorized ? (
          <AccessDeniedView
            onNavigateToPermitted={() => setActiveTab(getDefaultTabForRole(currentUser?.roleKey))}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardScreen
                onOpenReports={(repKey) => {
                  if (repKey) setSelectedReportTab(repKey as ReportType);
                  setActiveTab('reports');
                }}
                onOpenPos={() => setActiveTab('pos')}
                onOpenInventory={() => setActiveTab('inventory')}
                onOpenInvoicesLookup={() => setActiveTab('invoices_lookup')}
                onOpenQuotations={() => setActiveTab('quotations')}
                onOpenPayments={() => setActiveTab('payments')}
                onOpenPurchases={() => setActiveTab('purchases')}
              />
            )}

            {activeTab === 'reports' && (
              <ReportsScreen
                initialReportTab={selectedReportTab}
                onBackToDashboard={() => setActiveTab('dashboard')}
              />
            )}

            {activeTab === 'pos' && (
              <PosScreen
                initialProducts={products}
                initialWarehouses={warehouses}
                onRefreshData={loadData}
                onOpenPaymentSettings={() => setActiveTab('payment_terminals')}
                onOpenReturns={() => setActiveTab('returns')}
                onOpenQuotations={() => setActiveTab('quotations')}
                onOpenInvoicesLookup={() => setActiveTab('invoices_lookup')}
              />
            )}

            {activeTab === 'invoices_lookup' && (
              <InvoicesLookupScreen onBackToPos={() => setActiveTab('pos')} />
            )}

            {activeTab === 'zatca' && (
              <ZatcaScreen />
            )}

            {activeTab === 'payment_terminals' && (
              <PaymentSettingsScreen onBackToPos={() => setActiveTab('pos')} />
            )}

            {activeTab === 'quotations' && (
              <QuotationsScreen />
            )}

            {activeTab === 'returns' && (
              <ReturnsScreen />
            )}

            {activeTab === 'customers' && (
              <CustomersScreen
                onRecordPaymentClick={(cust) => {
                  setPaymentTargetCustomer(cust);
                  setActiveTab('payments');
                }}
              />
            )}

            {activeTab === 'suppliers' && (
              <SuppliersScreen
                onRecordDisbursementClick={(supp) => {
                  setPaymentTargetSupplier(supp);
                  setActiveTab('payments');
                }}
                onCreatePurchaseClick={(supp) => {
                  setPurchaseTargetSupplier(supp);
                  setActiveTab('purchases');
                }}
              />
            )}

            {activeTab === 'purchases' && (
              <PurchasesScreen initialSupplier={purchaseTargetSupplier} />
            )}

            {activeTab === 'payments' && (
              <PaymentsScreen
                initialPartyType={paymentTargetCustomer ? 'customer' : paymentTargetSupplier ? 'supplier' : 'customer'}
                initialParty={paymentTargetCustomer || paymentTargetSupplier || null}
              />
            )}

            {activeTab === 'catalog' && (
              <ProductsViewer
                products={products}
                categories={categories}
                brands={brands}
                units={units}
                onOpenAddModal={() => setIsAddModalOpen(true)}
                onRefresh={loadData}
              />
            )}

            {activeTab === 'inventory' && (
              <InventoryManager
                products={products}
                warehouses={warehouses}
                onRefresh={loadData}
              />
            )}

            {activeTab === 'roles' && (
              <RoleMatrix />
            )}

            {activeTab === 'audit' && (
              <AuditTrail />
            )}

            {activeTab === 'settings' && (
              <SettingsScreen />
            )}
          </>
        )}
      </main>

      {/* نافذة إضافة صنف جديد */}
      <AddProductModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        categories={categories}
        brands={brands}
        units={units}
        warehouses={warehouses}
        onProductCreated={loadData}
      />

      {/* تذييل الصفحة */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mb-14 lg:mb-0">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            {facility.nameAr || 'مؤسسة عماد سعد آل سعيد لمواد البناء'} ERP & POS — النظام السحابي المتكامل لمواد البناء ومستلزمات المقاولين
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span>Cloud Firestore</span> • <span>RBAC Security</span> • <span>ZATCA Compliant Ready</span>
          </div>
        </div>
      </footer>

      {/* شريط التنقل السفلي السريع للأجهزة المحمولة وشاشات اللمس */}
      <nav
        aria-label="التنقل السفلي للجوال"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))]"
      >
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-bold transition-all ${
            activeTab === 'dashboard' ? 'text-amber-600 font-black' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-5 h-5 mb-0.5" />
          <span>المؤشرات</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pos')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl text-[10px] font-bold transition-all ${
            activeTab === 'pos'
              ? 'bg-slate-900 text-amber-400 shadow-xs font-black'
              : 'text-slate-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/60'
          }`}
        >
          <Store className="w-5 h-5 mb-0.5" />
          <span>الكاشير POS</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('invoices_lookup')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-bold transition-all ${
            activeTab === 'invoices_lookup' ? 'text-amber-600 font-black' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt className="w-5 h-5 mb-0.5" />
          <span>الفواتير</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-bold transition-all ${
            activeTab === 'catalog' ? 'text-amber-600 font-black' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className="w-5 h-5 mb-0.5" />
          <span>الكتالوج</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('customers')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-bold transition-all ${
            activeTab === 'customers' ? 'text-amber-600 font-black' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-5 h-5 mb-0.5" />
          <span>العملاء</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-bold transition-all ${
            activeTab === 'settings' ? 'text-amber-600 font-black' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Settings className="w-5 h-5 mb-0.5" />
          <span>الإعدادات</span>
        </button>
      </nav>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <DashboardContent />
        <FloatingPwaInstallButton />
      </SettingsProvider>
    </AuthProvider>
  );
}
