/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { User, PasswordResetRequest } from '../types';
import { logAuditEvent } from './audit';
import { sendResetOtpEmail } from './emailService';
import { getSystemSettings } from './settings';
import { sendPasswordResetOtpViaTelegram } from './telegramService';

const LOCAL_RESETS_KEY = 'emadco_password_resets_cache';

// تخزين محلي لطلبات الاستعادة لضمان العمل حتى في حال بطء الشبكة
function getCachedResets(): Record<string, PasswordResetRequest> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOCAL_RESETS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCachedReset(reset: PasswordResetRequest) {
  if (typeof window === 'undefined') return;
  try {
    const cache = getCachedResets();
    cache[reset.id] = reset;
    localStorage.setItem(LOCAL_RESETS_KEY, JSON.stringify(cache));
  } catch {}
}

/**
 * تنظيف ومطابقة رقم الجوال السعودي
 */
function normalizeSaudiPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('9665') && digits.length === 12) {
    return '0' + digits.substring(3);
  }
  if (digits.startsWith('5') && digits.length === 9) {
    return '0' + digits;
  }
  return digits;
}

/**
 * 1. توليد وإرسال الرمز المؤقت (OTP) إلى بريد وتيليجرام المستخدم عند نسيان الرقم السري
 */
export async function sendPasswordResetOTP(
  identifier: string,
  availableUsers: User[] = []
): Promise<{
  success: boolean;
  resetId: string;
  maskedEmail: string;
  maskedPhone?: string;
  expiresAt: string;
  userFullName: string;
  deliveredViaSmtp?: boolean;
  deliveryStatus?: string;
  deliveryWarning?: string;
  firebaseLinkSent?: boolean;
  telegramSent?: boolean;
  telegramStatus?: string;
  telegramBotUsername?: string;
  telegramDeepLink?: string;
}> {
  const cleanInput = identifier.trim();

  if (!cleanInput) {
    throw new Error('يرجى إدخال البريد الإلكتروني أو رقم الجوال المسجل في النظام.');
  }

  const isEmail = cleanInput.includes('@');
  const normalizedPhone = normalizeSaudiPhone(cleanInput);

  // البحث عن المستخدم أولاً في القائمة الحية
  let targetUser: User | undefined;

  if (isEmail) {
    const cleanEmail = cleanInput.toLowerCase();
    targetUser = availableUsers.find((u) => u.email.trim().toLowerCase() === cleanEmail);
  } else {
    targetUser = availableUsers.find(
      (u) => normalizeSaudiPhone(u.phone || '') === normalizedPhone
    );
  }

  // البحث في Firestore في حال عدم وجوده بالقائمة المحلية
  if (!targetUser) {
    try {
      const usersCol = collection(db, 'users');
      if (isEmail) {
        const snap = await getDocs(query(usersCol, where('email', '==', cleanInput.toLowerCase())));
        if (!snap.empty) {
          targetUser = { id: snap.docs[0].id, ...snap.docs[0].data() } as User;
        }
      } else {
        const snap = await getDocs(usersCol);
        for (const d of snap.docs) {
          const u = { id: d.id, ...d.data() } as User;
          if (normalizeSaudiPhone(u.phone || '') === normalizedPhone) {
            targetUser = u;
            break;
          }
        }
      }
    } catch (err) {
      console.warn('تعذر الاستعلام من السحابة:', err);
    }
  }

  if (!targetUser) {
    throw new Error(
      isEmail
        ? 'البريد الإلكتروني المدخل غير مسجل لأي مستخدم في نظام عمادكو.'
        : 'رقم الجوال المدخل غير مسجل لأي مستخدم في نظام عمادكو.'
    );
  }

  if (targetUser.isActive === false) {
    throw new Error('هذا الحساب موقوف حالياً من قبل الإدارة. يرجى التواصل مع مالك المنشأة.');
  }

  // توليد رمز تحقق عشوائي سداسي الأرقام
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const resetId = `reset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // صالح لمدة 15 دقيقة

  const resetData: PasswordResetRequest = {
    id: resetId,
    userId: targetUser.id,
    email: targetUser.email,
    userFullName: targetUser.fullName,
    code: otpCode,
    createdAt: new Date().toISOString(),
    expiresAt,
    isUsed: false,
    attempts: 0,
  };

  // حفظ في Firestore
  try {
    await setDoc(doc(db, 'password_resets', resetId), resetData);
  } catch (err) {
    console.warn('فشل حفظ طلب الاستعادة في Firestore، سيتم الاعتماد على الذاكرة المحلية الآمنة:', err);
  }

  // حفظ في التخزين المحلي الآمن
  saveCachedReset(resetData);

  // إخفاء جزء من البريد الإلكتروني للعرض الآمن
  const parts = targetUser.email.split('@');
  const namePart = parts[0];
  const domainPart = parts[1] || 'emadco.sa';
  const maskedEmail =
    namePart.length > 3
      ? `${namePart.substring(0, 2)}***${namePart.slice(-1)}@${domainPart}`
      : `${namePart.substring(0, 1)}***@${domainPart}`;

  // إخفاء جزء من رقم الجوال
  let maskedPhone = '';
  if (targetUser.phone) {
    const rawP = targetUser.phone.trim();
    if (rawP.length >= 7) {
      maskedPhone = `${rawP.substring(0, 3)}***${rawP.slice(-3)}`;
    } else {
      maskedPhone = rawP;
    }
  }

  // تسجيل حدث تدقيق أمني
  await logAuditEvent({
    userId: targetUser.id,
    userName: targetUser.fullName,
    action: 'SECURITY_ALERT',
    entity: 'users',
    entityId: targetUser.id,
    details: `طلب إعادة تعيين الرقم السري وإرسال رمز تحقق مؤقت للبريد (${targetUser.email}) والجوال (${targetUser.phone || 'غير محدد'})`,
  });

  const settings = await getSystemSettings().catch(() => null);

  // 1. إرسال رابط رسمي معتمد من Google Firebase Authentication مباشرة إلى بريد المستخدم
  let firebaseLinkSent = false;
  try {
    const currentOrigin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
    const actionCodeSettings = currentOrigin
      ? {
          url: `${currentOrigin}/?action=reset-password&email=${encodeURIComponent(targetUser.email)}`,
          handleCodeInApp: true,
        }
      : undefined;

    try {
      await sendPasswordResetEmail(auth, targetUser.email, actionCodeSettings);
      firebaseLinkSent = true;
    } catch {
      await sendPasswordResetEmail(auth, targetUser.email);
      firebaseLinkSent = true;
    }
  } catch (fbErr: any) {
    console.warn('تنبيه إرسال رابط Google Firebase:', fbErr?.message);
  }

  // 2. إرسال رسالة رمز الـ OTP عبر خادم SMTP المباشر إلى البريد
  let deliveredViaSmtp = false;
  let deliveryStatus = 'PENDING_SMTP_CONFIG';
  let deliveryWarning: string | undefined;

  try {
    const facility = settings?.facility;
    const smtpData = settings?.emailSmtp;
    const smtpConfig =
      smtpData && smtpData.user && smtpData.pass
        ? {
            host: smtpData.host || 'smtp.gmail.com',
            port: Number(smtpData.port) || 587,
            secure: Boolean(smtpData.secure),
            user: smtpData.user,
            pass: smtpData.pass,
            senderEmail: smtpData.senderEmail || smtpData.user || facility?.email || 'noreply@emadco.sa',
            senderName: smtpData.senderName || facility?.nameAr || 'إدارة المنشأة',
          }
        : undefined;

    const emailRes = await sendResetOtpEmail({
      toEmail: targetUser.email,
      userFullName: targetUser.fullName,
      otpCode,
      expiresMinutes: 15,
      smtpConfig,
      facilityInfo: facility
        ? {
            nameAr: facility.nameAr,
            phone: facility.phone,
            email: facility.email,
            city: facility.city,
            country: facility.country,
          }
        : undefined,
    });

    deliveredViaSmtp = Boolean(emailRes.deliveredViaSmtp);
    deliveryStatus = emailRes.deliveredViaSmtp ? 'DELIVERED_TO_INBOX' : (emailRes.status || 'PENDING_SMTP_CONFIG');
    deliveryWarning = emailRes.warning;
  } catch (emailErr) {
    console.warn('تعذر إرسال الإيميل المباشر، سيتم المتابعة:', emailErr);
  }

  // 3. إرسال رمز الـ OTP عبر بوت التيليجرام فوراً
  let telegramSent = false;
  let telegramStatus = 'NOT_SENT';
  let telegramBotUsername = settings?.telegramGateway?.botUsername || '';
  let telegramDeepLink = '';

  try {
    const telegramConfig = settings?.telegramGateway;
    if (telegramConfig && telegramConfig.enabled && telegramConfig.botToken) {
      if (telegramConfig.botUsername) {
        telegramBotUsername = telegramConfig.botUsername;
        telegramDeepLink = `https://t.me/${telegramConfig.botUsername}?start=otp_${resetId}`;
      }

      // معرف المحادثة (الخاص بالمستخدم أو الأدمن الافتراضي)
      const userChatId = targetUser.telegramChatId || telegramConfig.adminChatId;
      if (userChatId) {
        const tgRes = await sendPasswordResetOtpViaTelegram({
          botToken: telegramConfig.botToken,
          chatId: userChatId,
          userFullName: targetUser.fullName,
          otpCode,
          expiresMinutes: 15,
          facilityName: settings?.facility?.nameAr,
        });

        if (tgRes.success) {
          telegramSent = true;
          telegramStatus = 'DELIVERED';
        } else {
          telegramStatus = tgRes.status || 'FAILED';
        }
      } else {
        telegramStatus = 'READY_VIA_BOT_LINK';
      }
    }
  } catch (tgErr: any) {
    console.warn('تنبيه أثناء إرسال التيليجرام:', tgErr);
  }

  return {
    success: true,
    resetId,
    maskedEmail,
    maskedPhone,
    expiresAt,
    userFullName: targetUser.fullName,
    deliveredViaSmtp,
    deliveryStatus,
    deliveryWarning,
    firebaseLinkSent,
    telegramSent,
    telegramStatus,
    telegramBotUsername,
    telegramDeepLink,
  };
}

