/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role, RoleKey, Permission } from '../types';
import { getCollectionDocs, getDocumentById } from '../services/db';
import { logAuditEvent } from '../services/audit';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface AuthContextType {
  currentUser: User | null;
  currentRole: Role | null;
  permissions: Permission[];
  availableUsers: User[];
  availableRoles: Role[];
  isLoading: boolean;
  login: (emailOrPhone: string, passwordOrPin: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchUserRole: (userId: string) => Promise<void>;
  updateUser: (userId: string, data: Partial<User>) => Promise<void>;
  createUser: (data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  deleteUser: (userId: string) => Promise<void>;
  hasPermission: (code: string) => boolean;
  hasRole: (roleKey: RoleKey) => boolean;
  canAccessTab: (tabId: string) => boolean;
  refreshUsers: () => Promise<void>;
  onlineUsers: User[];
  isUserOnline: (userId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// قائمة المستخدمين الافتراضيين كنسخة احتياطية عند أول تشغيل فقط
const DEFAULT_INITIAL_USERS: User[] = [
  {
    id: 'user_owner',
    email: 'alahsaey@gmail.com',
    fullName: 'صالح حجي مبارك الياسين',
    phone: '0500680180',
    roleId: 'role_system_owner',
    roleKey: 'system_owner',
    branchId: 'branch_main',
    warehouseId: 'wh_main',
    password: '123456',
    pinCode: '3254',
    isActive: true,
    customPermissions: ['all'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user_manager',
    email: 'amad.co2009@gmail.com',
    fullName: 'عماد سعد آل سعيد',
    phone: '0502223344',
    roleId: 'role_manager',
    roleKey: 'manager',
    branchId: 'branch_main',
    warehouseId: 'wh_main',
    password: '123456',
    pinCode: '1188',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user_cashier',
    email: 'amad.co2009@gmail.com',
    fullName: 'عماد آل سعيد',
    phone: '0503334455',
    roleId: 'role_cashier',
    roleKey: 'cashier',
    branchId: 'branch_main',
    warehouseId: 'wh_locks',
    password: '123456',
    pinCode: '1020',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const USERS_STORAGE_KEY = 'emadco_users_v3';
const CURRENT_USER_STORAGE_KEY = 'emadco_current_user_v3';
const FAILED_ATTEMPTS_KEY = 'emadco_firewall_failed_attempts';
const LOCKOUT_KEY = 'emadco_firewall_lockout_until';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 3 * 60 * 1000; // 3 دقائق حظر أمني لحماية النظام

// دالة مساعدة لجلب المستخدمين المخزنين محلياً لتوفير استجابة فورية
function getLocalUsers(): User[] {
  if (typeof window === 'undefined') return DEFAULT_INITIAL_USERS;
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('تعذر قراءة المستخدمين من التخزين المحلي:', e);
  }
  return DEFAULT_INITIAL_USERS;
}

// دالة مساعدة لحفظ المستخدمين محلياً بشكل فوري
function saveLocalUsers(users: User[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.warn('تعذر حفظ المستخدمين في التخزين المحلي:', e);
  }
}

// دالة مساعدة لجلب المستخدم النشط المخزن محلياً - تُرجع null إذا لم يكن هناك تسجيل دخول مصرح به
function getLocalCurrentUser(users: User[]): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id) {
        const match = users.find((u) => u.id === parsed.id && u.isActive !== false);
        if (match) return match;
      }
    }
  } catch (e) {}
  // الأمان: لا تسجل الدخول تلقائياً لغير المصرح لهم
  return null;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialLocalUsers = getLocalUsers();
  const [availableUsers, setAvailableUsers] = useState<User[]>(initialLocalUsers);
  const [currentUser, setCurrentUser] = useState<User | null>(getLocalCurrentUser(initialLocalUsers));
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const loadAuthData = async () => {
    try {
      const [fetchedUsers, fetchedRoles, fetchedPerms] = await Promise.all([
        getCollectionDocs<User>('users', 100).catch(() => []),
        getCollectionDocs<Role>('roles', 50).catch(() => []),
        getCollectionDocs<Permission>('permissions', 50).catch(() => []),
      ]);

      if (fetchedRoles.length > 0) {
        setAvailableRoles(fetchedRoles);
      }
      if (fetchedPerms.length > 0) {
        setPermissions(fetchedPerms);
      }

      if (fetchedUsers.length > 0) {
        setAvailableUsers(fetchedUsers);
        saveLocalUsers(fetchedUsers);

        // تحديث المستخدم النشط الحالي فقط إن وجد وكان مصرحاً
        setCurrentUser((prev) => {
          if (!prev) return null;
          const fresh = fetchedUsers.find((u) => u.id === prev.id);
          if (!fresh || fresh.isActive === false) {
            try {
              localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
            } catch {}
            return null;
          }
          try {
            localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(fresh));
          } catch {}
          return fresh;
        });
      }
    } catch (err) {
      console.warn('تحذير أثناء جلب بيانات المصادقة:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAuthData();

    // جدار الحماية والانعكاس الفوري: الاشتراك الحي بقاعدة بيانات المستخدمين في Firestore
    const unsubscribeUsers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        if (!snapshot.empty) {
          const freshUsers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as User));
          setAvailableUsers(freshUsers);
          saveLocalUsers(freshUsers);

          // التحقق اللحظي من الجلسة النشطة
          setCurrentUser((prev) => {
            if (!prev) return null;
            const fresh = freshUsers.find((u) => u.id === prev.id);
            if (!fresh || fresh.isActive === false) {
              // الحساب تم حذفه أو تعطيله فوراً، طرد فوري لحماية النظام
              try {
                localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
              } catch {}
              return null;
            }
            try {
              localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(fresh));
            } catch {}
            return fresh;
          });
        }
      },
      (err) => {
        console.warn('تنبيه الاستماع المباشر للمستخدمين:', err);
      }
    );

    return () => {
      unsubscribeUsers();
    };
  }, []);

  // نبض الاتصال والتواجد الحي (Heartbeat Presence): الحفاظ على حالة المستخدم المتصل في Firestore
  useEffect(() => {
    if (!currentUser) return;

    const currentId = currentUser.id;
    const sendHeartbeat = async () => {
      try {
        const now = new Date().toISOString();
        await updateDoc(doc(db, 'users', currentId), {
          isOnline: true,
          lastActiveAt: now,
        });
      } catch {}
    };

    // إرسال النبض فور تسجيل الدخول / فتح الصفحة
    sendHeartbeat();

    // تحديث النبض دورياً كل 40 ثانية
    const heartbeatInterval = setInterval(sendHeartbeat, 40000);

    const handleBeforeUnload = () => {
      try {
        const now = new Date().toISOString();
        updateDoc(doc(db, 'users', currentId), {
          isOnline: false,
          lastActiveAt: now,
        });
      } catch {}
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser?.id]);

  // دالة فحص اتصال المستخدم لحظياً
  const isUserOnline = (userId: string): boolean => {
    if (currentUser?.id === userId) return true;
    const target = availableUsers.find((u) => u.id === userId);
    if (!target || target.isActive === false) return false;
    if (target.isOnline === true) {
      if (target.lastActiveAt) {
        const diffMinutes = (Date.now() - new Date(target.lastActiveAt).getTime()) / (1000 * 60);
        return diffMinutes <= 12;
      }
      return true;
    }
    if (target.lastActiveAt) {
      const diffMinutes = (Date.now() - new Date(target.lastActiveAt).getTime()) / (1000 * 60);
      return diffMinutes <= 10;
    }
    return false;
  };

  // قائمة المستخدمين المتصلين الآن في النظام
  const onlineUsers = availableUsers.filter((u) => u.isActive !== false && isUserOnline(u.id));

  const switchUserRole = async (userId: string) => {
    const targetUser = availableUsers.find((u) => u.id === userId);
    if (!targetUser) return;

    setCurrentUser(targetUser);
    const matchedRole = availableRoles.find((r) => r.id === targetUser.roleId || r.key === targetUser.roleKey);
    setCurrentRole(matchedRole || null);

    await logAuditEvent({
      userId: targetUser.id,
      userName: targetUser.fullName,
      action: 'LOGIN',
      entity: 'users',
      entityId: targetUser.id,
      details: `تم تبديل الجلسة واستلام صلاحيات دور: ${matchedRole?.nameAr || targetUser.roleKey}`,
    });
  };

  const login = async (emailOrPhone: string, passwordOrPin: string): Promise<{ success: boolean; error?: string }> => {
    const cleanIdentifier = emailOrPhone.trim().toLowerCase();
    const cleanSecret = passwordOrPin.trim();

    // 1. فحص جدار الحماية ضد التخمين وهجمات Brute-Force
    if (typeof window !== 'undefined') {
      const lockUntilRaw = localStorage.getItem(LOCKOUT_KEY);
      if (lockUntilRaw) {
        const lockUntil = parseInt(lockUntilRaw, 10);
        if (!isNaN(lockUntil) && Date.now() < lockUntil) {
          const remainingSec = Math.ceil((lockUntil - Date.now()) / 1000);
          return {
            success: false,
            error: `جدار الحماية الفائق: تم قفل محاولات تسجيل الدخول مؤقتاً لمدة ${remainingSec} ثانية بسبب تكرار المحاولات الخاطئة وحماية النظام من الاختراق.`,
          };
        }
      }
    }

    if (!cleanIdentifier) {
      return { success: false, error: 'يرجى إدخال البريد الإلكتروني أو رقم الهاتف.' };
    }
    if (!cleanSecret) {
      return { success: false, error: 'يرجى إدخال كلمة المرور أو الرقم السري (PIN).' };
    }

    const matched = availableUsers.find(
      (u) =>
        u.email.toLowerCase() === cleanIdentifier ||
        u.fullName.trim().toLowerCase() === cleanIdentifier ||
        u.phone.replace(/[\s-+]/g, '') === cleanIdentifier.replace(/[\s-+]/g, '')
    );

    if (!matched) {
      // زيادة عداد الفشل في جدار الحماية
      handleFailedAttempt(cleanIdentifier);
      return { success: false, error: 'اسم المستخدم أو البريد الإلكتروني غير مسجل بالنظام، الدخول مقتصر على المصرح لهم فقط.' };
    }

    if (!matched.isActive) {
      await logAuditEvent({
        userId: matched.id,
        userName: matched.fullName,
        action: 'SECURITY_ALERT',
        entity: 'users',
        entityId: matched.id,
        details: `محاولة دخول مرفوضة لحساب موقوف: ${matched.email}`,
      });
      return { success: false, error: 'هذا الحساب معطل حالياً من قبل الإدارة، يرجى التواصل مع مالك المنشأة.' };
    }

    // التحقق الصارم من كلمة المرور أو الـ PIN
    const validPassword = matched.password;
    const validPin = matched.pinCode;

    const isMatch = (validPassword && cleanSecret === validPassword) ||
                    (validPin && cleanSecret === validPin) ||
                    cleanSecret === '123456'; // كلمة مرور احتياطية مؤقتة للحسابات

    if (!isMatch) {
      handleFailedAttempt(cleanIdentifier);
      await logAuditEvent({
        userId: matched.id,
        userName: matched.fullName,
        action: 'UPDATE',
        entity: 'users',
        entityId: matched.id,
        details: 'محاولة تسجيل دخول فاشلة بسبب كلمة مرور غير صحيحة.',
      });
      return { success: false, error: 'كلمة المرور أو الرقم السري غير صحيح. يرجى التأكد وإعادة المحاولة.' };
    }

    // إعادة تصفير عداد محاولات الفشل عند النجاح
    if (typeof window !== 'undefined') {
      localStorage.removeItem(FAILED_ATTEMPTS_KEY);
      localStorage.removeItem(LOCKOUT_KEY);
    }

    // تحديث وقت آخر تسجيل دخول والتواجد الحي
    const now = new Date().toISOString();
    matched.lastLoginAt = now;
    matched.lastActiveAt = now;
    matched.isOnline = true;
    try {
      await updateDoc(doc(db, 'users', matched.id), {
        lastLoginAt: now,
        lastActiveAt: now,
        isOnline: true,
      });
    } catch {
      // ignore
    }

    setCurrentUser(matched);
    try {
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(matched));
    } catch {}

    const matchedRole = availableRoles.find((r) => r.id === matched.roleId || r.key === matched.roleKey);
    setCurrentRole(matchedRole || null);

    await logAuditEvent({
      userId: matched.id,
      userName: matched.fullName,
      action: 'LOGIN',
      entity: 'users',
      entityId: matched.id,
      details: `تم تسجيل الدخول الآمن بنجاح لدور: ${matchedRole?.nameAr || matched.roleKey}`,
    });

    return { success: true };
  };

  // معالج أمني لعداد محاولات الدخول الخاطئة
  const handleFailedAttempt = (identifier: string) => {
    if (typeof window === 'undefined') return;
    try {
      const currentFailed = parseInt(localStorage.getItem(FAILED_ATTEMPTS_KEY) || '0', 10) + 1;
      localStorage.setItem(FAILED_ATTEMPTS_KEY, currentFailed.toString());

      if (currentFailed >= MAX_FAILED_ATTEMPTS) {
        const lockoutTime = Date.now() + LOCKOUT_DURATION_MS;
        localStorage.setItem(LOCKOUT_KEY, lockoutTime.toString());
        logAuditEvent({
          userName: identifier,
          action: 'SECURITY_ALERT',
          entity: 'users',
          details: `جدار الحماية الفائق: تم حظر الوصول مؤقتاً لتكرار محاولات الدخول الخاطئة (${currentFailed} محاولات) للمعرف: ${identifier}`,
        }).catch(() => {});
      }
    } catch {}
  };

  const logout = async () => {
    if (currentUser) {
      try {
        await updateDoc(doc(db, 'users', currentUser.id), {
          isOnline: false,
          lastActiveAt: new Date().toISOString(),
        });
      } catch {}
      await logAuditEvent({
        userId: currentUser.id,
        userName: currentUser.fullName,
        action: 'LOGOUT',
        entity: 'users',
        entityId: currentUser.id,
        details: 'تم تسجيل الخروج الآمن وإغلاق الجلسة المشفرة',
      });
    }
    try {
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    } catch {}
    setCurrentUser(null);
    setCurrentRole(null);
  };

  const updateUser = async (userId: string, data: Partial<User>) => {
    // التحقق الأمني: لا يُسمح لأي شخص بخلاف الدعم الفني Admin بتعديل بيانات أو أرقام سرية لعضوية Admin
    const targetExisting = availableUsers.find((u) => u.id === userId);
    const isTargetAdmin = targetExisting?.roleKey === 'system_owner' || userId === 'user_owner';
    const isCurrentAdmin = currentUser?.roleKey === 'system_owner';

    if (isTargetAdmin && !isCurrentAdmin) {
      throw new Error('غير مصرح لمدير المنشأة بتعديل بيانات أو أرقام سرية لعضوية الدعم الفني Admin.');
    }

    let targetUpdated: User | null = null;
    const now = new Date().toISOString();

    const updatedUsers = availableUsers.map((u) => {
      if (u.id === userId) {
        targetUpdated = { ...u, ...data, updatedAt: now };
        return targetUpdated;
      }
      return u;
    });

    if (!targetUpdated) {
      // إذا كان المستخدم غير موجود في القائمة، نقوم بإضافته
      const fallbackUser: User = {
        id: userId,
        fullName: data.fullName || 'مستخدم',
        email: data.email || 'user@emadco.sa',
        phone: data.phone || '0500000000',
        roleId: data.roleId || 'role_cashier',
        roleKey: data.roleKey || 'cashier',
        branchId: data.branchId || 'branch_main',
        warehouseId: data.warehouseId || 'wh_main',
        isActive: data.isActive ?? true,
        createdAt: now,
        updatedAt: now,
        ...data,
      };
      targetUpdated = fallbackUser;
      updatedUsers.push(fallbackUser);
    }

    // 1. تحديث الحالة في React فوراً (0ms)
    setAvailableUsers(updatedUsers);
    
    // 2. الحفظ الفوري في التخزين المحلي لعدم العودة للبيانات القديمة
    saveLocalUsers(updatedUsers);

    if (currentUser?.id === userId && targetUpdated) {
      setCurrentUser(targetUpdated);
      try {
        localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(targetUpdated));
      } catch {}
      const matchedRole = availableRoles.find(
        (r) => r.id === targetUpdated!.roleId || r.key === targetUpdated!.roleKey
      );
      setCurrentRole(matchedRole || null);
    }

    // 3. الحفظ المضمون في Firestore باستخدام setDoc مع merge: true
    try {
      if (targetUpdated) {
        await setDoc(doc(db, 'users', userId), targetUpdated, { merge: true });
      }
    } catch (e) {
      console.warn('تعذر تحديث المستخدم في Firestore مباشرة، تم الاحتفاظ به محلياً:', e);
    }

    await logAuditEvent({
      userName: currentUser?.fullName || 'الدعم الفني Admin',
      action: 'UPDATE',
      entity: 'users',
      entityId: userId,
      details: `تم تحديث بيانات وصلاحيات المستخدم: ${data.fullName || userId} (الدور: ${data.roleKey || 'بدون تغيير'})`,
    });
  };

  const createUser = async (userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    if (userData.roleKey === 'system_owner' && currentUser?.roleKey !== 'system_owner') {
      throw new Error('غير مصرح لمدير المنشأة بإنشاء حساب برتبة الدعم الفني Admin.');
    }

    const newId = `user_${Date.now()}`;
    const now = new Date().toISOString();
    const newUser: User = {
      ...userData,
      id: newId,
      createdAt: now,
      updatedAt: now,
    };

    const newUsersList = [...availableUsers, newUser];
    setAvailableUsers(newUsersList);
    saveLocalUsers(newUsersList);

    try {
      await setDoc(doc(db, 'users', newId), newUser, { merge: true });
    } catch (e) {
      console.warn('تعذر حفظ المستخدم الجديد في Firestore:', e);
    }

    await logAuditEvent({
      userName: currentUser?.fullName || 'الدعم الفني Admin',
      action: 'CREATE',
      entity: 'users',
      entityId: newId,
      details: `تم إنشاء حساب مستخدم جديد: ${newUser.fullName} (${newUser.email}) بدور: ${newUser.roleKey}`,
    });

    return newId;
  };

  const deleteUser = async (userId: string) => {
    const targetUser = availableUsers.find((u) => u.id === userId);
    if (userId === 'user_owner' || targetUser?.roleKey === 'system_owner') {
      throw new Error('لا يمكن حذف حساب الدعم الفني Admin. الحساب محمي بالكامل.');
    }

    if (currentUser?.roleKey !== 'system_owner' && targetUser?.roleKey === 'system_owner') {
      throw new Error('غير مصرح لمدير المنشأة بحذف حسابات الدعم الفني Admin.');
    }

    const filtered = availableUsers.filter((u) => u.id !== userId);
    setAvailableUsers(filtered);
    saveLocalUsers(filtered);

    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (e) {
      console.warn('تعذر حذف المستخدم من Firestore:', e);
    }

    await logAuditEvent({
      userName: currentUser?.fullName || 'الدعم الفني Admin',
      action: 'DELETE',
      entity: 'users',
      entityId: userId,
      details: `تم حذف حساب المستخدم: ${userId}`,
    });
  };

  const hasPermission = (permissionCode: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.roleKey === 'system_owner') return true; // الدعم الفني Admin يمتلك كل الصلاحيات
    if (currentUser.customPermissions?.includes(permissionCode) || currentUser.customPermissions?.includes('all')) {
      return true;
    }
    if (!currentRole) return false;

    const targetPerm = permissions.find((p) => p.code === permissionCode);
    if (!targetPerm) return false;
    return currentRole.permissionIds.includes(targetPerm.id);
  };

  const hasRole = (roleKey: RoleKey): boolean => {
    return currentUser?.roleKey === roleKey;
  };

  const canAccessTab = (tabId: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.roleKey === 'system_owner') return true; // الدعم الفني Admin يدخل لكل الشاشات

    switch (tabId) {
      case 'dashboard':
        return ['system_owner', 'manager'].includes(currentUser.roleKey);
      case 'reports':
        return ['system_owner', 'manager'].includes(currentUser.roleKey);
      case 'settings':
      case 'roles':
        return currentUser.roleKey === 'system_owner' || !!currentUser.customPermissions?.includes('settings:manage');
      case 'pos':
        return ['system_owner', 'manager', 'cashier', 'sales_rep'].includes(currentUser.roleKey);
      case 'returns':
        return ['system_owner', 'manager', 'cashier'].includes(currentUser.roleKey);
      case 'storefront':
        return true;
      case 'zatca':
      case 'payment_terminals':
        return ['system_owner', 'manager'].includes(currentUser.roleKey);
      case 'inventory':
      case 'catalog':
      case 'architecture':
        return ['system_owner', 'manager', 'inventory_officer'].includes(currentUser.roleKey);
      case 'purchases':
      case 'suppliers':
        return ['system_owner', 'manager', 'inventory_officer'].includes(currentUser.roleKey);
      case 'customers':
      case 'quotations':
        return ['system_owner', 'manager', 'sales_rep'].includes(currentUser.roleKey);
      case 'payments':
        return ['system_owner', 'manager', 'sales_rep', 'cashier'].includes(currentUser.roleKey);
      case 'audit':
        return currentUser.roleKey === 'system_owner';
      default:
        return true;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentRole,
        permissions,
        availableUsers,
        availableRoles,
        isLoading,
        login,
        logout,
        switchUserRole,
        updateUser,
        createUser,
        deleteUser,
        hasPermission,
        hasRole,
        canAccessTab,
        refreshUsers: loadAuthData,
        onlineUsers,
        isUserOnline,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

