/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ElectronicInvoice } from '../../types';
import {
  X,
  QrCode,
  Code,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Download,
  RotateCw,
  Clock,
  ShieldCheck,
  Hash,
  MessageSquare,
} from 'lucide-react';
import { WhatsAppShareModal } from '../common/WhatsAppShareModal';
import { formatSAR } from '../../utils/formatters';
import { buildInvoiceWhatsAppMessage } from '../../utils/whatsapp';

interface ZatcaInvoiceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: ElectronicInvoice | null;
  onRetry: (id: string) => Promise<void>;
  isRetrying: boolean;
}

export const ZatcaInvoiceDetailsModal: React.FC<ZatcaInvoiceDetailsModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onRetry,
  isRetrying,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'qr' | 'xml' | 'response'>('overview');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);

  useEffect(() => {
    if (invoice?.qrData) {
      QRCode.toDataURL(invoice.qrData, {
        width: 240,
        margin: 1,
        errorCorrectionLevel: 'M',
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('فشل توليد رمز QR:', err));
    }
  }, [invoice]);

  if (!isOpen || !invoice) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
  };

  const handleDownloadXml = () => {
    if (!invoice.xmlUbl) return;
    const blob = new Blob([invoice.xmlUbl], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoice.invoiceNumber}_ZATCA_UBL.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // فك تشفير حقول TLV من Base64 لعرضها بوضوح
  const decodeTlvData = (base64Str: string) => {
    try {
      const binary = atob(base64Str);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const decoder = new TextDecoder();
      const tags: Array<{ tag: number; name: string; value: string }> = [];
      let index = 0;

      const tagNames: Record<number, string> = {
        1: 'اسم المورد / المنشأة',
        2: 'الرقم الضريبي للمنشأة',
        3: 'الطابع الزمني للإصدار (ISO)',
        4: 'إجمالي الفاتورة مع الضريبة',
        5: 'إجمالي ضريبة القيمة المضافة',
        6: 'تشفير الفاتورة (Invoice Hash)',
        7: 'التوقيع الرقمي (ECDSA Signature)',
        8: 'المفتاح العام للمنشأة (Public Key)',
      };

      while (index < bytes.length) {
        const tag = bytes[index];
        const len = bytes[index + 1];
        if (index + 2 + len <= bytes.length) {
          const valBytes = bytes.slice(index + 2, index + 2 + len);
          const valStr = decoder.decode(valBytes);
          tags.push({
            tag,
            name: tagNames[tag] || `حقل رقم ${tag}`,
            value: valStr,
          });
          index += 2 + len;
        } else {
          break;
        }
      }
      return tags;
    } catch {
      return [];
    }
  };

  const decodedTags = invoice.qrData ? decodeTlvData(invoice.qrData) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* رأس النافذة */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">تفاصيل الفاتورة الإلكترونية - ZATCA</h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  {invoice.invoiceNumber}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                UUID: {invoice.uuid}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* شريط التبويبات الداخلية */}
        <div className="flex items-center gap-1 p-2 bg-slate-50 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>نظرة عامة والاعتماد</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'qr'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>رمز الاستجابة السريعة (QR TLV)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('xml')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'xml'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code className="w-4 h-4" />
            <span>كود UBL 2.1 XML</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('response')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'response'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>استجابة الهيئة وسجل المحاولات</span>
          </button>
        </div>

        {/* جسم النافذة */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* تبويب: نظرة عامة والاعتماد */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* بطاقة الحالة الرئيسية */}
              <div
                className={`p-4 rounded-xl border flex items-start justify-between ${
                  invoice.submissionStatus === 'Accepted'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : invoice.submissionStatus === 'Pending' || invoice.submissionStatus === 'Submitted'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div className="flex items-start gap-3">
                  {invoice.submissionStatus === 'Accepted' ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                  ) : invoice.submissionStatus === 'Pending' || invoice.submissionStatus === 'Submitted' ? (
                    <Clock className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">حالة الإرسال إلى ZATCA:</span>
                      <span className="font-extrabold px-2 py-0.5 rounded-md text-xs bg-white/70 shadow-2xs">
                        {invoice.submissionStatus === 'Accepted' && 'مقبولة ومعتمدة (Accepted)'}
                        {invoice.submissionStatus === 'Pending' && 'معلقة في انتظار الاعتماد (Pending)'}
                        {invoice.submissionStatus === 'Submitted' && 'تم الرفع وجاري المعالجة (Submitted)'}
                        {invoice.submissionStatus === 'Rejected' && 'مرفوضة من الهيئة (Rejected)'}
                        {invoice.submissionStatus === 'Failed' && 'فشل الإرسال والربط (Failed)'}
                        {invoice.submissionStatus === 'Draft' && 'مسودة غير مرسلة (Draft)'}
                      </span>
                    </div>

                    {invoice.errorMessage && (
                      <div className="mt-2 text-xs bg-white/80 p-2.5 rounded-lg border border-rose-200 text-rose-800 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold">سبب الخطأ / الملاحظة:</div>
                          <p>{invoice.errorMessage}</p>
                        </div>
                      </div>
                    )}

                    {invoice.warningMessages && invoice.warningMessages.length > 0 && (
                      <div className="mt-2 text-xs bg-white/80 p-2.5 rounded-lg border border-amber-200 text-amber-800 space-y-1">
                        <div className="font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          <span>تحذيرات المطابقة (Warnings):</span>
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                          {invoice.warningMessages.map((w, idx) => (
                            <li key={idx}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* زر إعادة المحاولة السريع */}
                {invoice.submissionStatus !== 'Accepted' && (
                  <button
                    type="button"
                    disabled={isRetrying}
                    onClick={() => onRetry(invoice.id)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer transition-all disabled:opacity-50"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                    <span>{isRetrying ? 'جاري الإرسال...' : 'إعادة الإرسال'}</span>
                  </button>
                )}
              </div>

              {/* بطاقات البيانات المالية والتقنية */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <h4 className="font-bold text-slate-800 border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>البيانات المالية للفاتورة</span>
                  </h4>
                  <div className="flex justify-between text-slate-600">
                    <span>نوع الفاتورة:</span>
                    <span className="font-bold text-slate-800">
                      {invoice.invoiceType === 'simplified' ? 'فاتورة ضريبية مبسطة (B2C)' : 'فاتورة ضريبية قياسية (B2B)'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>المبلغ قبل الضريبة (Subtotal):</span>
                    <span className="font-mono font-bold text-slate-800">{formatSAR(invoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>ضريبة القيمة المضافة (15% VAT):</span>
                    <span className="font-mono font-bold text-slate-800">{formatSAR(invoice.vat)}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 pt-1.5 border-t border-slate-200 font-bold">
                    <span>الإجمالي الشامل (Total):</span>
                    <span className="font-mono text-emerald-600 text-sm">{formatSAR(invoice.total)}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <h4 className="font-bold text-slate-800 border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                    <Hash className="w-4 h-4 text-emerald-600" />
                    <span>سلسلة التجزئة والتشفير (Hash Chaining)</span>
                  </h4>
                  <div>
                    <span className="text-slate-500 block">تشفير الفاتورة (Invoice Hash - SHA-256):</span>
                    <div className="font-mono text-[10px] bg-white p-1.5 rounded border border-slate-200 text-slate-800 break-all select-all mt-0.5">
                      {invoice.invoiceHash || 'جاري الاحتساب...'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 block">تشفير الفاتورة السابقة (PIH):</span>
                    <div className="font-mono text-[10px] bg-white p-1.5 rounded border border-slate-200 text-slate-800 break-all select-all mt-0.5">
                      {invoice.previousInvoiceHash || 'البذرة الابتدائية (Initial Seed)'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* تبويب: رمز الاستجابة السريعة (QR TLV) */}
          {activeTab === 'qr' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row items-center gap-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs shrink-0 text-center">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="ZATCA QR" className="w-48 h-48 mx-auto" />
                  ) : (
                    <div className="w-48 h-48 bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                      جاري تحميل QR...
                    </div>
                  )}
                  <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                    ZATCA TLV Base64
                  </span>
                </div>

                <div className="flex-1 space-y-2 w-full text-xs">
                  <h4 className="font-bold text-slate-800 flex items-center justify-between">
                    <span>محتويات الوسوم المشفرة (TLV Decoded Fields)</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(invoice.qrData, 'qrData')}
                      className="text-[11px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedText === 'qrData' ? 'تم النسخ!' : 'نسخ Base64 QR'}</span>
                    </button>
                  </h4>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {decodedTags.map((t) => (
                      <div key={t.tag} className="p-2 rounded-lg bg-white border border-slate-200 flex justify-between items-center">
                        <span className="text-slate-500 font-medium">
                          [وسم {t.tag}] {t.name}:
                        </span>
                        <span className="font-bold text-slate-900 font-mono">{t.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* تبويب: كود UBL 2.1 XML */}
          {activeTab === 'xml' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  كود الفاتورة بهيكل XML القياسي المعتمد من هيئة الزكاة والضريبة (UBL 2.1 Standard):
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(invoice.xmlUbl || '', 'xml')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedText === 'xml' ? 'تم النسخ!' : 'نسخ الكود'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadXml}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  >
                    <Download className="w-3 h-3" />
                    <span>تحميل .xml</span>
                  </button>
                </div>
              </div>

              <pre className="p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto max-h-80 select-all leading-relaxed" dir="ltr">
                {invoice.xmlUbl || '<!-- لا يتوفر تمثيل XML لهذه الفاتورة -->'}
              </pre>
            </div>
          )}

          {/* تبويب: استجابة الهيئة وسجل المحاولات */}
          {activeTab === 'response' && (
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">عدد محاولات الإرسال:</span>
                  <span className="font-mono font-bold text-slate-800">{invoice.submissionAttempts || 1}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">تاريخ آخر محاولة:</span>
                  <span className="font-mono text-slate-700">
                    {invoice.lastAttemptTimestamp
                      ? new Date(invoice.lastAttemptTimestamp).toLocaleString('ar-SA')
                      : 'غير متوفر'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">كود حالة الاستجابة (Status Code):</span>
                  <span className="font-mono font-bold text-emerald-600">
                    {invoice.responseDetails?.statusCode || 200} OK
                  </span>
                </div>
              </div>

              {invoice.responseDetails?.rawResponse && (
                <div>
                  <span className="text-slate-500 block mb-1">الاستجابة التقنية الكاملة (API Raw Payload):</span>
                  <pre className="p-3 bg-slate-900 text-slate-200 font-mono text-[11px] rounded-xl overflow-x-auto max-h-48" dir="ltr">
                    {invoice.responseDetails.rawResponse}
                  </pre>
                </div>
              )}
            </div>
          )}

        </div>

        {/* تذييل النافذة */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center gap-2">
          <button
            type="button"
            onClick={() => setIsWhatsAppOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            <span>إرسال الفاتورة عبر واتساب</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold cursor-pointer transition-colors"
          >
            إغلاق
          </button>
        </div>

      </div>

      {/* نافذة المشاركة عبر الواتساب */}
      <WhatsAppShareModal
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
        documentTitle="الفاتورة الضريبية ZATCA"
        documentNumber={invoice.invoiceNumber}
        recipientName={invoice.customerName || 'العميل'}
        initialPhone=""
        grandTotal={invoice.total}
        messageText={buildInvoiceWhatsAppMessage({
          invoice: {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            saleId: invoice.saleId,
            customerName: invoice.customerName || 'عميل نقدي',
            totalExcludingTax: invoice.subtotal,
            taxAmount: invoice.vat,
            totalIncludingTax: invoice.total,
            paymentStatus: 'paid',
            invoiceType: invoice.invoiceType === 'simplified' ? 'simplified_tax_invoice' : 'standard_tax_invoice',
            issueDate: invoice.issueDate || invoice.createdAt,
            zatcaUuid: invoice.uuid,
          },
          companyName: 'مؤسسة عماد سعد آل سعيد لمواد البناء (عمادكو)',
          vatNumber: '310948572100003',
        })}
      />
    </div>
  );
};