/**
 * 2. التحقق من مطابقة الرمز المؤقت وصلاحيته
 */
export async function verifyTemporaryCode(
  resetId: string,
  inputCode: string
): Promise<{
  valid: boolean;
  userId: string;
  email: string;
  userFullName: string;
}> {
  const cleanCode = inputCode.trim();

  if (!cleanCode) {
    throw new Error('يرجى إدخال الرمز المؤقت المكون من 6 أرقام.');
  }

  let resetData: PasswordResetRequest | null = null;

  // محاولة الجلب من Firestore
  try {
    const snap = await getDoc(doc(db, 'password_resets', resetId));
    if (snap.exists()) {
      resetData = snap.data() as PasswordResetRequest;
    }
  } catch (e) {
    console.warn('تعذر جلب رمز الاستعادة من السحابة:', e);
  }

  // استخدام الكاش المحلي كبديل سريع وموثوق
  if (!resetData) {
    resetData = getCachedResets()[resetId] || null;
  }

  if (!resetData) {
    throw new Error('جلسة التحقق غير صالحة أو منتهية، يرجى طلب رمز جديد.');
  }

  if (resetData.isUsed) {
    throw new Error('تم استخدام هذا الرمز المؤقت مسبقاً. يرجى طلب رمز جديد.');
  }

  if (new Date().getTime() > new Date(resetData.expiresAt).getTime()) {
    throw new Error('انتهت صلاحية الرمز المؤقت (15 دقيقة). يرجى طلب رمز تحقق جديد.');
  }

  if (resetData.attempts >= 5) {
    throw new Error('تم تجاوز الحد الأقصى للمحاولات الخاطئة (5 محاولات). تم إبطال الرمز لحماية حسابك.');
  }

  // مطابقة الرمز المؤقت بدقة
  if (resetData.code.trim() !== cleanCode) {
    // زيادة عدد المحاولات الخاطئة
    resetData.attempts = (resetData.attempts || 0) + 1;
    saveCachedReset(resetData);
    try {
      await updateDoc(doc(db, 'password_resets', resetId), {
        attempts: resetData.attempts,
      });
    } catch {}

    const remaining = 5 - resetData.attempts;
    throw new Error(
      `الرقم المؤقت غير صحيح! يرجى التأكد من الرمز المرسل إلى بريدك الإلكتروني (المتبقي: ${remaining} محاولات).`
    );
  }

  return {
    valid: true,
    userId: resetData.userId,
    email: resetData.email,
    userFullName: resetData.userFullName,
  };
}

