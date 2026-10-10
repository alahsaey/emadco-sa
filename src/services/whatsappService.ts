/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WhatsAppGatewayConfig, DEFAULT_SYSTEM_SETTINGS, getSystemSettings } from './settings';
import { formatWhatsAppPhone } from '../utils/whatsapp';

export interface SendWhatsAppPayload {
  toPhone: string;
  message: string;
  pdfBase64?: string;
  fileName?: string;
  gatewayConfig?: Partial<WhatsAppGatewayConfig>;
}

export interface WhatsAppSendResult {
  success: boolean;
  message: string;
  messageId?: string;
  provider?: string;
  error?: string;
  timestamp?: string;
}

export interface WhatsAppStatusResult {
  connected: boolean;
  status: 'connected' | 'disconnected' | 'qr_ready' | 'connecting';
  phone?: string;
  deviceName?: string;
  pairedAt?: string;
  qrCodeData?: string;
  pairingCode?: string;
  queueCount?: number;
  engineVersion?: string;
}

export interface WhatsAppOutboxEntry {
  id: string;
  toPhone: string;
  message: string;
  status: 'sent' | 'pending' | 'failed';
  provider: string;
  timestamp: string;
  errorMessage?: string;
  hasAttachment?: boolean;
}

// مفتاح التخزين المحلي لرابط خادم الواتساب
export const WA_CUSTOM_SERVER_URL_KEY = 'emadco_wa_server_url';
export const WA_LOCAL_OUTBOX_KEY = 'emadco_wa_outbox';
export const WA_SESSION_STATUS_KEY = 'emadco_wa_session_status';
export const WA_PAIRED_PHONE_KEY = 'emadco_wa_paired_phone';
export const WA_PAIRED_DEVICE_KEY = 'emadco_wa_paired_device';

/**
 * الحصول على عنوان خادم الـ API للواتساب
 */
export function getWhatsAppApiBaseUrl(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(WA_CUSTOM_SERVER_URL_KEY);
      if (stored && stored.trim()) {
        return stored.trim().replace(/\/+$/, '');
      }
    }

    const envUrl = (import.meta as any).env?.VITE_WHATSAPP_SERVER_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
      return envUrl.trim().replace(/\/+$/, '');
    }
  } catch (e) {}

  return '';
}

/**
 * حفظ عنوان خادم الواتساب المخصص
 */
export function setWhatsAppApiBaseUrl(url: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      if (url && url.trim()) {
        localStorage.setItem(WA_CUSTOM_SERVER_URL_KEY, url.trim().replace(/\/+$/, ''));
      } else {
        localStorage.removeItem(WA_CUSTOM_SERVER_URL_KEY);
      }
    }
  } catch (e) {}
}

/**
 * بناء الرابط الكامل للمسار
 */
export function resolveWhatsAppApiEndpoint(path: string): string {
  const base = getWhatsAppApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!base) return cleanPath;
  return `${base}${cleanPath}`;
}

/**
 * فحص ما إذا كانت البيئة الحالية استضافة ثابتة (مثل GitHub Pages)
 */
export function isStaticOrGitHubPages(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.includes('github.io') || host.includes('pages.dev') || window.location.protocol === 'file:';
}

/**
 * دالة مساعدة للتعامل الآمن مع استجابات JSON والتأكد من التواصل مع الخادم مباشرة
 */
async function safeJsonFetch<T>(
  input: string,
  init?: RequestInit,
  fallbackMsg = 'تعذر الاتصال بخادم الواتساب.'
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const fullUrl = resolveWhatsAppApiEndpoint(input);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(fullUrl, {
      ...init,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text().catch(() => '');
      return {
        ok: false,
        error: res.status === 404 ? 'المسار البرمجي غير موجود على الخادم (404).' : (text.slice(0, 100) || fallbackMsg),
      };
    }
    const data = await res.json();
    return { ok: res.ok, data };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.name === 'AbortError' ? 'انتهت مهلة انتظار الخادم.' : (err?.message || fallbackMsg),
    };
  }
}

/**
 * حفظ رسالة في سجل الصادر المحلي
 */
function saveLocalOutboxEntry(entry: WhatsAppOutboxEntry) {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(WA_LOCAL_OUTBOX_KEY);
    const list: WhatsAppOutboxEntry[] = raw ? JSON.parse(raw) : [];
    list.unshift(entry);
    localStorage.setItem(WA_LOCAL_OUTBOX_KEY, JSON.stringify(list.slice(0, 50)));
  } catch (e) {}
}

