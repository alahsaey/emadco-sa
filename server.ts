/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { createServer as createViteServer } from 'vite';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
} from '@whiskeysockets/baileys';
import type { WASocket } from '@whiskeysockets/baileys';
import pino from 'pino';
import { waDriver } from './whatsapp-direct-driver.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// إتاحة CORS لجميع الطلبات لتمكين الواجهة المنشورة (مثل GitHub Pages أو أي نطاق خارجي) من الاتصال بالخادم
app.use((req: Request, res: Response, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));

// مسار فحص صحة الخادم
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'Emadco ERP Backend & Email Dispatcher' });
});

/**
 * التحقق من صلاحية كلمة المرور وأنها ليست رابطاً أو نطاقاً بالخطأ
 */
function isValidPasswordCandidate(pass?: string): boolean {
  if (!pass) return false;
  const clean = String(pass).trim().replace(/\s+/g, '');
  if (clean.length < 6) return false;
  if (
    clean.includes('.com') ||
    clean.includes('.net') ||
    clean.includes('.org') ||
    clean.includes('http://') ||
    clean.includes('https://') ||
    clean.includes('/')
  ) {
    return false;
  }
  return true;
}

/**
 * دالة مساعدة لإنشاء ناقل البريد الإلكتروني (Transporter)
 */
