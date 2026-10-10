/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Database, CheckCircle2 } from 'lucide-react';

interface ConnectionBannerProps {
  onSeedCompleted: () => void;
  collectionsCount: Record<string, number>;
}

export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({ onSeedCompleted, collectionsCount }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between gap-4">
      {/* معلومات الاتصال السحابي */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
          <Database className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">المزامنة السحابية وقاعدة البيانات</h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              <CheckCircle2 className="w-3 h-3" /> متصل ومزامن لحظياً
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            كافة الفواتير، المخزون، وعمليات مواد البناء محفوظة سحابياً بأعلى معايير الأمان (يمكنك استخدام <strong className="text-slate-700">قائمة الخطوط ☰</strong> بالأعلى للوصول لكافة أدوات الفحص والصيانة).
          </p>
        </div>
      </div>
    </div>
  );
};
