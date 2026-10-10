/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldAlert, Lock, ArrowLeft, Home, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AccessDeniedViewProps {
  requiredRole?: string;
  onNavigateToPermitted?: () => void;
}

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({
  requiredRole = 'الدعم الفني Admin أو مدير المنشأة',
  onNavigateToPermitted,
}) => {
  const { currentUser, logout } = useAuth();

  return (
    <div className="bg-white rounded-3xl border border-rose-200 p-8 shadow-md max-w-2xl mx-auto my-8 text-center space-y-6 animate-in fade-in">
      <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto border border-rose-200 shadow-xs">
        <ShieldAlert className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
          وصول مقيد ومحمي بالصلاحيات (RBAC Security)
        </span>
        <h2 className="text-xl font-black text-slate-900">
          عذراً، هذه الشاشة مخصصة للمصرح لهم فقط
        </h2>
        <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
          حسابك الحالي (<strong className="text-slate-900">{currentUser?.fullName}</strong> - دور{' '}
          <span className="text-amber-700 font-bold">{currentUser?.roleKey}</span>) لا يمتلك الصلاحية الكافية لدخول هذه الشاشة أو الاطلاع على بياناتها المالية والإدارية.
        </p>
      </div>

      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600 text-right space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-slate-800">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>الشروط المطلوبة للوصول:</span>
        </div>
        <div className="text-[11px] text-slate-500 pr-6">
          • يتطلب حساب {requiredRole}.
          <br />
          • إذا كنت بحاجة للوصول، يرجى طلب منحك الصلاحية من الدعم الفني Admin عبر شاشة "إدارة المستخدمين والصلاحيات".
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        {onNavigateToPermitted && (
          <button
            type="button"
            onClick={onNavigateToPermitted}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <Home className="w-4 h-4 text-amber-400" />
            <span>الانتقال لمساحة العمل المصرحة لك</span>
          </button>
        )}

        <button
          type="button"
          onClick={logout}
          className="px-4 py-2.5 bg-white hover:bg-rose-50 border border-slate-300 text-slate-700 hover:text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج والتبديل لحساب آخر</span>
        </button>
      </div>
    </div>
  );
};
