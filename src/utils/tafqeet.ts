/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * تحويل الأرقام إلى نصوص باللغة العربية (تفقيط المبالغ المالية بالريال السعودي)
 */
export function tafqeetRiyal(amount: number): string {
  if (isNaN(amount) || amount === 0) {
    return 'صفر ريال سعودي لا غير';
  }

  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة'];
  const teens = ['', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

  function convertGroup(n: number): string {
    let result = '';
    const h = Math.floor(n / 100);
    const remainder = n % 100;
    const t = Math.floor(remainder / 10);
    const o = remainder % 10;

    if (h > 0) {
      result += hundreds[h];
    }

    if (remainder > 0) {
      if (result.length > 0) result += ' و';
      if (remainder <= 10) {
        result += ones[remainder];
      } else if (remainder < 20) {
        result += teens[remainder - 10];
      } else {
        if (o > 0) {
          result += ones[o] + ' و' + tens[t];
        } else {
          result += tens[t];
        }
      }
    }

    return result;
  }

  const rounded = Math.round(amount * 100) / 100;
  const integerPart = Math.floor(rounded);
  const decimalPart = Math.round((rounded - integerPart) * 100);

  let text = '';

  if (integerPart === 0) {
    text = '';
  } else if (integerPart < 1000) {
    text = convertGroup(integerPart);
  } else if (integerPart < 1000000) {
    const thousands = Math.floor(integerPart / 1000);
    const rem = integerPart % 1000;
    let thText = '';
    if (thousands === 1) thText = 'ألف';
    else if (thousands === 2) thText = 'ألفان';
    else if (thousands >= 3 && thousands <= 10) thText = convertGroup(thousands) + ' آلاف';
    else thText = convertGroup(thousands) + ' ألف';

    text = thText;
    if (rem > 0) {
      text += ' و' + convertGroup(rem);
    }
  } else {
    text = integerPart.toString();
  }

  let fullResult = `فقط ${text} ريال سعودي`;

  if (decimalPart > 0) {
    let halalasText = convertGroup(decimalPart);
    fullResult += ` و${halalasText} هللة`;
  }

  fullResult += ' لا غير';
  return fullResult;
}
