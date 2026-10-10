/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Check, Lock, UserCheck, ShieldCheck } from 'lucide-react';
import { RoleKey } from '../types';

interface RoleDetail {
  key: RoleKey;
  title: string;
  badge: string;
  description: string;
  allowedActions: string[];
}

const ROLES_INFO: RoleDetail[] = [
  {
    key: 'system_owner',
    title: 'الدعم الفني Admin',
    badge: 'صلاحيات عليا مطلقة',
    description: 'إدارة كاملة للنظام، الفروع، المستخدمين، التراخيص، والسياسات المالية والضريبية وسجلات التدقيق.',
    allowedActions: [
      'عرض وتعديل كافة المنتجات والأسعار',
      'إدارة المستخدمين والأدوار الوظيفية',
      'إصدار فواتير نقاط البيع والائتمان',
      'اعتماد التسويات وحركات المخزون',
      'إعدادات الضرائب وهيئة الزكاة ZATCA',
      'عرض سجلات الأمان والتدقيق الشاملة',
    ],
  },
  {
    key: 'manager',
    title: 'مدير المنشأة / الفرع (Manager)',
    badge: 'إدارة تشغيلية',
    description: 'صلاحيات إدارة حركة المبيعات، المخزون، الشراء، واعتماد خصومات وأسعار المقاولين.',
    allowedActions: [
      'إضافة وتعديل بيانات المنتجات',
      'اعتماد عروض أسعار المقاولين',
      'إدخال فواتير المشتريات من الموردين',
      'تسوية الجرد ومراقبة النواقص',
      'متابعة حسابات الموردين والعملاء',
      'استعراض سجلات التدقيق التشغيلية',
    ],
  },
  {
    key: 'cashier',
    title: 'كاشير نقطة البيع (POS Cashier)',
    badge: 'كاشير ونقاط بيع',
    description: 'إصدار فواتير البيع الفورية، تحصيل مبالغ مدى والنقد، وطباعة الإيصالات والباركود.',
    allowedActions: [
      'استعراض كتالوج الأصناف والأسعار',
      'إنشاء فواتير نقاط البيع POS',
      'تحصيل مدفوعات مدى ونقداً',
      'طباعة الفواتير الحرارية ورمز QR',
    ],
  },
  {
    key: 'sales_rep',
    title: 'موظف مبيعات المقاولين (Sales Rep)',
    badge: 'عقود ومقاولين',
    description: 'تسجيل طلبيات ورش المقاولين، إعداد عروض الأسعار، والمبيعات الآجلة وفق السقف الائتماني.',
    allowedActions: [
      'عرض أسعار الجملة والمقاولين',
      'إعداد عروض الأسعار والمناقصات',
      'إنشاء طلبيات البيع الآجل للمقاولين',
      'استعلام أرصدة المخزون المتوفرة',
    ],
  },
  {
    key: 'inventory_officer',
    title: 'أمين ومسؤول المخزون (Inventory Officer)',
    badge: 'مخازن وسلاسل إمداد',
    description: 'استلام بضائع الموردين، مراقبة مستودعات الأقفال والكيماويات، والتحويل بين الفروع.',
    allowedActions: [
      'استعراض أرصدة وبطاقات الأصناف',
      'استلام بضائع فواتير الشراء',
      'التحويل بين المستودعات والمخازن',
      'تسجيل النواقص والتوالف وتجهيز الطلبيات',
    ],
  },
];

export const RoleMatrix: React.FC = () => {
  const { currentUser, switchUserRole, availableUsers } = useAuth();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
            <h3 className="text-base font-bold text-slate-900">
              نظام التحكم في الوصول القائم على الأدوار (Role-Based Access Control - RBAC)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            الأدوار الخمسة المطلوبة مجهزة ومحددة الصلاحيات، ويمكن تبديل المستخدم الحالي لاختبار تأثير الصلاحيات
          </p>
        </div>
      </div>

      {/* بطاقات الأدوار */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
        {ROLES_INFO.map((role) => {
          const isActive = currentUser?.roleKey === role.key;
          const matchingUser = availableUsers.find((u) => u.roleKey === role.key);

          return (
            <div
              key={role.key}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                isActive
                  ? 'border-amber-400 bg-amber-50/40 ring-2 ring-amber-400/20 shadow-xs'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-white'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                      isActive
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {role.badge}
                  </span>

                  {isActive && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                      <UserCheck className="w-3 h-3" /> الحساب النشط
                    </span>
                  )}
                </div>

                <h4 className="text-xs font-bold text-slate-900 mt-2.5">{role.title}</h4>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">{role.description}</p>

                <div className="mt-3 pt-3 border-t border-slate-200/70">
                  <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                    أبرز الصلاحيات المصرحة:
                  </div>
                  <ul className="space-y-1.5 text-[11px] text-slate-600">
                    {role.allowedActions.map((action, idx) => (
                      <li key={idx} className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                <div className="text-[10px] text-slate-400 font-mono">
                  {matchingUser ? `المستخدم: ${matchingUser.fullName}` : 'حساب جاهز'}
                </div>
                {matchingUser && !isActive && (
                  <button
                    type="button"
                    onClick={() => switchUserRole(matchingUser.id)}
                    className="text-xs font-bold text-amber-700 hover:text-amber-800 bg-white hover:bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 transition-colors cursor-pointer"
                  >
                    تجربة هذا الدور
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