/**
 * جلب حالة اتصال جلسة الواتساب المباشرة من الخادم الخلفي
 */
export async function getWhatsAppConnectionStatus(): Promise<WhatsAppStatusResult & { qrRemainingSeconds?: number }> {
  try {
    const res = await safeJsonFetch<WhatsAppStatusResult & { qrRemainingSeconds?: number }>('/api/whatsapp/status', { method: 'GET' });
    if (res.ok && res.data) {
      if (res.data.connected && typeof localStorage !== 'undefined') {
        localStorage.setItem(WA_SESSION_STATUS_KEY, 'connected');
        localStorage.setItem(WA_PAIRED_PHONE_KEY, res.data.phone || '0500680180');
        localStorage.setItem(WA_PAIRED_DEVICE_KEY, res.data.deviceName || 'هاتف المحاسبة والإدارة الرئيسي');
      } else if (!res.data.connected && typeof localStorage !== 'undefined') {
        localStorage.removeItem(WA_SESSION_STATUS_KEY);
      }
      return res.data;
    }
  } catch (err) {}

  return { connected: false, status: 'disconnected' };
}

/**
 * توليد باركود ربط حي لجلسة واتساب مباشرة عبر خادم Baileys
 */
export async function generatePairingQRCode(phoneHint?: string, forceRefresh = false): Promise<{
  success: boolean;
  qrDataUrl?: string;
  pairingCode?: string;
  expiresIn?: number;
  remainingSeconds?: number;
  message?: string;
  error?: string;
}> {
  try {
    const res = await safeJsonFetch<{
      success: boolean;
      qrDataUrl?: string;
      pairingCode?: string;
      expiresIn?: number;
      remainingSeconds?: number;
      message?: string;
      error?: string;
    }>(
      '/api/whatsapp/pair-qr',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneHint: phoneHint || '0500680180', forceRefresh }),
      },
      'تعذر استلام باركود الاقتران من خادم الواتساب.'
    );

    if (res.ok && res.data) {
      return res.data;
    }

    return {
      success: false,
      error: res.error || 'تعذر استلام باركود الاقتران من الخادم. تأكد من تشغيل خادم Node.js.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'تعذر الاتصال بخادم توليد الباركود.',
    };
  }
}

/**
 * طلب وتوليد كود الاقتران المباشر برقم الهاتف (8-Character Pairing Code)
 */
export async function requestWhatsAppPairingCode(phone: string): Promise<{
  success: boolean;
  pairingCode?: string;
  expiresIn?: number;
  waShareUrl?: string;
  cleanPhone?: string;
  message?: string;
  error?: string;
}> {
  try {
    const res = await safeJsonFetch<{
      success: boolean;
      pairingCode?: string;
      expiresIn?: number;
      waShareUrl?: string;
      cleanPhone?: string;
      message?: string;
      error?: string;
    }>(
      '/api/whatsapp/pair-code',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone || '0500680180' }),
      },
      'تعذر طلب كود الاقتران من خادم الواتساب.'
    );

    if (res.ok && res.data) {
      return res.data;
    }

    return {
      success: false,
      error: res.error || 'تعذر طلب كود الاقتران من الخادم.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'تعذر الاتصال بخادم طلب كود الاقتران.',
    };
  }
}

/**
 * التحقق من كود الاقتران وتأكيد الربط الفوري
 */
export async function verifyWhatsAppPairingCode(payload: {
  phone: string;
  code: string;
  deviceName?: string;
}): Promise<{
  success: boolean;
  message: string;
  session?: any;
  error?: string;
}> {
  try {
    const res = await safeJsonFetch<{
      success: boolean;
      message: string;
      session?: any;
      error?: string;
    }>(
      '/api/whatsapp/verify-code',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      'فشل التحقق من كود الاقتران.'
    );

    if (res.ok && res.data && res.data.success) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(WA_SESSION_STATUS_KEY, 'connected');
        localStorage.setItem(WA_PAIRED_PHONE_KEY, payload.phone || '0500680180');
        localStorage.setItem(WA_PAIRED_DEVICE_KEY, payload.deviceName || 'هاتف المحاسبة والإدارة (صالح الياسين)');
      }
      return res.data;
    }

    return {
      success: false,
      message: res.data?.message || res.error || 'فشل التحقق من كود الاقتران.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'فشل التحقق من كود الاقتران.',
    };
  }
}

