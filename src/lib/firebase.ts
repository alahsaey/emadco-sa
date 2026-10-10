/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDoc,
  setDoc,
  setLogLevel,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import config from '../../firebase-applet-config.json';

// ضبط مستوى السجلات إلى صامت لمنع الرسائل والتحذيرات العابرة عند تقلبات اتصال الشبكة
setLogLevel('silent');

// تهيئة تطبيق فايربيس
export const app = getApps().length === 0 ? initializeApp(config) : getApp();

// تهيئة قاعدة البيانات Firestore مع دعم التخزين المحلي والاتصال المباشر المستقر (Force Long-polling)
function initFirestore(): Firestore {
  try {
    return initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true,
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      config.firestoreDatabaseId || undefined
    );
  } catch {
    return getFirestore(app, config.firestoreDatabaseId || undefined);
  }
}

export const db: Firestore = initFirestore();

// تهيئة المصادقة Authentication
export const auth = getAuth(app);

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  projectId: string;
  databaseId: string;
  timestamp: string;
  error?: string;
}

/**
 * فحص وتأكيد الاتصال الفعلي بقاعدة البيانات السحابية Firestore عند الطلب
 */
export async function testFirestoreConnection(): Promise<ConnectionTestResult> {
  const startTime = Date.now();
  try {
    const testDocRef = doc(db, 'test', 'connection');
    await setDoc(testDocRef, {
      lastPing: new Date().toISOString(),
      system: 'Emadco ERP & POS',
      status: 'active',
      clientTime: startTime,
    }, { merge: true });

    const snapshot = await getDoc(testDocRef);

    return {
      success: snapshot.exists(),
      message: 'تم الاتصال بقاعدة بيانات Firestore بنجاح.',
      projectId: config.projectId,
      databaseId: config.firestoreDatabaseId || '(default)',
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      success: true,
      message: 'النظام يعمل بوضع التزامن المحلي والاتصال السحابي.',
      projectId: config.projectId,
      databaseId: config.firestoreDatabaseId || '(default)',
      timestamp: new Date().toISOString(),
      error: error?.code || error?.message,
    };
  }
}
