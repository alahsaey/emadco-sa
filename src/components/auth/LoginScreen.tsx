/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  UserCheck,
  LogIn,
  Lock,
  Mail,
  AlertCircle,
  Users,
  Eye,
  EyeOff,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  LockKeyhole,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { RoleKey, User } from '../../types';
import { EmadcoLogo } from '../common/EmadcoLogo';
import { ForgotPasswordModal } from './ForgotPasswordModal';

interface LoginScreenProps {
  onLoginSuccess?: () => void;
}

const ROLE_METADATA: Record<
  RoleKey,
  {
    title: string;
    badge: string;
    badgeColor: string;
    description: string;
  }
> = {
  system_owner: {
    title: 'الدعم الفني Admin',
    badge: 'صلاحيات عليا مطلقة',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    description: 'تحكم كامل في الإعدادات، الصلاحيات، التقارير المالية، والنسخ الاحتياطي.',
  },
  manager: {
    title: 'مدير المنشأة (Manager)',
    badge: 'إدارة تشغيلية ولوحة القيادة',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    description: 'إدارة المشتريات، المخزون، الموردين، والمبيعات والتقارير اليومية.',
  },
  cashier: {
    title: 'كاشير نقطة البيع (Cashier POS)',
    badge: 'نقطة البيع فقط (محجوبة عن اللوحة)',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'تسجيل فواتير البيع، مسح الباركود، وتحصيل المبالغ دون وصول للإعدادات أو الأرباح.',
  },
  sales_rep: {
    title: 'مندوب مبيعات مقاولين (Sales)',
    badge: 'عقود ومقاولون',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'إنشاء عروض الأسعار، البيع بالآجل، ومتابعة حسابات وسقوف المقاولين.',
  },
  inventory_officer: {
    title: 'مسؤول المستودعات (Inventory)',
    badge: 'مستودعات وجرد',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    description: 'استلام بضاعة الموردين، تسوية الجرد، والتحويل بين المستودعات.',
  },
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const { login, availableUsers, refreshUsers } = useAuth();
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // تصفية المستخدمين الفعليين والنشطين فقط من قاعدة البيانات
  const activeUsers = availableUsers.filter((u) => u.isActive !== false);

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [showForgotPassword, setShowForgotPassword] = useState<boolean>(false);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);
  const [showUsersDirectory, setShowUsersDirectory] = useState<boolean>(false);

  // مراقبة عداد قفل جدار الحماية ضد محاولات التخمين والاختراق
  useEffect(() => {
    const checkLockout = () => {
      try {
        const lockoutUntil = parseInt(localStorage.getItem('emadco_firewall_lockout_until') || '0', 10);
        if (lockoutUntil > Date.now()) {
          setLockoutRemaining(Math.ceil((lockoutUntil - Date.now()) / 1000));
        } else {
          setLockoutRemaining(0);
        }
      } catch {}
    };

    checkLockout();
    const timer = setInterval(checkLockout, 1000);
    return () => clearInterval(timer);
  }, []);

  // فحص معاملات الرابط عند فتح التطبيق برابط استعادة مرسل من البريد
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const isResetAction =
        params.get('action') === 'reset-password' ||
        params.get('mode') === 'resetPassword' ||
        Boolean(params.get('oobCode'));
      const emailParam = params.get('email');
      if (emailParam) {
        setEmail(emailParam);
      }
      if (isResetAction) {
        setShowForgotPassword(true);
      }
    }
  }, []);


  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshUsers();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutRemaining > 0) {
      setError(`جدار الحماية الفائق مفعل: تم قفل محاولات الدخول مؤقتاً لحماية النظام من أي هجوم أو تخمين. يرجى الانتظار ${lockoutRemaining} ثانية.`);
      return;
    }

    if (!email.trim()) {
      setError('يرجى إدخال البريد الإلكتروني أو اسم المستخدم المصرح به.');
      return;
    }
    if (!password.trim()) {
      setError('يرجى إدخال كلمة المرور أو الرقم السري (PIN).');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const result = await login(email.trim(), password.trim());
      if (result.success) {
        onLoginSuccess?.();
      } else {
        setError(result.error || 'فشل التحقق الأمني: البريد أو كلمة المرور غير صحيحة، أو الحساب غير مصرح له.');
      }
    } catch (err: any) {
      setError(err?.message || 'فشل التحقق الأمني لتسجيل الدخول.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectVerifiedUser = (user: User) => {
    setSelectedUser(user);
    setEmail(user.fullName || user.email || '');
    setPassword('');
    setError(null);
    setShowUsersDirectory(false);
    if (passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col justify-center items-center p-4 sm:p-6" dir="rtl">
      <div className="max-w-xl w-full space-y-6">
        {/* ترويسة الشعار المعتمد عمادكو */}
        <div className="text-center space-y-2">
          <EmadcoLogo size="xl" variant="vertical" showSubtitle={true} theme="dark" />
        </div>

        {/* بطاقة تسجيل الدخول المحمية بجدار الحماية الفائق */}
        <div className="bg-white rounded-3xl border border-slate-700 shadow-2xl overflow-hidden">
          {/* شريط حالة جدار الحماية الفائق */}
          <div className="bg-slate-900 px-6 py-3.5 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>جدار الحماية الفائق مفعل ومراقب</span>
            </div>
            <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                تشفير تام 256-bit
              </span>
              <button
                type="button"
                onClick={handleManualRefresh}
                title="مزامنة فورية حية مع قاعدة بيانات المستخدمين"
                className="hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
                <span>مزامنة ({activeUsers.length})</span>
              </button>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LockKeyhole className="w-5 h-5 text-amber-600" />
                  <h2 className="text-lg font-black text-slate-900">بوابة الدخول المصرح</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUsersDirectory(!showUsersDirectory)}
                  className="text-xs text-amber-700 hover:text-amber-800 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{showUsersDirectory ? 'إخفاء دليل الحسابات' : 'دليل الحسابات المصرحة'}</span>
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                يُمنع منعاً باتاً دخول الموقع أو لوحة القيادة إلا للمصرح لهم فقط بكلمة مرور أو رقم سري (PIN).
              </p>
            </div>

            {/* تنبيه الحظر الزمني لجدار الحماية في حال تكرار الأخطاء */}
            {lockoutRemaining > 0 && (
              <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-xs text-rose-900 font-bold flex items-center gap-2.5 animate-pulse">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <div className="font-black text-rose-950">إغلاق أمني مؤقت لمنع محاولات الاختراق والتسلل</div>
                  <div className="text-[11px] text-rose-700 font-normal">
                    تم رصد عدة محاولات دخول غير صحيحة. جدار الحماية قام بقفل الجلسة مؤقتاً لحماية النظام لمدة: <span className="font-mono font-black text-rose-900">{lockoutRemaining} ثانية</span>.
                  </div>
                </div>
              </div>
            )}

            {error && !lockoutRemaining && (
              <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-bold flex items-start gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* بطاقة الحساب المحدد إن وجد */}
            {selectedUser && (
              <div className="mb-4 p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-600" />
                  <div>
                    <span className="text-[10px] text-amber-700 block">الحساب المحدد للدخول:</span>
                    <strong className="text-slate-900 text-xs">{selectedUser.fullName}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser(null);
                    setEmail('');
                    setPassword('');
                  }}
                  className="text-[10px] font-bold text-slate-500 hover:text-rose-600"
                >
                  إلغاء التحديد
                </button>
              </div>
            )}

            {/* نافذة قابلة للطي: دليل الحسابات الفعلية الحديثة من قاعدة البيانات */}
            {showUsersDirectory && (
              <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    المستخدمون الفعليون المحدثون من السحابة ({activeUsers.length})
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">انقر للتعبئة المصرحة</span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {activeUsers.map((u) => {
                    const meta = ROLE_METADATA[u.roleKey] || {
                      title: u.roleKey,
                      badge: 'معتمد',
                      badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
                    };
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleSelectVerifiedUser(u)}
                        className="w-full p-2.5 bg-white hover:bg-amber-50 rounded-xl border border-slate-200 hover:border-amber-300 transition-all flex items-center justify-between text-right cursor-pointer shadow-2xs"
                      >
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-amber-600" />
                          <div>
                            <div className="text-xs font-bold text-slate-900">{u.fullName}</div>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${meta.badgeColor}`}>
                          {meta.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* نموذج تسجيل الدخول النظيف والآمن */}
            <form onSubmit={handleEmailLogin} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">
                  البريد الإلكتروني أو اسم المستخدم المصرح
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="أدخل بريدك الإلكتروني أو اسمك المسجل بالنظام"
                    required
                    disabled={lockoutRemaining > 0}
                    className="w-full pr-9 pl-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-bold disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-700 font-bold">كلمة المرور أو الرقم السري (PIN)</label>
                  <span className="text-[10px] text-slate-400 font-mono">مشفر ومحمي</span>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  <input
                    ref={passwordInputRef}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={lockoutRemaining > 0}
                    placeholder="أدخل كلمة المرور أو PIN المعتمد"
                    className="w-full pr-9 pl-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setShowForgotPassword(true);
                  }}
                  className="text-xs text-amber-700 hover:text-amber-800 font-bold hover:underline flex items-center gap-1.5 cursor-pointer py-1 transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                  <span>نسيت الرقم السري؟ استعادة عبر الإيميل</span>
                </button>
                <span className="text-[10px] text-slate-400 font-mono">إرسال كود OTP آمن للبريد فقط</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || lockoutRemaining > 0}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50 mt-2"
              >
                <LogIn className="w-4 h-4 text-amber-400" />
                <span>{isSubmitting ? 'جاري التحقق من الصلاحيات وأمان الدخول...' : 'تسجيل الدخول للنظام'}</span>
              </button>
            </form>

            <div className="pt-6 border-t border-slate-100 mt-6 text-[11px] text-slate-500 text-center space-y-1">
              <div className="font-bold text-slate-700 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>جدار حماية فائق ومراقب • يُمنع الدخول للموقع إلا للمصرح لهم فقط</span>
              </div>
              <div className="text-[10px] text-slate-400">
                جميع محاولات الدخول والتعديلات مسجلة بسجل تدقيق أمني مشفر لحماية المنشأة
              </div>
            </div>
          </div>
        </div>

        {/* نافذة استعادة الرقم السري والتحقق بالرمز المؤقت OTP المرسل للإيميل فقط */}
        <ForgotPasswordModal
          isOpen={showForgotPassword}
          onClose={() => setShowForgotPassword(false)}
          initialEmail={email}
          onSuccessLogin={onLoginSuccess}
        />
      </div>
    </div>
  );
};


