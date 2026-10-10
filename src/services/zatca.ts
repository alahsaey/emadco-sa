/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * خدمة توليد بيانات وتشفير الفاتورة الإلكترونية المتوافقة مع متطلبات
 * هيئة الزكاة والضريبة والجمارك (ZATCA / فورة) في المملكة العربية السعودية
 */

// ترميز الحقول بتقنية TLV (Tag-Length-Value)
function getTlvBuffer(tag: number, value: string): Uint8Array {
  const encoder = new TextEncoder();
  const valueBytes = encoder.encode(value);
  const tagByte = tag;
  const lengthByte = valueBytes.length;
  const result = new Uint8Array(2 + valueBytes.length);
  result[0] = tagByte;
  result[1] = lengthByte;
  result.set(valueBytes, 2);
  return result;
}

/**
 * توليد نص QR Code المشفر Base64 TLV حسب معايير ZATCA
 */
export function generateZatcaTlvBase64(
  sellerName: string,
  vatNumber: string,
  timestampIso: string,
  totalWithVat: number,
  vatTotal: number
): string {
  try {
    const tlv1 = getTlvBuffer(1, sellerName);
    const tlv2 = getTlvBuffer(2, vatNumber);
    const tlv3 = getTlvBuffer(3, timestampIso);
    const tlv4 = getTlvBuffer(4, totalWithVat.toFixed(2));
    const tlv5 = getTlvBuffer(5, vatTotal.toFixed(2));

    const totalLen = tlv1.length + tlv2.length + tlv3.length + tlv4.length + tlv5.length;
    const combined = new Uint8Array(totalLen);

    let offset = 0;
    for (const tlv of [tlv1, tlv2, tlv3, tlv4, tlv5]) {
      combined.set(tlv, offset);
      offset += tlv.length;
    }

    // تحويل البايتات إلى Base64
    let binary = '';
    const bytes = new Uint8Array(combined);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (err) {
    console.error('Error generating ZATCA QR TLV:', err);
    return 'ZATCA-E-INVOICE-BASE64';
  }
}

/**
 * توليد معرّف فريد UUID v4
 */
export function generateUuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
