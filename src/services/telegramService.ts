/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CompleteSystemSettings, getSystemSettings, TelegramGatewayConfig } from './settings';

export interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
}

export interface TelegramSendResult {
  success: boolean;
  messageId?: number;
  status: string;
  error?: string;
}

export interface TelegramUpdateItem {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    chat: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      type: string;
    };
    date: number;
    text?: string;
  };
}

/**
 * فحص الاتصال بالبوت والتحقق من صحة التوكن عبر خادم النظام أو Telegram Bot API
 */
export async function getTelegramBotInfo(botToken: string): Promise<{
  success: boolean;
  bot?: TelegramBotInfo;
  error?: string;
}> {
  const cleanToken = botToken.trim();
  if (!cleanToken) {
    return { success: false, error: 'لم يتم إدخال رمز التوكن (Bot Token) لبوت التيليجرام.' };
  }

  // 1. المحاولة عبر خادم التطبيق الداخلي (لتفادي مشاكل CORS والشبكة)
  try {
    const proxyRes = await fetch('/api/telegram/get-me', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken: cleanToken }),
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data.ok && data.result) {
        return {
          success: true,
          bot: data.result as TelegramBotInfo,
        };
      }
      if (data.error) {
        return {
          success: false,
          error: data.error,
        };
      }
    }
  } catch (proxyErr) {
    console.warn('[TELEGRAM PROXY GET_ME FALLBACK]', proxyErr);
  }

  // 2. المحاولة المباشرة في حال تعذر الخادم المحلي
  try {
    const response = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`, {
      method: 'GET',
    });

    const data = await response.json();

    if (data.ok && data.result) {
      return {
        success: true,
        bot: data.result as TelegramBotInfo,
      };
    } else {
      return {
        success: false,
        error: data.description || 'فشل التحقق من توكن التيليجرام، يرجى التأكد من الرمز المدخل.',
      };
    }
  } catch (err: any) {
    console.error('خطأ في الاتصال بخوادم Telegram API:', err);
    return {
      success: false,
      error: `تعذر الوصول لخادم Telegram: ${err?.message || 'خطأ في الشبكة'}. تأكد من صحة التوكن وأن خادم النظام يعمل.`,
    };
  }
}

/**
 * إرسال رسالة مباشرة إلى محادثة تيليجرام عبر البوت
 */
export async function sendTelegramMessage(params: {
  botToken: string;
  chatId: string | number;
  text: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
}): Promise<TelegramSendResult> {
  const cleanToken = params.botToken.trim();
  const cleanChatId = String(params.chatId).trim();

  if (!cleanToken) {
    return { success: false, status: 'NO_TOKEN', error: 'لم يتم تزويد توكن البوت.' };
  }

  if (!cleanChatId) {
    return { success: false, status: 'NO_CHAT_ID', error: 'لم يتم تزويد معرف المحادثة (Chat ID).' };
  }

  // 1. الإرسال عبر خادم التطبيق الداخلي أولاً
  try {
    const proxyRes = await fetch('/api/telegram/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        botToken: cleanToken,
        chatId: cleanChatId,
        text: params.text,
        parseMode: params.parseMode || 'HTML',
      }),
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data.ok && data.result) {
        return {
          success: true,
          messageId: data.result.message_id || data.messageId,
          status: 'DELIVERED',
        };
      }
      if (data.error) {
        return {
          success: false,
          status: 'API_ERROR',
          error: data.error,
        };
      }
    }
  } catch (proxyErr) {
    console.warn('[TELEGRAM PROXY SEND FALLBACK]', proxyErr);
  }

  // 2. المحاولة المباشرة في حال عدم استجابة الخادم
  try {
    const response = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: params.text,
        parse_mode: params.parseMode || 'HTML',
      }),
    });

    const data = await response.json();

    if (data.ok && data.result) {
      return {
        success: true,
        messageId: data.result.message_id,
        status: 'DELIVERED',
      };
    } else {
      return {
        success: false,
        status: 'API_ERROR',
        error: data.description || 'رفض التيليجرام تسليم الرسالة.',
      };
    }
  } catch (err: any) {
    console.error('خطأ أثناء إرسال رسالة التيليجرام:', err);
    return {
      success: false,
      status: 'NETWORK_ERROR',
      error: err?.message || 'خطأ في الاتصال بالشبكة.',
    };
  }
}

/**
 * جلب آخر الرسائل والمستخدمين الذين تفاعلوا مع البوت (لمعرفة ومعاينة الـ Chat ID بسهولة)
 */
export async function getRecentTelegramUpdates(botToken: string): Promise<{
  success: boolean;
  updates: TelegramUpdateItem[];
  error?: string;
}> {
  const cleanToken = botToken.trim();
  if (!cleanToken) return { success: false, updates: [], error: 'التوكن مفقود' };

  // 1. عبر خادم التطبيق
  try {
    const proxyRes = await fetch('/api/telegram/get-updates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken: cleanToken, limit: 20 }),
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data.ok && Array.isArray(data.result)) {
        return {
          success: true,
          updates: data.result,
        };
      }
    }
  } catch (proxyErr) {
    console.warn('[TELEGRAM PROXY UPDATES FALLBACK]', proxyErr);
  }

  // 2. المحاولة المباشرة
  try {
    const response = await fetch(`https://api.telegram.org/bot${cleanToken}/getUpdates?limit=20`, {
      method: 'GET',
    });
    const data = await response.json();

    if (data.ok && Array.isArray(data.result)) {
      return {
        success: true,
        updates: data.result,
      };
    }
    return {
      success: false,
      updates: [],
      error: data.description || 'تعذر جلب التحديثات.',
    };
  } catch (err: any) {
    return {
      success: false,
      updates: [],
      error: err?.message || 'خطأ في الاتصال.',
    };
  }
}

