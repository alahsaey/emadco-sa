/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, RoleKey } from '../types';
import { logAuditEvent } from './audit';

/**
 * جلب جميع مستخدمي النظام من Firestore
 */
export async function fetchAllUsers(): Promise<User[]> {
  try {
    const colRef = collection(db, 'users');
    const snap = await getDocs(query(colRef, limit(100)));
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as User[];
  } catch (err) {
    console.error('خطأ في جلب المستخدمين:', err);
    throw err;
  }
}

/**
 * إنشاء مستخدم جديد
 */
export async function createUser(
  data: {
    fullName: string;
    email: string;
    phone: string;
    roleKey: RoleKey;
    roleId: string;
    branchId?: string;
    warehouseId?: string;
    isActive: boolean;
  },
  actor: { id: string; name: string }
): Promise<User> {
  const trimmedName = data.fullName.trim();
  const trimmedEmail = data.email.trim().toLowerCase();
  const trimmedPhone = data.phone.trim();

  if (!trimmedName) {
    throw new Error('يرجى إدخال الاسم الكامل للمستخدم.');
  }
  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    throw new Error('يرجى إدخال بريد إلكتروني صحيح.');
  }

  // التحقق من تكرار البريد الإلكتروني
  const currentUsers = await fetchAllUsers();
  const duplicate = currentUsers.find(
    (u) => u.email.toLowerCase() === trimmedEmail
  );
  if (duplicate) {
    throw new Error('البريد الإلكتروني مسجل مسبقاً لمستخدم آخر.');
  }

  const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const newUser: User = {
    id: userId,
    fullName: trimmedName,
    email: trimmedEmail,
    phone: trimmedPhone || '0500000000',
    roleKey: data.roleKey,
    roleId: data.roleId || `role_${data.roleKey}`,
    branchId: data.branchId || 'branch_main',
    warehouseId: data.warehouseId || 'wh_main',
    isActive: data.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, 'users', userId), newUser);

  await logAuditEvent({
    userId: actor.id,
    userName: actor.name,
    action: 'CREATE',
    entity: 'users',
    entityId: userId,
    details: `تم إنشاء مستخدم جديد: ${trimmedName} (${trimmedEmail}) بدور: ${data.roleKey}`,
  });

  return newUser;
}

/**
 * تعديل بيانات مستخدم موجود
 */
export async function updateUserDetails(
  userId: string,
  updates: {
    fullName?: string;
    email?: string;
    phone?: string;
    roleKey?: RoleKey;
    roleId?: string;
    branchId?: string;
    warehouseId?: string;
    isActive?: boolean;
  },
  actor: { id: string; name: string }
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    // في حال كان المستخدم الافتراضي لم يُحفظ بعد في Firestore، نقوم بإنشائه وتحديثه
    const now = new Date().toISOString();
    const newUser: User = {
      id: userId,
      fullName: updates.fullName?.trim() || 'مستخدم',
      email: updates.email?.trim().toLowerCase() || 'user@emadco.sa',
      phone: updates.phone?.trim() || '0500000000',
      roleKey: updates.roleKey || 'cashier',
      roleId: updates.roleId || `role_${updates.roleKey || 'cashier'}`,
      branchId: updates.branchId || 'branch_main',
      warehouseId: updates.warehouseId || 'wh_main',
      isActive: updates.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(userRef, newUser);
    return;
  }

  const existingData = snap.data() as User;

  // التحقق من تكرار البريد الإلكتروني في حال تغييره
  if (updates.email && updates.email.trim().toLowerCase() !== existingData.email.toLowerCase()) {
    const allUsers = await fetchAllUsers();
    const isTaken = allUsers.some(
      (u) => u.id !== userId && u.email.toLowerCase() === updates.email!.trim().toLowerCase()
    );
    if (isTaken) {
      throw new Error('البريد الإلكتروني الجديد مسجل مسبقاً لمستخدم آخر.');
    }
  }

  // منع تعطيل أو تغيير دور المالك الأخير
  if (existingData.roleKey === 'system_owner' && updates.roleKey && updates.roleKey !== 'system_owner') {
    const allUsers = await fetchAllUsers();
    const ownersCount = allUsers.filter((u) => u.roleKey === 'system_owner' && u.isActive).length;
    if (ownersCount <= 1) {
      throw new Error('لا يمكن تغيير رتبة الدعم الفني Admin لضمان استمرار التحكم بالنظام.');
    }
  }

  if (existingData.roleKey === 'system_owner' && updates.isActive === false) {
    const allUsers = await fetchAllUsers();
    const ownersCount = allUsers.filter((u) => u.roleKey === 'system_owner' && u.isActive && u.id !== userId).length;
    if (ownersCount === 0) {
      throw new Error('لا يمكن تعطيل حساب الدعم الفني Admin الأساسي، يجب توفر حساب نشط واحد على الأقل.');
    }
  }

  const payload: any = {
    updatedAt: new Date().toISOString(),
  };

  if (updates.fullName !== undefined) payload.fullName = updates.fullName.trim();
  if (updates.email !== undefined) payload.email = updates.email.trim().toLowerCase();
  if (updates.phone !== undefined) payload.phone = updates.phone.trim();
  if (updates.roleKey !== undefined) {
    payload.roleKey = updates.roleKey;
    payload.roleId = updates.roleId || `role_${updates.roleKey}`;
  }
  if (updates.branchId !== undefined) payload.branchId = updates.branchId;
  if (updates.warehouseId !== undefined) payload.warehouseId = updates.warehouseId;
  if (updates.isActive !== undefined) payload.isActive = updates.isActive;

  await updateDoc(userRef, payload);

  await logAuditEvent({
    userId: actor.id,
    userName: actor.name,
    action: 'UPDATE',
    entity: 'users',
    entityId: userId,
    details: `تم تعديل بيانات المستخدم: ${updates.fullName || existingData.fullName}`,
  });
}

/**
 * حذف مستخدم نهائياً من النظام
 */
export async function deleteUserAccount(
  userId: string,
  currentUserId: string,
  actor: { id: string; name: string }
): Promise<void> {
  if (userId === currentUserId) {
    throw new Error('لا يمكنك حذف حسابك الحالي أثناء تسجيل الدخول به.');
  }

  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    // في حال عدم وجوده كوثيقة صريحة
    return;
  }

  const userData = snap.data() as User;

  // التحقق من عدم حذف المالك الوحيد
  if (userData.roleKey === 'system_owner') {
    const allUsers = await fetchAllUsers();
    const activeOwners = allUsers.filter((u) => u.roleKey === 'system_owner' && u.id !== userId);
    if (activeOwners.length === 0) {
      throw new Error('لا يمكن حذف حساب الدعم الفني Admin، يجب الإبقاء على حساب واحد على الأقل.');
    }
  }

  await deleteDoc(userRef);

  await logAuditEvent({
    userId: actor.id,
    userName: actor.name,
    action: 'DELETE',
    entity: 'users',
    entityId: userId,
    details: `تم حذف حساب المستخدم نهائياً: ${userData.fullName} (${userData.email})`,
  });
}
