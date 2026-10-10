/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  PaymentTerminalConfig,
  PaymentTransaction,
  TerminalPaymentRequest,
  TerminalPaymentResponse,
  TerminalProviderCode,
} from '../../types';
import { PaymentTerminalProvider } from './types';
import { MockTerminalAdapter } from './adapters/MockTerminalAdapter';
import { GeideaPosAdapter } from './adapters/GeideaPosAdapter';
import { NearPayAdapter } from './adapters/NearPayAdapter';
import { StandardEcrAdapter } from './adapters/StandardEcrAdapter';

// الإعدادات الافتراضية لجهاز نقاط البيع
export const DEFAULT_TERMINAL_CONFIG: PaymentTerminalConfig = {
  id: 'active_terminal_config',
  providerId: 'mock',
  providerName: 'محاكي جهاز نقاط البيع المعتمد (Mock POS)',
  terminalId: 'TID-MADA-8812',
  merchantId: 'MID-BUNYAN-9944',
  connectionType: 'local_network_ip',
  terminalIp: '192.168.1.180',
  port: 8080,
  environment: 'sandbox',
  timeoutSeconds: 60,
  isAutoSendEnabled: true,
  isSimulationMode: true,
  notes: 'جاهز للاستخدام الفوري ومحاكاة مبيعات شبكة مدى والبطاقات الائتمانية.',
  lastUpdated: new Date().toISOString(),
};

// مخزن الـ Adapters
let activeProviderInstance: PaymentTerminalProvider | null = null;
let currentMockInstance: MockTerminalAdapter | null = null;

/**
 * جلب إعدادات جهاز الدفع من قاعدة البيانات Firestore
 */
export async function getTerminalConfig(): Promise<PaymentTerminalConfig> {
  try {
    const configDocRef = doc(db, 'pos_integrations', 'active_terminal_config');
    const snap = await getDoc(configDocRef);
    if (snap.exists()) {
      return { ...DEFAULT_TERMINAL_CONFIG, ...(snap.data() as PaymentTerminalConfig) };
    }
  } catch (err) {
    console.warn('تعذر جلب إعدادات جهاز نقاط البيع، جاري استخدام الافتراضيات:', err);
  }
  return DEFAULT_TERMINAL_CONFIG;
}

/**
 * حفظ وتحديث إعدادات جهاز الدفع ونقاط البيع
 */
export async function saveTerminalConfig(
  newConfig: Partial<PaymentTerminalConfig>
): Promise<PaymentTerminalConfig> {
  const current = await getTerminalConfig();
  const merged: PaymentTerminalConfig = {
    ...current,
    ...newConfig,
    lastUpdated: new Date().toISOString(),
  };

  try {
    const configDocRef = doc(db, 'pos_integrations', 'active_terminal_config');
    await setDoc(configDocRef, merged);
  } catch (err) {
    console.error('فشل حفظ إعدادات جهاز نقاط البيع:', err);
    throw err;
  }

  // إعادة تهيئة المحول النشط بالإعدادات الجديدة
  activeProviderInstance = null;
  return merged;
}

/**
 * استدعاء أو إنشاء المزود النشط (Factory Pattern)
 */
export async function getActiveTerminalProvider(): Promise<PaymentTerminalProvider> {
  const config = await getTerminalConfig();

  if (activeProviderInstance && activeProviderInstance.code === config.providerId) {
    return activeProviderInstance;
  }

  let provider: PaymentTerminalProvider;

  switch (config.providerId) {
    case 'geidea':
      provider = new GeideaPosAdapter();
      break;
    case 'nearpay':
      provider = new NearPayAdapter();
      break;
    case 'standard_ecr':
      provider = new StandardEcrAdapter();
      break;
    case 'mock':
    default:
      if (!currentMockInstance) {
        currentMockInstance = new MockTerminalAdapter();
      }
      provider = currentMockInstance;
      break;
  }

  await provider.initialize(config);
  activeProviderInstance = provider;
  return provider;
}

/**
 * الوصول إلى كائن محاكي الـ Mock للتحكم بسيناريوهات الاختبار من الواجهة
 */
export function getMockTerminalAdapter(): MockTerminalAdapter {
  if (!currentMockInstance) {
    currentMockInstance = new MockTerminalAdapter();
  }
  return currentMockInstance;
}

/**
 * فحص منع التكرار (Idempotency Check)
 * للتأكد من عدم خصم المبلغ أو إرسال نفس العملية مرتين لنفس الفاتورة
 */
export async function checkPaymentIdempotency(
  idempotencyKey: string
): Promise<PaymentTransaction | null> {
  try {
    const q = query(
      collection(db, 'payment_transactions'),
      where('idempotencyKey', '==', idempotencyKey),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data() as PaymentTransaction;
    }
  } catch (err) {
    console.warn('تنبيه: تعذر فحص مفتاح منع التكرار:', err);
  }
  return null;
}

/**
 * تسجيل سجل محاولة الدفع في مجموعة payment_transactions
 */
export async function recordPaymentTransaction(
  txData: PaymentTransaction
): Promise<void> {
  try {
    const ref = doc(db, 'payment_transactions', txData.id);
    await setDoc(ref, txData);
  } catch (err) {
    console.warn('تنبيه: تعذر تسجيل معاملة الدفع في قاعدة البيانات:', err);
  }
}

/**
 * جلب أحدث سجلات عمليات الدفع عبر أجهزة نقاط البيع
 */
export async function fetchTerminalTransactions(
  limitCount = 25
): Promise<PaymentTransaction[]> {
  try {
    const q = query(
      collection(db, 'payment_transactions'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentTransaction));
  } catch (err) {
    console.warn('خطأ في جلب سجلات عمليات الدفع:', err);
    return [];
  }
}