/**
 * 3. إكمال إعادة التعيين وتغيير الرقم السري إجبارياً بعد التأكيد
 */
export async function completePasswordResetAndChange(
  resetId: string,
  verifiedCode: string,
  newSecret: string
): Promise<{
  success: boolean;
  userId: string;
  newSecret: string;
}> {
  // مطابقة وإعادة فحص الرمز المؤقت بشكل صارم أثناء الدخول للتغيير
  const check = await verifyTemporaryCode(resetId, verifiedCode);

  const cleanSecret = newSecret.trim();
  if (!cleanSecret || cleanSecret.length < 4) {
    throw new Error('يجب ألا يقل الرقم السري أو كلمة المرور الجديدة عن 4 خانات على الأقل.');
  }

  const now = new Date().toISOString();

  // تحديث الحساب في Firestore بكلمة المرور والرقم السري الجديد
  try {
    const userRef = doc(db, 'users', check.userId);
    await updateDoc(userRef, {
      password: cleanSecret,
      pinCode: cleanSecret,
      updatedAt: now,
    });
  } catch (err) {
    console.warn('تحذير أثناء تحديث مستخدم في السحابة:', err);
  }

  // وسم طلب الاستعادة بأنه تم استخدامه وإبطاله
  try {
    await updateDoc(doc(db, 'password_resets', resetId), {
      isUsed: true,
      usedAt: now,
    });
  } catch {}

  const cache = getCachedResets();
  if (cache[resetId]) {
    cache[resetId].isUsed = true;
    localStorage.setItem(LOCAL_RESETS_KEY, JSON.stringify(cache));
  }

  // تسجيل حدث التدقيق الأمني
  await logAuditEvent({
    userId: check.userId,
    userName: check.userFullName,
    action: 'UPDATE',
    entity: 'users',
    entityId: check.userId,
    details: `تم تغيير وتعيين الرقم السري بنجاح بعد التحقق الإجباري من الرمز المؤقت المرسل للبريد (${check.email})`,
  });

  return {
    success: true,
    userId: check.userId,
    newSecret: cleanSecret,
  };
}