/**
 * مزامنة إعدادات جلسة الواتساب مع خادم النظام
 */
export async function syncWhatsAppSettingsWithServer(payload: {
  phone?: string;
  deviceName?: string;
  enabled?: boolean;
  sessionStatus?: string;
}): Promise<{ success: boolean; connected?: boolean }> {
  try {
    const res = await safeJsonFetch<{ success: boolean; connected?: boolean }>(
      '/api/whatsapp/sync-settings',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      'تعذر مزامنة إعدادات الواتساب مع الخادم.'
    );
    return res.data || { success: false };
  } catch (err) {
    return { success: false };
  }
}

/**
 * تأكيد الاقتران وحفظ الجلسة
 */
export async function confirmWhatsAppPairing(payload: {
  phone: string;
  deviceName?: string;
  method?: 'qr' | 'code';
}): Promise<{
  success: boolean;
  message: string;
  config?: WhatsAppGatewayConfig;
}> {
  try {
    const res = await safeJsonFetch<{
      success: boolean;
      message: string;
      session?: any;
    }>(
      '/api/whatsapp/confirm-pairing',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      'فشل تأكيد اقتران الجهاز.'
    );

    if (res.ok && res.data && res.data.success) {
      const currentSettings = await getSystemSettings();
      const baseGateway = currentSettings.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway;
      const updatedGateway: WhatsAppGatewayConfig = {
        ...baseGateway,
        enabled: true,
        sessionStatus: 'connected',
        pairedPhoneNumber: payload.phone || '0500680180',
        pairedDeviceName: payload.deviceName || 'هاتف المحاسبة والإدارة (صالح الياسين)',
        provider: 'direct_qr',
      };

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(WA_SESSION_STATUS_KEY, 'connected');
        localStorage.setItem(WA_PAIRED_PHONE_KEY, payload.phone || '0500680180');
        localStorage.setItem(WA_PAIRED_DEVICE_KEY, payload.deviceName || 'هاتف المحاسبة والإدارة (صالح الياسين)');
      }

      return {
        success: true,
        message: res.data.message || 'تم تأكيد الاقتران واعتماد اتصال الواتساب بنجاح!',
        config: updatedGateway,
      };
    }

    return {
      success: false,
      message: res.error || 'فشل تأكيد اقتران الجهاز بالخادم.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'فشل تأكيد اقتران الجهاز.',
    };
  }
}

/**
 * فصل جلسة الواتساب الحالية
 */
export async function disconnectWhatsAppSession(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await safeJsonFetch<{ success: boolean; message: string }>(
      '/api/whatsapp/disconnect',
      { method: 'POST' },
      'تعذر فصل جلسة الواتساب.'
    );

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(WA_SESSION_STATUS_KEY);
      localStorage.removeItem(WA_PAIRED_PHONE_KEY);
      localStorage.removeItem(WA_PAIRED_DEVICE_KEY);
    }

    return res.data || { success: true, message: 'تم فصل جلسة الواتساب بنجاح.' };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'تعذر فصل جلسة الواتساب.',
    };
  }
}

/**
 * جلب سجل الرسائل الصادرة وطابور الإرسال
 */
export async function getWhatsAppOutboxLogs(): Promise<WhatsAppOutboxEntry[]> {
  try {
    const res = await safeJsonFetch<{ success: boolean; logs: WhatsAppOutboxEntry[] }>(
      '/api/whatsapp/outbox',
      { method: 'GET' }
    );
    if (res.ok && res.data?.logs) {
      return res.data.logs;
    }
  } catch (err) {}

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(WA_LOCAL_OUTBOX_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    }
  } catch (e) {}

  return [];
}

/**
 * إرسال رسالة مباشرة إلى واتساب العميل حصراً عبر خادم الـ API الخلفي دون فتح تطبيق الواتساب
 */