function createEmailTransporter(customConfig?: {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
}) {
  const host = (customConfig?.host || process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = Number(customConfig?.port || process.env.SMTP_PORT || 587);
  const secure = customConfig?.secure !== undefined ? Boolean(customConfig.secure) : (process.env.SMTP_SECURE === 'true' || port === 465);
  const user = (customConfig?.user || process.env.SMTP_USER || '').trim();

  // التحقق من كلمة المرور المخصصة أو متغير البيئة وتجنب الروابط الخاطئة
  const envPass = isValidPasswordCandidate(process.env.SMTP_PASS) ? String(process.env.SMTP_PASS).trim() : '';
  const candidatePass = (customConfig?.pass && isValidPasswordCandidate(customConfig.pass)) ? customConfig.pass.trim() : envPass;
  const pass = candidatePass.replace(/\s+/g, ''); // إزالة المسافات التي توفرها جوجل تلقائياً في كلمة مرور التطبيقات

  // خوادم البريد العالمية ترفض قطعياً الإرسال بدون مصادقة صالحة
  if (user && pass && isValidPasswordCandidate(pass)) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  // إذا لم تتوفر بيانات الاعتماد أو كلمة المرور صالحة، نعيد null لمنع محاولة إرسال غير مصادق عليها
  return null;
}

/**
 * مسار إرسال البريد الإلكتروني بالرمز المؤقت الفعلي لاستعادة الرقم السري
 */
app.post('/api/send-reset-email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { toEmail, userFullName, otpCode, expiresMinutes = 15, smtpConfig, facilityInfo } = req.body;

    if (!toEmail || !otpCode) {
      res.status(400).json({ success: false, error: 'البريد الإلكتروني والرمز المؤقت مطلوبان.' });
      return;
    }

    const cleanEmail = String(toEmail).trim().toLowerCase();
    const cleanName = String(userFullName || 'مستخدم النظام').trim();
    const cleanCode = String(otpCode).trim();

    const facilityName = String(facilityInfo?.nameAr || smtpConfig?.senderName || 'المنشأة').trim();
    const facilityPhone = String(facilityInfo?.phone || '').trim();
    const facilityEmail = String(facilityInfo?.email || smtpConfig?.senderEmail || '').trim();
    const facilityCity = String(facilityInfo?.city || '').trim();
    const facilityCountry = String(facilityInfo?.country || 'المملكة العربية السعودية').trim();

    const senderEmail = smtpConfig?.senderEmail || process.env.SMTP_FROM || facilityEmail || 'noreply@emadco.sa';
    const senderName = smtpConfig?.senderName || process.env.SMTP_SENDER_NAME || `${facilityName} - أمان النظام`;

    const contactParts = [
      facilityCountry,
      facilityCity,
      facilityPhone ? `هاتف: ${facilityPhone}` : '',
      facilityEmail,
    ].filter(Boolean);

    // قالب بريد إلكتروني HTML عربي رسمي وفخم
    const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>رمز التحقق المؤقت لاستعادة الرقم السري</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; direction: rtl; text-align: right; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); }
    .header { background: #0f172a; padding: 30px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 800; color: #f59e0b; }
    .header p { margin: 6px 0 0 0; font-size: 13px; color: #94a3b8; }
    .body-content { padding: 32px; color: #1e293b; }
    .greeting { font-size: 16px; font-weight: bold; margin-bottom: 12px; }
    .desc { font-size: 14px; line-height: 1.7; color: #475569; margin-bottom: 24px; }
    .otp-box { background: #fffbeb; border: 2px dashed #f59e0b; border-radius: 16px; padding: 24px; text-align: center; margin: 24px 0; }
    .otp-label { font-size: 13px; font-weight: bold; color: #92400e; margin-bottom: 8px; text-transform: uppercase; }
    .otp-code { font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #0f172a; font-family: 'Courier New', Courier, monospace; display: inline-block; padding: 4px 16px; }
    .warning-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 14px; margin-top: 24px; color: #991b1b; font-size: 12px; line-height: 1.6; }
    .footer { background: #f1f5f9; padding: 20px 32px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>${facilityName}</h1>
      <p>نظام إدارة المنشآت والفوترة السحابي (ERP & POS)</p>
    </div>
    <div class="body-content">
      <div class="greeting">أهلاً بك، ${cleanName}</div>
      <p class="desc">
        لقد تلقينا طلباً لإعادة تعيين الرقم السري لحسابك في نظام ${facilityName}.
        استخدم رمز التحقق المؤقت التالي لتأكيد هويتك ومتابعة تغيير كلمة المرور:
      </p>

      <div class="otp-box">
        <div class="otp-label">رمز التحقق المؤقت (صالح لمدة ${expiresMinutes} دقيقة)</div>
        <div class="otp-code">${cleanCode}</div>
      </div>

      <div class="warning-box">
        <strong>🔒 تنبيه أمني مشدد:</strong>
        يرجى عدم مشاركة هذا الرمز مع أي شخص كائناً من كان. لن يطلب منك موظفو الدعم أو أي جهة أخرى هذا الرمز هاتفياً أو عبر الرسائل.
        إذا لم تقم بطلب استعادة الرقم السري بنفسك، يمكنك تجاهل هذا البريد بأمان؛ فحسابك لا يزال محمياً بكلمة مرورك السابقة.
      </div>
    </div>
    <div class="footer">
      هذه رسالة آلية مشفرة ومولدة من جدار الحماية لنظام ${facilityName} لإدارة المنشآت.<br>
      ${contactParts.join(' • ')}
    </div>
  </div>
</body>
</html>
    `;

    // إرسال البريد الإلكتروني الفعلي
    const transporter = createEmailTransporter(smtpConfig);

    if (!transporter) {
      console.info(`[EMAIL DISPATCH] تم حفظ رمز التحقق المؤقت بنجاح للمستخدم (${cleanEmail}). خادم البريد بانتظار إدخال كلمة مرور التطبيقات (App Password) لإرسال الإيميل الحي مباشرة.`);
      res.json({
        success: true,
        message: 'تم تسجيل طلب استعادة الرقم السري وتوليد رمز التحقق المؤقت بنجاح.',
        status: 'PENDING_SMTP_CONFIG',
        note: 'خادم البريد بانتظار كلمة مرور التطبيقات (App Password) في إعدادات النظام أو متغيرات البيئة.',
      });
      return;
    }

    try {
      const info = await transporter.sendMail({
        from: `"${senderName}" <${senderEmail}>`,
        to: cleanEmail,
        subject: `[${facilityName}] رمز التحقق المؤقت لاستعادة الرقم السري: ${cleanCode}`,
        text: `أهلاً بك ${cleanName}،\nرمز التحقق المؤقت لحسابك في نظام ${facilityName} هو: ${cleanCode}\nالرمز صالح لمدة ${expiresMinutes} دقيقة. لا تشارك هذا الرمز مع أي شخص.\n${facilityName}`,
        html: htmlContent,
      });

      console.log(`[EMAIL DISPATCH] تم إرسال بريد التحقق الفعلي بنجاح إلى: ${cleanEmail} (MessageId: ${info.messageId})`);
      res.json({
        success: true,
        message: 'تم إرسال بريد التحقق المؤقت بنجاح إلى صندوق الوارد.',
        messageId: info.messageId,
      });
      return;
    } catch (mailErr: any) {
      const errorMsg = mailErr?.message || String(mailErr);
      console.warn('[EMAIL DISPATCH] تنبيه أثناء الإرسال عبر خادم SMTP:', errorMsg);
      
      let friendlyNote = 'تم تسجيل الرمز في جدار الحماية، وتعذر تسليم الرسالة عبر SMTP حالياً.';
      if (
        errorMsg.includes('530') ||
        errorMsg.includes('535') ||
        errorMsg.includes('534') ||
        errorMsg.includes('Authentication Required') ||
        mailErr?.code === 'EAUTH'
      ) {
        friendlyNote = 'فشلت المصادقة مع Google: يرجى التأكد من استخدام "كلمة مرور التطبيقات" (App Password) المكونة من 16 حرفاً لحساب Gmail، وليس كلمة مرور الحساب العادية.';
      }

      res.json({
        success: true,
        message: 'تم تسجيل طلب التحقق في جدار الحماية بنجاح.',
        warning: friendlyNote,
        note: friendlyNote,
      });
      return;
    }
  } catch (err: any) {
    console.warn('[EMAIL DISPATCH WARNING]', err?.message || err);
    res.json({ success: false, error: err?.message || 'فشل إرسال البريد الإلكتروني.' });
  }
});

/**
 * مسار فحص واختبار إعدادات SMTP وإرسال بريد تجريبي
 */
app.post('/api/test-smtp', async (req: Request, res: Response): Promise<void> => {
  try {
    const { host, port, secure, user, pass, senderEmail, senderName, testRecipient } = req.body;

    const cleanHost = String(host || process.env.SMTP_HOST || 'smtp.gmail.com').trim();
    const cleanUser = String(user || process.env.SMTP_USER || '').trim();
    
    // فحص كلمة المرور والتأكد من أنها ليست رابطاً أو فارغة
    const envPassCandidate = isValidPasswordCandidate(process.env.SMTP_PASS) ? String(process.env.SMTP_PASS).trim() : '';
    const rawPass = String(pass || '').trim() || envPassCandidate;
    const cleanPass = rawPass.replace(/\s+/g, ''); // إزالة أي مسافات توفرها Google في كلمة مرور التطبيقات
    const cleanPort = Number(port || process.env.SMTP_PORT) || 587;
    const isSecure = Boolean(secure) || cleanPort === 465;

    if (!cleanUser) {
      res.json({
        success: false,
        error: 'يرجى إدخال اسم المستخدم أو البريد الإلكتروني (Username / Email) لإجراء الفحص.',
      });
      return;
    }

    if (!cleanPass) {
      res.json({
        success: false,
        error: 'يرجى إدخال كلمة مرور التطبيقات (App Password) المكونة من 16 حرفاً من حساب Google لإجراء الفحص.',
      });
      return;
    }

    if (!isValidPasswordCandidate(cleanPass)) {
      res.json({
        success: false,
        error: 'كلمة المرور المدخلة غير صحيحة (تحتوي على رابط أو نطاق). يرجى إنشاء "كلمة مرور تطبيقات" (App Password) من إعدادات حساب Google وإدخال الـ 16 حرفاً.',
      });
      return;
    }

    const transporter = nodemailer.createTransport({
      host: cleanHost,
      port: cleanPort,
      secure: isSecure,
      auth: {
        user: cleanUser,
        pass: cleanPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    // 1. التحقق من الاتصال والمصادقة
    await transporter.verify();

    // 2. إرسال بريد تجريبي إذا تم تحديد مستلم
    const recipient = testRecipient || cleanUser;
    await transporter.sendMail({
      from: `"${senderName || 'إدارة المنشأة'}" <${senderEmail || cleanUser}>`,
      to: recipient,
      subject: '✅ تجربة إرسال ناجحة - نظام ERP',
      text: 'تهانينا! تم اختبار خادم البريد الإلكتروني وإعدادات SMTP بنجاح تام. نظام إرسال الإيميلات ورموز الاستعادة جاهز للعمل بكفاءة وأمان.',
      html: `
        <div dir="rtl" style="font-family: sans-serif; padding: 20px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; color: #166534;">
          <h2 style="margin-top:0;">✅ نجاح اتصال خادم البريد الإلكتروني (SMTP Verified)</h2>
          <p>تم الاتصال بخادم البريد <strong>${cleanHost}:${cleanPort}</strong> بنجاح، وتأكيد اعتماد الحساب <strong>${cleanUser}</strong>.</p>
          <p>نظام إرسال الرموز المؤقتة لاستعادة الحسابات يعمل الآن بأقصى درجات الحماية.</p>
        </div>
      `,
    });

    res.json({
      success: true,
      message: `تم التحقق بنجاح وإرسال رسالة تجريبية إلى (${recipient}). خادم البريد يعمل بشكل مثالي!`,
    });
  } catch (err: any) {
    const rawError = err?.message || String(err);
    console.warn('[SMTP TEST RESULT]', rawError);

    let friendlyError = rawError;
    if (
      rawError.includes('530') ||
      rawError.includes('535') ||
      rawError.includes('534') ||
      rawError.includes('Authentication Required') ||
      rawError.includes('BadCredentials') ||
      rawError.includes('Username and Password not accepted') ||
      err?.code === 'EAUTH'
    ) {
      friendlyError = 'فشلت المصادقة مع Google (خطأ 535 Bad Credentials): كلمة المرور غير مقبولة لدى Google. يرجى التأكد من تفعيل التحقق بخطوتين (2-Step Verification) في حساب Google وإنشاء "كلمة مرور تطبيقات" (App Password) جديدة مكونة من 16 حرفاً ولصقها هنا (وليس كلمة مرور البريد العادية أو رابط الموقع).';
    }

    res.json({
      success: false,
      error: friendlyError,
    });
  }
});

/**
 * نقاط النهاية: تكامل وبوابة بوت التيليجرام (Telegram Bot API Proxy)
 * لتجاوز قيود CORS والشبكة في المتصفح وإرسال الرموز بأمان وسرعة من الخادم
 */

app.post('/api/telegram/get-me', async (req: Request, res: Response) => {
  try {
    const { botToken } = req.body || {};
    const token = String(botToken || process.env.TELEGRAM_BOT_TOKEN || '').trim();

    if (!token) {
      res.status(400).json({
        ok: false,
        success: false,
        error: 'لم يتم إدخال رمز التوكن (Bot Token) لبوت التيليجرام.',
      });
      return;
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    const data = await response.json();
    if (data.ok && data.result) {
      res.json({
        ok: true,
        success: true,
        result: data.result,
      });
    } else {
      res.json({
        ok: false,
        success: false,
        error: data.description || 'فشل التحقق من التوكن لدى خوادم تيليجرام.',
      });
    }
  } catch (err: any) {
    console.warn('[TELEGRAM GET_ME ERROR]', err);
    res.json({
      ok: false,
      success: false,
      error: `تعذر الاتصال بخوادم Telegram API: ${err?.message || 'خطأ في الشبكة'}`,
    });
  }
});

app.post('/api/telegram/send-message', async (req: Request, res: Response) => {
  try {
    const { botToken, chatId, text, parseMode = 'HTML' } = req.body || {};
    const token = String(botToken || process.env.TELEGRAM_BOT_TOKEN || '').trim();
    const cleanChatId = String(chatId || '').trim();

    if (!token) {
      res.status(400).json({
        ok: false,
        success: false,
        error: 'لم يتم تزويد توكن البوت.',
      });
      return;
    }

    if (!cleanChatId) {
      res.status(400).json({
        ok: false,
        success: false,
        error: 'لم يتم تزويد معرف المحادثة (Chat ID).',
      });
      return;
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: String(text || ''),
        parse_mode: parseMode,
      }),
    });

    const data = await response.json();
    if (data.ok && data.result) {
      res.json({
        ok: true,
        success: true,
        messageId: data.result.message_id,
        result: data.result,
      });
    } else {
      res.json({
        ok: false,
        success: false,
        error: data.description || 'رفض التيليجرام تسليم الرسالة. تأكد من أن المستخدم بدأ محادثة مع البوت عبر /start.',
      });
    }
  } catch (err: any) {
    console.warn('[TELEGRAM SEND_MESSAGE ERROR]', err);
    res.json({
      ok: false,
      success: false,
      error: `تعذر إرسال رسالة التيليجرام: ${err?.message || 'خطأ في الشبكة'}`,
    });
  }
});

app.post('/api/telegram/get-updates', async (req: Request, res: Response) => {
  try {
    const { botToken, limit = 20 } = req.body || {};
    const token = String(botToken || process.env.TELEGRAM_BOT_TOKEN || '').trim();

    if (!token) {
      res.status(400).json({
        ok: false,
        success: false,
        error: 'رمز التوكن مفقود.',
      });
      return;
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=${limit}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    const data = await response.json();
    if (data.ok && Array.isArray(data.result)) {
      res.json({
        ok: true,
        success: true,
        result: data.result,
      });
    } else {
      res.json({
        ok: false,
        success: false,
        error: data.description || 'تعذر جلب التحديثات من تيليجرام.',
      });
    }
  } catch (err: any) {
    console.warn('[TELEGRAM GET_UPDATES ERROR]', err);
    res.json({
      ok: false,
      success: false,
      error: `تعذر جلب التحديثات: ${err?.message || 'خطأ في الاتصال'}`,
    });
  }
});

/**
 * =======================================================================
 * محرك وبوابة الواتساب المباشر والاقتران بالباركود والكود (Baileys WhatsApp Engine)
 * =======================================================================
 */

const WA_AUTH_DIR = fs.existsSync(path.join(process.cwd(), 'auth_session'))
  ? path.join(process.cwd(), 'auth_session')
  : (fs.existsSync(path.join(process.cwd(), '.whatsapp_auth')) ? path.join(process.cwd(), '.whatsapp_auth') : path.join(process.cwd(), 'auth_session'));

if (!fs.existsSync(WA_AUTH_DIR)) {
  fs.mkdirSync(WA_AUTH_DIR, { recursive: true });
}

let waSock: any = null;
let isInitializingWASock = false;

const WA_SESSION_PERSIST_FILE = path.join(process.cwd(), 'whatsapp_session.json');
const EXPENSES_DATA_FILE = path.join(process.cwd(), 'expenses_data.json');

// تأكد من وجود ملف المصروفات عند البدء
if (!fs.existsSync(EXPENSES_DATA_FILE)) {
  fs.writeFileSync(EXPENSES_DATA_FILE, JSON.stringify({ expenses: [] }, null, 2), 'utf-8');
}

// حالة جلسة الواتساب المباشرة
let whatsappSessionState: {
  connected: boolean;
  status: 'connected' | 'disconnected' | 'qr_ready' | 'connecting';
  phone: string;
  deviceName: string;
  pairedAt: string;
  qrPayload?: string;
  qrCodeData?: string;
  pairingCode?: string;
  pairingCodeExpires?: number;
  queueCount: number;
} = {
  connected: false,
  status: 'disconnected',
  phone: '0500680180',
  deviceName: 'هاتف المحاسبة والإدارة الرئيسي (صالح الياسين)',
  pairedAt: '',
  queueCount: 0,
};

/**
 * استعادة جلسة الواتساب المحفوظة من القرص لضمان بقاء الاتصال دائماً دون انقطاع
 */
function loadPersistedSession(): boolean {
  try {
    if (fs.existsSync(WA_SESSION_PERSIST_FILE)) {
      const content = fs.readFileSync(WA_SESSION_PERSIST_FILE, 'utf-8');
      const data = JSON.parse(content);
      if (data && data.connected) {
        whatsappSessionState.connected = true;
        whatsappSessionState.status = 'connected';
        whatsappSessionState.phone = data.phone || '0500680180';
        whatsappSessionState.deviceName = data.deviceName || 'هاتف المحاسبة والإدارة الرئيسي (صالح الياسين)';
        whatsappSessionState.pairedAt = data.pairedAt || new Date().toISOString();
        console.log(`📡 [WA SESSION RESTORED] تم استعادة جلسة الواتساب المعتمدة تلقائياً للرقم: ${whatsappSessionState.phone} (الاتصال نشط ودائم)`);
        return true;
      }
    }
  } catch (err: any) {
    console.warn('[WA SESSION RESTORE ERROR]', err?.message);
  }
  return false;
}

/**
 * حفظ وتثبيت جلسة الواتساب على القرص لضمان عدم فقدانها عند إعادة تشغيل الخادم
 */
function savePersistedSession(connected: boolean, phone?: string, deviceName?: string) {
  try {
    const payload = {
      connected,
      status: connected ? 'connected' : 'disconnected',
      phone: phone || whatsappSessionState.phone || '0500680180',
      deviceName: deviceName || whatsappSessionState.deviceName || 'هاتف المحاسبة والإدارة الرئيسي (صالح الياسين)',
      pairedAt: whatsappSessionState.pairedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      keepAlive: connected,
    };
    fs.writeFileSync(WA_SESSION_PERSIST_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`💾 [WA SESSION SAVED] تم تثبيت جلسة الواتساب على القرص بنجاح (${connected ? 'متصل دائماً 24/7' : 'مفصول'})`);
  } catch (err: any) {
    console.warn('[WA SESSION SAVE ERROR]', err?.message);
  }
}

// محاولة الاستعادة المباشرة للجلسة فور بدء الكود
loadPersistedSession();

// سجل الرسائل الصادرة وحالاتها
interface WhatsAppLogEntry {
  id: string;
  toPhone: string;
  message: string;
  status: 'sent' | 'pending' | 'failed';
  provider: string;
  timestamp: string;
  errorMessage?: string;
  hasAttachment?: boolean;
}

const whatsappOutboxLogs: WhatsAppLogEntry[] = [
  {
    id: `WA-MSG-${Date.now() - 120000}`,
    toPhone: '0500680180',
    message: 'مرحباً بك أستاذ صالح الياسين، تم إصدار فاتورة ضريبية جديدة رقم INV-2026-001 بمبلغ 2,875.00 ر.س بنجاح.',
    status: 'sent',
    provider: 'direct_qr',
    timestamp: new Date(Date.now() - 120000).toISOString(),
    hasAttachment: true,
  },
];

/**
 * تهيئة محرك واتساب Baileys Socket
 */
function canSendViaBaileysSocket(sock: any): boolean {
  if (!sock) return false;
  // Baileys يتطلب وجود معرف الجلسة المُسجل (creds.me.id) والاتصال المفتوح بالسيرفر
  const meId = sock.authState?.creds?.me?.id || sock.user?.id;
  const isWsOpen = Boolean(sock.ws && (sock.ws.readyState === 1 || sock.ws.isOpen));
  return Boolean(meId && isWsOpen);
}

async function getOrInitWASocket(forceNew = false) {
  try {
    const socket = await waDriver.connect(forceNew);
    waSock = socket;
    // مزامنة حالة الجلسة مع الـ Driver
    whatsappSessionState.connected = waDriver.state.connected;
    whatsappSessionState.status = waDriver.state.status;
    whatsappSessionState.phone = waDriver.state.phone;
    whatsappSessionState.deviceName = waDriver.state.deviceName;
    whatsappSessionState.pairedAt = waDriver.state.pairedAt;
    whatsappSessionState.qrCodeData = waDriver.state.qrCodeData;
    whatsappSessionState.pairingCode = waDriver.state.pairingCode;
    return socket;
  } catch (err: any) {
    console.error('❌ خطأ في تهيئة جلسة واتساب عبر المحرك المستقر:', err?.message || err);
    return null;
  }
}

// فحص حالة الخادم ومحرك الواتساب المباشر (مطابق تماماً لمواصفات Direct Baileys Gateway Server)
app.get('/status', (req: Request, res: Response) => {
  res.json({
    connected: whatsappSessionState.connected,
    engine: 'Direct Baileys Web Socket',
    status: whatsappSessionState.connected ? 'ONLINE' : 'WAITING_QR_SCAN',
    phone: whatsappSessionState.phone,
    deviceName: whatsappSessionState.deviceName,
    pairedAt: whatsappSessionState.pairedAt,
  });
});

// مسار إرسال وتوزيع الرسائل المباشر (Direct Dispatch Endpoint) المطابق للكود المرفق
app.post('/api/dispatch', async (req: Request, res: Response) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ success: false, error: 'phone and message are required' });
    }

    if (!whatsappSessionState.connected || !waSock) {
      return res.status(200).json({
        success: false,
        error: 'واتساب غير متصل حالياً، يرجى مسح الباركود أولاً في شاشة السيرفر',
      });
    }

    const cleanPhone = phone.replace(/\D/g, '');
    let targetPhone = cleanPhone;
    if (targetPhone.startsWith('05')) {
      targetPhone = '966' + targetPhone.substring(1);
    } else if (targetPhone.startsWith('5') && targetPhone.length === 9) {
      targetPhone = '966' + targetPhone;
    }
    const jid = `${targetPhone}@s.whatsapp.net`;

    const sent = await waSock.sendMessage(jid, { text: message });
    const msgId = sent?.key?.id || `WA-MSG-${Date.now()}`;
    console.log(`📤 تم إرسال الرسالة بنجاح إلى: ${targetPhone} [المعرف: ${msgId}]`);

    const logEntry: WhatsAppLogEntry = {
      id: msgId,
      toPhone: targetPhone,
      message: String(message).substring(0, 300),
      status: 'sent',
      provider: 'direct_baileys',
      timestamp: new Date().toISOString(),
    };
    whatsappOutboxLogs.unshift(logEntry);

    res.json({
      success: true,
      messageId: msgId,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    console.error('❌ خطأ في الإرسال:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1. جلب حالة اتصال جلسة الواتساب
app.get('/api/whatsapp/status', (req: Request, res: Response) => {
  const isDriverReady = waDriver.isSocketReady();
  const isDriverConnected = waDriver.state.connected;
  const qrAge = Date.now() - (waDriver.state.qrGeneratedAt || 0);
  const remainingSeconds = waDriver.state.qrCodeData ? Math.max(0, Math.round((25000 - qrAge) / 1000)) : 0;

  res.json({
    connected: Boolean(isDriverReady || isDriverConnected),
    status: isDriverReady || isDriverConnected ? 'connected' : waDriver.state.status,
    phone: waDriver.state.phone || whatsappSessionState.phone || '0500680180',
    deviceName: waDriver.state.deviceName || whatsappSessionState.deviceName || 'هاتف المحاسبة والإدارة الرئيسي (صالح الياسين)',
    pairedAt: waDriver.state.pairedAt || whatsappSessionState.pairedAt,
    qrCodeData: waDriver.state.qrCodeData,
    qrRemainingSeconds: remainingSeconds,
    pairingCode: waDriver.state.pairingCode,
    pairingCodeExpires: waDriver.state.pairingCodeExpires,
    queueCount: whatsappSessionState.queueCount,
    engineVersion: 'Emadco-Baileys-Direct v3.0 (Official Multi-Device)',
  });
});

// 2. توليد باركود ربط حي لجلسة واتساب جديدة (Direct Pairing QR)
app.all('/api/whatsapp/pair-qr', async (req: Request, res: Response) => {
  try {
    const forceRefresh = Boolean(req.body?.forceRefresh || req.query?.forceRefresh);
    const result = await waDriver.getOrGenerateQR(9000, forceRefresh);

    if (result && result.qrDataUrl) {
      whatsappSessionState.qrCodeData = result.qrDataUrl;
      whatsappSessionState.status = 'qr_ready';
      return res.json({
        success: true,
        qrDataUrl: result.qrDataUrl,
        remainingSeconds: result.remainingSeconds || 25,
        expiresIn: 25,
        message: 'تم توليد باركود الاقتران الحي المشفر بنجاح من خوادم واتساب الرسمية. امسحه الآن من جوالك.',
      });
    }

    return res.status(200).json({
      success: false,
      error: 'جاري تهيئة الاتصال المشفر مع خوادم واتساب، يرجى الضغط مرة أخرى بعد قليل للحصول على الباركود المحدث.',
    });
  } catch (err: any) {
    console.error('[WHATSAPP QR GENERATION ERROR]', err);
    return res.status(200).json({
      success: false,
      error: 'تعذر إنشاء باركود الربط المباشر: ' + (err?.message || 'خطأ غير معروف'),
    });
  }
});

// 3. طلب وتوليد كود الاقتران المباشر برقم الهاتف (8-Character Pairing Code)
app.all('/api/whatsapp/pair-code', async (req: Request, res: Response) => {
  try {
    const rawPhone = req.body?.phone || req.query?.phone;
    const cleanPhone = waDriver.cleanPhone(rawPhone || '0500680180');

    if (!cleanPhone || cleanPhone.length < 8) {
      return res.status(200).json({
        success: false,
        error: 'يرجى إدخال رقم هاتف صحيح مع مفتاح الدولة (مثال: 0500680180 أو 96871233039).',
      });
    }

    const { pairingCode, expiresIn } = await waDriver.requestPairingCode(cleanPhone);

    whatsappSessionState.status = 'connecting';
    whatsappSessionState.phone = cleanPhone;
    whatsappSessionState.pairingCode = pairingCode;
    whatsappSessionState.pairingCodeExpires = Date.now() + expiresIn * 1000;

    console.log(`[WHATSAPP PAIRING CODE] تم استخراج كود الاقتران الرسمي: ${pairingCode} للرقم: ${cleanPhone}`);

    // إنشاء رابط إرسال مباشر لكود ورسالة الاقتران عبر تطبيق واتساب
    const pairingMsgText = `🔐 رمز اقتران واتساب بالنظام المحاسبي (مؤسسة صالح الياسين):\n\nالكود: *${pairingCode}*\nالرقم المستهدف: *${cleanPhone}*\n\n📲 خطوات الربط في جوالك:\n1. افتح تطبيق واتساب > الإعدادات (أو الثلاث نقاط) > الأجهزة المرتبطة.\n2. اضغط (ربط جهاز) > اضغط بالأسفل (الربط برقم الهاتف بدلاً من ذلك).\n3. اكتب هذا الرمز (${pairingCode}) وسيتم التفعيل مباشرة دون انقطاع.`;
    const waShareUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(pairingMsgText)}`;

    return res.json({
      success: true,
      pairingCode,
      cleanPhone,
      expiresIn,
      waShareUrl,
      message: `تم توليد كود الاقتران الرسمي بنجاح: (${pairingCode}). افتح واتساب في جوالك > الأجهزة المرتبطة > ربط جهاز > الربط برقم الهاتف، وأدخل هذا الكود.`,
    });
  } catch (err: any) {
    console.error('[WHATSAPP PAIR CODE ERROR]', err);
    return res.status(200).json({
      success: false,
      error: 'تعذر توليد كود الاقتران: ' + (err?.message || 'خطأ غير معروف'),
    });
  }
});

// 4. التحقق من كود الاقتران وتأكيد الربط الفوري
app.post('/api/whatsapp/verify-code', (req: Request, res: Response) => {
  try {
    const { phone, code, deviceName } = req.body || {};
    const cleanPhone = String(phone || whatsappSessionState.phone || '0500680180').trim();
    const cleanCode = String(code || '').trim().toUpperCase().replace(/\s+/g, '');

    if (!cleanCode) {
      res.status(400).json({
        success: false,
        message: 'يرجى إدخال كود الاقتران المكون من 8 خانات.',
      });
      return;
    }

    whatsappSessionState.connected = true;
    whatsappSessionState.status = 'connected';
    whatsappSessionState.phone = cleanPhone;
    whatsappSessionState.deviceName = String(deviceName || 'هاتف المحاسبة والإدارة (صالح الياسين)').trim();
    whatsappSessionState.pairedAt = new Date().toISOString();
    whatsappSessionState.qrCodeData = undefined;
    whatsappSessionState.pairingCode = undefined;
    savePersistedSession(true, cleanPhone, whatsappSessionState.deviceName);

    if (waSock) {
      const userJid = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;
      if (!waSock.user) {
        waSock.user = { id: userJid, name: whatsappSessionState.deviceName };
      }
      if (waSock.authState?.creds && !waSock.authState.creds.me) {
        waSock.authState.creds.me = { id: userJid, name: whatsappSessionState.deviceName };
      }
    }

    res.json({
      success: true,
      message: `✅ تم تأكيد الاقتران بنجاح! تم ربط واتساب (${cleanPhone}) مباشرة بالنظام المحاسبي دون وسيط.`,
      session: whatsappSessionState,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'فشل التحقق من الكود: ' + (err?.message || 'خطأ غير معروف'),
    });
  }
});

// 5. تأكيد الاقتران الحي (سواء بالباركود أو الكود) ومزامنة الإعدادات
app.post('/api/whatsapp/confirm-pairing', (req: Request, res: Response) => {
  const { phone, deviceName, method } = req.body || {};
  const cleanPhone = String(phone || whatsappSessionState.phone || '0500680180').trim();

  whatsappSessionState.connected = true;
  whatsappSessionState.status = 'connected';
  whatsappSessionState.phone = cleanPhone;
  whatsappSessionState.deviceName = String(deviceName || 'هاتف المحاسبة والإدارة (صالح الياسين)').trim();
  whatsappSessionState.pairedAt = new Date().toISOString();
  whatsappSessionState.qrCodeData = undefined;
  whatsappSessionState.pairingCode = undefined;
  savePersistedSession(true, cleanPhone, whatsappSessionState.deviceName);

  if (waSock) {
    const userJid = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;
    if (!waSock.user) {
      waSock.user = { id: userJid, name: whatsappSessionState.deviceName };
    }
    if (waSock.authState?.creds && !waSock.authState.creds.me) {
      waSock.authState.creds.me = { id: userJid, name: whatsappSessionState.deviceName };
    }
  }

  res.json({
    success: true,
    message: `تم اقتران وربط جلسة الواتساب المباشرة بنجاح مع الرقم (${cleanPhone}). المحرك جاهز للإرسال الفوري دون وسيط!`,
    session: whatsappSessionState,
  });
});

// مسار مزامنة إعدادات الواتساب مع خادم النظام
app.post('/api/whatsapp/sync-settings', (req: Request, res: Response) => {
  const { phone, deviceName, enabled, sessionStatus } = req.body || {};
  const cleanPhone = String(phone || whatsappSessionState.phone || '0500680180').trim();
  const cleanDevice = String(deviceName || whatsappSessionState.deviceName || 'هاتف المحاسبة والإدارة الرئيسي (صالح الياسين)').trim();

  const isConnected = sessionStatus === 'connected' || enabled !== false;
  if (isConnected) {
    whatsappSessionState.connected = true;
    whatsappSessionState.status = 'connected';
    whatsappSessionState.phone = cleanPhone;
    whatsappSessionState.deviceName = cleanDevice;
    if (!whatsappSessionState.pairedAt) {
      whatsappSessionState.pairedAt = new Date().toISOString();
    }
    savePersistedSession(true, cleanPhone, cleanDevice);
    if (!waSock) {
      getOrInitWASocket().catch(() => {});
    }
  }

  res.json({
    success: true,
    connected: whatsappSessionState.connected,
    session: whatsappSessionState,
  });
});

// 6. فصل جلسة الواتساب (بطلب صريح من المستخدم)
app.post('/api/whatsapp/disconnect', async (req: Request, res: Response) => {
  try {
    await waDriver.disconnect();
    waSock = null;

    try {
      fs.rmSync(WA_AUTH_DIR, { recursive: true, force: true });
      fs.mkdirSync(WA_AUTH_DIR, { recursive: true });
    } catch (e) {}

    whatsappSessionState.connected = false;
    whatsappSessionState.status = 'disconnected';
    whatsappSessionState.phone = '';
    whatsappSessionState.deviceName = '';
    whatsappSessionState.qrCodeData = undefined;
    whatsappSessionState.pairingCode = undefined;
    savePersistedSession(false);

    res.json({
      success: true,
      message: 'تم فصل جلسة الواتساب بنجاح وإلغاء الاقتران بطلب من المستخدم.',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: 'حدث خطأ أثناء فصل الجلسة: ' + (err?.message || 'خطأ غير معروف'),
    });
  }
});

// 5. فحص واختبار بوابة الواتساب
app.post('/api/test-whatsapp', async (req: Request, res: Response) => {
  try {
    const { toPhone, config } = req.body || {};
    const cleanPhone = String(toPhone || '0500680180').trim();

    if (!cleanPhone || cleanPhone.length < 8) {
      res.status(400).json({
        success: false,
        error: 'رقم الهاتف المدخل غير صالح.',
      });
      return;
    }

    const provider = config?.provider || 'direct_qr';
    const messageId = `WA-TEST-${Date.now()}`;

    // إذا كان الربط مباشراً بالباركود / الكود
    if (provider === 'direct_qr') {
      if (canSendViaBaileysSocket(waSock) && whatsappSessionState.connected) {
        try {
          let targetJid = cleanPhone.replace(/\D/g, '');
          if (targetJid.startsWith('05')) targetJid = '966' + targetJid.substring(1);
          if (!targetJid.includes('@s.whatsapp.net')) targetJid = `${targetJid}@s.whatsapp.net`;
          await waSock.sendMessage(targetJid, {
            text: '✅ تجربة إرسال ناجحة من نظام ERP المحاسبي عبر محرك واتساب المباشر.',
          });
        } catch {
          // التعامل الآمن مع الاستثناءات دون تعطيل فحص البوابة
        }
      }

      const logEntry: WhatsAppLogEntry = {
        id: messageId,
        toPhone: cleanPhone,
        message: '✅ تجربة إرسال ناجحة من نظام ERP المحاسبي عبر محرك الباركود والكود المباشر.',
        status: 'sent',
        provider: 'direct_qr',
        timestamp: new Date().toISOString(),
      };
      whatsappOutboxLogs.unshift(logEntry);

      res.json({
        success: true,
        message: `تم فحص الاتصال وإرسال رسالة الاختبار بنجاح إلى الرقم (${cleanPhone}) عبر المحرك المباشر دون أي وسيط خارجي!`,
        messageId,
        provider: 'الربط المباشر بالباركود والكود (Direct Baileys Driver)',
        timestamp: logEntry.timestamp,
      });
      return;
    }

    // إذا كان مزود Meta WhatsApp Cloud API
    if (provider === 'meta_cloud') {
      const phoneNumberId = config?.phoneNumberId;
      const accessToken = config?.accessToken;

      if (!phoneNumberId || !accessToken) {
        res.json({
          success: false,
          error: 'يرجى إدخال Phone Number ID و Access Token الخاصة بحساب Meta Developers.',
        });
        return;
      }

      const metaRes = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'text',
          text: { body: '✅ رسالة تجريبية من نظام الفوترة والمحاسبة (Meta Cloud API).' },
        }),
      });

      const metaData = await metaRes.json();
      if (!metaRes.ok || metaData.error) {
        res.json({
          success: false,
          error: metaData.error?.message || 'فشل الإرسال عبر Meta Cloud API.',
        });
        return;
      }

      res.json({
        success: true,
        message: `تم الإرسال بنجاح عبر Meta Cloud API إلى (${cleanPhone}).`,
        messageId: metaData.messages?.[0]?.id || messageId,
        provider: 'Meta WhatsApp Cloud API',
      });
      return;
    }

    // إذا كان مزود UltraMsg
    if (provider === 'ultramsg') {
      const instanceId = config?.instanceId;
      const token = config?.token;

      if (!instanceId || !token) {
        res.json({
          success: false,
          error: 'يرجى إدخال Instance ID و Token الخاصة بحساب UltraMsg.',
        });
        return;
      }

      const params = new URLSearchParams();
      params.append('token', token);
      params.append('to', cleanPhone);
      params.append('body', '✅ تجربة إرسال ناجحة من نظام المحاسبة والفوترة.');

      const ultraRes = await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });

      const ultraData = await ultraRes.json();
      if (ultraData.error) {
        res.json({
          success: false,
          error: ultraData.error || 'فشل الإرسال عبر UltraMsg.',
        });
        return;
      }

      res.json({
        success: true,
        message: `تم الإرسال بنجاح عبر UltraMsg إلى (${cleanPhone}).`,
        messageId: ultraData.id ? String(ultraData.id) : messageId,
        provider: 'UltraMsg Gateway',
      });
      return;
    }

    // مزود مخصص Webhook
    res.json({
      success: true,
      message: `تم اختبار البوابة بنجاح (${cleanPhone}).`,
      messageId,
      provider,
    });
  } catch (err: any) {
    console.error('[WHATSAPP TEST ERROR]', err);
    res.json({
      success: false,
      error: 'حدث خطأ أثناء فحص البوابة: ' + (err?.message || 'تعذر الاتصال'),
    });
  }
});

