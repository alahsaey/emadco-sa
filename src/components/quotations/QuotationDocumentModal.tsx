/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Quotation, QuotationStatus } from '../../types';
import {
  Printer,
  X,
  FileSpreadsheet,
  Calendar,
  User,
  ShieldCheck,
  Tag,
  Clock,
  Phone,
  MessageSquare,
  FileDown,
  Loader2,
} from 'lucide-react';
import { EmadcoLogo } from '../common/EmadcoLogo';
import { Barcode } from '../common/Barcode';
import { WhatsAppShareModal } from '../common/WhatsAppShareModal';
import { buildQuotationWhatsAppMessage } from '../../utils/whatsapp';
import { formatSAR } from '../../utils/formatters';
import { printElement } from '../../utils/print';
import { generatePdfFromElement, downloadPdfBlob } from '../../utils/pdfGenerator';
import { useSystemSettings } from '../../context/SettingsContext';

interface QuotationDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: Quotation | null;
  onConvertToSale?: (quotation: Quotation) => void;
}

export const QuotationDocumentModal: React.FC<QuotationDocumentModalProps> = ({
  isOpen,
  onClose,
  quotation,
  onConvertToSale,
}) => {
  const { facility } = useSystemSettings();
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !quotation) return null;

  const handlePrint = () => {
    printElement(printRef.current, `عرض سعر - ${quotation.quotationNumber}`);
  };

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    try {
      setIsGeneratingPdf(true);
      const result = await generatePdfFromElement(printRef.current, {
        fileName: `عرض_سعر_${quotation.quotationNumber}`,
        format: 'a4',
      });
      downloadPdfBlob(result.blob, result.fileName);
    } catch (err) {
      console.error('فشل توليد وتحميل PDF لعرض السعر:', err);
      printElement(printRef.current, `عرض سعر - ${quotation.quotationNumber}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const whatsAppMessage = buildQuotationWhatsAppMessage({
    quotation,
    companyName: facility.nameAr || 'مؤسسة عماد سعد آل سعيد لمواد البناء',
    vatNumber: facility.vatNumber || '310948572100003',
  });

  const statusBadgeStyle: Record<QuotationStatus, { bg: string; text: string; label: string }> = {
    Draft: { bg: 'bg-slate-100 border-slate-300', text: 'text-slate-700', label: 'مسودة (Draft)' },
    Sent: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', label: 'تم الإرسال (Sent)' },
    Accepted: { bg: 'bg-emerald-50 border-emerald-300', text: 'text-emerald-800', label: 'مقبول (Accepted)' },
    Rejected: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', label: 'مرفوض (Rejected)' },
    Expired: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', label: 'منتهي الصلاحية (Expired)' },
    Converted: { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-800', label: 'تم التحويل لفاتورة بيع (Converted)' },
  };

  const st = statusBadgeStyle[quotation.status] || statusBadgeStyle.Draft;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="print-dialog-wrapper bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* شريط الإجراءات العلوي */}
        <div className="p-4 bg-emerald-800 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">مستند عرض السعر الرسمي (Quotation)</h3>
              <p className="text-[11px] text-emerald-100 font-mono">
                {quotation.quotationNumber} • للعميل: {quotation.customerName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {quotation.status !== 'Converted' && onConvertToSale && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onConvertToSale(quotation);
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                تحويل إلى فاتورة
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsWhatsAppOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              title="إرسال عرض السعر للعميل عبر الواتساب"
            >
              <MessageSquare className="w-4 h-4" />
              <span>إرسال واتساب</span>
            </button>
            <button
              type="button"
              disabled={isGeneratingPdf}
              onClick={handleDownloadPdf}
              className="px-3.5 py-1.5 rounded-lg bg-white text-slate-800 hover:bg-slate-100 disabled:opacity-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              title="تحميل عرض السعر بصيغة PDF"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-4 h-4 text-rose-600 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4 text-rose-600" />
              )}
              <span>تحميل PDF</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-950 text-white hover:bg-emerald-900 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4 text-emerald-300" />
              <span>طباعة العرض</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* جسم مستند عرض السعر القابل للطباعة والمعاينة */}
        <div ref={printRef} className="printable-document p-6 overflow-y-auto text-slate-800 text-xs font-sans print:p-0 print:text-black">
          
          {/* ترويسة المنشأة */}
          <div className="text-center pb-4 border-b border-dashed border-slate-300">
            <div className="flex justify-center mb-1.5">
              {facility.logoUrl ? (
                <img src={facility.logoUrl} alt={facility.nameAr} className="h-10 w-auto object-contain" />
              ) : (
                <EmadcoLogo size="md" variant="icon" />
              )}
            </div>
            <h2 className="text-base font-black text-slate-900">{facility.nameAr || 'مؤسسة عماد سعد آل سعيد لمواد البناء'}</h2>
            {facility.nameEn && <p className="text-[11px] text-amber-800 font-bold">{facility.nameEn}</p>}
            <p className="text-[11px] text-slate-500 font-medium">سجل تجاري: {facility.crNumber || '1010998877'} • الرقم الضريبي: {facility.vatNumber || '310948572100003'}</p>
            <p className="text-[10px] text-slate-400">{[facility.country, facility.city, facility.district, facility.street].filter(Boolean).join(' - ')} {facility.phone ? `• هاتف: ${facility.phone}` : ''} {facility.email ? `• ${facility.email}` : ''}</p>
            
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="px-3 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-full font-bold text-xs">
                عرض سعر مواد ومستلزمات إنشائية (Price Quotation)
              </span>
              <span className={`px-2.5 py-1 border rounded-full font-bold text-[11px] ${st.bg} ${st.text}`}>
                {st.label}
              </span>
            </div>
          </div>

          {/* تفاصيل العرض والعميل مع باركود رسمي لرقم العرض */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 py-3.5 border-b border-slate-200 text-[11px] items-center">
            
            {/* بيانات العرض الأساسية */}
            <div className="sm:col-span-5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="font-semibold">رقم عرض السعر:</span>
                <span className="font-mono font-black text-slate-950 text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {quotation.quotationNumber}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold">تاريخ الإصدار:</span>
                <span className="font-mono font-bold text-slate-800">{quotation.issueDate}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold">صلاحية العرض حتى:</span>
                <span className="font-mono font-bold text-rose-700">{quotation.validUntil}</span>
              </div>
              {quotation.projectName && (
                <div className="flex items-center gap-1.5 text-slate-600">
                  <span className="font-semibold">المشروع / الموقع:</span>
                  <span className="font-bold text-slate-800">{quotation.projectName}</span>
                </div>
              )}
            </div>

            {/* بيانات العميل */}
            <div className="sm:col-span-4 space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-600">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold">العميل:</span>
                <span className="font-bold text-slate-900 text-xs">{quotation.customerName}</span>
              </div>
              {quotation.customerPhone && (
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold">الجوال:</span>
                  <span className="font-mono">{quotation.customerPhone}</span>
                </div>
              )}
              {quotation.customerTaxNumber && (
                <div className="flex items-center gap-1.5 text-slate-600">
                  <span className="font-semibold">الرقم الضريبي للعميل:</span>
                  <span className="font-mono font-bold">{quotation.customerTaxNumber}</span>
                </div>
              )}
              {quotation.customerAddress && (
                <div className="flex items-center gap-1.5 text-slate-600">
                  <span className="font-semibold">العنوان:</span>
                  <span>{quotation.customerAddress}</span>
                </div>
              )}
            </div>

            {/* باركود رقم الفاتورة / العرض الرسمي */}
            <div className="sm:col-span-3 flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 border border-slate-200">
              <Barcode
                value={quotation.quotationNumber}
                width={1.4}
                height={34}
                fontSize={10}
                displayValue={true}
                margin={1}
              />
              <span className="text-[9px] text-slate-400 font-mono mt-0.5">DOCUMENT BARCODE</span>
            </div>
          </div>

          {/* جدول البنود والتسعير */}
          <div className="py-3">
            <table className="w-full text-right border-collapse text-[11px]">
              <thead>
                <tr className="border-b-2 border-slate-300 text-slate-600 bg-slate-50">
                  <th className="py-2 px-2">#</th>
                  <th className="py-2 px-2">الصنف والمواصفات</th>
                  <th className="py-2 px-2 text-center">الكمية</th>
                  <th className="py-2 px-2 text-left">سعر الوحدة</th>
                  <th className="py-2 px-2 text-left">الخصم</th>
                  <th className="py-2 px-2 text-left">الضريبة (15%)</th>
                  <th className="py-2 px-2 text-left font-bold">الإجمالي شامل الضريبة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotation.items && quotation.items.length > 0 ? (
                  quotation.items.map((it, idx) => (
                    <tr key={it.id || idx} className="hover:bg-slate-50">
                      <td className="py-2 px-2 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2 px-2 font-medium">
                        <div className="font-bold text-slate-900">{it.productName}</div>
                        {it.description && <div className="text-[10px] text-slate-500">{it.description}</div>}
                        {it.sku && <div className="text-[9px] text-slate-400 font-mono">SKU: {it.sku}</div>}
                      </td>
                      <td className="py-2 px-2 text-center font-mono font-bold">
                        {it.quantity} {it.unitSymbol || 'حبة'}
                      </td>
                      <td className="py-2 px-2 text-left font-mono">
                        {formatSAR(it.unitPrice)}
                      </td>
                      <td className="py-2 px-2 text-left font-mono text-amber-700">
                        {it.discount > 0 ? formatSAR(it.discount) : '-'}
                      </td>
                      <td className="py-2 px-2 text-left font-mono text-slate-500">
                        {formatSAR(it.taxAmount)}
                      </td>
                      <td className="py-2 px-2 text-left font-bold font-mono text-slate-900">
                        {formatSAR(it.lineTotal)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-slate-400">
                      لا توجد بنود مدخلة في هذا العرض
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ملخص المبالغ والضريبة */}
          <div className="py-3 border-t-2 border-slate-300 bg-slate-50/70 rounded-xl p-3 mt-2 space-y-1.5">
            <div className="flex justify-between text-slate-600">
              <span>المجموع الخاضع للضريبة:</span>
              <span className="font-mono font-medium">{formatSAR(quotation.subtotal)}</span>
            </div>
            {quotation.discountTotal > 0 && (
              <div className="flex justify-between text-amber-700">
                <span>إجمالي الخصم الممنوح:</span>
                <span className="font-mono font-medium">-{formatSAR(quotation.discountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>ضريبة القيمة المضافة (15%):</span>
              <span className="font-mono font-medium">{formatSAR(quotation.taxTotal)}</span>
            </div>
            <div className="flex justify-between text-sm font-black text-emerald-900 border-t border-slate-200 pt-1.5">
              <span>المبلغ الإجمالي النهائي لعرض السعر:</span>
              <span className="font-mono text-base">{formatSAR(quotation.grandTotal)}</span>
            </div>
          </div>

          {/* الشروط والملاحظات */}
          {(quotation.notes || quotation.terms) && (
            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-[10px] space-y-1">
              {quotation.notes && (
                <div>
                  <span className="font-bold text-slate-700">ملاحظات: </span>
                  <span className="text-slate-600">{quotation.notes}</span>
                </div>
              )}
              {quotation.terms && (
                <div>
                  <span className="font-bold text-slate-700">الشروط والأحكام: </span>
                  <span className="text-slate-600">{quotation.terms}</span>
                </div>
              )}
            </div>
          )}

          {/* التوقيعات والاعتماد والباركود السفلي */}
          <div className="pt-6 grid grid-cols-2 gap-8 text-center text-[10px] text-slate-500 border-t border-slate-200 mt-4">
            <div>
              <p className="mb-6 font-semibold">إدارة المبيعات والتسعير</p>
              <div className="border-b border-slate-300 pb-1 font-bold text-slate-700">
                {quotation.createdBy || 'مسؤول المبيعات'}
              </div>
            </div>
            <div>
              <p className="mb-6 font-semibold">موافقة وتوقيع العميل / المفوض</p>
              <div className="border-b border-slate-300 pb-1">
                ...........................................
              </div>
            </div>
          </div>

          <div className="mt-4 text-center text-[9px] text-slate-400">
            الأسعار المعروضة سارية خلال فترة الصلاحية فقط، وتخضع للتوريد وفق الكميات المتوفرة.
          </div>
        </div>

        {/* تذييل النافذة مع أزرار الطباعة والمشاركة */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center gap-2 no-print">
          <button
            type="button"
            onClick={() => setIsWhatsAppOpen(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span>إرسال العرض عبر واتساب</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              إغلاق
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-black flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer ring-2 ring-emerald-500/20"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة العرض الرسمي</span>
            </button>
          </div>
        </div>

      </div>

      {/* نافذة إرسال العرض بالواتساب */}
      <WhatsAppShareModal
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
        documentTitle="عرض السعر"
        documentNumber={quotation.quotationNumber}
        recipientName={quotation.customerName}
        initialPhone={quotation.customerPhone || ''}
        messageText={whatsAppMessage}
        pdfElementRef={printRef}
        pdfFormat="a4"
        grandTotal={quotation.grandTotal}
      />
    </div>
  );
};