export async function sendDirectWhatsApp(
  payload: SendWhatsAppPayload
): Promise<WhatsAppSendResult> {
  const formattedPhone = formatWhatsAppPhone(payload.toPhone);
  if (!formattedPhone || formattedPhone.length < 8) {
    return {
      success: false,
      message: 'رقم هاتف العميل غير صحيح أو غير مكتمل.',
      error: 'INVALID_PHONE',
    };
  }

  let config = payload.gatewayConfig;
  if (!config) {
    const settings = await getSystemSettings();
    config = settings.whatsappGateway;
  }

  try {
    const res = await safeJsonFetch<{
      success: boolean;
      message?: string;
      messageId?: string;
      provider?: string;
      error?: string;
      timestamp?: string;
    }>(
      '/api/send-whatsapp',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toPhone: formattedPhone,
          message: payload.message,
          pdfBase64: payload.pdfBase64,
          fileName: payload.fileName,
          config,
        }),
      },
      'تعذر الاتصال بخادم إرسال الواتساب المباشر.'
    );

    if (res.ok && res.data && res.data.success) {
      saveLocalOutboxEntry({
        id: res.data.messageId || `WA-${Date.now()}`,
        toPhone: formattedPhone,
        message: payload.message,
        status: 'sent',
        provider: res.data.provider || 'خادم الواتساب المباشر (Baileys)',
        timestamp: new Date().toLocaleTimeString('ar-SA'),
        hasAttachment: Boolean(payload.pdfBase64),
      });

      return {
        success: true,
        message: res.data.message || 'تم إرسال الرسالة مباشرة إلى واتساب العميل بنجاح عبر النظام! ✨',
        messageId: res.data.messageId,
        provider: res.data.provider || 'direct_baileys',
        timestamp: res.data.timestamp || new Date().toISOString(),
      };
    }

    return {
      success: false,
      message: res.data?.error || res.error || 'فشل إرسال الرسالة عبر خادم الواتساب المباشر. يرجى التحقق من اتصال الواتساب في شاشة الإعدادات.',
      error: res.data?.error || res.error,
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'تعذر الاتصال بخادم إرسال الواتساب: ' + (err?.message || ''),
      error: err?.message,
    };
  }
}

/**
 * فحص الاتصال ببوابة الواتساب وإرسال رسالة تجريبية عبر الخادم
 */
export async function testWhatsAppGateway(
  config: WhatsAppGatewayConfig,
  testPhone: string
): Promise<WhatsAppSendResult> {
  const formattedPhone = formatWhatsAppPhone(testPhone);
  if (!formattedPhone || formattedPhone.length < 8) {
    return {
      success: false,
      message: 'يرجى إدخال رقم هاتف صحيح لإرسال الرسالة التجريبية إليه (مثال: 0500680180).',
    };
  }

  try {
    const res = await safeJsonFetch<{
      success: boolean;
      message?: string;
      messageId?: string;
      provider?: string;
      error?: string;
      timestamp?: string;
    }>(
      '/api/test-whatsapp',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toPhone: formattedPhone,
          config,
        }),
      },
      'فشل فحص اتصال بوابة الواتساب عبر الخادم.'
    );

    if (res.ok && res.data && res.data.success) {
      return {
        success: true,
        message: res.data.message || 'تم فحص الاتصال وإرسال الرسالة التجريبية بنجاح عبر الخادم!',
        messageId: res.data.messageId,
        provider: res.data.provider,
        timestamp: res.data.timestamp || new Date().toISOString(),
      };
    }

    return {
      success: false,
      message: res.data?.error || res.error || 'فشل فحص اتصال بوابة الواتساب.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'تعذر الوصول إلى خادم الفحص: ' + (err?.message || ''),
      error: err?.message,
    };
  }
}

/**
 * فحص الاتصال بسيرفر الواتساب الخارجي/السحابي المخصص
 */
export async function testCustomBackendServer(serverUrl?: string): Promise<{ success: boolean; message: string }> {
  const urlToTest = serverUrl?.trim() || getWhatsAppApiBaseUrl();
  if (!urlToTest) {
    return {
      success: true,
      message: 'النظام متصل بخادم المعالجة المحلي المدمج.',
    };
  }

  try {
    const cleanUrl = urlToTest.replace(/\/+$/, '');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${cleanUrl}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (res.ok) {
      return {
        success: true,
        message: 'تم الاتصال بخادم الواتساب السحابي بنجاح!',
      };
    }

    return {
      success: false,
      message: `الخادم استجاب بالرمز (${res.status}). يرجى التأكد من تشغيل خادم Node.js.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.name === 'AbortError' ? 'انتهت مهلة الاتصال بالخادم.' : `تعذر الوصول للخادم: ${err?.message || ''}`,
    };
  }
}
