/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Invoice, Sale, SaleItem, Payment, Quotation, Return, ReturnItem } from '../types';
import { tafqeetRiyal } from './tafqeet';
import { formatSAR } from './formatters';

/**
 * تنظيف وتهيئة رقم الهاتف ليكون متوافقاً مع معايير واتساب الدولية
 * يحوّل أرقام السعودية (مثال: 0501234567) إلى 966501234567 تلقائياً
 */
export function formatWhatsAppPhone(phone: string): string {
  if (!phone) return '';
  
  // إزالة المسافات والشرطات والرموز غير الرقمية
  let clean = phone.replace(/[^\d+]/g, '');

  // إزالة علامة الزائد إذا كانت موجودة
  if (clean.startsWith('+')) {
    clean = clean.substring(1);
  }

  // إذا كان الرقم يبدأ بـ 00 (بادئة الاتصال الدولي)
  if (clean.startsWith('00')) {
    clean = clean.substring(2);
  }

  // إذا كان الرقم يبدأ بـ 05 (الرقم السعودي المحلي)
  if (clean.startsWith('05')) {
    clean = '966' + clean.substring(1);
  } else if (clean.startsWith('5') && clean.length === 9) {
    clean = '966' + clean;
  }

  return clean;
}

export interface InvoiceWhatsAppPayload {
  invoice: Invoice;
  sale?: Sale;
  saleItems?: SaleItem[];
  payment?: Payment;
  companyName?: string;
  vatNumber?: string;
  crNumber?: string;
}

/**
 * صياغة رسالة فاتورة ضريبية رسمية منسقة للواتساب
 */