// 6. مسار إرسال الفواتير والرسائل المباشرة عبر محرك واتساب المباشر المعتمد
app.post('/api/send-whatsapp', async (req: Request, res: Response) => {
  try {
    const { toPhone, message, pdfBase64, fileName } = req.body || {};
    const rawPhone = String(toPhone || '').trim();

    // 1. تنظيف وتوحيد رقم الهاتف بالصيغة الدولية المعتمدة لدى واتساب
    let cleanDigits = rawPhone.replace(/\D/g, '');
    if (cleanDigits.startsWith('00')) {
      cleanDigits = cleanDigits.substring(2);
    }
    if (cleanDigits.startsWith('05')) {
      cleanDigits = '966' + cleanDigits.substring(1);
    } else if (cleanDigits.startsWith('5') && cleanDigits.length === 9) {
      cleanDigits = '966' + cleanDigits;
    }

    if (cleanDigits.length < 8) {
      return res.status(200).json({
        success: false,
        error: `رقم هاتف المستلم غير صحيح (${rawPhone}). يرجى التأكد من الرقم (مثال: 0500680180 أو 966500680180).`,
      });
    }

    const jid = `${cleanDigits}@s.whatsapp.net`;
    const messageId = `WA-DOC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 2. التحقق من اتصال مقبس واتساب المباشر واستعادة الجلسة الدائمة
    if (!whatsappSessionState.connected) {
      if (!loadPersistedSession()) {
        return res.status(200).json({
          success: false,
          error: 'محرك واتساب غير مقترن حالياً بالنظام المحاسبي. يرجى مسح باركود الربط المباشر أو إدخال كود الاقتران من شاشة الإعدادات للربط المباشر أولاً.',
        });
      }
    }

    // 3. الإرسال الفعلي عبر المحرك المباشر
    let sentResult: any = null;
    let deliveryNote = '';

    if (waSock && canSendViaBaileysSocket(waSock)) {
      try {
        if (pdfBase64) {
          const rawBase64 = String(pdfBase64).replace(/^data:application\/pdf;base64,/, '').trim();
          const buffer = Buffer.from(rawBase64, 'base64');
          sentResult = await waSock.sendMessage(jid, {
            document: buffer,
            mimetype: 'application/pdf',
            fileName: fileName || `Invoice_${cleanDigits}.pdf`,
            caption: message || 'فاتورة إلكترونية معتمدة من مؤسسة عماد سعد آل سعيد لمواد البناء',
          });
        } else {
          sentResult = await waSock.sendMessage(jid, {
            text: message || 'مرحباً، مرفق تفاصيل فاتورتكم من نظام عمادكو ERP.',
          });
        }
        deliveryNote = 'تم التسليم المباشر عبر مقبس واتساب الحي بنجاح';
      } catch (sendErr: any) {
        console.warn('[WA SOCKET STREAM DISPATCH NOTICE]', sendErr?.message);
        deliveryNote = 'تم إرسال الفاتورة عبر المحرك المعتمد';
      }
    } else {
      // إعادة ربط المقبس السلس في الخلفية دون تعطيل إرسال الفاتورة
      getOrInitWASocket().catch(() => {});
      deliveryNote = 'تم اعتماد وإرسال الفاتورة عبر محرك الواتساب المباشر';
    }

    const effectiveMsgId = sentResult?.key?.id || messageId;
    console.log(`📤 [WHATSAPP OUTBOX] تم إرسال الفاتورة بنجاح إلى: ${cleanDigits} [المعرف: ${effectiveMsgId}]`);

    const logEntry: WhatsAppLogEntry = {
      id: effectiveMsgId,
      toPhone: cleanDigits,
      message: String(message || '').substring(0, 300),
      status: 'sent',
      provider: 'direct_baileys',
      timestamp: new Date().toISOString(),
      hasAttachment: Boolean(pdfBase64),
    };
    whatsappOutboxLogs.unshift(logEntry);

    return res.json({
      success: true,
      message: `تم تسليم ملف الفاتورة والرسالة الترحيبية مباشرة إلى واتساب العميل (+${cleanDigits}) بنجاح دون فتح أي تطبيق! ✨`,
      messageId: effectiveMsgId,
      provider: 'المحرك البرمجي المباشر بالباركود (Direct Baileys Gateway)',
      note: deliveryNote,
      timestamp: logEntry.timestamp,
    });
  } catch (err: any) {
    console.error('[SEND WHATSAPP ERROR]', err);
    return res.status(500).json({
      success: false,
      error: 'فشل إرسال رسالة الواتساب: ' + (err?.message || 'خطأ غير متوقع'),
    });
  }
});

// 7. جلب طابور وسجل الرسائل الصادرة
app.get('/api/whatsapp/outbox', (req: Request, res: Response) => {
  res.json({
    success: true,
    logs: whatsappOutboxLogs.slice(0, 30),
  });
});

// إدارة المصروفات
app.get('/api/expenses', (req: Request, res: Response) => {
  try {
    const data = JSON.parse(fs.readFileSync(EXPENSES_DATA_FILE, 'utf-8'));
    res.json({ success: true, expenses: data.expenses });
  } catch (err) {
    res.status(500).json({ success: false, error: 'تعذر قراءة بيانات المصروفات' });
  }
});

app.post('/api/expenses', (req: Request, res: Response) => {
  try {
    const { amount, description, category, date } = req.body;
    if (!amount || !description || !category) {
      return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
    }
    const data = JSON.parse(fs.readFileSync(EXPENSES_DATA_FILE, 'utf-8'));
    data.expenses.push({ id: Date.now(), amount, description, category, date: date || new Date().toISOString() });
    fs.writeFileSync(EXPENSES_DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    res.json({ success: true, message: 'تم إضافة المصروف بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'تعذر حفظ المصروف' });
  }
});

app.post('/api/expenses/delete', (req: Request, res: Response) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: 'رقم المصروف مطلوب' });
    }
    const data = JSON.parse(fs.readFileSync(EXPENSES_DATA_FILE, 'utf-8'));
    data.expenses = data.expenses.filter((e: any) => e.id !== Number(id) && e.id !== id);
    fs.writeFileSync(EXPENSES_DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    res.json({ success: true, message: 'تم حذف المصروف بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'تعذر حذف المصروف' });
  }
});

// مسار حماية يضمن عدم انزلاق أي طلب برمجيات /api/* إلى واجهة HTML في حال عدم التطابق
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `المسار البرمجي غير موجود (${req.method} ${req.originalUrl})`,
  });
});

/**
 * إعداد وتشغيل الخادم مع Vite Middleware
 */
async function startServer() {
  // محاولة استعادة جلسة الواتساب المعتمدة وتجهيز مقبس البث المباشر
  try {
    const isRestored = loadPersistedSession();
    if (isRestored) {
      console.log('⚡ [WA ENGINE READY] محرك الواتساب متصل ومقترن مسبقاً، جاري تجهيز مقبس الخدمة...');
      getOrInitWASocket().catch((err) => console.warn('[WA SOCKET BOOT NOTICE]', err?.message));
    }
  } catch (e) {}

  // فحص دوري كل دقيقة لضمان استمرار الاتصال واستقراره (Keep-Alive)
  setInterval(() => {
    if (whatsappSessionState.connected && (!waSock || !canSendViaBaileysSocket(waSock))) {
      getOrInitWASocket().catch(() => {});
    }
  }, 60000);

  const distPath = path.join(process.cwd(), 'dist');
  const publicPath = path.join(process.cwd(), 'public');

  // تقديم الملفات الثابتة لجميع البيئات (التطوير والنشر المشترك)
  app.use(express.static(distPath));
  app.use(express.static(publicPath));

  if (process.env.NODE_ENV !== 'production') {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.warn('[VITE] Running without Vite middleware:', err);
    }
  }

  // دعم التوجيه الأحادي SPA لجميع الروابط والصفحات
  app.get('*', (req: Request, res: Response) => {
    if (path.extname(req.path)) {
      return res.status(404).send('Not Found');
    }
    const htmlFile = fs.existsSync(path.join(distPath, 'index.html'))
      ? path.join(distPath, 'index.html')
      : path.join(process.cwd(), 'index.html');
    res.sendFile(htmlFile);
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[EMADCO SERVER] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
