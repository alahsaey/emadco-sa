/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  KeyRound,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  RotateCw,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  MailCheck,
  Send,
  Smartphone,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { TelegramIcon } from '../common/TelegramIcon';
import {
  sendPasswordResetOTP,
  verifyTemporaryCode,
  completePasswordResetAndChange,
} from '../../services/passwordReset';
import { useAuth } from '../../context/AuthContext';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
  onSuccessLogin?: () => void;
}

type ResetStep = 'ENTER_EMAIL' | 'VERIFY_OTP' | 'CHANGE_PASSWORD' | 'SUCCESS';

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  initialEmail = '',
  onSuccessLogin,
}) => {
  const { availableUsers, updateUser, login } = useAuth();

  const [step, setStep] = useState<ResetStep>('ENTER_EMAIL');
  const [identifier, setIdentifier] = useState<string>(initialEmail);
  const [resetId, setResetId] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [maskedEmail, setMaskedEmail] = useState<string>('');
  const [maskedPhone, setMaskedPhone] = useState<string>('');
  const [userFullName, setUserFullName] = useState<string>('');

  // حالة قنوات الإرسال (تيليجرام + بريد)
  const [deliveredViaSmtp, setDeliveredViaSmtp] = useState<boolean>(false);
  const [firebaseLinkSent, setFirebaseLinkSent] = useState<boolean>(false);
  const [telegramSent, setTelegramSent] = useState<boolean>(false);
  const [telegramStatus, setTelegramStatus] = useState<string>('');
  const [telegramBotUsername, setTelegramBotUsername] = useState<string>('');
  const [telegramDeepLink, setTelegramDeepLink] = useState<string>('');

  // خطوة تغيير الرقم السري
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  // حالات التحميل والرسائل
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState<boolean>(false);
  const [deliveryWarning, setDeliveryWarning] = useState<string | null>(null);

  // مؤقت انتهاء الصلاحية (15 دقيقة = 900 ثانية)
  const [timeLeft, setTimeLeft] = useState<number>(900);
  // مؤقت إعادة الإرسال (60 ثانية)
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStep('ENTER_EMAIL');
      setIdentifier(initialEmail);
      setOtpCode('');
      setNewPassword('');
      setConfirmPassword('');
      setError(null);
      setIsLoading(false);
      setTimeLeft(900);
      setResendCooldown(0);
      setResendSuccess(false);
      setFirebaseLinkSent(false);
      setTelegramSent(false);
      setTelegramStatus('');
      setTelegramBotUsername('');
      setTelegramDeepLink('');

      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const emailParam = params.get('email');
        if (emailParam) {
          setIdentifier(emailParam);
        }
      }
    }
  }, [isOpen, initialEmail]);

  // عداد تنازلي لصلاحية الرمز المؤقت
  useEffect(() => {
    let timer: any;
    if (step === 'VERIFY_OTP' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  // عداد تنازلي لإعادة الإرسال
  useEffect(() => {
    let resendTimer: any;
    if (resendCooldown > 0) {
      resendTimer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(resendTimer);
  }, [resendCooldown]);

  if (!isOpen) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 1. معالج إرسال الرمز المؤقت إلى تيليجرام والبريد الإلكتروني
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await sendPasswordResetOTP(identifier, availableUsers);
      setResetId(res.resetId);
      setMaskedEmail(res.maskedEmail);
      setMaskedPhone(res.maskedPhone || '');
      setUserFullName(res.userFullName);
      setDeliveredViaSmtp(Boolean(res.deliveredViaSmtp));
      setDeliveryWarning(res.deliveryWarning || null);
      setFirebaseLinkSent(Boolean(res.firebaseLinkSent));
      setTelegramSent(Boolean(res.telegramSent));
      setTelegramStatus(res.telegramStatus || '');
      setTelegramBotUsername(res.telegramBotUsername || '');
      setTelegramDeepLink(res.telegramDeepLink || '');
      setTimeLeft(900);
      setResendCooldown(60);
      setStep('VERIFY_OTP');
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 200);
    } catch (err: any) {
      setError(err?.message || 'تعذر إرسال رمز التحقق. يرجى التأكد من البريد أو الجوال المدخل.');
    } finally {
      setIsLoading(false);
    }
  };

  // إعادة إرسال الرمز
  const handleResendOTP = async () => {
    if (resendCooldown > 0 || isResending) return;
    setError(null);
    setIsResending(true);
    setResendSuccess(false);

    try {
      const res = await sendPasswordResetOTP(identifier, availableUsers);
      setResetId(res.resetId);
      setDeliveredViaSmtp(Boolean(res.deliveredViaSmtp));
      setDeliveryWarning(res.deliveryWarning || null);
      setFirebaseLinkSent(Boolean(res.firebaseLinkSent));
      setTelegramSent(Boolean(res.telegramSent));
      setTelegramStatus(res.telegramStatus || '');
      setTelegramBotUsername(res.telegramBotUsername || '');
      setTelegramDeepLink(res.telegramDeepLink || '');
      setTimeLeft(900);
      setResendCooldown(60);
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 4000);
    } catch (err: any) {
      setError(err?.message || 'تعذر إعادة إرسال الرمز.');
    } finally {
      setIsResending(false);
    }
  };

  // 2. معالج التحقق من مطابقة الرمز المؤقت
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await verifyTemporaryCode(resetId, otpCode);
      setStep('CHANGE_PASSWORD');
    } catch (err: any) {
      setError(err?.message || 'فشل التحقق من الرمز المؤقت.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. معالج إجبار المستخدم على تغيير الرقم السري
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanNew = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanNew) {
      setError('يرجى إدخال الرقم السري أو كلمة المرور الجديدة.');
      return;
    }

    if (cleanNew.length < 4) {
      setError('يجب ألا يقل الرقم السري عن 4 خانات على الأقل.');
      return;
    }

    if (cleanNew !== cleanConfirm) {
      setError('كلمة المرور وتأكيدها غير متطابقين، يرجى إعادة التحقق.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await completePasswordResetAndChange(resetId, otpCode, cleanNew);

      await updateUser(res.userId, {
        password: cleanNew,
        pinCode: cleanNew,
      });

      setStep('SUCCESS');

      setTimeout(async () => {
        const loginRes = await login(identifier, cleanNew);
        if (loginRes.success) {
          onClose();
          if (onSuccessLogin) {
            onSuccessLogin();
          }
        } else {
          onClose();
        }
      }, 1800);
    } catch (err: any) {
      setError(err?.message || 'تعذر حفظ الرقم السري الجديد.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
        {/* الترويسة العلوية */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">استعادة وتعيين الرقم السري</h3>
              <p className="text-xs text-slate-400">إرسال رمز الأمان OTP عبر التيليجرام والإيميل</p>
            </div>
          </div>
          {step !== 'SUCCESS' && (
            <button
              onClick={onClose}
              type="button"
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer text-xs"
            >
              إلغاء
            </button>
          )}
        </div>

        {/* مؤشر الخطوات */}
        <div className="px-6 pt-4 pb-2 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <div
              className={`flex items-center gap-1.5 ${
                step === 'ENTER_EMAIL' ? 'text-amber-700' : 'text-emerald-600'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  step === 'ENTER_EMAIL'
                    ? 'bg-amber-600 text-white'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                1
              </div>
              <span>بيانات المستخدم</span>
            </div>

            <div className="h-0.5 flex-1 mx-2 bg-slate-200">
              <div
                className={`h-full bg-amber-500 transition-all ${
                  step === 'ENTER_EMAIL' ? 'w-0' : step === 'VERIFY_OTP' ? 'w-1/2' : 'w-full'
                }`}
              />
            </div>

            <div
              className={`flex items-center gap-1.5 ${
                step === 'VERIFY_OTP'
                  ? 'text-amber-700'
                  : step === 'CHANGE_PASSWORD' || step === 'SUCCESS'
                  ? 'text-emerald-600'
                  : 'text-slate-400'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  step === 'VERIFY_OTP'
                    ? 'bg-amber-600 text-white'
                    : step === 'CHANGE_PASSWORD' || step === 'SUCCESS'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                2
              </div>
              <span>مطابقة رمز OTP</span>
            </div>

            <div className="h-0.5 flex-1 mx-2 bg-slate-200">
              <div
                className={`h-full bg-amber-500 transition-all ${
                  step === 'CHANGE_PASSWORD' || step === 'SUCCESS' ? 'w-full' : 'w-0'
                }`}
              />
            </div>

            <div
              className={`flex items-center gap-1.5 ${
                step === 'CHANGE_PASSWORD'
                  ? 'text-amber-700'
                  : step === 'SUCCESS'
                  ? 'text-emerald-600'
                  : 'text-slate-400'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  step === 'CHANGE_PASSWORD'
                    ? 'bg-amber-600 text-white'
                    : step === 'SUCCESS'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                3
              </div>
              <span>تعيين الرقم السري</span>
            </div>
          </div>
        </div>

        {/* رسائل التنبيه والأخطاء */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-bold">{error}</span>
          </div>
        )}

        {/* إشعار نجاح إعادة الإرسال */}
        {resendSuccess && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold">تم إرسال رمز تحقق مؤقت جديد إلى تيليجرام والبريد بنجاح!</span>
          </div>
        )}

        {/* محتوى الخطوات */}
        <div className="p-6">
          {/* الخطوة 1: إدخال البريد أو الجوال */}
          {step === 'ENTER_EMAIL' && (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div>
                <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                  أدخل عنوان البريد الإلكتروني أو رقم الجوال المسجل باسم المستخدم في نظام عمادكو،
                  وسيقوم النظام فوراً بإرسال رمز تحقق مؤقت (OTP) مكون من 6 أرقام عبر <strong>التيليجرام</strong> و<strong>البريد الإلكتروني</strong>.
                </p>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  البريد الإلكتروني أو رقم الجوال المسجل
                </label>
                <div className="relative">
                  <div className="absolute right-3 top-3.5 flex items-center gap-1.5 text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="مثال: alahsaey@gmail.com أو 0500680180"
                    required
                    autoFocus
                    className="w-full pr-10 pl-3 py-3 bg-slate-50 border border-slate-300 rounded-xl font-sans text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* بطاقة توضيحية لقنوات التسليم */}
              <div className="p-3.5 bg-sky-50 rounded-2xl border border-sky-200 text-[11px] text-sky-950 space-y-2">
                <div className="font-bold flex items-center gap-2 text-sky-900">
                  <TelegramIcon className="w-4 h-4 text-sky-600" />
                  <span>قنوات الإرسال المباشرة:</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div className="bg-white/80 p-2 rounded-xl border border-sky-100 flex items-center gap-2">
                    <TelegramIcon className="w-4 h-4 text-sky-500 shrink-0" />
                    <div>
                      <strong className="block text-slate-800">بوت تيليجرام 📲</strong>
                      <span className="text-slate-500 text-[10px]">فوري وبدون تأخير</span>
                    </div>
                  </div>
                  <div className="bg-white/80 p-2 rounded-xl border border-sky-100 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-amber-500 shrink-0" />
                    <div>
                      <strong className="block text-slate-800">البريد الإلكتروني ✉️</strong>
                      <span className="text-slate-500 text-[10px]">نسخة أمان موثقة</span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 transition-all"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                    <span>جاري التحقق وإرسال الرمز للتيليجرام والإيميل...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-amber-400" />
                    <span>إرسال رمز التحقق المؤقت (OTP)</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* الخطوة 2: مطابقة الرمز المؤقت */}
          {step === 'VERIFY_OTP' && (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 block">المستخدم المستهدف:</span>
                  <strong className="text-slate-900 text-xs">{userFullName} ({maskedEmail || maskedPhone})</strong>
                </div>
                <div className="flex items-center gap-1 text-xs font-mono font-bold bg-amber-100 text-amber-900 px-2.5 py-1 rounded-lg border border-amber-200">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  <span>{formatTime(timeLeft)}</span>
                </div>
              </div>

              {/* بطاقة معلومات تسليم الرمز عبر تيليجرام والإيميل */}
              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 text-white space-y-3 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    {telegramSent ? (
                      <TelegramIcon className="w-5 h-5 text-sky-400" />
                    ) : deliveredViaSmtp || firebaseLinkSent ? (
                      <MailCheck className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <ShieldCheck className="w-5 h-5 text-amber-400" />
                    )}
                    <span className="text-xs font-bold text-slate-100">
                      {telegramSent
                        ? 'تم إرسال الرمز بنجاح إلى تيليجرام والإيميل'
                        : 'تم توليد وتأمين رمز التحقق في جدار الحماية'}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-bold ${
                      telegramSent
                        ? 'text-sky-300 bg-sky-950/80 border-sky-800'
                        : 'text-amber-300 bg-amber-950/80 border-amber-800'
                    }`}
                  >
                    {telegramSent ? 'تيليجرام + بريد' : 'حماية مشفرة'}
                  </span>
                </div>

                <div className="text-xs text-slate-300 leading-relaxed">
                  مرحباً <strong>{userFullName}</strong>، لقد تم إنشاء رمز تحقق مؤقت مكون من{' '}
                  <strong className="text-amber-400">6 أرقام</strong> لحسابك ({maskedEmail || maskedPhone}).
                </div>

                {/* رابط مباشر لفتح بوت التيليجرام إذا كان متاحاً */}
                {telegramDeepLink && (
                  <div className="p-3 bg-sky-950/60 rounded-xl border border-sky-800/80 text-[11px] text-sky-200 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <TelegramIcon className="w-5 h-5 text-sky-400 shrink-0" />
                      <div>
                        <strong className="block text-sky-300">بوت أمان تيليجرام:</strong>
                        <span className="text-slate-300">
                          {telegramSent ? 'تم إرسال الرمز في المحادثة.' : 'اضغط للفتح واستلام الرمز فوراً.'}
                        </span>
                      </div>
                    </div>
                    <a
                      href={telegramDeepLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-lg transition-colors flex items-center gap-1.5 shrink-0 text-xs"
                    >
                      <TelegramIcon className="w-3.5 h-3.5 text-slate-950" />
                      <span>فتح البوت</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <span className="text-slate-400">لم تصلك الرسالة؟</span>
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={resendCooldown > 0 || isResending}
                    className="text-amber-400 hover:text-amber-300 disabled:text-slate-500 font-bold flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed transition-colors"
                  >
                    <RotateCw className={`w-3 h-3 ${isResending ? 'animate-spin' : ''}`} />
                    <span>
                      {resendCooldown > 0
                        ? `إعادة الإرسال بعد (${resendCooldown} ث)`
                        : 'إعادة إرسال الرمز'}
                    </span>
                  </button>
                </div>
              </div>

              {/* حقل إدخال الرمز المؤقت للمطابقة */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  أدخل رمز التحقق (6 أرقام) المستلم للمطابقة:
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                  <input
                    ref={otpInputRef}
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="------"
                    required
                    autoComplete="one-time-code"
                    className="w-full pr-9 pl-3 py-3 bg-slate-50 border-2 border-slate-300 focus:border-amber-500 rounded-xl font-mono text-center text-xl font-bold tracking-widest text-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('ENTER_EMAIL')}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  تغيير المستخدم
                </button>
                <button
                  type="submit"
                  disabled={isLoading || otpCode.length < 6}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 transition-all"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري مطابقة الرقم المؤقت...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تأكيد ومطابقة الرمز المؤقت</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* الخطوة 3: إجبار المستخدم على تغيير الرقم السري */}
          {step === 'CHANGE_PASSWORD' && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>تمت مطابقة الرمز المؤقت بنجاح!</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  بموجب سياسة أمان نظام عمادكو، <strong>أنت مجبر الآن على تعيين رقم سري جديد</strong> لحسابك
                  لإكمال الدخول وحماية صلاحياتك.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الرقم السري أو كلمة المرور الجديدة (PIN)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="أدخل 4 خانات على الأقل (مثال: 4567)"
                    required
                    autoFocus
                    className="w-full pr-9 pl-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  تأكيد الرقم السري الجديد
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="أعد كتابة الرقم السري الجديد"
                    required
                    className="w-full pr-9 pl-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* مؤشر التطابق */}
              {newPassword && confirmPassword && (
                <div
                  className={`text-[11px] font-bold flex items-center gap-1.5 ${
                    newPassword === confirmPassword ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {newPassword === confirmPassword ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>الرقم السري متطابق وجاهز للاعتماد</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>الرقم السري غير متطابق</span>
                    </>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !newPassword || newPassword !== confirmPassword}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 transition-all mt-4"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                    <span>جاري حفظ الرقم السري الجديد والدخول...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>حفظ الرقم السري الجديد وتسجيل الدخول فوراً</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* الخطوة 4: اكتمال وتأكيد النجاح */}
          {step === 'SUCCESS' && (
            <div className="text-center py-6 space-y-4 animate-scale-up">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900">تم تغيير الرقم السري بنجاح!</h4>
                <p className="text-xs text-slate-500 mt-1">
                  تم تحديث بيانات حسابك في قاعدة البيانات السحابية، جاري تسجيل الدخول الآمن للنظام الآن...
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-amber-700 font-bold">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>جاري توجيهك إلى شاشتك المعتمدة...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
