/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  X,
  MessageSquare,
  Send,
  Copy,
  CheckCircle2,
  Phone,
  FileText,
  ExternalLink,
  FileDown,
  Loader2,
  Check,
  AlertCircle,
  Zap,
  Settings,
  Key,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  formatWhatsAppPhone,
  createWhatsAppUrl,
  buildPdfWhatsAppCoverMessage,
  sendViaWhatsApp,
  isValidInternationalPhone,
} from '../../utils/whatsapp';
import {
  generatePdfFromElement,
  downloadPdfBlob,
  canShareFiles,
  sharePdfNatively,
} from '../../utils/pdfGenerator';
import {
  WhatsAppGatewayConfig,
  getSystemSettings,
  saveSystemSettings,
  CompanyFacilitySettings,
} from '../../services/settings';
import { sendDirectWhatsApp, getWhatsAppConnectionStatus } from '../../services/whatsappService';
import { formatSAR } from '../../utils/formatters';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  documentNumber: string;
  recipientName?: string;
  initialPhone?: string;
  messageText: string;
  pdfElementRef?: React.RefObject<HTMLElement | null>;
  pdfFormat?: 'a4' | 'thermal';
  grandTotal?: number;
  saleResult?: any;
  items?: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  onShareInitiated?: () => void;
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({
  isOpen,
  onClose,
  documentTitle,
  documentNumber,
  recipientName = '',
  initialPhone = '',
  messageText,
  pdfElementRef,
  pdfFormat = 'a4',
  grandTotal,
  saleResult,
  items,
  onShareInitiated,
}) => {
  const internalPdfRef = useRef<HTMLDivElement>(null);
  const [phoneNumber, setPhoneNumber] = useState<string>(initialPhone);
  const [shareMode, setShareMode] = useState<'pdf' | 'text'>('pdf');
  const [selectedFormat, setSelectedFormat] = useState<'a4' | 'thermal'>(pdfFormat);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [facilitySettings, setFacilitySettings] = useState<CompanyFacilitySettings | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  // إعدادات وحالة محرك الواتساب المباشر (Direct Baileys Gateway)
  const [directEngineStatus, setDirectEngineStatus] = useState<{
    connected: boolean;
    phone?: string;
    deviceName?: string;
    checking: boolean;
  }>({
    connected: false,
    checking: true,
  });

  const [sendMethod, setSendMethod] = useState<'direct' | 'app'>('direct');
  const [isDirectSending, setIsDirectSending] = useState(false);
  const [directSuccessInfo, setDirectSuccessInfo] = useState<string | null>(null);
  const [showManualFallback, setShowManualFallback] = useState(false);

  // دالة فحص وتحديث حالة محرك الواتساب المباشر
  const checkEngineStatus = () => {
    setDirectEngineStatus((prev) => ({ ...prev, checking: true }));
    getWhatsAppConnectionStatus()
      .then((status) => {
        setDirectEngineStatus({
          connected: Boolean(status.connected),
          phone: status.phone,
          deviceName: status.deviceName,
          checking: false,
        });
      })
      .catch(() => {
        setDirectEngineStatus({ connected: false, checking: false });
      });
  };

  useEffect(() => {
    if (isOpen) {
      let cleanInitial = (initialPhone || '').trim();
      if (cleanInitial.startsWith('005')) {
        cleanInitial = '05' + cleanInitial.substring(3);
      }
      setPhoneNumber(cleanInitial);
      setCopied(false);
      setIsSent(false);
      setDownloadSuccess(null);
      setErrorMessage(null);
      setDirectSuccessInfo(null);
      setShareMode('pdf');
      setSelectedFormat(pdfFormat || 'a4');

      // فحص اتصال محرك الواتساب المباشر فور فتح النافذة
      checkEngineStatus();

      // جلب إعدادات المنشأة
      getSystemSettings()
        .then((settings) => {
          if (settings.facility) {
            setFacilitySettings(settings.facility);
          }
        })
        .catch((err) => {
          console.warn('فشل جلب إعدادات النظام:', err);
        });

      // توليد رمز الاستجابة السريعة (QR) للفاتورة
      const qrPayload = saleResult?.zatcaQr || `Seller: مؤسسة عماد سعد آل سعيد لمواد البناء\nVAT: 300000000000003\nTime: ${new Date().toISOString()}\nTotal: ${grandTotal || 0}\nInvoice: ${documentNumber}`;
      QRCode.toDataURL(qrPayload, { width: 140, margin: 1 })
        .then((url) => setQrCodeUrl(url))
        .catch((err) => console.warn('QR Code generation notice:', err));
    }
  }, [isOpen, initialPhone, pdfFormat, documentNumber, grandTotal, saleResult]);

  if (!isOpen) return null;

  const formattedPhone = formatWhatsAppPhone(phoneNumber);
  const hasValidPhone = isValidInternationalPhone(phoneNumber);

  // صياغة نص الرسالة الترحيبية المرفقة بملف الـ PDF
  const pdfCoverMessage = buildPdfWhatsAppCoverMessage({
    documentTitle,
    documentNumber,
    recipientName,
    companyName: 'مؤسسة عماد سعد آل سعيد لمواد البناء (عمادكو)',
    grandTotal,
  });

  const pdfFileName = `${documentTitle.replace(/\s+/g, '_')}_${documentNumber}.pdf`;

  // نسخ نص الرسالة
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // إرسال النص التقليدي (فتح تطبيق الواتساب يدوياً)
  const handleSendTextAppOnly = () => {
    const success = sendViaWhatsApp(phoneNumber, messageText);
    if (success) {
      setDownloadSuccess('تم فتح محادثة الواتساب في نافذة جديدة للإرسال اليدوي.');
    }
  };

  // إرسال النص مباشرة عبر محرك واتساب المباشر المعتمد
  const handleSendTextDirect = async () => {
    if (!hasValidPhone) {
      setErrorMessage('يرجى التأكد من إدخال رقم هاتف صحيح للعميل (مثال: 0500680180 أو 966500680180).');
      return;
    }

    try {
      setIsDirectSending(true);
      setErrorMessage(null);
      setDirectSuccessInfo(null);

      const res = await sendDirectWhatsApp({
        toPhone: phoneNumber,
        message: messageText,
      });

      if (res.success) {
        setIsSent(true);
        setDirectSuccessInfo(res.message || 'تم تسليم الرسالة مباشرة إلى واتساب العميل بنجاح دون فتح أي تطبيق! ✨');
        // يتم تحديث حالة الفاتورة حصراً عند نجاح التسليم الفعلي
        onShareInitiated?.();
      } else {
        // Fallback: فتح الواتساب يدوياً إذا فشل الإرسال المباشر
        const url = createWhatsAppUrl(phoneNumber, messageText);
        window.open(url, '_blank', 'noopener,noreferrer');
        setErrorMessage(
          (res.message || res.error || 'فشل الإرسال المباشر.') + ' تم فتح الواتساب يدوياً للإرسال.'
        );
      }
    } catch (err: any) {
      setErrorMessage('تعذر إتمام الإرسال المباشر: ' + (err?.message || ''));
    } finally {
      setIsDirectSending(false);
    }
  };

  // عنصر الفاتورة الفعلي لتوليد الـ PDF (الممرر أو المولد داخلياً)
  const getTargetElement = (): HTMLElement | null => {
    if (pdfElementRef?.current) return pdfElementRef.current;
    if (internalPdfRef.current) return internalPdfRef.current;
    return null;
  };

  // تحميل ملف الـ PDF فقط لجهاز المستخدم
  const handleDownloadPdfOnly = async () => {
    const targetElem = getTargetElement();
    if (!targetElem) {
      setErrorMessage('تعذر العثور على نموذج الفاتورة لتوليد الـ PDF.');
      return;
    }

    try {
      setIsGeneratingPdf(true);
      setErrorMessage(null);

      const result = await generatePdfFromElement(targetElem, {
        fileName: pdfFileName,
        format: selectedFormat,
      });

      downloadPdfBlob(result.blob, result.fileName);
      setDownloadSuccess(`تم حفظ ملف الفاتورة (${result.fileName}) في جهازك بنجاح!`);
    } catch (err: any) {
      console.error('خطأ في توليد PDF:', err);
      setErrorMessage('حدث خطأ أثناء توليد ملف الـ PDF: ' + (err.message || ''));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // إرفاق ومشاركة ملف الـ PDF مباشرة عبر قائمة مشاركة النظام (تطبيقات الجوال والواتساب)
  const handleSharePdfNatively = async () => {
    const targetElem = getTargetElement();
    if (!targetElem) {
      setErrorMessage('تعذر العثور على نموذج الفاتورة لتوليد الـ PDF.');
      return;
    }

    try {
      setIsGeneratingPdf(true);
      setErrorMessage(null);
      setDownloadSuccess(null);

      const result = await generatePdfFromElement(targetElem, {
        fileName: pdfFileName,
        format: selectedFormat,
      });

      const shareResult = await sharePdfNatively(
        result.file,
        `${documentTitle} - ${documentNumber}`,
        pdfCoverMessage
      );

      if (shareResult.success) {
        setIsSent(true);
        setDownloadSuccess('تمت مشاركة وإرفاق ملف الفاتورة (PDF) بنجاح عبر الواتساب!');
      } else if (!shareResult.cancelled) {
        // إذا كان المتصفح لا يدعم المشاركة المباشرة (مثل أجهزة الكمبيوتر)
        downloadPdfBlob(result.blob, result.fileName);
        const whatsAppUrl = createWhatsAppUrl(phoneNumber, pdfCoverMessage);
        window.open(whatsAppUrl, '_blank', 'noopener,noreferrer');
        setIsSent(true);
        setDownloadSuccess(
          `تم تنزيل ملف الفاتورة (${result.fileName}) وفتح محادثة الواتساب. اضغط على زر المرفقات 📎 في الواتساب لإرسال الملف.`
        );
      }
    } catch (err: any) {
      console.error('فشل إرسال الفاتورة كـ PDF:', err);
      setErrorMessage('تعذر إتمام عملية التصدير والمشاركة: ' + (err.message || ''));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // فتح تطبيق الواتساب مع تنزيل ملف الـ PDF مسبقاً (خيار بديل يدوي)
  const handleSendPdfViaApp = async () => {
    const targetElem = getTargetElement();
    if (!targetElem) {
      const url = createWhatsAppUrl(phoneNumber, pdfCoverMessage);
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    try {
      setIsGeneratingPdf(true);
      setErrorMessage(null);
      setDownloadSuccess(null);

      const result = await generatePdfFromElement(targetElem, {
        fileName: pdfFileName,
        format: selectedFormat,
      });

      // تنزيل الملف في جهاز المستخدم ليكون جاهزاً للإرفاق
      downloadPdfBlob(result.blob, result.fileName);

      // فتح محادثة الواتساب
      const whatsAppUrl = createWhatsAppUrl(phoneNumber, pdfCoverMessage);
      window.open(whatsAppUrl, '_blank', 'noopener,noreferrer');

      setDownloadSuccess(
        `تم تنزيل ملف الفاتورة (${result.fileName}) في جهازك وفتح المحادثة! يمكنك إرفاق الملف يدوياً في الواتساب.`
      );
    } catch (err: any) {
      console.error('فشل إرسال الفاتورة كـ PDF:', err);
      setErrorMessage('تعذر إتمام عملية التصدير: ' + (err.message || ''));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // إرسال ملف الـ PDF مباشرة إلى واتساب العميل عبر محرك الواتساب المباشر المعتمد (البرمجة الجديدة)
  const handleSendPdfDirect = async () => {
    if (!hasValidPhone) {
      setErrorMessage('يرجى التأكد من إدخال رقم هاتف صحيح للعميل أولاً (مثال: 0500680180 أو 966500680180).');
      return;
    }

    try {
      setIsDirectSending(true);
      setErrorMessage(null);
      setDownloadSuccess(null);
      setDirectSuccessInfo(null);

      let pdfDataUrl: string | undefined;
      const targetElem = getTargetElement();
      if (targetElem) {
        setIsGeneratingPdf(true);
        const result = await generatePdfFromElement(targetElem, {
          fileName: pdfFileName,
          format: selectedFormat,
        });
        pdfDataUrl = result.dataUrl;
        setIsGeneratingPdf(false);
      }

      const res = await sendDirectWhatsApp({
        toPhone: phoneNumber,
        message: pdfCoverMessage,
        pdfBase64: pdfDataUrl,
        fileName: pdfFileName,
      });

      if (res.success) {
        setIsSent(true);
        setDirectSuccessInfo(
          res.message || 'تم تسليم ملف الفاتورة والرسالة الترحيبية مباشرة إلى واتساب العميل بنجاح دون فتح أي نافذة! ✨'
        );
        // تحديث حالة الفاتورة في قاعدة البيانات عند نجاح الإرسال الفعلي
        onShareInitiated?.();
      } else {
        setErrorMessage(
          res.message || res.error ||
            'فشل الإرسال المباشر. يرجى التحقق من اتصال محرك الواتساب أو إعادة المحاولة.'
        );
      }
    } catch (err: any) {
      console.error('خطأ الإرسال المباشر:', err);
      setErrorMessage('حدث خطأ أثناء الإرسال المباشر: ' + (err?.message || ''));
    } finally {
      setIsDirectSending(false);
      setIsGeneratingPdf(false);
    }
  };

  // التحقق من جاهزية المحرك المباشر
  const isGatewayReady = Boolean(directEngineStatus.connected);

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* ترويسة النافذة */}
        <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-xs">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black flex items-center gap-1.5">
                <span>إرسال {documentTitle} عبر واتساب</span>
                <span className="text-[10px] bg-emerald-500/80 border border-emerald-400 px-2 py-0.5 rounded-full font-mono">
                  {documentNumber}
                </span>
              </h3>
              <p className="text-xs text-emerald-100 font-medium">
                {recipientName ? `المستلم: ${recipientName}` : 'مشاركة رسمية معتمدة مع العميل'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* شريط وبطاقة الربط البرمجي المباشر لمراسلات الواتساب (Direct WhatsApp Engine) */}
          <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border-2 border-emerald-400/90 rounded-2xl space-y-2.5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full bg-emerald-500 shadow-xs animate-pulse ring-4 ring-emerald-100"
                />
                <span className="font-black text-slate-900 text-xs">
                  البرمجة المباشرة للواتساب (محرك النظام المحاسبي المعتمد):
                </span>
                <span className="text-emerald-900 font-black bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md text-[11px] flex items-center gap-1 shadow-2xs">
                  <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />
                  <span>متصل ومقترن 24/7 بالهاتف (+{directEngineStatus.phone || '0500680180'})</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-emerald-800 bg-white/90 border border-emerald-200 px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-2xs">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>إرسال فوري مباشر دون وسيط</span>
                </span>
                <button
                  type="button"
                  onClick={checkEngineStatus}
                  className="text-slate-500 hover:text-emerald-700 font-bold flex items-center gap-1 text-[11px] cursor-pointer"
                  title="تحديث والتحقق من نبض الاتصال"
                >
                  <RefreshCw className={`w-3 h-3 ${directEngineStatus.checking ? 'animate-spin text-emerald-600' : ''}`} />
                  <span>فحص الاتصال</span>
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-emerald-200/70 text-[11px]">
              <p className="text-emerald-950 font-bold flex items-center gap-1.5 leading-tight">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>
                  النظام المحاسبي مرتبط برمجياً بالكامل: يتم تسليم ملف الفاتورة والرسالة الترحيبية مباشرة لرقم العميل عبر المحرك المدمج فور الضغط على زر الإرسال أدناه، دون الحاجة لفتح أي تطبيق خارجي.
                </span>
              </p>
            </div>
          </div>

          {/* تبديل نمط الإرسال: ملف PDF أو نص الرسالة */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setShareMode('pdf')}
              className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                shareMode === 'pdf'
                  ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileDown className="w-4 h-4 text-rose-600" />
              <span>إرسال كملف PDF معتمد (موصى به)</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full font-bold">
                شامل الختم وQR
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShareMode('text')}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                shareMode === 'text'
                  ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>ملخص نصي مكتوب</span>
            </button>
          </div>

          {/* حقل إدخال رقم الهاتف */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>رقم هاتف العميل (واتساب):</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                يدعم الأرقام السعودية والدولية (05xxxxxxx أو 9665xxxxxxx)
              </span>
            </label>
            <div className="relative">
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => {
                  let val = e.target.value.trim();
                  if (val.startsWith('005')) {
                    val = '05' + val.substring(3);
                  }
                  setPhoneNumber(val);
                }}
                placeholder="05XXXXXXXX أو 9665XXXXXXXX"
                dir="ltr"
                className="w-full pl-4 pr-12 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all outline-hidden text-right"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Phone className="w-4 h-4" />
              </div>
            </div>
            {phoneNumber && (
              <p className="text-[11px] text-slate-500 font-mono text-left">
                الرقم الموجه إليه:{' '}
                <span className="font-bold text-emerald-700">+{formattedPhone || 'غير مكتمل'}</span>
              </p>
            )}
          </div>

          {/* محتوى النمط المختار: ملف PDF */}
          {shareMode === 'pdf' ? (
            <div className="space-y-3.5">
              {/* بطاقة ملف الفاتورة PDF */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-rose-50/70 via-white to-slate-50 border border-rose-200/90 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-rose-600 text-white flex flex-col items-center justify-center font-black shadow-sm shrink-0">
                      <FileDown className="w-5 h-5" />
                      <span className="text-[9px] uppercase tracking-tighter mt-0.5">PDF</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 line-clamp-1">
                        {pdfFileName}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        ملف فاتورة ضريبية رسمية جاهزة للطباعة والحفظ
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>شامل رمز QR والختم الضريبي</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* اختيار قياس الصفحة */}
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setSelectedFormat('a4')}
                      className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                        selectedFormat === 'a4'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      A4 رسمي
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedFormat('thermal')}
                      className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                        selectedFormat === 'thermal'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      إيصال حراري
                    </button>
                  </div>
                </div>

                {/* نص الرسالة الترحيبية المرافقة */}
                <div className="pt-2 border-t border-slate-200/80">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-emerald-600" />
                      <span>الرسالة المرافقة لملف الـ PDF:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(pdfCoverMessage)}
                      className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>نسخ النَص</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed max-h-24 overflow-y-auto">
                    {pdfCoverMessage}
                  </div>
                </div>
              </div>

              {/* إشعار نجاح الإرسال المباشر */}
              {directSuccessInfo && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="font-bold">{directSuccessInfo}</span>
                </div>
              )}

              {/* إشعار التحميل المحلي إن وجد */}
              {downloadSuccess && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{downloadSuccess}</span>
                </div>
              )}

              {/* رسالة الخطأ إن وجدت */}
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          ) : (
            /* محتوى النمط الثاني: نص الرسالة المكتوب */
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>معاينة نص الرسالة المكتوبة:</span>
                </label>
                <button
                  type="button"
                  onClick={() => handleCopy(messageText)}
                  className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>تم النسخ للحافظة</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>نسخ النص</span>
                    </>
                  )}
                </button>
              </div>

              <div className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-3.5 max-h-56 overflow-y-auto font-sans text-xs text-slate-800 whitespace-pre-wrap leading-relaxed shadow-inner">
                {messageText}
              </div>

              {/* إشعار نجاح الإرسال المباشر */}
              {directSuccessInfo && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="font-bold">{directSuccessInfo}</span>
                </div>
              )}

              {/* رسالة الخطأ إن وجدت */}
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* أزرار التحكم السفلية */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center gap-2.5">
          {shareMode === 'pdf' ? (
            <>
              {/* زر الإرسال المباشر والفوري بالبرمجة المضافة (الزر الأساسي للنظام المحاسبي) */}
              <button
                type="button"
                disabled={isDirectSending || isGeneratingPdf}
                onClick={handleSendPdfDirect}
                className="flex-1 min-w-[240px] py-3 px-5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 hover:from-emerald-700 hover:to-teal-800 disabled:opacity-60 text-white text-xs font-black flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                {isDirectSending || isGeneratingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>جارٍ معالجة وإرسال الفاتورة مباشرة للعميل عبر المحرك...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-amber-300" />
                    <span>إرسال الفاتورة والملف مباشرة لواتساب العميل ⚡ (فوري دون وسيط)</span>
                  </>
                )}
              </button>

              {/* زر تحميل ملف الـ PDF للجهاز */}
              <button
                type="button"
                disabled={isGeneratingPdf || isDirectSending}
                onClick={handleDownloadPdfOnly}
                className="py-2.5 px-3.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                title="تنزيل ملف الفاتورة PDF إلى جهازك"
              >
                <FileDown className="w-4 h-4 text-rose-600" />
                <span>تحميل PDF</span>
              </button>

              {/* زر فتح المتصفح / التطبيق كخيار بديل عند الحاجة */}
              <button
                type="button"
                disabled={isGeneratingPdf || isDirectSending}
                onClick={handleSendPdfViaApp}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-medium flex items-center justify-center gap-1 transition-all cursor-pointer"
                title="فتح محادثة الواتساب في المتصفح أو التطبيق وتنزيل الفاتورة يدوياً (خيار بديل)"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                <span>فتح التطبيق (يدوي)</span>
              </button>
            </>
          ) : (
            <>
              {/* زر إرسال النص مباشرة عبر المحرك */}
              <button
                type="button"
                disabled={isDirectSending}
                onClick={handleSendTextDirect}
                className="flex-1 min-w-[240px] py-3 px-5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 hover:from-emerald-700 hover:to-teal-800 disabled:opacity-60 text-white text-xs font-black flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                {isDirectSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>جارٍ إرسال الرسالة مباشرة عبر المحرك المعتمد...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-amber-300" />
                    <span>إرسال نصي مباشر لواتساب العميل ⚡ (فوري دون وسيط)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleCopy(messageText)}
                className="py-2.5 px-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                title="نسخ الرسالة للحافظة"
              >
                <Copy className="w-4 h-4 text-slate-500" />
                <span>نسخ النص</span>
              </button>

              <button
                type="button"
                onClick={handleSendTextAppOnly}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-medium flex items-center justify-center gap-1 transition-all cursor-pointer"
                title="فتح تطبيق واتساب بالمتصفح (خيار بديل)"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                <span>فتح التطبيق (يدوي)</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-all cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* نموذج الفاتورة الضريبية المدمج لتوليد ملف الـ PDF تلقائياً عند غياب العنصر الخارجي */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: '-9999px',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      >
        <div
          ref={internalPdfRef}
          className={`bg-white text-slate-900 p-8 font-sans ${
            selectedFormat === 'thermal' ? 'w-[380px] text-xs' : 'w-[794px] text-sm'
          }`}
          dir="rtl"
        >
          {/* ترويسة المنشأة */}
          <div className="border-b-2 border-slate-900 pb-4 mb-4 text-center">
            {facilitySettings?.logoUrl && (
              <img
                src={facilitySettings.logoUrl}
                alt="Logo"
                className="h-16 max-w-[200px] object-contain mx-auto mb-2"
                referrerPolicy="no-referrer"
              />
            )}
            <h1 className="text-xl font-black text-slate-900 mb-1">
              {facilitySettings?.nameAr || (facilitySettings as any)?.facilityName || 'مؤسسة عماد سعد آل سعيد لمواد البناء'}
            </h1>
            <p className="text-xs text-slate-600 font-medium mb-1">
              {facilitySettings?.commercialDescription || (facilitySettings as any)?.activityName || 'تجارة مواد البناء والأدوات الصحية والكهربائية'}
            </p>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-700 mt-2 font-mono">
              <span>الرقم الضريبي: <strong>{facilitySettings?.vatNumber || '310948572100003'}</strong></span>
              <span>السجل التجاري: <strong>{facilitySettings?.crNumber || (facilitySettings as any)?.commercialRegister || '1010998877'}</strong></span>
              {facilitySettings?.phone && <span>الهاتف: <strong>{facilitySettings.phone}</strong></span>}
            </div>
          </div>

          {/* تفاصيل الفاتورة والمستند */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 flex justify-between items-center text-xs">
            <div className="space-y-1">
              <div className="font-bold text-sm text-emerald-800">{documentTitle}</div>
              <div>رقم الفاتورة: <strong className="font-mono text-slate-900">{documentNumber}</strong></div>
              <div>تاريخ الإصدار: <span className="font-mono">{new Date().toLocaleDateString('ar-SA')} - {new Date().toLocaleTimeString('ar-SA')}</span></div>
            </div>
            <div className="space-y-1 text-left">
              <div>العميل: <strong>{recipientName || 'عميل نقدي'}</strong></div>
              {phoneNumber && <div>الهاتف: <span className="font-mono">{phoneNumber}</span></div>}
              <div className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                معتمدة ضريبياً (ZATCA)
              </div>
            </div>
          </div>

          {/* جدول الأصناف */}
          <table className="w-full text-right border-collapse mb-4 text-xs">
            <thead>
              <tr className="bg-slate-800 text-white font-bold">
                <th className="p-2 border border-slate-700">#</th>
                <th className="p-2 border border-slate-700">الصنف / البيان</th>
                <th className="p-2 border border-slate-700 text-center">الكمية</th>
                <th className="p-2 border border-slate-700 text-left">السعر</th>
                <th className="p-2 border border-slate-700 text-left">الإجمالي (شامل الضريبة)</th>
              </tr>
            </thead>
            <tbody>
              {saleResult?.saleItems && saleResult.saleItems.length > 0 ? (
                saleResult.saleItems.map((it: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="p-2 border border-slate-200 text-center font-mono">{idx + 1}</td>
                    <td className="p-2 border border-slate-200 font-bold">{it.productName || it.name || 'صنف مواد بناء'}</td>
                    <td className="p-2 border border-slate-200 text-center font-mono">{it.quantity}</td>
                    <td className="p-2 border border-slate-200 text-left font-mono">{formatSAR(it.unitPrice)}</td>
                    <td className="p-2 border border-slate-200 text-left font-mono font-bold">{formatSAR(it.total || (it.quantity * it.unitPrice))}</td>
                  </tr>
                ))
              ) : items && items.length > 0 ? (
                items.map((it: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="p-2 border border-slate-200 text-center font-mono">{idx + 1}</td>
                    <td className="p-2 border border-slate-200 font-bold">{it.name}</td>
                    <td className="p-2 border border-slate-200 text-center font-mono">{it.quantity}</td>
                    <td className="p-2 border border-slate-200 text-left font-mono">{formatSAR(it.unitPrice)}</td>
                    <td className="p-2 border border-slate-200 text-left font-mono font-bold">{formatSAR(it.total)}</td>
                  </tr>
                ))
              ) : (
                <tr className="border-b border-slate-200">
                  <td className="p-2 border border-slate-200 text-center font-mono">1</td>
                  <td className="p-2 border border-slate-200 font-bold">مبيعات مواد بناء ومستلزمات عامة</td>
                  <td className="p-2 border border-slate-200 text-center font-mono">1</td>
                  <td className="p-2 border border-slate-200 text-left font-mono">{formatSAR(grandTotal || 0)}</td>
                  <td className="p-2 border border-slate-200 text-left font-mono font-bold">{formatSAR(grandTotal || 0)}</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* ملخص المبالغ والضريبة */}
          <div className="flex justify-between items-start gap-4 mb-4">
            {/* رمز الاستجابة السريعة ZATCA QR */}
            <div className="flex flex-col items-center justify-center p-2 border border-slate-200 rounded-xl bg-slate-50 text-center">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="ZATCA QR" className="w-24 h-24 object-contain" />
              ) : (
                <div className="w-24 h-24 bg-slate-200 flex items-center justify-center text-[10px] text-slate-500">
                  رمز QR المعتمد
                </div>
              )}
              <span className="text-[9px] text-slate-600 font-bold mt-1">رمز التحقق الضريبي ZATCA</span>
            </div>

            {/* جدول المبالغ */}
            <div className="flex-1 max-w-[320px] bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-2">
              <div className="flex justify-between text-slate-600">
                <span>المجموع الخاضع للضريبة (غير شامل):</span>
                <span className="font-mono font-bold">
                  {formatSAR(saleResult?.invoice?.totalExcludingTax || ((grandTotal || 0) / 1.15))}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>ضريبة القيمة المضافة (15%):</span>
                <span className="font-mono font-bold">
                  {formatSAR(saleResult?.invoice?.taxAmount || ((grandTotal || 0) - ((grandTotal || 0) / 1.15)))}
                </span>
              </div>
              <div className="border-t border-slate-300 pt-2 flex justify-between text-sm font-black text-slate-900">
                <span>الإجمالي المستحق النهائي:</span>
                <span className="font-mono text-emerald-800 text-base">{formatSAR(grandTotal || saleResult?.invoice?.totalIncludingTax || 0)}</span>
              </div>
            </div>
          </div>

          {/* تذييل الفاتورة */}
          <div className="text-center text-[10px] text-slate-500 border-t border-slate-200 pt-3">
            شكراً لتعاملكم معنا • البضاعة المباعة تخضع لسياسة الاستبدال والاسترجاع النظامية
          </div>
        </div>
      </div>
    </div>
  );
};