export function buildInvoiceWhatsAppMessage(payload: InvoiceWhatsAppPayload): string {
  const {
    invoice,
    sale,
    saleItems = [],
    payment,
    companyName = 'مؤسسة عماد سعد آل سعيد لمواد البناء (عمادكو)',
    vatNumber = '310948572100003',
  } = payload;

  const issueDate = new Date(invoice.issueDate).toLocaleString('ar-SA', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const currency = 'ر.س';

  let text = `🏗️ *${companyName}*\n`;
  text += `🧾 *فاتورة مبيعات ضريبية مبسطة*\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📋 *رقم الفاتورة:* \`${invoice.invoiceNumber}\`\n`;
  text += `📅 *التاريخ:* ${issueDate}\n`;
  text += `👤 *العميل:* ${invoice.customerName || 'عميل نقدي'}\n`;

  if (payment?.paymentMethodId) {
    const methodNames: Record<string, string> = {
      CASH: 'نقداً (كاش)',
      MADA: 'شبكة مدى (Mada)',
      CARD: 'بطاقة ائتمانية',
      CREDIT: 'آجل (ذمم)',
      TRANSFER: 'تحويل بنكي',
    };
    text += `💳 *طريقة الدفع:* ${methodNames[payment.paymentMethodId] || payment.paymentMethodId}\n`;
  }

  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📦 *بيان المواد والأصناف:*\n`;

  if (saleItems && saleItems.length > 0) {
    saleItems.forEach((item, index) => {
      const itemTotal = (item as any).totalAmount || item.lineTotal || (item.quantity * item.unitPrice);
      text += `${index + 1}. *${item.productName}*\n`;
      text += `   الكمية: ${item.quantity} | السعر: ${formatSAR(item.unitPrice)} | الإجمالي: *${formatSAR(itemTotal)}*\n`;
    });
  } else {
    text += `مشتريات ومواد بناء معتمدة.\n`;
  }

  const subtotal = (invoice as any).subtotal ?? invoice.totalExcludingTax ?? 0;
  const discountAmount = (invoice as any).discountAmount ?? (sale?.discountTotal ?? 0);
  const totalAmount = (invoice as any).totalAmount ?? invoice.totalIncludingTax ?? 0;

  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `💵 *المجموع قبل الضريبة:* ${formatSAR(subtotal)}\n`;
  if (discountAmount > 0) {
    text += `🏷️ *الخصم التجاري:* ${formatSAR(discountAmount)}\n`;
  }
  text += `📊 *ضريبة القيمة المضافة (15%):* ${formatSAR(invoice.taxAmount)}\n`;
  text += `💰 *الإجمالي المستحق النهائي:* *${formatSAR(totalAmount)}*\n`;
  text += `📝 *المبلغ كتابةً:* ${tafqeetRiyal(totalAmount)}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `🏛️ *الرقم الضريبي للمنشأة:* \`${vatNumber}\`\n`;
  text += `✨ *شكراً لتعاملكم مع عمادكو لمواد البناء! نسعد بخدمتكم دائماً.*`;

  return text;
}

export interface QuotationWhatsAppPayload {
  quotation: Quotation;
  companyName?: string;
  vatNumber?: string;
}

/**
 * صياغة رسالة عرض سعر منسقة للواتساب
 */
export function buildQuotationWhatsAppMessage(payload: QuotationWhatsAppPayload): string {
  const {
    quotation,
    companyName = 'مؤسسة عماد سعد آل سعيد لمواد البناء (عمادكو)',
    vatNumber = '310948572100003',
  } = payload;

  const issueDate = new Date(quotation.issueDate).toLocaleDateString('ar-SA');
  const validUntil = new Date(quotation.validUntil).toLocaleDateString('ar-SA');
  const currency = 'ر.س';

  let text = `🏗️ *${companyName}*\n`;
  text += `📑 *عرض أسعار مواد ومستلزمات إنشائية*\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📋 *رقم عرض السعر:* \`${quotation.quotationNumber}\`\n`;
  text += `📅 *تاريخ العرض:* ${issueDate}\n`;
  text += `⏳ *صالح حتى:* ${validUntil}\n`;
  text += `👤 *السيد/السادة:* ${quotation.customerName}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📦 *بيان المواد والبنود المسعرة:*\n`;

  if (quotation.items && quotation.items.length > 0) {
    quotation.items.forEach((item, index) => {
      const itemTotal = (item as any).totalAmount ?? item.lineTotal ?? (item.quantity * item.unitPrice);
      text += `${index + 1}. *${item.productName}*\n`;
      text += `   الكمية: ${item.quantity} | السعر: ${formatSAR(item.unitPrice)} | الإجمالي: *${formatSAR(itemTotal)}*\n`;
    });
  }

  const qSubtotal = (quotation as any).subtotal ?? quotation.subtotal ?? 0;
  const qDiscount = (quotation as any).discountAmount ?? quotation.discountTotal ?? 0;
  const qTax = (quotation as any).taxAmount ?? quotation.taxTotal ?? 0;
  const qTotal = (quotation as any).totalAmount ?? quotation.grandTotal ?? 0;

  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `💵 *المجموع قبل الضريبة:* ${formatSAR(qSubtotal)}\n`;
  if (qDiscount > 0) {
    text += `🏷️ *الخصم الممنوح:* ${formatSAR(qDiscount)}\n`;
  }
  text += `📊 *ضريبة القيمة المضافة (15%):* ${formatSAR(qTax)}\n`;
  text += `💰 *الإجمالي النهائي:* *${formatSAR(qTotal)}*\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  const qTerms = (quotation as any).termsAndConditions ?? quotation.notes;
  if (qTerms) {
    text += `📝 *ملاحظات وشروط:* ${qTerms}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  }
  text += `🏛️ *الرقم الضريبي للمنشأة:* \`${vatNumber}\`\n`;
  text += `✨ *يسعدنا اعتمادكم للعرض للتنفيذ الفوري والتوريد.*`;

  return text;
}

export interface ReturnWhatsAppPayload {
  returnDoc: Return;
  companyName?: string;
  vatNumber?: string;
}

/**
 * صياغة رسالة إشعار دائن / مرتجع للواتساب
 */
