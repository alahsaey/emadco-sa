/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuditLog } from '../types';
import { fetchRecentAuditLogs } from '../services/audit';
import { ShieldAlert, RefreshCw, Clock, User, FileText, CheckCircle2 } from 'lucide-react';

export const AuditTrail: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchRecentAuditLogs(15);
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const getActionBadge = (action: AuditLog['action']) => {
    switch (action) {
      case 'CREATE':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'DELETE':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'LOGIN':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'SEED_DATABASE':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
      <div className="flex items-center justify-between pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <h3 className="text-base font-bold text-slate-900">
              سجلات التدقيق والأمان المباشرة (Audit Logs)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            تسجيل وتوثيق كافة العمليات، تسجيلات الدخول، وبذر البيانات بشكل غير قابل للتعديل
          </p>
        </div>

        <button
          type="button"
          onClick={loadLogs}
          disabled={loading}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="تحديث سجلات التدقيق"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="mt-4 divide-y divide-slate-100">
        {logs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            لا توجد سجلات تدقيق مسجلة حتى الآن.
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-start sm:items-center gap-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${getActionBadge(log.action)}`}>
                  {log.action}
                </span>
                <div>
                  <p className="text-xs font-semibold text-slate-800">{log.details}</p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" />
                      {log.userName}
                    </span>
                    <span>•</span>
                    <span className="font-mono text-slate-400">الجدول: {log.entity}</span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3" />
                <span>{new Date(log.timestamp).toLocaleTimeString('ar-SA')}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
