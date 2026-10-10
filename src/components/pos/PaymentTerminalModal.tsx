/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  CreditCard,
  Wifi,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCw,
  Clock,
  ShieldCheck,
  Zap,
  ArrowRight,
  X,
  Smartphone,
  Radio,
} from 'lucide-react';
import { SaudiReceiptIcon as Receipt } from '../common/SaudiReceiptIcon';
import {
  PaymentTerminalConfig,
  TerminalPaymentRequest,
  TerminalPaymentResponse,
  TerminalPaymentStatus,
} from '../../types';
import {
  getActiveTerminalProvider,
  getMockTerminalAdapter,
  getTerminalConfig,
  recordPaymentTransaction,
} from '../../services/paymentTerminal/terminalService';
import { formatSAR, formatNumber } from '../../utils/formatters';

interface PaymentTerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  grandTotal: number;
  invoiceNumber?: string;
  cashierName: string;
  onPaymentSuccess: (response: TerminalPaymentResponse) => void;
}

export const PaymentTerminalModal: React.FC<PaymentTerminalModalProps> = ({
  isOpen,
  onClose,
  grandTotal,
  invoiceNumber,
  cashierName,
  onPaymentSuccess,
}) => {
  const [config, setConfig] = useState<PaymentTerminalConfig | null>(null);
  const [status, setStatus] = useState<TerminalPaymentStatus>('Pending');
  const [paymentResponse, setPaymentResponse] = useState<TerminalPaymentResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(60);
  const [activeTxId, setActiveTxId] = useState<string>('');
  const [activeIdempotencyKey, setActiveIdempotencyKey] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  const countdownTimerRef = useRef<any>(null);

  // تحميل الإعدادات وبدء العملية عند فتح النافذة
  useEffect(() => {
    if (isOpen) {
      loadConfigAndInitiate();
    } else {
      resetState();
    }
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [isOpen]);

  const resetState = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setStatus('Pending');
    setPaymentResponse(null);
    setErrorMessage(null);
    setCountdown(60);
    setActiveTxId('');
    setActiveIdempotencyKey('');
  };

  const loadConfigAndInitiate = async () => {
    setIsInitializing(true);
    resetState();
    try {
      const cfg = await getTerminalConfig();
      setConfig(cfg);
      setCountdown(cfg.timeoutSeconds || 60);

      // إذا كان الإرسال التلقائي مفعلاً، يتم إرسال المبلغ فور فتح النافذة
      if (cfg.isAutoSendEnabled) {
        await initiateSendToTerminal(cfg);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'تعذر الاتصال بخدمة أجهزة نقاط البيع.');
    } finally {
      setIsInitializing(false);
    }
  };

  // إرسال مبلغ الفاتورة إلى جهاز الدفع
  const initiateSendToTerminal = async (currentConfig?: PaymentTerminalConfig) => {
    const cfg = currentConfig || config;
    if (!cfg) return;

    const txId = `pos_tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    setActiveTxId(txId);
    setActiveIdempotencyKey(idempotencyKey);
    setStatus('Processing');
    setErrorMessage(null);
    setPaymentResponse(null);
    setCountdown(cfg.timeoutSeconds || 60);

    // بدء العد التنازلي للمهلة
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const request: TerminalPaymentRequest = {
      idempotencyKey,
      transactionId: txId,
      amount: grandTotal,
      currency: 'SAR',
      invoiceNumber: invoiceNumber || 'INV-DRAFT',
      cashierName,
      terminalId: cfg.terminalId,
      timeoutSeconds: cfg.timeoutSeconds || 60,
    };

    try {
      const provider = await getActiveTerminalProvider();
      const response = await provider.sendPayment(request);

      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      setPaymentResponse(response);
      setStatus(response.status);

      // تسجيل العملية في مجموعة سجلات الدفع
      await recordPaymentTransaction({
        id: response.transactionId,
        paymentId: `pay_${response.transactionId}`,
        gateway: (response.cardScheme as any) || 'pos_terminal',
        transactionReference: response.rrn || response.transactionId,
        authCode: response.authCode,
        rrn: response.rrn,
        cardScheme: response.cardScheme,
        cardLast4: response.cardLast4,
        amount: grandTotal,
        status: response.status.toLowerCase() as any,
        idempotencyKey: response.idempotencyKey,
        terminalId: response.terminalId,
        providerId: cfg.providerId,
        errorMessage: response.errorMessage,
        timestamp: response.timestamp,
      });

      if (response.success && response.status === 'Approved') {
        // نجاح العملية، الانتظار ثانية واحدة للمعاينة البصرية ثم الاعتماد التلقائي
        setTimeout(() => {
          onPaymentSuccess(response);
        }, 1200);
      } else {
        setErrorMessage(response.errorMessage || 'تم رفض العملية من جهاز الدفع أو البنك.');
      }
    } catch (err: any) {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      setStatus('Failed');
      setErrorMessage(err?.message || 'حدث خطأ أثناء إرسال المبلغ إلى جهاز نقاط البيع.');
    }
  };

  const handleTimeout = () => {
    setStatus('Timeout');
    setErrorMessage('انتهت مهلة انتظار استجابة جهاز الدفع دون إتمام تمرير البطاقة.');
  };

  // أزرار المحاكاة في وضع الـ Mock أو الـ Simulation
  const handleSimulateOutcome = (
    outcome: 'Approved' | 'Declined' | 'Cancelled' | 'Timeout' | 'Duplicate',
    options?: { cardScheme?: 'mada' | 'visa' | 'mastercard' | 'apple_pay'; declineReason?: string }
  ) => {
    try {
      const mockAdapter = getMockTerminalAdapter();
      mockAdapter.triggerSimulationOutcome(outcome, options);
    } catch (err) {
      console.warn('تنبيه المحاكاة:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        
        {/* رأس النافذة */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="text-sm font-bold">تكامل جهاز نقاط البيع (Payment Terminal)</h3>
              <p className="text-[11px] text-slate-400 font-mono">
                {config?.providerName || 'جهاز الدفع المعتمد'} • {config?.terminalId || 'TID-MADA'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* عرض المبلغ المرسل للجهاز بشكل ضخم ومؤكد */}
        <div className="p-5 bg-gradient-to-br from-blue-950 via-slate-900 to-slate-900 text-white text-center border-b border-blue-900/50">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium mb-2 border border-blue-500/30">
            <Radio className="w-3.5 h-3.5 animate-pulse text-blue-400" />
            <span>المبلغ المرسل مباشرة إلى جهاز الدفع</span>
          </div>

          <div className="text-4xl font-black font-mono tracking-tight text-white flex items-center justify-center gap-2">
            <span>{formatNumber(grandTotal || 0)}</span>
            <span className="text-xl font-normal font-sans text-blue-300">ر.س</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            لا يحتاج الكاشير لكتابة المبلغ يدوياً، تم تثبيت ومطابقة المبلغ إلكترونياً.
          </p>
        </div>

        {/* شاشة جهاز الدفع التفاعلية (POS Terminal Screen Display) */}
        <div className="p-6 space-y-5">
          <div className="relative mx-auto max-w-sm rounded-2xl bg-slate-900 p-5 text-white shadow-xl border-2 border-slate-700">
            {/* مؤشر الاتصال والـ TID */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-1.5">
                <Wifi className={`w-3.5 h-3.5 ${status === 'Processing' ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
                <span>{config?.connectionType === 'local_network_ip' ? 'شبكة محلية IP' : 'ربط سحابي'}</span>
              </div>
              <span className="font-mono">{config?.terminalId || 'TID-8812'}</span>
            </div>

            {/* محتوى شاشة الجهاز المتغير بحسب الحالة */}
            <div className="py-6 text-center space-y-3">
              {status === 'Processing' && (
                <div className="space-y-3">
                  <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
                    <CreditCard className="w-7 h-7 text-blue-400 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">يرجى تمرير أو إدخال البطاقة</h4>
                    <p className="text-xs text-blue-300 mt-1">بطاقات مدى، فيزا، ماستركارد، أو Apple Pay</p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-mono bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                    <Clock className="w-3.5 h-3.5" />
                    <span>الوقت المتبقي: {countdown} ثانية</span>
                  </div>
                </div>
              )}

              {status === 'Approved' && (
                <div className="space-y-2 animate-in zoom-in-95 duration-200">
                  <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-base font-bold text-emerald-400">تمت العملية بنجاح (APPROVED)</h4>
                  <p className="text-xs text-slate-300 font-mono">
                    {paymentResponse?.cardScheme?.toUpperCase()} •••• {paymentResponse?.cardLast4 || '4921'}
                  </p>
                  <div className="text-[11px] text-slate-400 font-mono pt-1">
                    AUTH: {paymentResponse?.authCode} | RRN: {paymentResponse?.rrn}
                  </div>
                </div>
              )}

              {(status === 'Declined' || status === 'Failed') && (
                <div className="space-y-2 animate-in zoom-in-95 duration-200">
                  <div className="w-14 h-14 mx-auto rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                    <XCircle className="w-8 h-8" />
                  </div>
                  <h4 className="text-base font-bold text-rose-400">تم رفض العملية (DECLINED)</h4>
                  <p className="text-xs text-slate-300">
                    {errorMessage || 'رصيد غير كافٍ أو تعذر إتمام التفويض البنكي.'}
                  </p>
                </div>
              )}

              {status === 'Cancelled' && (
                <div className="space-y-2">
                  <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <h4 className="text-base font-bold text-amber-400">تم إلغاء العملية</h4>
                  <p className="text-xs text-slate-300">تم إلغاء العملية من جهاز الدفع من قِبل العميل.</p>
                </div>
              )}

              {status === 'Timeout' && (
                <div className="space-y-2">
                  <div className="w-14 h-14 mx-auto rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                    <Clock className="w-8 h-8" />
                  </div>
                  <h4 className="text-base font-bold text-slate-200">انتهت مهلة الانتظار</h4>
                  <p className="text-xs text-slate-400">لم يتم تمرير البطاقة خلال الوقت المحدد.</p>
                </div>
              )}

              {status === 'Pending' && (
                <div className="space-y-3">
                  <CreditCard className="w-10 h-10 mx-auto text-slate-500" />
                  <p className="text-xs text-slate-400">جاهز لإرسال المبلغ إلى شاشة جهاز الدفع...</p>
                </div>
              )}
            </div>

            {/* شعار الشبكات المدعومة في أسفل شاشة الجهاز */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-center gap-3 text-[10px] text-slate-400 font-bold">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-400">mada مدى</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-blue-400">VISA</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-rose-400">Mastercard</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200">Apple Pay</span>
            </div>
          </div>

          {/* لوحة التحكم بالمحاكاة للكاشير والمطور (Simulator Controls) */}
          {(config?.isSimulationMode || config?.providerId === 'mock') && status === 'Processing' && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>لوحة محاكاة جهاز الدفع (اختبار السيناريوهات):</span>
                </span>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  وضع الاختبار النشط
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSimulateOutcome('Approved', { cardScheme: 'mada' })}
                  className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>نجاح الدفع (بطاقة مدى)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSimulateOutcome('Approved', { cardScheme: 'apple_pay' })}
                  className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>نجاح (Apple Pay)</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleSimulateOutcome('Declined', {
                      declineReason: 'تم رفض البطاقة: رصيد غير كافٍ في الحساب (Code 51).',
                    })
                  }
                  className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>محاكاة رفض (رصيد غير كافٍ)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSimulateOutcome('Cancelled')}
                  className="p-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>محاكاة إلغاء العميل</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSimulateOutcome('Timeout')}
                  className="p-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>محاكاة انتهاء المهلة (Timeout)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSimulateOutcome('Duplicate')}
                  className="p-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer col-span-2"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>محاكاة عملية مكررة مرفوضة (Duplicate Transaction - Code 94)</span>
                </button>
              </div>
            </div>
          )}

          {/* أزرار الإجراءات */}
          <div className="flex items-center gap-2 pt-2">
            {status !== 'Approved' && status !== 'Processing' && (
              <button
                type="button"
                onClick={() => initiateSendToTerminal()}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCw className="w-4 h-4" />
                <span>إعادة إرسال المبلغ لجهاز الدفع ({formatSAR(grandTotal)})</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              {status === 'Approved' ? 'تم الاعتماد' : 'إلغاء والرجوع'}
            </button>
          </div>
        </div>

        {/* تذييل النافذة */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>حماية من التكرار والخصم المزدوج (Idempotency Secured)</span>
          </div>
          <span className="font-mono text-[10px] text-slate-400">
            Ref: {activeTxId ? activeTxId.slice(-8) : 'INIT'}
          </span>
        </div>
      </div>
    </div>
  );
};