export function buildReturnWhatsAppMessage(payload: ReturnWhatsAppPayload): string {
  const {
    returnDoc,
    companyName = 'مؤسسة عماد سعد آل سعيد لمواد البناء (عمادكو)',
    vatNumber = '310948572100003',
  } = payload;

  const rawDate = (returnDoc as any).returnDate || (returnDoc as any).createdAt || new Date().toISOString();
  const returnDate = new Date(rawDate).toLocaleString('ar-SA', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const currency = 'ر.س';

  let text = `🏗️ *${companyName}*\n`;
  text += `🔄 *إشعار دائن ضريبي معتمد (مرتجع مبيعات)*\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📋 *رقم الإشعار:* \`${returnDoc.returnNumber}\`\n`;
  text += `🧾 *مرجع الفاتورة الأصلية:* \`${returnDoc.originalInvoiceNumber}\`\n`;
  text += `📅 *التاريخ:* ${returnDate}\n`;
  text += `👤 *العميل:* ${returnDoc.customerName || 'عميل نقدي'}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📦 *المواد المرتجعة:*\n`;

  if (returnDoc.items && returnDoc.items.length > 0) {
    returnDoc.items.forEach((item, index) => {
      const qty = item.quantity || (item as any).returnQuantity || 1;
      const lineTotal = (item as any).lineTotal ?? (item.unitPrice * qty);
      text += `${index + 1}. *${item.productName}*\n`;
      text += `   الكمية: ${qty} | السعر: ${formatSAR(item.unitPrice)} | الإجمالي: *${formatSAR(lineTotal)}*\n`;
    });
  }

  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `💰 *إجمالي مبلغ الاسترداد المعتمد:* *${formatSAR(returnDoc.refundAmount)}*\n`;
  
  const refundMethodNames: Record<string, string> = {
    cash: 'استرداد نقدي فوري',
    card: 'استرجاع عبر البطاقة / مدى',
    customer_balance: 'رصيد دائن بحساب العميل',
    bank_transfer: 'تحويل بنكي',
  };
  text += `💳 *طريقة الاسترداد:* ${refundMethodNames[returnDoc.refundMethod] || returnDoc.refundMethod}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `🏛️ *الرقم الضريبي للمنشأة:* \`${vatNumber}\`\n`;
  text += `✨ *تمت معالجة الإرجاع وإعادة البند للمخزون بنجاح.*`;

  return text;
}

/**
 * إنشاء رابط مباشر لفتح الواتساب
 */
export function createWhatsAppUrl(phone: string, message: string): string {
  const formattedPhone = formatWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(message);
  
  if (formattedPhone) {
    return `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

/**
 * صياغة رسالة مرافقة مهنية لإرسال ملف الفاتورة أو المستند كـ PDF عبر واتساب
 */
export function buildPdfWhatsAppCoverMessage(payload: {
  documentTitle?: string;
  documentNumber: string;
  recipientName?: string;
  companyName?: string;
  grandTotal?: number;
}): string {
  const company = payload.companyName || 'مؤسسة عماد سعد آل سعيد لمواد البناء (عمادكو)';
  const customer = payload.recipientName ? `الأخ / ${payload.recipientName}` : 'عميلنا العزيز';
  const title = payload.documentTitle || 'الفاتورة الضريبية';
  
  let msg = `السلام عليكم ورحمة الله وبركاته 🤝\n`;
  msg += `مرحباً بك ${customer}،\n`;
  msg += `مرفق لكم ${title} الرسمية (ملف PDF) الصادرة من *${company}*:\n`;
  msg += `🧾 *رقم المستند:* \`${payload.documentNumber}\`\n`;
  if (payload.grandTotal !== undefined && payload.grandTotal !== null) {
    msg += `💰 *الإجمالي المستحق:* *${formatSAR(payload.grandTotal)}*\n`;
  }
  msg += `📄 *حالة المستند:* مستند رسمي معتمد ومسجل إلكترونياً ومتوافق مع هيئة الزكاة والضريبة والجمارك (ZATCA).\n\n`;
  msg += `نسعد دائماً بخدمتكم وتلبية كافة طلباتكم من مواد البناء والأدوات الصحية والكهربائية! ✨`;
  return msg;
}

/**
 * التحقق من أن رقم الهاتف بصيغة دولية صالحة متوافقة مع معايير E.164 وواتساب
 * - يتطلب وجود كود دولة صالح بدون أصفار بادئة
 * - يتراوح طول الرقم الصافي بين 8 و 15 خانة
 */
export function isValidInternationalPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  
  // تنظيف وتهيئة الرقم
  const clean = formatWhatsAppPhone(phone.trim());
  if (!clean) return false;

  // المعيار الدولي E.164: من 8 إلى 15 خانة رقمية تبدأ برقم غير صفري
  return /^[1-9]\d{7,14}$/.test(clean);
}

/**
 * عرض إشعار تنبيهي (Toast) للمستخدم في واجهة النظام
 */
export function showWhatsAppToast(message: string, type: 'error' | 'success' | 'warning' = 'error'): void {
  if (typeof document === 'undefined') return;

  // إرسال CustomEvent ليتم التقاطه من أي مكوّن يستمع للتنبيهات في التطبيق
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { type, message },
        })
      );
    } catch {
      // تجاهل إذا لم تكن البيئة تدعم CustomEvent
    }
  }

  // البحث عن الحاوية أو إنشاؤها
  let container = document.getElementById('whatsapp-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'whatsapp-toast-container';
    container.setAttribute('dir', 'rtl');
    container.setAttribute('aria-live', 'polite');
    container.style.cssText =
      'position: fixed; top: 24px; left: 50%; transform: translateX(-50%); z-index: 999999; display: flex; flex-direction: column; gap: 10px; width: 92%; max-width: 440px; pointer-events: none;';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const isError = type === 'error';
  const bgColor = isError ? '#e11d48' : type === 'warning' ? '#d97706' : '#059669';

  toast.style.cssText = `
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background-color: ${bgColor};
    color: #ffffff;
    border-radius: 16px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
    font-size: 13px;
    font-weight: 700;
    pointer-events: auto;
    direction: rtl;
    text-align: right;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    opacity: 0;
    transform: translateY(-12px) scale(0.96);
    border: 1px solid rgba(255, 255, 255, 0.2);
  `;

  // أيقونة التنبيه
  const iconSpan = document.createElement('span');
  iconSpan.style.cssText = 'flex-shrink: 0; display: flex; align-items: center; justify-content: center;';
  iconSpan.innerHTML = isError
    ? `<svg style="width:20px;height:20px;" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`
    : `<svg style="width:20px;height:20px;" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`;

  const messageSpan = document.createElement('span');
  messageSpan.style.cssText = 'flex: 1; line-height: 1.45; font-family: inherit;';
  messageSpan.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'إغلاق الإشعار');
  closeBtn.style.cssText =
    'background: rgba(255,255,255,0.2); border: none; color: white; cursor: pointer; border-radius: 8px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; flex-shrink: 0; transition: background 0.2s;';
  closeBtn.textContent = '✕';

  closeBtn.onmouseenter = () => {
    closeBtn.style.backgroundColor = 'rgba(255,255,255,0.35)';
  };
  closeBtn.onmouseleave = () => {
    closeBtn.style.backgroundColor = 'rgba(255,255,255,0.2)';
  };

  toast.appendChild(iconSpan);
  toast.appendChild(messageSpan);
  toast.appendChild(closeBtn);

  const dismiss = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-12px) scale(0.96)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
      if (container && container.childNodes.length === 0 && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }, 300);
  };

  closeBtn.onclick = dismiss;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0) scale(1)';
  });

  setTimeout(dismiss, 4500);
}

