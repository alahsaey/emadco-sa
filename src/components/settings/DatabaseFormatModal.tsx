/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  Trash2,
  Lock,
  CheckCircle2,
  RefreshCw,
  X,
  Database,
  FileSpreadsheet,
  Package,
  Layers,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  executeDatabaseFormat,
  FormatScope,
  FormatResult,
} from '../../services/databaseMaintenance';

interface DatabaseFormatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFormatComplete?: () => void;
}

export const DatabaseFormatModal: React.FC<DatabaseFormatModalProps> = ({
  isOpen,
  onClose,
  onFormatComplete,
}) => {
  const { currentUser } = useAuth();
  const [selectedScope, setSelectedScope] = useState<FormatScope>('catalog_and_transactions');
  const [confirmInput, setConfirmInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<FormatResult | null>(null);

  if (!isOpen) return null;

  // التحقق الحصري من صلاحية الأدمن
  const isAuthorized =
    currentUser?.roleKey === 'system_owner' || currentUser?.roleKey === 'manager';

  const isConfirmed =
    confirmInput.trim() === 'فورمات' ||
    (currentUser?.pinCode && confirmInput.trim() === currentUser.pinCode) ||
    (currentUser?.password && confirmInput.trim() === currentUser.password);

  const handleExecuteFormat = async () => {
    if (!currentUser || !isAuthorized) {
      setErrorMessage('غير مصرح لك بتنفيذ هذه العملية. خاصية مخصصة للأدمن فقط.');
      return;
    }

    if (!isConfirmed) {
      setErrorMessage('يرجى كتابة كلمة "فورمات" أو إدخال رمز PIN الإداري لتأكيد العملية.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setResult(null);

    try {
      const res = await executeDatabaseFormat(
        selectedScope,
        currentUser,
        confirmInput.trim()
      );
      setResult(res);
      if (onFormatComplete) {
        onFormatComplete();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'حدث خطأ أثناء تنفيذ عملية الفورمات.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinishAndReload = () => {
    onClose();
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl border border-rose-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
        dir="rtl"
      >
        {/* الترويسة الأمنية */}
        <div className="bg-rose-900 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-800/80 border border-rose-700 flex items-center justify-center text-rose-300">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight">فورمات وتصفير قاعدة البيانات السحابية</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                  صلاحية الأدمن فقط 🔒
                </span>
              </div>
              <p className="text-xs text-rose-200 mt-1">
                تهيئة وتفريغ الجداول لتجهيز المنظومة للعمل الفعلي أو إعادة الانطلاق من الصفر
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="w-9 h-9 rounded-xl bg-rose-800/50 hover:bg-rose-800 text-rose-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* محتوى النافذة */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {!isAuthorized ? (
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <Lock className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-slate-900">الوصول مقيد للأدمن فقط</h4>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                عذراً، لا تمتلك الصلاحيات الإدارية العليا المطلوبة لتنفيذ فورمات قاعدة البيانات. يجب تسجيل الدخول بحساب الدعم الفني Admin.
              </p>
            </div>
          ) : result ? (
            /* شاشة النجاح بعد الفورمات */
            <div className="space-y-6 py-4 text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border-4 border-emerald-50">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h4 className="text-xl font-black text-slate-900 mb-1">
                  تم فورمات وتصفير قاعدة البيانات بنجاح!
                </h4>
                <p className="text-xs text-slate-600">
                  تم حذف <strong className="text-emerald-700 font-mono text-sm">{result.totalDocsDeleted}</strong> مستنداً وسجلاً قديماً، وأصبحت المنظومة نظيفة وجاهزة لبدء العمل.
                </p>
              </div>

              {/* تفصيل الجداول المحذوفة */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-right">
                <h5 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <Database className="w-4 h-4 text-slate-500" />
                  ملخص الجداول التي تم تفريغها:
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {Object.entries(result.deletedCollections)
                    .filter(([_, count]) => (count as number) > 0)
                    .map(([col, count]) => (
                      <div
                        key={col}
                        className="bg-white p-2.5 rounded-xl border border-slate-200 flex justify-between items-center"
                      >
                        <span className="text-slate-600 font-medium">{col}</span>
                        <span className="font-mono font-bold text-rose-600">{count}</span>
                      </div>
                    ))}
                  {result.totalDocsDeleted === 0 && (
                    <div className="col-span-full text-center text-slate-500 py-2 text-xs">
                      كانت الجداول فارغة بالفعل وجاهزة للعمل.
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleFinishAndReload}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
              >
                <RefreshCw className="w-4 h-4" />
                <span>إعادة تحميل النظام وبدء الاستخدام النظيف</span>
              </button>
            </div>
          ) : (
            /* نموذج اختيار نوع الفورمات والتأكيد */
            <>
              {/* تنبيه تحذيري */}
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <span className="font-bold text-rose-950">تحذير أمني شديد الأهمية:</span>
                  <p className="mt-1 text-rose-800">
                    عملية الفورمات تقوم بحذف السجلات المحددة نهائياً من سحابة Firestore. لا يمكن التراجع عن هذه الخطوة بعد إتمامها.
                  </p>
                </div>
              </div>

              {/* خيارات نطاق الفورمات */}
              <div className="space-y-3">
                <label className="block text-xs font-black text-slate-800">
                  اختر نطاق الفورمات المطلوب:
                </label>

                {/* الخيار 1: تصفير الحركات فقط */}
                <label
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    selectedScope === 'transactions_only'
                      ? 'border-amber-500 bg-amber-50/50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="formatScope"
                    value="transactions_only"
                    checked={selectedScope === 'transactions_only'}
                    onChange={() => setSelectedScope('transactions_only')}
                    className="mt-1 text-amber-600 focus:ring-amber-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                      <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                      <span>تصفير الحركات والمعاملات المالية وسجلات التدقيق (Sales & Audit Reset)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      حذف جميع فواتير نقاط البيع، الفواتير الإلكترونية ZATCA، سجلات التدقيق والتجربة، سجلات طرق الدفع، عروض الأسعار، المرتجعات، وسندات الصرف — مع <strong>الحفاظ على جميع المنتجات، الأسعار، التصنيفات، والعملاء</strong>.
                    </p>
                  </div>
                </label>

                {/* الخيار 2: تصفير شامل للمنتجات والعمليات مع الحفاظ على الحسابات والإعدادات */}
                <label
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    selectedScope === 'catalog_and_transactions'
                      ? 'border-rose-500 bg-rose-50/50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="formatScope"
                    value="catalog_and_transactions"
                    checked={selectedScope === 'catalog_and_transactions'}
                    onChange={() => setSelectedScope('catalog_and_transactions')}
                    className="mt-1 text-rose-600 focus:ring-rose-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                      <Package className="w-4 h-4 text-rose-600" />
                      <span>تصفير شامل للكتالوج وسجلات التدقيق والعمليات (موصى به لبدء النشاط من الصفر)</span>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                        موصى به
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      حذف كافة المنتجات التجريبية، المخزون، الفواتير، سجلات التدقيق والتجربة، طرق الدفع المخصصة، العملاء، والموردين — مع <strong>الإبقاء على حسابك الإداري، الرقم الضريبي، وبيانات المنشأة</strong> لتكون جاهزة لإدخال بضائعك الحقيقية.
                    </p>
                  </div>
                </label>

                {/* الخيار 3: فورمات المصنع الشامل */}
                <label
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    selectedScope === 'full_factory_reset'
                      ? 'border-red-600 bg-red-50/60'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="formatScope"
                    value="full_factory_reset"
                    checked={selectedScope === 'full_factory_reset'}
                    onChange={() => setSelectedScope('full_factory_reset')}
                    className="mt-1 text-red-600 focus:ring-red-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                      <Layers className="w-4 h-4 text-red-600" />
                      <span>فورمات المصنع الشامل (Full Factory Reset)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      مسح كافة الجداول وسجلات التدقيق بالكامل وإعادة النظام لحالته الأولية تماماً.
                    </p>
                  </div>
                </label>
              </div>

              {/* خطوة التحقق والأمان */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <label className="block text-xs font-bold text-slate-800">
                  لتأكيد العملية، اكتب كلمة <span className="text-rose-600 font-mono font-black">فورمات</span> أو أدخل رمز الـ PIN الإداري الخاص بك:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder='اكتب: فورمات'
                    disabled={isProcessing}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-bold focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-mono"
                  />
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>المستخدم الحالي المصرح له: <strong>{currentUser.fullName}</strong> ({currentUser.roleKey})</span>
                </div>
              </div>

              {/* رسالة الخطأ إن وجدت */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-100 text-rose-900 border border-rose-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* أزرار التحكم السفلية */}
        {!result && isAuthorized && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              إلغاء وتراجع
            </button>

            <button
              type="button"
              onClick={handleExecuteFormat}
              disabled={!isConfirmed || isProcessing}
              className={`px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
                isConfirmed && !isProcessing
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري تنفيذ الفورمات ومسح الجداول...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>تأكيد وتنفيذ الفورمات نهائياً</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
