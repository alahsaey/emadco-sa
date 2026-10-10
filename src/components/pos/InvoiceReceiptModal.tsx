/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { CompletedSaleResult } from '../../services/pos';
import {
  Printer,
  FileDown,
  RotateCcw,
  CheckCircle,
  X,
  Calendar,
  CreditCard,
  User,
  ShieldCheck,
  MessageSquare,
  Share2,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileCheck,
  Sparkles,
  Loader2,
  ChevronDown,
  ExternalLink,
  Download,
  FileText,
  Check,
  AlertCircle,
} from 'lucide-react';
import { SaudiReceiptIcon as Receipt } from '../common/SaudiReceiptIcon';
import { EmadcoLogo } from '../common/EmadcoLogo';
import { Barcode } from '../common/Barcode';
import { WhatsAppShareModal } from '../common/WhatsAppShareModal';
import { buildInvoiceWhatsAppMessage } from '../../utils/whatsapp';
import { tafqeetRiyal } from '../../utils/tafqeet';
import { useSystemSettings } from '../../context/SettingsContext';
import { formatSAR, formatNumber } from '../../utils/formatters';
import { printElement } from '../../utils/print';
import {
  generatePdfFromElement,
  downloadPdfBlob,
  openPdfInNewTab,
  printPdfDirectly,
  GeneratedPdfResult,
} from '../../utils/pdfGenerator';

interface InvoiceReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleResult: CompletedSaleResult | null;
  onNewSale: () => void;
}