export interface SendViaWhatsAppOptions {
  onError?: (errorMessage: string) => void;
  showToastOnError?: boolean;
}

/**
 * فتح تطبيق الواتساب أو واتساب ويب مع نص الرسالة مع التحقق المسبق من وجود وصحة الرقم الدولي
 * @param phone رقم هاتف المستلم
 * @param message نص الرسالة المراد إرسالها
 * @param options خيارات إضافية لمعالجة الأخطاء والتنبيهات
 * @returns boolean يعود بـ true إذا تم التحقق وفتح الرابط بنجاح، و false في حال وجود خطأ
 */
export function sendViaWhatsApp(
  phone: string,
  message: string,
  options?: SendViaWhatsAppOptions
): boolean {
  const shouldShowToast = options?.showToastOnError !== false;

  // 1. التحقق من وجود رقم الهاتف (Missing Phone Check)
  if (!phone || !phone.trim()) {
    const errorMsg = 'رقم الهاتف مفقود. يرجى إدخال رقم هاتف المستلم للمتابعة عبر الواتساب.';
    if (shouldShowToast) {
      showWhatsAppToast(errorMsg, 'error');
    }
    options?.onError?.(errorMsg);
    return false;
  }

  // 2. التحقق من مطابقة الرقم للصيغة الدولية الصحيحة (Valid International Format Check)
  if (!isValidInternationalPhone(phone)) {
    const errorMsg = 'رقم الهاتف غير صالح. يرجى إدخال رقم هاتف بصيغة دولية معتمدة (مثال: 966500680180 أو 0500680180).';
    if (shouldShowToast) {
      showWhatsAppToast(errorMsg, 'error');
    }
    options?.onError?.(errorMsg);
    return false;
  }

  // 3. إنشاء رابط الواتساب وفتح النافذة
  const url = createWhatsAppUrl(phone, message);
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  return true;
}

