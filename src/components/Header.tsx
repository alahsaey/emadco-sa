/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { EmadcoLogo } from './common/EmadcoLogo';
import {
  LayoutDashboard,
  Store,
  FileSpreadsheet,
  ShoppingBag,
  Settings,
  Database,
  LogOut,
  ChevronDown,
  User as UserIcon,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Users,
  Lock,
  Sparkles,
  CheckCircle2,
  Printer,
  Download,
  Share2,
  Menu,
  X,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { SaudiReceiptIcon as Receipt } from './common/SaudiReceiptIcon';
import { RoleKey } from '../types';
import { PwaInstallModal } from './common/PwaInstallModal';
import { ShareWebsiteModal } from './common/ShareWebsiteModal';
import { testFirestoreConnection } from '../lib/firebase';
import { DatabaseFormatModal } from './settings/DatabaseFormatModal';
import { usePwaInstall } from '../hooks/usePwaInstall';

interface HeaderProps {
  onRefreshData: () => void;
  isConnecting: boolean;
  connectionSuccess: boolean;
  activeTab?: string;
  onSelectTab?: (tab: any) => void;
}

const ROLE_LABELS: Record<RoleKey, { label: string; bg: string; text: string; border: string }> = {
  system_owner: { label: 'الدعم الفني Admin', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  manager: { label: 'مدير المنشأة', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  cashier: { label: 'كاشير POS', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  sales_rep: { label: 'مندوب مبيعات', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  inventory_officer: { label: 'مسؤول المخزون', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
};

export const Header: React.FC<HeaderProps> = ({
  onRefreshData,
  isConnecting,
  connectionSuccess,
  activeTab = 'dashboard',
  onSelectTab,
}) => {
  const { currentUser, logout, canAccessTab, onlineUsers } = useAuth();
  const { isInstalled } = usePwaInstall();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isFormatModalOpen, setIsFormatModalOpen] = useState(false);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [testConnMessage, setTestConnMessage] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isAdmin = currentUser?.roleKey === 'system_owner' || currentUser?.roleKey === 'manager';

  const handleTestConnectionFromMenu = async () => {
    setIsTestingConn(true);
    setTestConnMessage(null);
    try {
      const res = await testFirestoreConnection();
      setTestConnMessage(res.message);
    } catch (e: any) {
      setTestConnMessage(e?.message || 'فشل الاتصال');
    } finally {
      setIsTestingConn(false);
    }
  };

  // إغلاق قائمة الجوال عند توسيع الشاشة
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1200) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // إغلاق القائمة المنسدلة تلقائياً عند النقر خارجها أو الضغط على Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
        setIsMobileMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUserMenuOpen]);

  const currentRoleInfo = currentUser?.roleKey
    ? ROLE_LABELS[currentUser.roleKey]
    : { label: 'مستخدم', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };

  const navItems = [
    {
      id: 'dashboard',
      label: 'لوحة القيادة',
      icon: LayoutDashboard,
      restricted: !canAccessTab('dashboard'),
    },
    {
      id: 'pos',
      label: 'نقطة البيع (POS)',
      icon: Store,
      badge: 'مباشر',
      restricted: !canAccessTab('pos'),
    },
  ];

  const hamburgerNavItems = [
    {
      id: 'dashboard',
      label: 'لوحة القيادة والمؤشرات',
      icon: LayoutDashboard,
      restricted: !canAccessTab('dashboard'),
    },
    {
      id: 'pos',
      label: 'نقطة البيع (POS)',
      icon: Store,
      badge: 'مباشر',
      restricted: !canAccessTab('pos'),
    },
    {
      id: 'invoices_lookup',
      label: 'استعلام وطباعة الفواتير',
      icon: Receipt,
      restricted: false,
    },
    {
      id: 'quotations',
      label: 'عروض الأسعار',
      icon: FileSpreadsheet,
      restricted: !canAccessTab('quotations'),
    },
    {
      id: 'reports',
      label: 'التقارير المحاسبية',
      icon: FileSpreadsheet,
      restricted: !canAccessTab('reports'),
    },
    {
      id: 'zatca',
      label: 'الفوترة ZATCA',
      icon: ShieldCheck,
      restricted: !canAccessTab('zatca'),
    },
  ];

  const handleMenuNavigate = (tab: string) => {
    setIsUserMenuOpen(false);
    if (onSelectTab) {
      onSelectTab(tab);
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18 gap-1.5 sm:gap-4">
          {/* الشعار واسم النظام عمادكو */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1 sm:flex-initial">
            <div className="hidden sm:block">
              <EmadcoLogo size="md" variant="compact" showSubtitle={true} />
            </div>
            <div className="sm:hidden min-w-0">
              <EmadcoLogo size="xs" variant="compact" showSubtitle={false} className="max-w-[135px] xs:max-w-[170px]" />
            </div>
          </div>

          {/* أزرار التنقل الرئيسية مع احترام وتطبيق الصلاحيات */}
          {onSelectTab && (
            <nav className="hidden lg:flex items-center gap-1.5 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const isRestricted = item.restricted;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectTab(item.id)}
                    className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm'
                        : isRestricted
                        ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/40 opacity-70'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                    }`}
                  >
                    {isRestricted ? (
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
                    )}
                    <span>{item.label}</span>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                          isActive ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          )}

          {/* الجزء الأيسر: بطاقة المستخدم ذات الأولوية، أزرار الأدوات، والقائمة */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* بطاقة المستخدم المسجل حالياً مع القائمة المنسدلة المدمجة (أولوية قصوى للظهور) */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className={`flex items-center bg-slate-50 hover:bg-slate-100/90 border rounded-2xl p-1 sm:p-1.5 gap-1.5 sm:gap-2 transition-all cursor-pointer select-none text-right shrink-0 ${
                  isUserMenuOpen
                    ? 'border-amber-400 ring-2 ring-amber-100 bg-amber-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                }`}
                title="اضغط لفتح قائمة إعدادات المستخدم والحساب وتسجيل الخروج"
                aria-expanded={isUserMenuOpen}
              >
                {/* الأيقونة الرمزية للمستخدم مع مؤشر النبض الأخضر */}
                <div className="relative shrink-0">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-xs shadow-xs">
                    <UserIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2 sm:h-2.5 sm:w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-emerald-500 border border-white"></span>
                  </span>
                </div>

                {/* تفاصيل الاسم والجلسة (تظهر بشكل ذكي ومختصر على الجوال والشاشات المختلفة) */}
                <div className="text-right max-w-[70px] xs:max-w-[100px] sm:max-w-[130px] md:max-w-none">
                  <div className="text-[11px] sm:text-xs font-black text-slate-900 truncate leading-tight">
                    {currentUser?.fullName || 'المستخدم'}
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                    <KeyRound className="w-2.5 h-2.5 text-amber-500 shrink-0 hidden xs:inline" />
                    <span className="truncate">{currentRoleInfo.label}</span>
                  </div>
                </div>

                {/* شارة الدور وشارة المتصلين على الشاشات الأكبر */}
                <div className="hidden md:flex items-center gap-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{onlineUsers.length} متصل</span>
                  </span>
                </div>

                {/* سهم القائمة المنسدلة */}
                <div className="px-0.5 text-slate-400">
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isUserMenuOpen ? 'rotate-180 text-amber-600' : 'text-slate-400'
                    }`}
                  />
                </div>
              </button>

              {/* القائمة المنسدلة المدمجة تحت اسم المستخدم */}
              {isUserMenuOpen && (
                <>
                  {/* خلفية معتمة للجوال لإغلاق القائمة بسهولة عند النقر خارجها */}
                  <div
                    className="fixed inset-0 bg-slate-950/40 z-40 sm:hidden backdrop-blur-2xs"
                    onClick={() => setIsUserMenuOpen(false)}
                  />

                  <div className="fixed inset-x-3 top-16 sm:top-auto sm:inset-x-auto sm:left-0 sm:mt-2 max-w-sm w-auto sm:w-85 max-h-[85vh] overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                    {/* ترويسة بطاقة المستخدم داخل القائمة */}
                    <div className="p-3.5 bg-linear-to-b from-slate-50 to-white border-b border-slate-100 flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center font-black text-sm shadow-xs">
                            <UserIcon className="w-5 h-5 text-amber-400" />
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-black text-slate-900 truncate">
                            {currentUser?.fullName || 'الدعم الفني Admin'}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono truncate">
                            {currentUser?.email || 'alahsaey@gmail.com'}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`inline-flex text-[9px] font-bold px-2 py-0.2 rounded-md border ${currentRoleInfo.bg} ${currentRoleInfo.text} ${currentRoleInfo.border}`}
                            >
                              {currentRoleInfo.label}
                            </span>
                            <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                              متصل الآن
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* زر إغلاق القائمة في الجوال */}
                      <button
                        type="button"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="sm:hidden p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* قائمة المتصلين الآن بالنظام */}
                    <div className="p-2.5 bg-slate-50/80 border-b border-slate-100">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <div className="flex items-center gap-1.5">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          <span className="text-[11px] font-black text-slate-800">المتصلين الآن بالنظام</span>
                        </div>
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                          {onlineUsers.length} متصل
                        </span>
                      </div>

                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5 divide-y divide-slate-100/60">
                        {onlineUsers.map((user) => {
                          const userRole = ROLE_LABELS[user.roleKey] || {
                            label: user.roleKey,
                            bg: 'bg-slate-100',
                            text: 'text-slate-700',
                            border: 'border-slate-200',
                          };
                          const isMe = user.id === currentUser?.id;
                          return (
                            <div
                              key={user.id}
                              className={`flex items-center justify-between p-2 rounded-xl transition-all pt-1.5 ${
                                isMe
                                  ? 'bg-amber-50/90 border border-amber-200/90'
                                  : 'bg-white border border-slate-200/80 shadow-2xs'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="relative shrink-0">
                                  <div className="w-7 h-7 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-[10px]">
                                    {user.fullName.substring(0, 2)}
                                  </div>
                                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white"></span>
                                </div>
                                <div className="min-w-0">
                                  <div className="text-[11px] font-bold text-slate-900 truncate flex items-center gap-1">
                                    <span className="truncate">{user.fullName}</span>
                                    {isMe && (
                                      <span className="text-[8px] bg-amber-200 text-amber-900 px-1 py-0.2 rounded font-bold shrink-0">
                                        أنت
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[9px] text-slate-400 font-mono truncate">
                                    {user.email}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-0.5 shrink-0 mr-1">
                                <span
                                  className={`text-[8px] font-bold px-1.5 py-0.2 rounded border ${userRole.bg} ${userRole.text} ${userRole.border}`}
                                >
                                  {userRole.label}
                                </span>
                                <span className="text-[8px] text-emerald-600 font-bold flex items-center gap-0.5">
                                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                                  متصل
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* عناصر القائمة المنسدلة (إعدادات المستخدمين، النظام، والأمان) */}
                    <div className="p-1.5 space-y-1">
                      {/* خيار إدارة المستخدمين والصلاحيات */}
                      {canAccessTab('settings') && (
                        <button
                          type="button"
                          onClick={() => handleMenuNavigate('settings')}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-right text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer group"
                        >
                          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center group-hover:bg-amber-100 shrink-0">
                            <Users className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-black text-slate-900">إدارة المستخدمين والصلاحيات</div>
                            <div className="text-[10px] text-slate-400 font-normal">إضافة مستخدمين وتعديل الأدوار</div>
                          </div>
                        </button>
                      )}

                      {/* خيار إعدادات النظام والمنشأة */}
                      {canAccessTab('settings') && (
                        <button
                          type="button"
                          onClick={() => handleMenuNavigate('settings')}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-right text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer group"
                        >
                          <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-slate-200 shrink-0">
                            <Settings className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-black text-slate-900">إعدادات المنشأة والفوترة</div>
                            <div className="text-[10px] text-slate-400 font-normal">بيانات الضريبة، ZATCA والطباعة</div>
                          </div>
                        </button>
                      )}

                      {/* خيار تثبيت التطبيق PWA (يختفي إذا كان مثبتاً بالفعل) */}
                      {!isInstalled && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            setIsInstallModalOpen(true);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-right text-xs font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-900 transition-colors cursor-pointer group"
                        >
                          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center group-hover:bg-amber-200 shrink-0">
                            <Download className="w-4 h-4 text-amber-700" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-black text-slate-900">تثبيت التطبيق على الجهاز (PWA)</div>
                            <div className="text-[10px] text-slate-400 font-normal">إضافة إلى شريط المهام والشاشة الرئيسية</div>
                          </div>
                        </button>
                      )}

                      {/* خيار مشاركة الموقع */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setIsShareModalOpen(true);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-right text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer group"
                      >
                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-slate-200 shrink-0">
                          <Share2 className="w-4 h-4 text-slate-700" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-black text-slate-900">مشاركة الموقع والنظام</div>
                          <div className="text-[10px] text-slate-400 font-normal">نسخ الرابط، رمز QR، والمشاركة المباشرة</div>
                        </div>
                      </button>

                      {/* خيار سجلات التدقيق والأمان */}
                      {currentUser?.roleKey === 'system_owner' && (
                        <button
                          type="button"
                          onClick={() => handleMenuNavigate('settings')}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-right text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer group"
                        >
                          <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center group-hover:bg-rose-100 shrink-0">
                            <ShieldCheck className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-black text-slate-900">سجل التدقيق والأمان (Zero-Trust)</div>
                            <div className="text-[10px] text-slate-400 font-normal">مراقبة العمليات الحساسة</div>
                          </div>
                        </button>
                      )}
                    </div>

                    {/* فاصل */}
                    <div className="border-t border-slate-100 my-1" />

                    {/* زر تسجيل الخروج داخل القائمة المنسدلة */}
                    <div className="p-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-right text-xs font-black text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer group"
                      >
                        <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center group-hover:bg-rose-200 shrink-0">
                          <LogOut className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-black text-rose-700">تسجيل الخروج</div>
                          <div className="text-[10px] text-rose-400 font-normal">إنهاء الجلسة الحالية والتبديل لحساب آخر</div>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* زر مشاركة الموقع */}
            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-bold transition-all cursor-pointer shadow-2xs shrink-0"
              title="مشاركة رابط الموقع ورمز QR"
            >
              <Share2 className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden md:inline">مشاركة</span>
            </button>

            {/* مؤشر حالة قاعدة البيانات */}
            <div
              title={connectionSuccess ? 'متصل بقاعدة بيانات Firestore السحابية' : 'جاري التحقق من الاتصال'}
              className="hidden xl:flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-[11px] text-slate-600 font-medium shrink-0"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionSuccess ? 'bg-emerald-500 ring-2 ring-emerald-100' : 'bg-amber-500 animate-pulse'
                }`}
              />
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span>{connectionSuccess ? 'سحابي متصل' : 'جاري الاتصال...'}</span>
            </div>

            {/* زر فتح القائمة (Hamburger Menu - قائمة الخطوط) */}
            {onSelectTab && (
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                className={`p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer border shrink-0 ${
                  isMobileMenuOpen
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                }`}
                aria-label="قائمة الخطوط والتنقل السريع"
                title="قائمة الخطوط والتنقل السريع"
              >
                {isMobileMenuOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <Menu className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
            )}
          </div>
        </div>

        {/* قائمة الخطوط المنسدلة للتنقل السريع وعمليات النظام */}
        {isMobileMenuOpen && onSelectTab && (
          <div className="border-t border-slate-200 py-4 px-3 sm:px-4 bg-slate-50/98 backdrop-blur-md animate-in slide-in-from-top-2 duration-150">
            <div className="max-w-7xl mx-auto space-y-3">
              <div className="text-xs font-bold text-slate-600 px-1 flex items-center justify-between">
                <span>أقسام النظام المحاسبي والفواتير (قائمة الخطوط ☰)</span>
                <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full font-bold">
                  تشمل استعلام الفواتير، عروض الأسعار، التقارير والزاتكا
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {hamburgerNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const isRestricted = item.restricted;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectTab(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-2 p-3 rounded-xl text-xs font-bold text-right transition-all cursor-pointer border ${
                        isActive
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : isRestricted
                          ? 'bg-white text-slate-400 border-slate-200 opacity-60'
                          : 'bg-white text-slate-800 hover:bg-slate-100 border-slate-200 hover:border-slate-300 shadow-2xs'
                      }`}
                    >
                      {isRestricted ? (
                        <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                      ) : (
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-600'}`} />
                      )}
                      <span className="truncate flex-1">{item.label}</span>
                      {item.badge && (
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.2 rounded-md shrink-0 ${
                            isActive ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* قسم عمليات وصيانة السحابي ضمن قائمة الخطوط */}
              <div className="pt-2.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                <div className="text-[11px] font-bold text-slate-500 flex items-center gap-2">
                  <span>أدوات النظام السحابي:</span>
                  {testConnMessage && (
                    <span className="text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-lg font-mono">
                      {testConnMessage}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestConnectionFromMenu}
                    disabled={isTestingConn}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingConn ? 'animate-spin' : ''}`} />
                    <span>{isTestingConn ? 'جاري الفحص...' : 'فحص الاتصال'}</span>
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsFormatModalOpen(true);
                        setIsMobileMenuOpen(false);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>فورمات وتصفير السحابي 🔒</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* شريط التنقل السريع الأفقي للشاشات الصغيرة */}
        {onSelectTab && !isMobileMenuOpen && (
          <div className="lg:hidden flex items-center gap-1.5 py-2 overflow-x-auto border-t border-slate-100 no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isRestricted = item.restricted;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : isRestricted
                      ? 'bg-slate-50 text-slate-400 border border-slate-200/40 opacity-70'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60'
                  }`}
                >
                  {isRestricted ? (
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
                  )}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* نوافذ تثبيت التطبيق ومشاركة الموقع وتصفير قاعدة البيانات */}
      <PwaInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />

      <ShareWebsiteModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />

      <DatabaseFormatModal
        isOpen={isFormatModalOpen}
        onClose={() => setIsFormatModalOpen(false)}
        onFormatComplete={onRefreshData}
      />
    </header>
  );
};