export const InvoiceReceiptModal: React.FC<InvoiceReceiptModalProps> = ({
  isOpen,
  onClose,
  saleResult,
  onNewSale,
}) => {
  const { facility } = useSystemSettings();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [printFormat, setPrintFormat] = useState<'thermal' | 'a4'>('thermal');
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPdfMenuOpen, setIsPdfMenuOpen] = useState(false);
  const [isPrintMenuOpen, setIsPrintMenuOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'info' | 'error';
    actionLabel?: string;
    actionFn?: () => void;
  } | null>(null);
  const [lastPdfResult, setLastPdfResult] = useState<GeneratedPdfResult | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const pdfMenuRef = useRef<HTMLDivElement>(null);
  const printMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (saleResult?.zatcaQr) {
      QRCode.toDataURL(saleResult.zatcaQr, {
        width: 180,
        margin: 1,
        errorCorrectionLevel: 'M',
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('فشل توليد رمز QR للفاتورة:', err));
    }
  }, [saleResult]);

  // إغلاق القوائم المنسدلة عند النقر خارجها
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (pdfMenuRef.current && !pdfMenuRef.current.contains(e.target as Node)) {
        setIsPdfMenuOpen(false);
      }
      if (printMenuRef.current && !printMenuRef.current.contains(e.target as Node)) {
        setIsPrintMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // اختصارات لوحة المفاتيح: Ctrl+P للطباعة، F2 لفاتورة جديدة، Esc للإغلاق
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrint();
      } else if (e.key === 'F2') {
        e.preventDefault();
        onNewSale();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, saleResult, printFormat]);

  if (!isOpen || !saleResult) return null;

  const { invoice, sale, saleItems, payment, changeAmount } = saleResult;

  /**
   * تنفيذ أمر الطباعة المباشر
   */
  const handlePrint = (customFormat?: 'thermal' | 'a4') => {
    if (!receiptRef.current) return;
    setIsPrintMenuOpen(false);

    const activeFmt = customFormat || printFormat;
    if (customFormat && customFormat !== printFormat) {
      setPrintFormat(customFormat);
    }

    try {
      setIsPrinting(true);
      const title = `فاتورة ضريبية - ${invoice.invoiceNumber} (${activeFmt === 'thermal' ? 'حراري 80mm' : 'A4'})`;
      const success = printElement(receiptRef.current, title);

      setStatusMessage({
        text: 'تم إرسال أمر الطباعة إلى الطابعة بنجاح',
        type: 'success',
        actionLabel: 'طباعة عبر PDF',
        actionFn: () => handlePrintViaPdf(activeFmt),
      });

      setTimeout(() => {
        setIsPrinting(false);
      }, 1000);
    } catch (err) {
      console.error('خطأ أثناء الطباعة:', err);
      setIsPrinting(false);
      // تراجع تلقائي إلى الطباعة عبر ملف PDF
      handlePrintViaPdf(activeFmt);
    }
  };

  /**
   * توليد وتحميل ملف الفاتورة بصيغة PDF فورياً
   */
  const handleDownloadPdf = async (customFormat?: 'thermal' | 'a4') => {
    if (!receiptRef.current) return;
    setIsPdfMenuOpen(false);

    const targetFormat = customFormat || printFormat;
    const formatLabel = targetFormat === 'thermal' ? 'إيصال حراري (80mm)' : 'فاتورة قياسية (A4)';

    try {
      setIsGeneratingPdf(true);
      const result = await generatePdfFromElement(receiptRef.current, {
        fileName: `فاتورة_ضريبية_${invoice.invoiceNumber}_${targetFormat}`,
        format: targetFormat,
      });

      setLastPdfResult(result);
      downloadPdfBlob(result.blob, result.fileName);

      setStatusMessage({
        text: `تم تحميل ملف الفاتورة بصيغة PDF بنجاح [${formatLabel}]`,
        type: 'success',
        actionLabel: 'فتح الملف الآن',
        actionFn: () => openPdfInNewTab(result.blob),
      });
    } catch (err) {
      console.error('فشل توليد وتحميل PDF:', err);
      setStatusMessage({
        text: 'تعذر تحميل PDF تلقائياً، جاري محاولة الفتح المباشر...',
        type: 'error',
      });
      printElement(receiptRef.current, `فاتورة ضريبية - ${invoice.invoiceNumber}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  /**
   * معاينة وفتح ملف الفاتورة PDF في نافذة جديدة
   */
  const handlePreviewPdf = async (customFormat?: 'thermal' | 'a4') => {
    if (!receiptRef.current) return;
    setIsPdfMenuOpen(false);

    const targetFormat = customFormat || printFormat;

    try {
      setIsGeneratingPdf(true);
      const result = await generatePdfFromElement(receiptRef.current, {
        fileName: `فاتورة_ضريبية_${invoice.invoiceNumber}_${targetFormat}`,
        format: targetFormat,
      });

      setLastPdfResult(result);
      openPdfInNewTab(result.blob);

      setStatusMessage({
        text: 'تم فتح ملف الفاتورة PDF في نافذة جديدة',
        type: 'info',
        actionLabel: 'تنزيل نسخة للملف',
        actionFn: () => downloadPdfBlob(result.blob, result.fileName),
      });
    } catch (err) {
      console.error('فشل معاينة PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  /**
   * طباعة الفاتورة مباشرة عبر ملف PDF
   */
  const handlePrintViaPdf = async (customFormat?: 'thermal' | 'a4') => {
    if (!receiptRef.current) return;
    setIsPdfMenuOpen(false);
    setIsPrintMenuOpen(false);

    const targetFormat = customFormat || printFormat;

    try {
      setIsGeneratingPdf(true);
      const result = await generatePdfFromElement(receiptRef.current, {
        fileName: `فاتورة_ضريبية_${invoice.invoiceNumber}_${targetFormat}`,
        format: targetFormat,
      });

      setLastPdfResult(result);
      printPdfDirectly(result.blob);

      setStatusMessage({
        text: 'تم إرسال الفاتورة للطباعة عبر عارض PDF المباشر',
        type: 'success',
        actionLabel: 'تنزيل PDF',
        actionFn: () => downloadPdfBlob(result.blob, result.fileName),
      });
    } catch (err) {
      console.error('فشل الطباعة عبر PDF:', err);
      printElement(receiptRef.current, `فاتورة ضريبية - ${invoice.invoiceNumber}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const whatsAppMessage = buildInvoiceWhatsAppMessage({
    invoice,
    sale,
    saleItems,
    payment,
    companyName: facility.nameAr || 'مؤسسة عماد سعد آل سعيد لمواد البناء',
    vatNumber: facility.vatNumber || '310948572100003',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      {/* نافذة الفاتورة */}
      <div className={`bg-white w-full ${printFormat === 'a4' ? 'max-w-3xl' : 'max-w-lg'} rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200 transition-all`}>
        
        {/* رأس النافذة التفاعلي */}
        <div className="p-4 bg-emerald-600 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">تم إتمام البيع وإصدار الفاتورة بنجاح</h3>
              <p className="text-[11px] text-emerald-100 font-mono">
                {invoice.invoiceNumber} • {new Date(invoice.issueDate).toLocaleTimeString('ar-SA')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* مبدل نمط الطباعة: حراري 80mm أو A4 */}
            <div className="flex items-center bg-emerald-700/60 p-1 rounded-xl border border-emerald-500/50 text-xs">
              <button
                type="button"
                onClick={() => setPrintFormat('thermal')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  printFormat === 'thermal'
                    ? 'bg-white text-emerald-900 shadow-xs'
                    : 'text-emerald-100 hover:text-white'
                }`}
              >
                طابعة حرارية (80mm)
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('a4')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  printFormat === 'a4'
                    ? 'bg-white text-emerald-900 shadow-xs'
                    : 'text-emerald-100 hover:text-white'
                }`}
              >
                فاتورة قياسية (A4)
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* أزرار الإجراءات السريعة في الأعلى */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2 no-print relative">
          
          {/* زر وقائمة الطباعة الفورية */}
          <div className="relative flex-1 min-w-[140px]" ref={printMenuRef}>
            <div className="flex rounded-xl overflow-hidden shadow-xs">
              <button
                type="button"
                onClick={() => handlePrint()}
                disabled={isPrinting}
                className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                title="طباعة الإيصال فورياً (أو اضغط Ctrl+P)"
              >
                {isPrinting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                ) : (
                  <Printer className="w-4 h-4 text-emerald-400" />
                )}
                <span>{isPrinting ? 'جارٍ الطباعة...' : 'طباعة الإيصال'}</span>
                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">(Ctrl+P)</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPrintMenuOpen(!isPrintMenuOpen)}
                className="px-2 bg-slate-800 hover:bg-slate-700 text-white border-r border-slate-700 flex items-center justify-center cursor-pointer"
                title="خيارات الطباعة"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* قائمة خيارات الطباعة المنسدلة */}
            {isPrintMenuOpen && (
              <div className="absolute top-full right-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs text-slate-800 animate-in fade-in duration-150">
                <div className="px-3 py-1 text-[11px] font-bold text-slate-400 border-b border-slate-100">
                  خيارات الطباعة
                </div>
                <button
                  type="button"
                  onClick={() => handlePrint('thermal')}
                  className="w-full text-right px-3 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium"
                >
                  <Receipt className="w-4 h-4 text-slate-600" />
                  <span>طباعة إيصال حراري (80mm)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePrint('a4')}
                  className="w-full text-right px-3 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium"
                >
                  <FileText className="w-4 h-4 text-slate-600" />
                  <span>طباعة فاتورة قياسية (A4)</span>
                </button>
                <div className="border-t border-slate-100 my-1"></div>
                <button
                  type="button"
                  onClick={() => handlePrintViaPdf()}
                  className="w-full text-right px-3 py-2 hover:bg-emerald-50 text-emerald-700 flex items-center gap-2 cursor-pointer font-bold"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة عبر ملف PDF المباشر</span>
                </button>
              </div>
            )}
          </div>

          {/* زر مشاركة الواتساب */}
          <button
            type="button"
            onClick={() => setIsWhatsAppModalOpen(true)}
            className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer ring-2 ring-emerald-200"
            title="إرسال الفاتورة وتفاصيلها مباشرة لهاتف العميل عبر الواتساب"
          >
            <MessageSquare className="w-4 h-4" />
            <span>إرسال بالواتساب</span>
          </button>

          {/* زر وقائمة خيارات تحميل الفاتورة بصيغة PDF */}
          <div className="relative" ref={pdfMenuRef}>
            <div className="flex rounded-xl overflow-hidden border border-slate-300 shadow-2xs">
              <button
                type="button"
                disabled={isGeneratingPdf}
                onClick={() => handleDownloadPdf()}
                className="py-2 px-3 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                title="تحميل ملف الفاتورة بصيغة PDF مباشرة"
              >
                {isGeneratingPdf ? (
                  <Loader2 className="w-4 h-4 text-rose-600 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4 text-rose-600" />
                )}
                <span>
                  {isGeneratingPdf
                    ? 'جارٍ التوليد...'
                    : `تحميل PDF (${printFormat === 'thermal' ? 'حراري' : 'A4'})`}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setIsPdfMenuOpen(!isPdfMenuOpen)}
                className="px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border-r border-slate-300 flex items-center justify-center cursor-pointer"
                title="خيارات تحميل ومعاينة الفاتورة بصيغة PDF"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* القائمة المنسدلة: خيارات تحميل الفاتورة بصيغة PDF */}
            {isPdfMenuOpen && (
              <div className="absolute top-full right-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs text-slate-800 animate-in fade-in duration-150">
                <div className="px-3 py-1.5 text-[11px] font-bold text-slate-500 border-b border-slate-100 flex items-center justify-between">
                  <span>خيارات تحميل الفاتورة PDF</span>
                  <span className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded font-mono">PDF v2</span>
                </div>
                
                <button
                  type="button"
                  disabled={isGeneratingPdf}
                  onClick={() => handleDownloadPdf('a4')}
                  className="w-full text-right px-3 py-2.5 hover:bg-rose-50 hover:text-rose-900 flex items-center gap-2.5 cursor-pointer font-bold transition-colors"
                >
                  <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                  <div>
                    <div>تحميل فاتورة قياسية (A4 PDF)</div>
                    <div className="text-[10px] text-slate-400 font-normal">مطابقة لمتطلبات هيئة الزكاة والضريبة</div>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={isGeneratingPdf}
                  onClick={() => handleDownloadPdf('thermal')}
                  className="w-full text-right px-3 py-2.5 hover:bg-amber-50 hover:text-amber-900 flex items-center gap-2.5 cursor-pointer font-bold transition-colors"
                >
                  <Receipt className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <div>تحميل إيصال كاشير حراري (80mm)</div>
                    <div className="text-[10px] text-slate-400 font-normal">مخصص لطابعات الإيصالات الحرارية</div>
                  </div>
                </button>

                <div className="border-t border-slate-100 my-1"></div>

                <button
                  type="button"
                  disabled={isGeneratingPdf}
                  onClick={() => handlePreviewPdf()}
                  className="w-full text-right px-3 py-2 hover:bg-blue-50 text-blue-700 flex items-center gap-2.5 cursor-pointer font-bold transition-colors"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  <span>معاينة / فتح الفاتورة في تبويب جديد</span>
                </button>

                <button
                  type="button"
                  disabled={isGeneratingPdf}
                  onClick={() => handlePrintViaPdf()}
                  className="w-full text-right px-3 py-2 hover:bg-emerald-50 text-emerald-700 flex items-center gap-2.5 cursor-pointer font-bold transition-colors"
                >
                  <Printer className="w-4 h-4 shrink-0" />
                  <span>طباعة فورية عبر ملف PDF</span>
                </button>
              </div>
            )}
          </div>

          {/* زر فاتورة جديدة */}
          <button
            type="button"
            onClick={onNewSale}
            className="py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
            title="بدء فاتورة بيع جديدة فورياً (F2)"
          >
            <RotateCcw className="w-4 h-4" />
            <span>فاتورة جديدة (F2)</span>
          </button>
        </div>

        {/* شريط تأكيد الحالة والتفاعل بعد الطباعة أو التحميل */}
        {statusMessage && (
          <div
            className={`px-4 py-2 border-b flex items-center justify-between text-xs animate-in fade-in duration-200 no-print ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : statusMessage.type === 'error'
                ? 'bg-rose-50 text-rose-900 border-rose-200'
                : 'bg-blue-50 text-blue-900 border-blue-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
              )}
              <span className="font-bold">{statusMessage.text}</span>
            </div>

            <div className="flex items-center gap-2">
              {statusMessage.actionLabel && statusMessage.actionFn && (
                <button
                  type="button"
                  onClick={statusMessage.actionFn}
                  className="px-2.5 py-1 rounded-lg bg-white shadow-2xs border border-slate-200 hover:bg-slate-50 font-bold text-[11px] cursor-pointer"
                >
                  {statusMessage.actionLabel}
                </button>
              )}
              {lastPdfResult && (
                <button
                  type="button"
                  onClick={() => downloadPdfBlob(lastPdfResult.blob, lastPdfResult.fileName)}
                  className="px-2.5 py-1 rounded-lg bg-white shadow-2xs border border-slate-200 hover:bg-slate-50 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  title="تنزيل الملف مرة أخرى"
                >
                  <Download className="w-3 h-3 text-rose-600" />
                  <span>إعادة التنزيل</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                className="p-1 hover:bg-black/5 rounded text-slate-500 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* محتوى الفاتورة القابل للطباعة والمعاينة (تصميم إيصال كاشير حراري 80mm أو فاتورة ضريبية قياسية A4) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 text-slate-800 font-sans" ref={receiptRef}>
          {printFormat === 'thermal' ? (
            /* نمط الإيصال الحراري 80mm الفاخر */
            <div className="printable-receipt border-2 border-slate-900 rounded-xl p-4 bg-white shadow-xs max-w-sm mx-auto text-slate-900">
              {/* شريط علوي مميز */}
              <div className="text-center border-b-2 border-slate-900 pb-3">
                <div className="flex justify-center mb-1.5">
                  {facility.logoUrl ? (
                    <img src={facility.logoUrl} alt={facility.nameAr} className="h-10 w-auto object-contain" />
                  ) : (
                    <EmadcoLogo size="md" variant="icon" />
                  )}
                </div>
                <h2 className="text-sm font-black text-slate-950" style={{ letterSpacing: '0px' }}>
                  {facility.nameAr || 'مؤسسة عماد سعد آل سعيد لمواد البناء'}
                </h2>
                {facility.nameEn && (
                  <div className="inline-block bg-slate-900 text-amber-400 font-black text-[10px] px-2.5 py-0.5 rounded-md mt-1">
                    {facility.nameEn}
                  </div>
                )}
                <div className="text-[11px] font-bold text-slate-800 mt-1 font-mono">
                  الرقم الضريبي: {facility.vatNumber || '310948572100003'}
                </div>
                <div className="text-[10px] text-slate-600 font-mono">
                  س.ت: {facility.crNumber || '1010998877'} • {[facility.city, facility.district, facility.street].filter(Boolean).join(' - ') || 'الرياض'}
                </div>
              </div>

              {/* صفة الفاتورة */}
              <div className="text-center py-2 bg-slate-100 border-y border-slate-300 my-2.5">
                <span className="text-xs font-black text-slate-900 block" style={{ letterSpacing: '0px' }}>
                  فاتورة ضريبية مبسطة
                </span>
                <span className="text-[9px] text-slate-500 font-mono tracking-widest block">
                  SIMPLIFIED TAX INVOICE
                </span>
              </div>

              {/* تفاصيل الفاتورة */}
              <div className="text-xs space-y-1.5 border-b border-dashed border-slate-400 pb-3 text-slate-700">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">رقم الفاتورة:</span>
                  <span className="font-black font-mono text-slate-950 text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                    {invoice.invoiceNumber}
                  </span>
                </div>
                
                {/* باركود رقم الفاتورة للإيصال الحراري */}
                <div className="flex justify-center py-1 bg-slate-50/80 rounded my-1 border border-slate-200">
                  <Barcode value={invoice.invoiceNumber} width={1.2} height={28} fontSize={9} displayValue={false} />
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500">تاريخ ووقت الإصدار:</span>
                  <span className="font-mono font-medium text-slate-900 text-[11px]">
                    {new Date(invoice.issueDate).toLocaleString('ar-SA')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">العميل / المشتري:</span>
                  <span className="font-bold text-slate-950">{invoice.customerName || 'عميل نقدي'}</span>
                </div>
                {(invoice.customerPhone || sale.customerPhone) && (
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500">جوال المشتري:</span>
                    <span className="font-mono text-slate-900">{invoice.customerPhone || sale.customerPhone}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">طريقة الدفع:</span>
                  <span className="font-black text-slate-900">
                    {payment.paymentMethodId === 'CASH' && 'نقداً (كاش)'}
                    {payment.paymentMethodId === 'MADA' && 'مدى (Mada)'}
                    {payment.paymentMethodId === 'CARD' && 'بطاقة ائتمان'}
                    {payment.paymentMethodId === 'CREDIT' && 'آجل (ذمم)'}
                    {payment.paymentMethodId === 'TRANSFER' && 'تحويل بنكي'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">الكاشير المسؤول:</span>
                  <span className="font-medium text-slate-800">{payment.collectedBy || 'كاشير الفرع'}</span>
                </div>
              </div>

              {/* جدول بنود المبيعات */}
              <div className="py-2.5 border-b-2 border-slate-900">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-300 text-slate-600 font-bold text-[10px]">
                      <th className="text-right pb-1">الصنف</th>
                      <th className="text-center pb-1">الكمية</th>
                      <th className="text-left pb-1">السعر</th>
                      <th className="text-left pb-1">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {saleItems.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td className="py-1.5 text-right font-bold text-slate-900 pr-1 max-w-[130px] truncate text-[11px]">
                          {item.productName}
                        </td>
                        <td className="py-1.5 text-center font-mono font-bold text-slate-800">
                          {item.quantity}
                        </td>
                        <td className="py-1.5 text-left font-mono text-slate-700 text-[11px]">
                          {formatNumber(item.unitPrice || 0)}
                        </td>
                        <td className="py-1.5 text-left font-mono font-black text-slate-950">
                          {formatNumber(item.lineTotal || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ملخص الحسابات المالية */}
              <div className="py-2.5 border-b border-dashed border-slate-400 space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>المجموع الخاضع للضريبة:</span>
                  <span className="font-mono font-bold text-slate-900">{formatSAR(sale.subtotal || 0)}</span>
                </div>
                {sale.discountTotal > 0 && (
                  <div className="flex justify-between text-rose-700 font-bold">
                    <span>إجمالي الخصم التجاري:</span>
                    <span className="font-mono">-{formatSAR(sale.discountTotal || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>ضريبة القيمة المضافة (15%):</span>
                  <span className="font-mono font-bold text-slate-900">{formatSAR(sale.taxTotal || 0)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t-2 border-slate-900 text-sm font-black text-slate-950">
                  <span>المبلغ الإجمالي شامل الضريبة:</span>
                  <span className="font-mono text-base font-black text-slate-950 bg-amber-200/80 px-2 py-0.5 rounded">
                    {formatSAR(sale.grandTotal || 0)}
                  </span>
                </div>
              </div>

              {/* تفقيط المبلغ */}
              <div className="py-2 bg-slate-50 border-b border-slate-200 text-center text-[10px] font-bold text-slate-700">
                {tafqeetRiyal(sale.grandTotal)}
              </div>

              {/* رمز ZATCA QR Code المعتمد */}
              <div className="pt-3 flex flex-col items-center justify-center text-center">
                {qrDataUrl && (
                  <div className="p-2 bg-white border-2 border-slate-900 rounded-xl shadow-xs">
                    <img src={qrDataUrl} alt="ZATCA E-Invoice QR Code" className="w-28 h-28" />
                  </div>
                )}
                <div className="mt-2 text-[9px] text-slate-500 font-mono font-bold">
                  فاتورة ضريبية إلكترونية معتمدة (ZATCA Stage-2)
                </div>
                <div className="mt-2 text-[9px] text-slate-500 border-t border-dotted border-slate-300 pt-2 w-full font-medium">
                  نسعد بخدمتكم • البضاعة المباعة ترد وتستبدل خلال 7 أيام بموجب الفاتورة
                </div>
              </div>
            </div>
          ) : (
            /* نمط الفاتورة الضريبية القياسية A4 الفاخرة المعتمدة */
            <div className="printable-a4 border-2 border-slate-900 rounded-2xl p-6 sm:p-8 bg-white shadow-md space-y-6 text-slate-900">
              
              {/* الترويسة الفاخرة بالألوان الرسمية والشعار */}
              <div className="border-b-2 border-slate-900 pb-5">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      {facility.logoUrl ? (
                        <img src={facility.logoUrl} alt={facility.nameAr} className="h-12 w-auto object-contain" />
                      ) : (
                        <EmadcoLogo size="lg" variant="icon" />
                      )}
                      <div>
                        <h1 className="text-xl font-black text-slate-950" style={{ letterSpacing: '0px' }}>
                          {facility.nameAr || 'مؤسسة عماد سعد آل سعيد لمواد البناء'}
                        </h1>
                        <p className="text-xs font-bold text-amber-700 font-mono">
                          {facility.nameEn || 'EMAD SAAD AL-SAEED BUILDING MATERIALS (EMADCO)'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-700 mt-3 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">الرقم الضريبي للمنشأة:</span>
                        <span className="font-mono font-black text-slate-950">{facility.vatNumber || '310948572100003'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">السجل التجاري (CR):</span>
                        <span className="font-mono font-bold text-slate-900">{facility.crNumber || '1010998877'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">العنوان:</span>
                        <span>{[facility.city, facility.district, facility.street].filter(Boolean).join(' - ') || 'الرياض - طريق الخرج - شارع المقاولين'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">الهاتف / واتساب:</span>
                        <span className="font-mono font-bold">{facility.phone || '0501112233'}</span>
                      </div>
                    </div>
                  </div>

                  {/* صندوق صفة الفاتورة والباركود الضريبي والباركود الخطي */}
                  <div className="flex flex-col items-center sm:items-end text-center sm:text-right shrink-0">
                    <div className="bg-slate-950 text-white px-5 py-2 rounded-xl text-center shadow-xs">
                      <div className="font-black text-sm text-amber-400" style={{ letterSpacing: '0px' }}>
                        فاتورة ضريبية رسمية
                      </div>
                      <div className="text-[10px] text-slate-300 font-mono tracking-widest">
                        TAX INVOICE
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {qrDataUrl && (
                        <div className="p-1.5 bg-white border border-slate-300 rounded-xl shadow-2xs">
                          <img src={qrDataUrl} alt="ZATCA QR" className="w-20 h-20" />
                        </div>
                      )}
                      <div className="p-1.5 bg-white border border-slate-300 rounded-xl shadow-2xs flex flex-col items-center justify-center">
                        <Barcode value={invoice.invoiceNumber} width={1.2} height={28} fontSize={9} displayValue={true} margin={1} />
                        <span className="text-[8px] text-slate-400 font-mono">INVOICE BARCODE</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* بطاقة بيانات الفاتورة والعميل المنظمة */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-300 text-xs">
                {/* بيانات الفاتورة */}
                <div className="space-y-1.5 border-b sm:border-b-0 sm:border-l sm:border-slate-200 pb-3 sm:pb-0 sm:pl-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-bold">رقم الفاتورة:</span>
                    <span className="font-black font-mono text-sm text-slate-950 bg-white px-2 py-0.5 rounded border border-slate-300">
                      {invoice.invoiceNumber}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-bold">تاريخ الإصدار:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {new Date(invoice.issueDate).toLocaleDateString('ar-SA')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-bold">وقت وتوقيت الإصدار:</span>
                    <span className="font-mono text-slate-800">
                      {new Date(invoice.issueDate).toLocaleTimeString('ar-SA')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-bold">حالة الفاتورة والربط:</span>
                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>معتمدة ومطابقة لـ ZATCA</span>
                    </span>
                  </div>
                </div>

                {/* بيانات العميل وطريقة السداد */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-bold">العميل / المنشأة المشترية:</span>
                    <span className="font-black text-slate-950 text-sm">{invoice.customerName || 'عميل نقدي'}</span>
                  </div>
                  {invoice.customerTaxNumber && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold">الرقم الضريبي للعميل:</span>
                      <span className="font-mono font-black text-slate-950">{invoice.customerTaxNumber}</span>
                    </div>
                  )}
                  {(invoice.customerPhone || sale.customerPhone) && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold">رقم جوال المشتري:</span>
                      <span className="font-mono font-bold text-slate-900">{invoice.customerPhone || sale.customerPhone}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-bold">طريقة السداد:</span>
                    <span className="font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {payment.paymentMethodId === 'CASH' && 'نقداً (كاش)'}
                      {payment.paymentMethodId === 'MADA' && 'شبكة مدى (Mada)'}
                      {payment.paymentMethodId === 'CARD' && 'بطاقة ائتمان'}
                      {payment.paymentMethodId === 'CREDIT' && 'حساب آجل (ذمم)'}
                      {payment.paymentMethodId === 'TRANSFER' && 'تحويل بنكي'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-bold">الكاشير / الفرع:</span>
                    <span className="font-medium text-slate-800">{payment.collectedBy || 'الفرع الرئيسي'}</span>
                  </div>
                </div>
              </div>

              {/* جدول البنود التفصيلي A4 الفاخر */}
              <div className="overflow-x-auto rounded-xl border border-slate-300">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-white font-black text-[11px]">
                      <th className="p-3 text-center w-10">#</th>
                      <th className="p-3">بيان مادة البناء والأصناف</th>
                      <th className="p-3 text-center">الكمية</th>
                      <th className="p-3 text-left">سعر الوحدة</th>
                      <th className="p-3 text-left">الخصم</th>
                      <th className="p-3 text-left">المبلغ قبل الضريبة</th>
                      <th className="p-3 text-left">ضريبة (15%)</th>
                      <th className="p-3 text-left">الإجمالي شامل الضريبة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {saleItems.map((it, i) => {
                      const itemTax = Math.round(it.lineTotal * 0.15 * 100) / 100;
                      return (
                        <tr key={it.id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                          <td className="p-3 text-center font-mono font-bold text-slate-500">{i + 1}</td>
                          <td className="p-3">
                            <div className="font-black text-slate-950 text-xs">{it.productName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">CODE: {it.productId?.substring(0, 8) || 'MAT'}</div>
                          </td>
                          <td className="p-3 text-center font-mono font-black text-slate-900 text-xs bg-slate-100/50">
                            {it.quantity}
                          </td>
                          <td className="p-3 text-left font-mono font-bold text-slate-800">
                            {formatSAR(it.unitPrice || 0)}
                          </td>
                          <td className="p-3 text-left font-mono text-slate-500">
                            {it.discountAmount ? formatSAR(it.discountAmount) : '0.00 ر.س'}
                          </td>
                          <td className="p-3 text-left font-mono font-bold text-slate-800">
                            {formatSAR(it.lineTotal || 0)}
                          </td>
                          <td className="p-3 text-left font-mono text-slate-600">
                            {formatSAR(itemTax || 0)}
                          </td>
                          <td className="p-3 text-left font-mono font-black text-slate-950 text-xs bg-amber-50/40">
                            {formatSAR((it.lineTotal || 0) + (itemTax || 0))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* الملخص المالي والتفقيط والختم الرسمي */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2">
                {/* التفقيط والإقرار الرسمي */}
                <div className="md:col-span-7 flex flex-col justify-between space-y-4">
                  <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl">
                    <span className="text-[11px] font-black text-amber-950 block mb-1">
                      المبلغ الإجمالي كتابةً (بالريال السعودي):
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      {tafqeetRiyal(sale.grandTotal)}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-300 text-[11px] text-slate-600 space-y-2">
                    <p className="font-bold text-slate-900">الشروط والأحكام والضمان:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-[10px] text-slate-600">
                      <li>البضاعة المباعة ترد وتستبدل خلال 7 أيام من تاريخ الشراء وبحالتها الأصلية.</li>
                      <li>فاتورة ضريبية رسمية صادرة وموثقة إلكترونياً حسب متطلبات هيئة الزكاة والضريبة والجمارك.</li>
                    </ul>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-300 text-xs font-bold text-slate-800 text-center">
                    <div className="border border-dashed border-slate-300 p-3 rounded-xl">
                      <span className="block text-slate-400 text-[10px] mb-2">توقيع المستلم / العميل</span>
                      <span className="block font-mono text-slate-300">________________</span>
                    </div>
                    <div className="border border-dashed border-slate-300 p-3 rounded-xl">
                      <span className="block text-slate-400 text-[10px] mb-2">الختم المعتمد للمنشأة</span>
                      <span className="block text-amber-800 font-bold text-[10px]">مؤسسة عماد سعد آل سعيد لمواد البناء</span>
                    </div>
                  </div>
                </div>

                {/* جدول الحسابات والمجاميع */}
                <div className="md:col-span-5 bg-slate-50 p-4 rounded-xl border-2 border-slate-900 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="font-bold">المجموع قبل الضريبة:</span>
                    <span className="font-mono font-bold text-slate-950">{formatSAR(sale.subtotal || 0)}</span>
                  </div>

                  {sale.discountTotal > 0 && (
                    <div className="flex justify-between items-center text-rose-700 font-bold">
                      <span>إجمالي الخصم الممنوح:</span>
                      <span className="font-mono">-{formatSAR(sale.discountTotal || 0)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-slate-700">
                    <span className="font-bold">ضريبة القيمة المضافة (15%):</span>
                    <span className="font-mono font-black text-slate-950">{formatSAR(sale.taxTotal || 0)}</span>
                  </div>

                  <div className="pt-3 border-t-2 border-slate-900 flex justify-between items-center">
                    <span className="text-sm font-black text-slate-950">المبلغ الإجمالي المستحق:</span>
                    <span className="font-mono text-lg font-black text-slate-950 bg-amber-400/90 px-2.5 py-1 rounded-lg shadow-2xs">
                      {formatSAR(sale.grandTotal || 0)}
                    </span>
                  </div>

                  {payment.paidAmount && payment.paidAmount > 0 && (
                    <div className="pt-2 border-t border-dashed border-slate-300 space-y-1 text-[11px]">
                      <div className="flex justify-between text-slate-600">
                        <span>المبلغ المدفوع:</span>
                        <span className="font-mono font-bold">{formatSAR(payment.paidAmount || 0)}</span>
                      </div>
                      {changeAmount > 0 && (
                        <div className="flex justify-between text-emerald-700 font-bold">
                          <span>المبلغ المتبقي للعميل (الفكة):</span>
                          <span className="font-mono">{formatSAR(changeAmount || 0)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* تذييل النافذة */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-between items-center gap-2 text-xs text-slate-500 no-print">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>معاملة مشفرة ومحفوظة في قاعدة البيانات ومطابقة لـ ZATCA</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePrint()}
              disabled={isPrinting}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer transition-colors text-xs"
              title="طباعة الإيصال"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              <span>طباعة</span>
            </button>
            <button
              type="button"
              disabled={isGeneratingPdf}
              onClick={() => handleDownloadPdf()}
              className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50 text-slate-800 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer transition-colors text-xs"
              title="تحميل ملف PDF"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
              ) : (
                <FileDown className="w-3.5 h-3.5 text-rose-600" />
              )}
              <span>تحميل PDF</span>
            </button>
            <button
              type="button"
              onClick={() => setIsWhatsAppModalOpen(true)}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer transition-colors text-xs"
            >
              <MessageSquare className="w-4 h-4" />
              <span>إرسال واتساب</span>
            </button>
            <button
              type="button"
              onClick={onNewSale}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold cursor-pointer transition-colors"
            >
              إغلاق وبدء فاتورة جديدة
            </button>
          </div>
        </div>

      </div>

      {/* نافذة المشاركة عبر الواتساب كملف PDF معتمد */}
      <WhatsAppShareModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        documentTitle="الفاتورة الضريبية"
        documentNumber={invoice.invoiceNumber}
        recipientName={invoice.customerName}
        initialPhone={invoice.customerPhone || sale.customerPhone || ''}
        messageText={whatsAppMessage}
        pdfElementRef={receiptRef}
        pdfFormat={printFormat}
        grandTotal={invoice.totalIncludingTax}
      />
    </div>
  );
};
