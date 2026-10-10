/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AuditLog } from '../types';

export interface LogParams {
  userId?: string;
  userName?: string;
  action: AuditLog['action'];
  entity: string;
  entityId?: string;
  details: string;
}

/**
 * خدمة تسجيل العمليات والتدقيق الأمني (Audit Logs)
 */
export async function logAuditEvent(params: LogParams): Promise<string | null> {
  try {
    const logData: Omit<AuditLog, 'id'> = {
      userId: params.userId || 'system',
      userName: params.userName || 'النظام التلقائي',
      action: params.action,
      entity: params.entity,
      entityId: params.entityId || '-',
      details: params.details,
      ipAddress: '127.0.0.1 (Cloud Sandbox)',
      timestamp: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, 'audit_logs'), logData);
    return docRef.id;
  } catch (error) {
    console.error('فشل تسجيل حدث التدقيق (Audit Log Error):', error);
    return null;
  }
}

/**
 * جلب آخر سجلات التدقيق
 */
export async function fetchRecentAuditLogs(count = 20): Promise<AuditLog[]> {
  try {
    const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(count));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as AuditLog[];
  } catch (error) {
    console.error('فشل جلب سجلات التدقيق:', error);
    return [];
  }
}