/**
 * إرسال رمز OTP لاستعادة كلمة المرور عبر التيليجرام
 */
export async function sendPasswordResetOtpViaTelegram(params: {
  botToken?: string;
  chatId?: string | number;
  userFullName: string;
  otpCode: string;
  expiresMinutes?: number;
  facilityName?: string;
}): Promise<TelegramSendResult> {
  const settings = await getSystemSettings().catch(() => null);
  const telegramConfig = settings?.telegramGateway;

  const botToken = params.botToken || telegramConfig?.botToken || '';
  const chatId = params.chatId || telegramConfig?.adminChatId || '';

  if (!botToken) {
    return {
      success: false,
      status: 'TELEGRAM_NOT_CONFIGURED',
      error: 'لم يتم تكوين توكن بوت التيليجرام في إعدادات النظام بعد.',
    };
  }

  if (!chatId) {
    return {
      success: false,
      status: 'NO_CHAT_ID',
      error: 'لم يتم ربط حساب المستخدم بمعرف محادثة التيليجرام (Chat ID).',
    };
  }

  const facility = params.facilityName || settings?.facility?.nameAr || 'مؤسسة عماد سعد آل سعيد لمواد البناء (عمادكو)';
  const minutes = params.expiresMinutes || 15;

  const messageHtml = `
<b>🛡️ ${facility}</b>
<b>🔐 رمز التحقق المؤقت لاستعادة الرقم السري (OTP)</b>
━━━━━━━━━━━━━━━━━━━━━
مرحباً بك: <b>${params.userFullName}</b>

رمز الأمان الخاص بك هو:
<code>${params.otpCode}</code>

⏱️ الرمز صالح لمدة <b>${minutes} دقيقة</b> فقط.
⚠️ <i>تنبيه أمني صارم:</i> لا تشارك هذا الرمز مع أي شخص. موظفو الدعم الفني وإدارة النظام لن يطلبوا هذا الرمز منك إطلاقاً.
━━━━━━━━━━━━━━━━━━━━━
نظام الأمان والحماية - عمادكو
`.trim();

  return await sendTelegramMessage({
    botToken,
    chatId,
    text: messageHtml,
    parseMode: 'HTML',
  });
}

/**
 * اختبار شامل لإعدادات بوت التيليجرام مع إرسال رسالة تجريبية
 */
export async function testTelegramGateway(
  config: TelegramGatewayConfig,
  targetChatId?: string
): Promise<{
  success: boolean;
  message: string;
  botInfo?: TelegramBotInfo;
}> {
  if (!config.botToken || !config.botToken.trim()) {
    return {
      success: false,
      message: 'يرجى إدخال رمز التوكن (Bot Token) من @BotFather أولاً.',
    };
  }

  // 1. فحص التوكن وجلب بيانات البوت
  const botRes = await getTelegramBotInfo(config.botToken);
  if (!botRes.success || !botRes.bot) {
    return {
      success: false,
      message: `فشل التحقق من البوت: ${botRes.error || 'توكن غير صالح'}`,
    };
  }

  const destinationChat = (targetChatId || config.adminChatId || '').trim();

  // 2. إذا تم تحديد Chat ID نرسل رسالة اختبار
  if (destinationChat) {
    const testMsg = `
<b>✅ نجاح اختبار اتصال بوت التيليجرام</b>
━━━━━━━━━━━━━━━━━━━━━
🏢 المنشأة: <b>مؤسسة عماد سعد آل سعيد لمواد البناء (عمادكو)</b>
🤖 البوت: <b>@${botRes.bot.username || botRes.bot.first_name}</b>
⏰ التوقيت: <code>${new Date().toLocaleString('ar-SA')}</code>

🚀 نظام إرسال رموز التحقق OTP وإشعارات الأمان جاهز للعمل بشكل مثالي.
`.trim();

    const sendRes = await sendTelegramMessage({
      botToken: config.botToken,
      chatId: destinationChat,
      text: testMsg,
      parseMode: 'HTML',
    });

    if (!sendRes.success) {
      return {
        success: false,
        message: `تم التحقق من البوت بنجاح (@${botRes.bot.username})، ولكن تعذر إرسال رسالة الاختبار للـ Chat ID (${destinationChat}): ${sendRes.error}`,
        botInfo: botRes.bot,
      };
    }

    return {
      success: true,
      message: `تم التحقق من البوت (@${botRes.bot.username}) وإرسال رسالة الاختبار بنجاح إلى المعرف (${destinationChat})!`,
      botInfo: botRes.bot,
    };
  }

  return {
    success: true,
    message: `تم التحقق من صحة البوت بنجاح: @${botRes.bot.username} (${botRes.bot.first_name}). يمكنك الآن ربط المحادثات واستقبال رموز التحقق.`,
    botInfo: botRes.bot,
  };
}
