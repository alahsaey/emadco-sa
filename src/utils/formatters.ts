/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * خيارات تنسيق المبالغ المالية والعملات
 */
export interface CurrencyFormatOptions {
  /** تضمين لاحقة اسم العملة (الافتراضي: true) */
  showCurrency?: boolean;
  /** نص لاحقة العملة (الافتراضي: 'ر.س') */
  currencyText?: string;
  /** عدد المنازل العشرية (الافتراضي: 2 دائماً) */
  decimals?: number;
  /** استخدام ترميز الأرقام (الافتراضي: en-US لضمان فواصل الآلاف والنقاط العشرية القياسية 1,234.56) */
  locale?: 'en-US' | 'ar-SA';
}

/**
 * دالة التنسيق الموحدة للريال السعودي (Saudi Riyal - SAR)
 * تضمن عرض المبلغ بدقة ثابتة لمنزلتين عشريتين مع فواصل الآلاف المعتمدة في المملكة
 * مثال: formatSAR(1234.56) => "1,234.56 ر.س"
 * مثال: formatSAR(1000) => "1,000.00 ر.س"
 */
export function formatSAR(
  amount: number | string | null | undefined,
  options?: CurrencyFormatOptions
): string {
  const {
    showCurrency = true,
    currencyText = 'ر.س',
    decimals = 2,
    locale = 'en-US',
  } = options || {};

  if (amount === null || amount === undefined || amount === '') {
    const zero = (0).toFixed(decimals);
    return showCurrency ? `${zero} ${currencyText}` : zero;
  }

  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (isNaN(num)) {
    const zero = (0).toFixed(decimals);
    return showCurrency ? `${zero} ${currencyText}` : zero;
  }

  // التنسيق مع فواصل الآلاف ومنزلتين عشريتين دقيقتين
  const formattedNumber = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  }).format(num);

  if (!showCurrency) {
    return formattedNumber;
  }

  return `${formattedNumber} ${currencyText}`;
}

/**
 * دالة رديفة لتنسيق العملة بمسمى formatCurrency
 */
export const formatCurrency = formatSAR;

/**
 * دالة تنسيق الأرقام العامة مع فواصل الآلاف وبعدد منازل عشرية محدد
 * مثال: formatNumber(1234.56, 2) -> "1,234.56"
 * مثال: formatNumber(1000, 2) -> "1,000.00"
 */
export function formatNumber(
  value: number | string | null | undefined,
  decimals: number = 2
): string {
  return formatSAR(value, { showCurrency: false, decimals });
}

/**
 * دالة تنسيق الكميات الصحيحة (أعداد القطع والعمليات والمخزون)
 * مثال: formatInteger(1500) -> "1,500"
 */
export function formatInteger(
  value: number | string | null | undefined
): string {
  return formatSAR(value, { showCurrency: false, decimals: 0 });
}

/**
 * دالة تنسيق النسبة المئوية
 * مثال: formatPercent(15) -> "15%" أو "15.00%"
 */
export function formatPercent(
  value: number | string | null | undefined,
  decimals: number = 0
): string {
  if (value === null || value === undefined) return '0%';
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (isNaN(num)) return '0%';
  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)}%`;
}
