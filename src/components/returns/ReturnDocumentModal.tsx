/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Return } from '../../types';
import {
  Printer,
  FileDown,
  X,
  FileCheck,
  Calendar,
  User,
  ShieldCheck,
  AlertCircle,
  FileText,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import { EmadcoLogo } from '../common/EmadcoLogo';
import { Barcode } from '../common/Barcode';
import { WhatsAppShareModal } from '../common/WhatsAppShareModal';
import { buildReturnWhatsAppMessage } from '../../utils/whatsapp';
import { formatSAR } from '../../utils/formatters';
import { printElement } from '../../utils/print';
import { generatePdfFromElement, downloadPdfBlob } from '../../utils/pdfGenerator';
import { useSystemSettings } from '../../context/SettingsContext';

interface ReturnDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  returnDoc: Return | null;
}

export const ReturnDocumentModal: React.FC<ReturnDocumentModalProps> = ({
  isOpen,
  onClose,
  returnDoc,
}) => {
  const { facility } = useSystemSettings();
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !returnDoc) return null;

  const handlePrint = () => {
    printElement(printRef.current, `إشعار مرتجع - ${returnDoc.returnNumber}`);
  };

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    try {
      setIsGeneratingPdf(true);
      const result = await generatePdfFromElement(printRef.current, {
        fileName: `إشعار_مرتجع_${returnDoc.returnNumber}`,
        format: 'a4',
      });
      downloadPdfBlob(result.blob, result.fileName);
    } catch (err) {
      console.error('فشل توليد وتحميل PDF للمرتجع:', err);
      printElement(printRef.current, `إشعار مرتجع - ${returnDoc.returnNumber}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const whatsAppMessage = buildReturnWhatsAppMessage({
    returnDoc,
    companyName: facility.nameAr || 'مؤسسة عماد سعد آل سعيد لمواد البناء',
    vatNumber: facility.vatNumber || '310948572100003',
  });

  const refundMethodLabels: Record<string, string> = {
    customer_balance: 'قيد دائن على حساب العميل',
    cash: 'استرداد نقدي من الصندوق',
    card: 'استرجاع عبر الشبكة / البطاقة',
    bank_transfer: 'تحويل بنكي',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="print-dialog-wrapper bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* شريط الإجراءات العلوي (لا يظهر عند الطباعة) */}
        <div className="p-4 bg-rose-700 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">إشعار دائن ضريبي / مستند مرتجع مبيعات</h3>
              <p className="text-[11px] text-rose-100 font-mono">
                {returnDoc.returnNumber} • للفاتورة: {returnDoc.originalInvoiceNumber}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsWhatsAppOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              title="إرسال إشعار المرتجع للعميل عبر الواتساب"
            >
              <MessageSquare className="w-4 h-4" />
              <span>إرسال واتساب</span>
            </button>
            <button
              type="button"
              disabled={isGeneratingPdf}
              onClick={handleDownloadPdf}
              className="px-3.5 py-1.5 rounded-lg bg-white text-slate-800 hover:bg-slate-100 disabled:opacity-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              title="تحميل مستند المرتجع بصيغة PDF"
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
              className="px-3.5 py-1.5 rounded-lg bg-rose-950 text-white hover:bg-rose-900 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4 text-rose-300" />
              <span>طباعة المستند</span>
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

        {/* جسم مستند الإشعار الدائن القابل للطباعة */}
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
            <p className="text-[10px] text-slate-400">{[facility.country, facility.city, facility.district, facility.street].filter(Boolean).join(' - ')} {facility.phone ? `• هاتف: ${facility.phone}` : ''}</p>
            <div className="inline-block mt-2 px-3 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-full font-bold text-xs">
              إشعار دائن ضريبي معتمد (Credit Note)
            </div>
          </div>

          {/* بيانات الإشعار الدائن والباركود */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 py-3 border-b border-slate-200 text-[11px] items-center">
            <div className="sm:col-span-5 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="font-semibold">رقم إشعار المرتجع:</span>
                <span className="font-mono font-bold text-slate-900 text-xs">{returnDoc.returnNumber}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="font-semibold">مرجع الفاتورة الأصلية:</span>
                <span className="font-mono font-bold text-rose-700">{returnDoc.originalInvoiceNumber}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold">تاريخ الإرجاع:</span>
                <span className="font-mono">{new Date(returnDoc.createdAt).toLocaleString('ar-SA')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="font-semibold">المستودع المستلم:</span>
                <span>{returnDoc.warehouseName || 'المستودع الرئيسي'}</span>
              </div>
            </div>

            <div className="sm:col-span-4 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-600">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold">العميل:</span>
                <span className="font-bold text-slate-900">{returnDoc.customerName}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="font-semibold">طريقة الاسترداد:</span>
                <span className="font-bold text-slate-800">
                  {refundMethodLabels[returnDoc.refundMethod] || returnDoc.refundMethod}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="font-semibold">سبب الإرجاع:</span>
                <span className="px-2 py-0.5 rounded-sm bg-amber-50 text-amber-800 font-bold border border-amber-200">
                  {returnDoc.reason}
                </span>
              </div>
              {returnDoc.reasonDetails && (
                <div className="text-[10px] text-slate-500 italic">
                  ملاحظات: {returnDoc.reasonDetails}
                </div>
              )}
            </div>

            {/* باركود إشعار المرتجع */}
            <div className="sm:col-span-3 flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 border border-slate-200">
              <Barcode value={returnDoc.returnNumber} width={1.3} height={30} fontSize={9} displayValue={true} margin={1} />
            </div>
          </div>

          {/* جدول البنود المرتجعة */}
          <div className="py-3">
            <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-rose-600" />
              <span>البنود المرتجعة إلى المستودع:</span>
            </h4>
            <table className="w-full text-right border-collapse text-[11px]">
              <thead>
                <tr className="border-b-2 border-slate-300 text-slate-500 bg-slate-50">
                  <th className="py-1.5 px-2">الصنف</th>
                  <th className="py-1.5 px-2 text-center">الكمية المرتجعة</th>
                  <th className="py-1.5 px-2 text-left">سعر الوحدة</th>
                  <th className="py-1.5 px-2 text-left">الضريبة (15%)</th>
                  <th className="py-1.5 px-2 text-left font-bold">المسترد الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {returnDoc.items && returnDoc.items.length > 0 ? (
                  returnDoc.items.map((it, idx) => (
                    <tr key={it.id || idx} className="hover:bg-slate-50">
                      <td className="py-2 px-2 font-medium">
                        <div>{it.productName}</div>
                        {it.sku && <span className="text-[10px] text-slate-400 font-mono">SKU: {it.sku}</span>}
                      </td>
                      <td className="py-2 px-2 text-center font-bold font-mono">
                        {it.quantity} {it.unitSymbol || 'حبة'}
                      </td>
                      <td className="py-2 px-2 text-left font-mono">
                        {formatSAR(it.unitPrice)}
                      </td>
                      <td className="py-2 px-2 text-left font-mono text-slate-500">
                        {formatSAR(it.taxAmount)}
                      </td>
                      <td className="py-2 px-2 text-left font-bold font-mono text-rose-700">
                        {formatSAR(it.refundTotal)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-400">
                      بيانات البنود مسجلة وموثقة في سجل المرتجع
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ملخص المبالغ المستردة */}
          <div className="py-3 border-t-2 border-slate-300 bg-slate-50/70 rounded-xl p-3 mt-2 space-y-1.5">
            <div className="flex justify-between text-slate-600">
              <span>المجموع قبل الضريبة:</span>
              <span className="font-mono font-medium">{formatSAR(returnDoc.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>ضريبة القيمة المضافة المسترجعة (15%):</span>
              <span className="font-mono font-medium">{formatSAR(returnDoc.taxTotal)}</span>
            </div>
            <div className="flex justify-between text-sm font-black text-rose-800 border-t border-slate-200 pt-1.5">
              <span>إجمالي قيمة المرتجع الدائن:</span>
              <span className="font-mono text-base">{formatSAR(returnDoc.refundAmount)}</span>
            </div>
          </div>

          {/* التوقيع والملاحظات القانونية */}
          <div className="pt-6 grid grid-cols-2 gap-8 text-center text-[10px] text-slate-500 border-t border-slate-200 mt-4">
            <div>
              <p className="mb-6 font-semibold">الموظف المسؤول / الكاشير</p>
              <div className="border-b border-slate-300 pb-1 font-bold text-slate-700">
                {returnDoc.processedBy || 'موظف المبيعات'}
              </div>
            </div>
            <div>
              <p className="mb-6 font-semibold">توقيع المستلم / العميل</p>
              <div className="border-b border-slate-300 pb-1">
                ...........................................
              </div>
            </div>
          </div>

          <div className="mt-4 text-center text-[9px] text-slate-400">
            تم تحديث رصيد المخزون في المستودع وحساب العميل آلياً بموجب هذا الإشعار وفقاً لضوابط الفوترة الإلكترونية.
          </div>
        </div>

        {/* تذييل النافذة */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center gap-2 no-print">
          <button
            type="button"
            onClick={() => setIsWhatsAppOpen(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span>إرسال الإشعار عبر واتساب</span>
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
              className="px-5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة المستند الرسمي</span>
            </button>
          </div>
        </div>

      </div>

      {/* نافذة إرسال الإشعار بالواتساب كملف PDF معتمد */}
      <WhatsAppShareModal
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
        documentTitle="إشعار الدائن / المرتجع"
        documentNumber={returnDoc.returnNumber}
        recipientName={returnDoc.customerName}
        initialPhone=""
        messageText={whatsAppMessage}
        pdfElementRef={printRef}
        pdfFormat="a4"
        grandTotal={returnDoc.refundAmount}
      />
    </div>
  );
};
