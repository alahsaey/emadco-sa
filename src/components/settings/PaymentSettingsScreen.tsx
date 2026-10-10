/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Wifi,
  Shield,
  Save,
  CheckCircle2,
  AlertCircle,
  Activity,
  Server,
  Key,
  Lock,
  Eye,
  EyeOff,
  RotateCw,
  Cpu,
  Smartphone,
  Building2,
  HelpCircle,
} from 'lucide-react';
import { SaudiReceiptIcon as Receipt } from '../common/SaudiReceiptIcon';
import {
  PaymentTerminalConfig,
  PaymentTransaction,
  TerminalProviderCode,
} from '../../types';
import {
  getTerminalConfig,
  saveTerminalConfig,
  getActiveTerminalProvider,
  fetchTerminalTransactions,
} from '../../services/paymentTerminal/terminalService';

interface PaymentSettingsScreenProps {
  onBackToPos?: () => void;
}

export const PaymentSettingsScreen: React.FC<PaymentSettingsScreenProps> = ({ onBackToPos }) => {
  const [config, setConfig] = useState<PaymentTerminalConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // إخفاء/إظهار حقول المفاتيح بأمان
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [showSecretKey, setShowSecretKey] = useState<boolean>(false);

  // فحص الاتصال
  const [pingStatus, setPingStatus] = useState<{
    isRunning: boolean;
    result?: { success: boolean; latencyMs: number; message: string };
  }>({ isRunning: false });

  // سجل العمليات
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [isLoadingTx, setIsLoadingTx] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const cfg = await getTerminalConfig();
      setConfig(cfg);
      loadTransactions();
    } catch (err: any) {
      setSaveError('تعذر تحميل إعدادات جهاز نقاط البيع.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTransactions = async () => {
    setIsLoadingTx(true);
    try {
      const txs = await fetchTerminalTransactions(20);
      setTransactions(txs);
    } finally {
      setIsLoadingTx(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      await saveTerminalConfig(config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setSaveError(err?.message || 'فشل حفظ الإعدادات في السحابة.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePingTest = async () => {
    setPingStatus({ isRunning: true });
    try {
      const provider = await getActiveTerminalProvider();
      const res = await provider.ping();
      setPingStatus({ isRunning: false, result: res });
    } catch (err: any) {
      setPingStatus({
        isRunning: false,
        result: {
          success: false,
          latencyMs: 0,
          message: err?.message || 'فشل الاتصال بجهاز الدفع المحدد.',
        },
      });
    }
  };

  if (isLoading || !config) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-600">
          <RotateCw className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-sm font-medium">جاري تحميل إعدادات نقاط البيع وأجهزة الدفع...</span>
        </div>
      </div>
    );
  }

  const providersList = [
    {
      code: 'mock' as TerminalProviderCode,
      name: 'محاكي جهاز نقاط البيع (Mock POS Adapter)',
      desc: 'للتطوير والاختبار ومحاكاة عمليات مدى والبطاقات البنكية دون الحاجة لجهاز فيزيائي.',
      icon: Cpu,
      badge: 'موصى به للاختبار',
    },
    {
      code: 'geidea' as TerminalProviderCode,
      name: 'جهاز جيديا الذكي (Geidea POS Terminal)',
      desc: 'تكامل مباشر مع أجهزة الدفع الذكية من شركة جيديا عبر الشبكة المحلية أو السحابية.',
      icon: CreditCard,
      badge: 'معتمد بنكياً',
    },
    {
      code: 'nearpay' as TerminalProviderCode,
      name: 'نيرباي للدفع عبر الجوال (NearPay SoftPOS)',
      desc: 'تحويل الهواتف الذكية والأجهزة اللوحية الداعمة لـ NFC إلى أجهزة دفع نقاط بيع فورية.',
      icon: Smartphone,
      badge: 'SoftPOS',
    },
    {
      code: 'standard_ecr' as TerminalProviderCode,
      name: 'الربط المباشر مع أجهزة البنوك (Standard Bank ECR)',
      desc: 'ربط أجهزة البنوك السعودية (PAX / Spire / Ingenico) عبر بروتوكول ECR التسلسلي أو الشبكي.',
      icon: Building2,
      badge: 'بروتوكول البنوك',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* مسار الصفحة والعنوان */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 mb-1">
            <span>الإعدادات</span>
            <span>/</span>
            <span>طرق الدفع</span>
            <span>/</span>
            <span className="text-slate-700">نقاط البيع (POS Terminal Integration)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <CreditCard className="w-7 h-7 text-blue-600" />
            <span>إعدادات وتكامل أجهزة الدفع (Payment Terminal)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            إدارة أجهزة نقاط البيع وربط مبالغ الفواتير تلقائياً مع شبكة مدى لمنع الأخطاء المحاسبية وتفادي الإدخال اليدوي.
          </p>
        </div>

        {onBackToPos && (
          <button
            type="button"
            onClick={onBackToPos}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer self-start sm:self-auto"
          >
            <span>العودة لشاشة الكاشير (POS)</span>
          </button>
        )}
      </div>

      {/* رسائل التنبيه والنجاح */}
      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-bold">تم حفظ إعدادات جهاز نقاط البيع بنجاح وتحديث معايير الاتصال.</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* لوحة فحص الاتصال السريع */}
      <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl shadow-lg border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">حالة الاتصال بالجهاز النشط:</div>
            <div className="text-sm font-bold flex items-center gap-2 mt-0.5">
              <span className="font-mono">{config.terminalId}</span>
              <span className="text-xs text-slate-400">({config.providerName})</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {pingStatus.result && (
            <div
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                pingStatus.result.success
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}
            >
              {pingStatus.result.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              )}
              <span>{pingStatus.result.message}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handlePingTest}
            disabled={pingStatus.isRunning}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center"
          >
            <RotateCw className={`w-3.5 h-3.5 ${pingStatus.isRunning ? 'animate-spin' : ''}`} />
            <span>{pingStatus.isRunning ? 'جاري فحص النبض...' : 'فحص الاتصال (Ping)'}</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. اختيار مزود الدفع ونوع المحول */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-600" />
              <span>1. اختيار مزود خدمة جهاز نقاط البيع (Payment Provider Adapter)</span>
            </h2>
            <span className="text-[11px] text-slate-500">معمارية المحولات المرنة (Adapter Pattern)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {providersList.map((p) => {
              const Icon = p.icon;
              const isSelected = config.providerId === p.code;
              return (
                <div
                  key={p.code}
                  onClick={() =>
                    setConfig({
                      ...config,
                      providerId: p.code,
                      providerName: p.name,
                    })
                  }
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">{p.name}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                          isSelected ? 'bg-blue-200 text-blue-800' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {p.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. بيانات الجهاز والتاجر والاتصال */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-5">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Wifi className="w-4 h-4 text-blue-600" />
            <span>2. بيانات معرّفات الجهاز والربط الشبكي</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                معرّف الجهاز المسجل لدى البنك (TID):
              </label>
              <input
                type="text"
                value={config.terminalId}
                onChange={(e) => setConfig({ ...config, terminalId: e.target.value })}
                required
                placeholder="مثال: TID-MADA-8812"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden"
              />
              <p className="text-[10px] text-slate-400 mt-1">Terminal ID المطبوع على ملصق الجهاز من البنك.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                معرّف التاجر المسجل بالشبكة (MID):
              </label>
              <input
                type="text"
                value={config.merchantId}
                onChange={(e) => setConfig({ ...config, merchantId: e.target.value })}
                required
                placeholder="مثال: MID-BUNYAN-9944"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden"
              />
              <p className="text-[10px] text-slate-400 mt-1">Merchant ID الخاص بحساب المنشأة البنكي.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                نوع اتصال الجهاز مع برنامج الكاشير:
              </label>
              <select
                value={config.connectionType}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    connectionType: e.target.value as any,
                  })
                }
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden"
              >
                <option value="local_network_ip">شبكة محلية LAN / Wi-Fi IP (TCP Socket)</option>
                <option value="cloud_api">سحابي Cloud REST API (مزود الدفع)</option>
                <option value="serial_usb">منفذ تسلسلي USB / Serial COM Port</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                عنوان IP الجهاز أو رابط الـ Gateway:
              </label>
              <input
                type="text"
                value={config.terminalIp || ''}
                onChange={(e) => setConfig({ ...config, terminalIp: e.target.value })}
                placeholder="192.168.1.180 أو api.pos-gateway.com"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                منفذ الاتصال (Port):
              </label>
              <input
                type="number"
                value={config.port || 8080}
                onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 8080 })}
                placeholder="8080"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                بيئة العمل (Environment):
              </label>
              <select
                value={config.environment}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    environment: e.target.value as any,
                  })
                }
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden"
              >
                <option value="sandbox">بيئة الاختبار والتجربة (Sandbox / Testing)</option>
                <option value="production">بيئة الإنتاج الحقيقي (Live Production)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3. بيانات الاعتماد الآمنة (Secure Credentials - مخفية ولا تظهر في Frontend) */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600" />
              <span>3. بيانات الاعتماد والأمان (Secure Credentials)</span>
            </h2>
            <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 font-medium">
              <Shield className="w-3 h-3" />
              <span>مخفية ومحمية بنظام التشفير</span>
            </span>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-800 leading-relaxed">
            <strong>ملاحظة أمنية:</strong> لا يتم إظهار مفاتيح الربط والـ Secret Tokens كنص صريح بالواجهة، وتخزن بصيغة آمنة تماماً ولا تشارك إلا مع الخوادم المعنية عند معالجة تفويضات مدى.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                مفتاح الـ API (Terminal API Key / Access Token):
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={config.apiKey || ''}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  placeholder="••••••••••••••••••••••••••••••••"
                  className="w-full p-2.5 pl-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                المفتاح السري (Merchant Secret / Shared Key):
              </label>
              <div className="relative">
                <input
                  type={showSecretKey ? 'text' : 'password'}
                  value={config.secretKey || ''}
                  onChange={(e) => setConfig({ ...config, secretKey: e.target.value })}
                  placeholder="••••••••••••••••••••••••••••••••"
                  className="w-full p-2.5 pl-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                >
                  {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 4. خيارات التشغيل وتجربة الكاشير */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-600" />
            <span>4. خيارات التشغيل وسلوك نقطة البيع</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  إرسال المبلغ تلقائياً لجهاز الدفع
                </span>
                <p className="text-[11px] text-slate-500 mt-1">
                  عند اختيار شبكة مدى أو نقاط البيع، يتم دفع إجمالي الفاتورة مباشرة للجهاز فوراً دون ضغطة إضافية.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.isAutoSendEnabled}
                onChange={(e) => setConfig({ ...config, isAutoSendEnabled: e.target.checked })}
                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer mt-0.5"
              />
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  تفعيل وضع المحاكاة الداخلي (Simulation Controls)
                </span>
                <p className="text-[11px] text-slate-500 mt-1">
                  إظهار أزرار اختبار السيناريوهات (نجاح، رفض، إلغاء، مهلة) لموظفي التدريب والمطورين.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.isSimulationMode}
                onChange={(e) => setConfig({ ...config, isSimulationMode: e.target.checked })}
                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer mt-0.5"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                مهلة انتظار استجابة جهاز الدفع (بالثواني):
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={15}
                  max={180}
                  value={config.timeoutSeconds}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      timeoutSeconds: Math.max(15, parseInt(e.target.value) || 60),
                    })
                  }
                  className="w-32 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden"
                />
                <span className="text-xs text-slate-500">
                  ثانية (الحد الأدنى 15 ثانية، الموصى به 60 ثانية لمراعاة إدخال العميل للرقم السري PIN).
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* زر الحفظ الأساسي */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'جاري حفظ الإعدادات...' : 'حفظ إعدادات جهاز الدفع ونقاط البيع'}</span>
          </button>
        </div>
      </form>

      {/* 5. سجل العمليات السابقة لجهاز الدفع (Terminal Transactions Log) */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-slate-700" />
              <span>سجل عمليات أجهزة الدفع والشبكة الأخيرة (POS Transactions Log)</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              توثيق كل محاولة دفع مع معرّف منع التكرار (Idempotency Key) وأرقام الـ RRN البنكية.
            </p>
          </div>

          <button
            type="button"
            onClick={loadTransactions}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoadingTx ? 'animate-spin' : ''}`} />
            <span>تحديث السجل</span>
          </button>
        </div>

        {transactions.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
            لا توجد عمليات مسجلة عبر أجهزة نقاط البيع حتى الآن. قم بتنفيذ عملية بيع من شاشة الكاشير لمشاهدة السجل.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">رقم العملية</th>
                  <th className="p-3">المبلغ</th>
                  <th className="p-3">الشبكة / البطاقة</th>
                  <th className="p-3">الرقم المرجعي (RRN)</th>
                  <th className="p-3">رمز التفويض (AUTH)</th>
                  <th className="p-3">جهاز الدفع (TID)</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3">التوقيت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono font-medium text-slate-700">{tx.id.slice(-10)}</td>
                    <td className="p-3 font-mono font-bold text-slate-900">
                      {tx.amount.toFixed(2)} <span className="text-[10px] font-sans">ر.س</span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px]">
                        {tx.cardScheme?.toUpperCase() || 'MADA'}
                      </span>
                      {tx.cardLast4 && (
                        <span className="text-[10px] font-mono text-slate-500 mr-1.5">
                          •••• {tx.cardLast4}
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-slate-600">{tx.rrn || '-'}</td>
                    <td className="p-3 font-mono text-slate-600">{tx.authCode || '-'}</td>
                    <td className="p-3 font-mono text-slate-500">{tx.terminalId || '-'}</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          tx.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : tx.status === 'declined'
                            ? 'bg-rose-100 text-rose-800'
                            : tx.status === 'cancelled'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {tx.status === 'approved' && <CheckCircle2 className="w-3 h-3" />}
                        {tx.status === 'declined' && <AlertCircle className="w-3 h-3" />}
                        <span>
                          {tx.status === 'approved'
                            ? 'مقبولة'
                            : tx.status === 'declined'
                            ? 'مرفوضة'
                            : tx.status === 'cancelled'
                            ? 'ملغاة'
                            : tx.status}
                        </span>
                      </span>
                    </td>
                    <td className="p-3 text-slate-400 font-mono text-[11px]">
                      {new Date(tx.timestamp).toLocaleTimeString('ar-SA')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
