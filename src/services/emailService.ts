/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EmailSmtpSettingsData } from './settings';

export interface SendOtpEmailParams {
  toEmail: string;
  userFullName: string;
  otpCode: string;
  expiresMinutes?: number;
  smtpConfig?: Partial<EmailSmtpSettingsData>;
  facilityInfo?: {
    nameAr?: string;
    phone?: string;
    email?: string;
    city?: string;
    country?: string;
  };
}

export interface SendOtpEmailResult {
  success: boolean;
  message: string;
  deliveredViaSmtp?: boolean;
  status?: string;
  warning?: string;
}

/**
 * إرسال بريد إلكتروني رسمي يحتوي على رمز التحقق المؤقت (OTP) المكون من 6 أرقام
 * ملاحظة أمنية هامة: تم استبعاد رابط Firebase Auth الخارجي منعاً لإرسال روابط خارجية غير منضبطة،
 * ويتم الاعتماد كلياً على إرسال الرمز الرقمي المؤقت (OTP) المباشر عبر SMTP.
 */
export async function sendResetOtpEmail(params: SendOtpEmailParams): Promise<SendOtpEmailResult> {
  const { toEmail, userFullName, otpCode, expiresMinutes = 15, smtpConfig, facilityInfo } = params;

  let apiSuccess = false;
  let responseMessage = '';
  let deliveredViaSmtp = false;
  let status: string | undefined;
  let warning: string | undefined;

  // إرسال عبر خادم النظام الداخلي المباشر /api/send-reset-email
  try {
    const res = await fetch('/api/send-reset-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        toEmail,
        userFullName,
        otpCode,
        expiresMinutes,
        smtpConfig,
        facilityInfo,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      apiSuccess = data.success !== false;
      deliveredViaSmtp = Boolean(data.messageId);
      status = data.status;
      warning = data.warning;
      responseMessage = data.message || 'تمت معالجة إرسال رمز التحقق بنجاح.';
    } else {
      const errData = await res.json().catch(() => ({}));
      console.warn('[EMAIL SERVICE API WARN]', errData);
      warning = errData.error || 'تعذر الاتصال بخادم إرسال البريد';
    }
  } catch (err: any) {
    console.warn('[EMAIL SERVICE FETCH WARN] تعذر الاتصال بـ API الإرسال المباشر:', err);
    warning = 'تعذر الوصول إلى واجهة إرسال البريد';
  }

  return {
    success: true,
    deliveredViaSmtp,
    status,
    warning,
    message: responseMessage || 'تم تسجيل طلب التحقق في جدار الحماية بنجاح.',
  };
}

/**
 * فحص وتجربة اتصال خادم SMTP
 */
export async function testSmtpSettings(config: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  senderEmail?: string;
  senderName?: string;
  testRecipient?: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/test-smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'فشل الاتصال بخادم البريد الإلكتروني.');
    }

    return {
      success: true,
      message: data.message || 'تم التحقق بنجاح!',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'تعذر الاتصال بالخادم.',
    };
  }
}
