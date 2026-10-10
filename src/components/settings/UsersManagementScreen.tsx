/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  KeyRound,
  Lock,
  Mail,
  Phone,
  Building2,
  Warehouse as WarehouseIcon,
  CheckCircle2,
  XCircle,
  Edit,
  Trash2,
  Search,
  Check,
  AlertCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { User, RoleKey } from '../../types';
import { TelegramIcon } from '../common/TelegramIcon';

interface UsersManagementScreenProps {
  onUserSelect?: (user: User) => void;
}

const ROLE_DEFINITIONS: Record<
  RoleKey,
  {
    nameAr: string;
    badgeColor: string;
    description: string;
    defaultPermissions: string[];
  }
> = {
  system_owner: {
    nameAr: 'الدعم الفني Admin',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    description: 'صلاحيات عليا مطلقة لإدارة النظام، الإعدادات، المستخدمين والتقارير المالية والنسخ الاحتياطي.',
    defaultPermissions: ['all'],
  },
  manager: {
    nameAr: 'مدير المنشأة (Manager)',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    description: 'إدارة تشغيلية للمبيعات، المشتريات، المخزون، والعملاء والموردين والتقارير التشغيلية.',
    defaultPermissions: [
      'products:view',
      'products:create',
      'products:edit',
      'inventory:view',
      'inventory:adjust',
      'sales:create',
      'sales:discount',
      'purchases:create',
      'customers:manage',
      'suppliers:manage',
    ],
  },
  cashier: {
    nameAr: 'كاشير نقطة البيع (Cashier)',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'إصدار الفواتير الفورية، تحصيل المدفوعات، قراءة الباركود، والمرتجعات المصرحة.',
    defaultPermissions: ['products:view', 'sales:create'],
  },
  sales_rep: {
    nameAr: 'مندوب مبيعات مقاولين (Sales)',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'إعداد عروض الأسعار، مبيعات الآجل للمقاولين، ومتابعة المشاريع والعملاء.',
    defaultPermissions: ['products:view', 'sales:create', 'customers:manage', 'inventory:view'],
  },
  inventory_officer: {
    nameAr: 'مسؤول المستودعات (Inventory)',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    description: 'استلام بضائع الموردين، التحويل بين المستودعات، وتسويات الجرد ومراقبة النواقص.',
    defaultPermissions: ['products:view', 'inventory:view', 'inventory:adjust', 'inventory:transfer', 'purchases:create'],
  },
};

const GRANULAR_PERMISSIONS = [
  { id: 'dashboard:view', label: 'الدخول للوحة القيادة والمؤشرات المالية', category: 'لوحة التحكم' },
  { id: 'reports:view', label: 'استعراض التقارير والأرباح وحركة المبيعات', category: 'التقارير' },
  { id: 'settings:manage', label: 'الوصول لإعدادات النظام والنسخ الاحتياطي والـ ZATCA', category: 'النظام' },
  { id: 'users:manage', label: 'إدارة وتعديل حسابات المستخدمين والصلاحيات', category: 'النظام' },
  { id: 'sales:create', label: 'إصدار فواتير نقاط البيع (POS)', category: 'المبيعات' },
  { id: 'sales:discount', label: 'منح خصومات إضافية للعملاء', category: 'المبيعات' },
  { id: 'sales:delete', label: 'إلغاء وحذف فواتير المبيعات المسجلة', category: 'المبيعات' },
  { id: 'inventory:adjust', label: 'تسوية الجرد وإثبات التوالف والمفقودات', category: 'المخزون' },
  { id: 'inventory:transfer', label: 'التحويل بين المستودعات والفروع', category: 'المخزون' },
  { id: 'purchases:create', label: 'تسجيل فواتير المشتريات وأوامر التوريد', category: 'المشتريات' },
];

export const UsersManagementScreen: React.FC<UsersManagementScreenProps> = () => {
  const { availableUsers, currentUser, updateUser, createUser, deleteUser, refreshUsers, onlineUsers, isUserOnline } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // رتبة المستخدم المسجل دخوله حالياً
  const isCurrentLoggedInAdmin = currentUser?.roleKey === 'system_owner';
  const isCurrentLoggedInManager = currentUser?.roleKey === 'manager';

  // حالة المودال (إضافة أو تعديل)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // حالة مودال تأكيد الحذف
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // حقول النموذج
  const [formData, setFormData] = useState<{
    fullName: string;
    email: string;
    phone: string;
    telegramChatId: string;
    telegramUsername: string;
    roleKey: RoleKey;
    password: string;
    pinCode: string;
    isActive: boolean;
    branchId: string;
    warehouseId: string;
    customPermissions: string[];
  }>({
    fullName: '',
    email: '',
    phone: '',
    telegramChatId: '',
    telegramUsername: '',
    roleKey: 'cashier',
    password: '',
    pinCode: '',
    isActive: true,
    branchId: 'branch_main',
    warehouseId: 'wh_main',
    customPermissions: [],
  });

  const [showPassword, setShowPassword] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleOpenAddModal = () => {
    setIsNewUser(true);
    setEditingUserId(null);
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      telegramChatId: '',
      telegramUsername: '',
      roleKey: 'cashier',
      password: '123456',
      pinCode: '1122',
      isActive: true,
      branchId: 'branch_main',
      warehouseId: 'wh_main',
      customPermissions: [...ROLE_DEFINITIONS.cashier.defaultPermissions],
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: User) => {
    const isTargetAdmin = user.roleKey === 'system_owner' || user.id === 'user_owner';

    // حظر تعديل أو استعراض كلمة سر الأدمن بواسطة مدير المنشأة أو أي مستخدم آخر
    if (isTargetAdmin && !isCurrentLoggedInAdmin) {
      showToast(
        'error',
        '⛔ حساب الدعم الفني Admin محمي بالكامل: لا يملك مدير المنشأة صلاحية استعراض أو تعديل كلمة المرور أو PIN الخاص بالأدمن.'
      );
      return;
    }

    setIsNewUser(false);
    setEditingUserId(user.id);
    setFormData({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || '',
      telegramChatId: user.telegramChatId || '',
      telegramUsername: user.telegramUsername || '',
      roleKey: user.roleKey,
      password: user.password || '123456',
      pinCode: user.pinCode || '1234',
      isActive: user.isActive !== false,
      branchId: user.branchId || 'branch_main',
      warehouseId: user.warehouseId || 'wh_main',
      customPermissions: user.customPermissions || [...(ROLE_DEFINITIONS[user.roleKey]?.defaultPermissions || [])],
    });
    setIsModalOpen(true);
  };

  const handleTogglePermission = (permId: string) => {
    setFormData((prev) => {
      const exists = prev.customPermissions.includes(permId);
      return {
        ...prev,
        customPermissions: exists
          ? prev.customPermissions.filter((p) => p !== permId)
          : [...prev.customPermissions, permId],
      };
    });
  };

  const handleRoleChange = (newRole: RoleKey) => {
    // منع مدير المنشأة من ترقية أي حساب إلى رتبة الدعم الفني Admin
    if (newRole === 'system_owner' && !isCurrentLoggedInAdmin) {
      showToast('error', '⛔ لا يمكن تعيين رتبة الدعم الفني Admin إلا من قِبل المشرف نفسه.');
      return;
    }

    setFormData((prev) => ({
      ...prev,
      roleKey: newRole,
      customPermissions: [...(ROLE_DEFINITIONS[newRole]?.defaultPermissions || [])],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.email.trim()) {
      showToast('error', 'يرجى إدخال اسم المستخدم والبريد الإلكتروني.');
      return;
    }

    if (!formData.password.trim()) {
      showToast('error', 'يرجى تحديد كلمة مرور للمستخدم.');
      return;
    }

    // تحقق أمني: منع تعديل حساب الأدمن لغير الأدمن
    if (editingUserId) {
      const targetUser = availableUsers.find((u) => u.id === editingUserId);
      const isTargetAdmin = targetUser?.roleKey === 'system_owner' || editingUserId === 'user_owner';
      if (isTargetAdmin && !isCurrentLoggedInAdmin) {
        showToast('error', '⛔ غير مصرح لمدير المنشأة بتعديل بيانات أو أرقام سرية لعضوية الدعم الفني Admin.');
        setIsModalOpen(false);
        return;
      }
    }

    if (isNewUser && formData.roleKey === 'system_owner' && !isCurrentLoggedInAdmin) {
      showToast('error', '⛔ لا يحق لمدير المنشأة إنشاء حسابات برتبة الدعم الفني Admin.');
      return;
    }

    setIsSaving(true);
    try {
      if (isNewUser) {
        await createUser({
          fullName: formData.fullName.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim(),
          telegramChatId: formData.telegramChatId.trim(),
          telegramUsername: formData.telegramUsername.trim().replace(/^@/, ''),
          roleId: `role_${formData.roleKey}`,
          roleKey: formData.roleKey,
          password: formData.password.trim(),
          pinCode: formData.pinCode.trim() || '1234',
          isActive: formData.isActive,
          branchId: formData.branchId,
          warehouseId: formData.warehouseId,
          customPermissions: formData.customPermissions,
        });
        showToast('success', `تمت إضافة المستخدم "${formData.fullName}" بنجاح.`);
      } else if (editingUserId) {
        await updateUser(editingUserId, {
          fullName: formData.fullName.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim(),
          telegramChatId: formData.telegramChatId.trim(),
          telegramUsername: formData.telegramUsername.trim().replace(/^@/, ''),
          roleId: `role_${formData.roleKey}`,
          roleKey: formData.roleKey,
          password: formData.password.trim(),
          pinCode: formData.pinCode.trim() || '1234',
          isActive: formData.isActive,
          branchId: formData.branchId,
          warehouseId: formData.warehouseId,
          customPermissions: formData.customPermissions,
        });
        showToast('success', `تم تحديث بيانات وصلاحيات "${formData.fullName}" بنجاح.`);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      showToast('error', err?.message || 'حدث خطأ أثناء حفظ بيانات المستخدم.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleUserActive = async (user: User) => {
    const isTargetAdmin = user.roleKey === 'system_owner' || user.id === 'user_owner';
    if (isTargetAdmin) {
      showToast('error', 'لا يمكن إيقاف حساب الدعم الفني Admin.');
      return;
    }
    const newStatus = !user.isActive;
    try {
      await updateUser(user.id, { isActive: newStatus });
      showToast('success', `تم ${newStatus ? 'تفعيل' : 'إيقاف'} حساب "${user.fullName}".`);
    } catch {
      showToast('error', 'فشل تغيير حالة الحساب.');
    }
  };

  const handleDeleteUser = (user: User) => {
    const isTargetAdmin = user.roleKey === 'system_owner' || user.id === 'user_owner';
    if (isTargetAdmin) {
      showToast('error', 'لا يمكن حذف الحساب الرئيسي للدعم الفني Admin.');
      return;
    }
    setUserToDelete(user);
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    const isTargetAdmin = userToDelete.roleKey === 'system_owner' || userToDelete.id === 'user_owner';
    if (isTargetAdmin) {
      showToast('error', 'لا يمكن حذف الحساب الرئيسي للدعم الفني Admin.');
      setUserToDelete(null);
      return;
    }

    setIsDeleting(true);
    try {
      await deleteUser(userToDelete.id);
      showToast('success', `تم حذف حساب المستخدم "${userToDelete.fullName}" نهائياً من النظام.`);
      setUserToDelete(null);
    } catch (err: any) {
      showToast('error', err?.message || 'فشل حذف المستخدم من قاعدة البيانات.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredUsers = availableUsers.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.phone && u.phone.includes(searchTerm));
    
    if (roleFilter === 'online') {
      return matchesSearch && isUserOnline(u.id);
    }
    const matchesRole = roleFilter === 'all' || u.roleKey === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* الترويسة والإحصائيات */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  إدارة المستخدمين والأرقام السرية وتخصيص الصلاحيات (RBAC)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  تحكم دقيق في هوية الدخول، كلمات المرور، رموز PIN السريعة، وصلاحيات الوصول للوحة القيادة
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              type="button"
              onClick={async () => {
                setIsRefreshing(true);
                await refreshUsers();
                setIsRefreshing(false);
                showToast('success', 'تمت مزامنة بيانات المستخدمين مع السحابة والتخزين الفوري بنجاح.');
              }}
              disabled={isRefreshing}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border border-slate-200"
              title="مزامنة وتحديث البيانات فوراً"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-600' : 'text-slate-500'}`} />
              <span>{isRefreshing ? 'جاري المزامنة...' : 'مزامنة وتحديث'}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <UserPlus className="w-4 h-4 text-amber-400" />
              <span>إضافة مستخدم جديد</span>
            </button>
          </div>
        </div>

        {/* إحصائيات سريعة */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-5 border-t border-slate-100 text-xs">
          <div
            onClick={() => setRoleFilter('all')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              roleFilter === 'all'
                ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-200'
                : 'bg-slate-50 hover:bg-slate-100/70 border-slate-200/70'
            }`}
          >
            <span className="text-slate-500 block text-[11px]">إجمالي المستخدمين</span>
            <span className="text-base font-black text-slate-900 font-mono mt-0.5 block">
              {availableUsers.length}
            </span>
          </div>

          <div
            onClick={() => setRoleFilter(roleFilter === 'online' ? 'all' : 'online')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              roleFilter === 'online'
                ? 'bg-emerald-100 border-emerald-400 ring-2 ring-emerald-200'
                : 'bg-emerald-50 hover:bg-emerald-100/60 border-emerald-200/70'
            }`}
            title="انقر لتصفية وعرض المتصلين الآن فقط"
          >
            <div className="flex items-center justify-between">
              <span className="text-emerald-700 block text-[11px] font-bold">المتصلين الآن</span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-black text-emerald-950 font-mono">
                {onlineUsers.length}
              </span>
              <span className="text-[10px] text-emerald-700 font-bold">متصل الآن</span>
            </div>
          </div>

          <div className="p-3 bg-blue-50 rounded-xl border border-blue-200/70">
            <span className="text-blue-700 block text-[11px]">الحسابات النشطة</span>
            <span className="text-base font-black text-blue-900 font-mono mt-0.5 block">
              {availableUsers.filter((u) => u.isActive !== false).length}
            </span>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/70">
            <span className="text-amber-700 block text-[11px]">نقاط البيع والكاشير</span>
            <span className="text-base font-black text-amber-900 font-mono mt-0.5 block">
              {availableUsers.filter((u) => u.roleKey === 'cashier').length}
            </span>
          </div>

          <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200/70">
            <span className="text-indigo-700 block text-[11px]">حماية الأرقام السرية</span>
            <span className="text-xs font-bold text-indigo-900 flex items-center gap-1 mt-1">
              <KeyRound className="w-3.5 h-3.5" /> مشفرة ومؤمنة
            </span>
          </div>
        </div>
      </div>

      {/* شريط تنبيه الصلاحيات والأمان */}
      {isCurrentLoggedInManager && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1 text-amber-950">
            <div className="font-bold flex items-center gap-1.5">
              <span>مستوى الصلاحيات: مدير المنشأة (Manager)</span>
              <span className="text-[10px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                حماية الحسابات الإشرافية مفعلة
              </span>
            </div>
            <p className="text-amber-800 leading-relaxed text-[11.5px]">
              يحق لك إدارة وتعديل حسابك الشخصي وجميع حسابات الموظفين (الكاشير، المبيعات، المستودعات) واستعراض وتعيين أرقامها السرية بحرية. بينما تم <strong>حجب وتأمين الأرقام السرية لعضوية الدعم الفني Admin</strong> ومنع تعديلها أو حذفها للحفاظ على سيادة وأمان النظام.
            </p>
          </div>
        </div>
      )}

      {isCurrentLoggedInAdmin && (
        <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-3.5 flex items-center gap-3 shadow-xs">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="text-xs text-emerald-950 flex flex-wrap items-center gap-2">
            <strong className="font-bold">أنت مسجل الدخول بصفتك الدعم الفني Admin:</strong>
            <span className="text-emerald-800 text-[11.5px]">
              تتمتع بالصلاحية الحصرية المطلقة لاستعراض وتعديل أرقامك السرية وأرقام جميع مستخدمي المنشأة.
            </span>
          </div>
        </div>
      )}

      {/* شريط البحث والفلترة */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث بالاسم، البريد أو رقم الجوال..."
            className="w-full pr-9 pl-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 font-bold whitespace-nowrap">تصفية حسب الدور:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">جميع الأدوار ({availableUsers.length})</option>
            <option value="online">🟢 المتصلين الآن ({onlineUsers.length})</option>
            <option value="system_owner">الدعم الفني Admin</option>
            <option value="manager">مدير المنشأة (Manager)</option>
            <option value="cashier">كاشير نقطة البيع (Cashier)</option>
            <option value="sales_rep">مندوب مبيعات (Sales)</option>
            <option value="inventory_officer">مسؤول المستودعات (Inventory)</option>
          </select>
        </div>
      </div>

      {/* رسالة التنبيه إن وجدت */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 border ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* جدول وبطاقات المستخدمين */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200">
                <th className="p-3.5 font-bold">المستخدم والبيانات</th>
                <th className="p-3.5 font-bold">الدور الوظيفي</th>
                <th className="p-3.5 font-bold">الرقم السري / PIN</th>
                <th className="p-3.5 font-bold">صلاحيات لوحة التحكم</th>
                <th className="p-3.5 font-bold">الحالة</th>
                <th className="p-3.5 font-bold text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => {
                const roleDef = ROLE_DEFINITIONS[user.roleKey] || ROLE_DEFINITIONS.cashier;
                const isTargetAdmin = user.roleKey === 'system_owner' || user.id === 'user_owner';
                const canAccessDashboard =
                  isTargetAdmin ||
                  user.roleKey === 'manager' ||
                  user.customPermissions?.includes('dashboard:view');

                // حماية الأرقام السرية: إذا كان الحساب المستهدف Admin ولم يكن المشاهد Admin، تحجب الأرقام وتمنع التعديل
                const canViewSecret = isCurrentLoggedInAdmin || !isTargetAdmin;
                const canEditThisUser = isCurrentLoggedInAdmin || !isTargetAdmin;

                return (
                  <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* الاسم والبريد */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div className="w-9 h-9 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-xs">
                            {user.fullName.substring(0, 2)}
                          </div>
                          {isUserOnline(user.id) ? (
                            <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white"></span>
                            </span>
                          ) : (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-slate-300 border-2 border-white" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center flex-wrap gap-1.5">
                            <span>{user.fullName}</span>
                            {currentUser?.id === user.id && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                                أنت الآن
                              </span>
                            )}
                            {isTargetAdmin && (
                              <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded font-bold">
                                حساب رئيسي
                              </span>
                            )}
                            {isUserOnline(user.id) ? (
                              <span className="text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                متصل الآن
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-400 font-medium">
                                غير متصل
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center flex-wrap gap-2">
                            <span>{user.email}</span>
                            {user.phone && <span>• {user.phone}</span>}
                            {user.telegramChatId ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.2 rounded font-sans">
                                <TelegramIcon className="w-3 h-3 text-sky-500" />
                                <span>تيليجرام مفعل</span>
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* الدور الوظيفي */}
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border inline-block ${roleDef.badgeColor}`}>
                        {roleDef.nameAr}
                      </span>
                    </td>

                    {/* كلمة المرور ورمز PIN */}
                    <td className="p-3.5">
                      {!canViewSecret ? (
                        <div className="space-y-1 text-[11px]">
                          <div className="flex items-center gap-1.5 text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200 w-fit">
                            <Lock className="w-3.5 h-3.5 text-rose-600" />
                            <span>محمي (عضوية الدعم الفني Admin)</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono pr-0.5">
                            •••••• / PIN: •••• (خاص بالمسؤول)
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1 font-mono text-[11px]">
                          <div className="flex items-center gap-1 text-slate-700">
                            <Lock className="w-3 h-3 text-slate-400" />
                            <span>كلمة السر:</span>
                            <span className="font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-900">
                              {user.password ? '••••••' : '123456'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-slate-700">
                            <KeyRound className="w-3 h-3 text-amber-500" />
                            <span>رمز PIN:</span>
                            <span className="font-bold bg-amber-50 text-amber-900 px-1.5 py-0.5 rounded border border-amber-200">
                              {user.pinCode || '1234'}
                            </span>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* صلاحيات لوحة التحكم */}
                    <td className="p-3.5">
                      {canAccessDashboard ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> مصرح بدخول اللوحة
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          <Lock className="w-3.5 h-3.5 text-slate-400" /> مقيد (كاشير/مبيعات)
                        </span>
                      )}
                    </td>

                    {/* حالة الحساب */}
                    <td className="p-3.5">
                      <button
                        type="button"
                        onClick={() => handleToggleUserActive(user)}
                        disabled={isTargetAdmin}
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                          isTargetAdmin ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
                        } ${
                          user.isActive !== false
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-rose-50 hover:text-rose-800'
                            : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-emerald-50 hover:text-emerald-800'
                        }`}
                        title={isTargetAdmin ? 'حساب الدعم الفني Admin نشط ومحمي دائماً' : 'انقر لتغيير الحالة'}
                      >
                        {user.isActive !== false ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> نشط
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-rose-600" /> موقوف
                          </>
                        )}
                      </button>
                    </td>

                    {/* أزرار العمليات */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {canEditThisUser ? (
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(user)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-amber-50 hover:border-amber-300 text-slate-700 hover:text-amber-900 transition-colors cursor-pointer"
                            title="تعديل البيانات والصلاحيات والرقم السري"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span
                            className="p-1.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed inline-flex items-center justify-center"
                            title="حساب الدعم الفني Admin محمي بالكامل: لا يمكن لمدير المنشأة تعديله أو كشف أرقامه السرية"
                          >
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                          </span>
                        )}

                        {!isTargetAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:border-rose-300 text-slate-400 hover:text-rose-700 transition-colors cursor-pointer"
                            title="حذف المستخدم"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* مودال إضافة وتعديل المستخدم والصلاحيات */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
            {/* رأس المودال */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  {isNewUser ? <UserPlus className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold">
                    {isNewUser ? 'إضافة مستخدم جديد للنظام' : `تعديل بيانات وصلاحيات: ${formData.fullName}`}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    تحديد هوية الدخول، الأرقام السرية، وتخصيص الصلاحيات بدقة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* جسم المودال القابل للتمرير */}
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
              {/* البيانات الشخصية الأساسية */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 pb-1 border-b border-slate-100 flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-500" />
                  <span>البيانات الشخصية والاتصال</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">الاسم الكامل للموظف *</label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      placeholder="مثال: صالح الياسين"
                      required
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">البريد الإلكتروني (اسم المستخدم) *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="alahsaey@gmail.com"
                      required
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">رقم الجوال</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="0500680180"
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">الدور الوظيفي الرئيسي *</label>
                    <select
                      value={formData.roleKey}
                      onChange={(e) => handleRoleChange(e.target.value as RoleKey)}
                      disabled={editingUserId === 'user_owner' || (!isCurrentLoggedInAdmin && formData.roleKey === 'system_owner')}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100"
                    >
                      {(isCurrentLoggedInAdmin || formData.roleKey === 'system_owner') && (
                        <option value="system_owner">الدعم الفني Admin (صلاحيات مطلقة)</option>
                      )}
                      <option value="manager">مدير المنشأة (Manager - إدارة تشغيلية)</option>
                      <option value="cashier">كاشير نقطة البيع (Cashier POS)</option>
                      <option value="sales_rep">مندوب مبيعات مقاولين (Sales Rep)</option>
                      <option value="inventory_officer">مسؤول المستودعات (Inventory Officer)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1.5">
                      <TelegramIcon className="w-3.5 h-3.5 text-sky-500" />
                      <span>معرف محادثة تيليجرام (Chat ID)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.telegramChatId}
                      onChange={(e) => setFormData({ ...formData, telegramChatId: e.target.value })}
                      placeholder="مثال: 123456789"
                      dir="ltr"
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-sky-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      لاستلام رمز OTP تلقائياً عبر تيليجرام عند نسيان الرقم السري
                    </span>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1.5">
                      <TelegramIcon className="w-3.5 h-3.5 text-sky-500" />
                      <span>اسم المستخدم في تيليجرام</span>
                    </label>
                    <input
                      type="text"
                      value={formData.telegramUsername}
                      onChange={(e) => setFormData({ ...formData, telegramUsername: e.target.value.replace(/^@/, '') })}
                      placeholder="saleh_alyaseen (بدون @)"
                      dir="ltr"
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
              </div>

              {/* الأمان والأرقام السرية */}
              {(() => {
                const targetUserObj = editingUserId ? availableUsers.find((u) => u.id === editingUserId) : null;
                const isTargetAdmin = !isNewUser && (targetUserObj?.roleKey === 'system_owner' || editingUserId === 'user_owner');
                const isManagerForbidden = isTargetAdmin && !isCurrentLoggedInAdmin;

                return (
                  <div className="space-y-4 pt-2">
                    <h4 className="font-bold text-slate-900 pb-1 border-b border-slate-100 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-amber-500" />
                        <span>كلمة المرور والرقم السري السريع (PIN)</span>
                      </span>
                      {isManagerForbidden && (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          حساب محمي أمنياً
                        </span>
                      )}
                    </h4>

                    {isManagerForbidden ? (
                      <div className="p-4 bg-rose-50/90 border border-rose-200 rounded-2xl flex items-start gap-3">
                        <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        <div className="space-y-1 text-xs text-rose-950">
                          <strong className="block text-sm font-black text-rose-900 flex items-center gap-1.5">
                            <span>الأرقام السرية لعضوية الدعم الفني Admin محمية بالكامل 🔒</span>
                          </strong>
                          <p className="text-rose-800 leading-relaxed text-[11.5px]">
                            وفقاً لسياسة الأمان الصارمة، لا يُسمح لمدير المنشأة بكشف أو استعراض كلمة المرور أو رمز PIN الخاص بعضوية الدعم الفني Admin، كما لا يحق له تعديلها. إدارة هذا الحساب وأرقامه محصورة فقط بالدعم الفني Admin نفسه عند تسجيل دخوله بحسابه.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">كلمة المرور للدخول *</label>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={formData.password}
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                              placeholder="أدخل كلمة مرور قوية"
                              required
                              className="w-full pr-3 pl-9 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            الافتراضي: <strong className="font-mono text-slate-600">123456</strong>
                          </span>
                        </div>

                        <div>
                          <label className="block text-slate-700 font-bold mb-1">الرقم السري السريع للكاشير (PIN 4 أرقام)</label>
                          <input
                            type="text"
                            maxLength={6}
                            value={formData.pinCode}
                            onChange={(e) => setFormData({ ...formData, pinCode: e.target.value })}
                            placeholder="مثال: 1234"
                            className="w-full p-2.5 bg-amber-50/50 border border-amber-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                          />
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            يستخدم للتبديل السريع عند شاشة الكاشير دون كتابة البريد كاملاً
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <input
                        type="checkbox"
                        id="isActiveToggle"
                        checked={formData.isActive}
                        disabled={editingUserId === 'user_owner' || isManagerForbidden}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                      />
                      <label htmlFor="isActiveToggle" className="cursor-pointer font-bold text-slate-800">
                        حساب نشط ومصرح له بالدخول للنظام
                      </label>
                    </div>
                  </div>
                );
              })()}

              {/* الصلاحيات المخصصة (Granular Permissions) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-500" />
                    <span>تخصيص الصلاحيات الفردية (Granular Overrides)</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    تم تحديد {formData.customPermissions.length} صلاحية
                  </span>
                </div>

                <p className="text-[11px] text-slate-500">
                  يمكنك منح هذا المستخدم صلاحيات إضافية محددة أو حجبها عنه بغض النظر عن دوره الافتراضي:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {GRANULAR_PERMISSIONS.map((perm) => {
                    const isChecked = formData.customPermissions.includes(perm.id) || formData.customPermissions.includes('all');
                    return (
                      <label
                        key={perm.id}
                        className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-amber-50/70 border-amber-300 text-amber-950 font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleTogglePermission(perm.id)}
                          className="w-4 h-4 text-amber-600 rounded mt-0.5 cursor-pointer shrink-0"
                        />
                        <div className="space-y-0.5">
                          <div className="text-xs">{perm.label}</div>
                          <span className="text-[10px] text-slate-400 font-normal block font-mono">
                            [{perm.category}] • {perm.id}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* أزرار الإجراءات في أسفل المودال */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  إلغاء
                </button>

                {(() => {
                  const targetUserObj = editingUserId ? availableUsers.find((u) => u.id === editingUserId) : null;
                  const isTargetAdmin = !isNewUser && (targetUserObj?.roleKey === 'system_owner' || editingUserId === 'user_owner');
                  const isManagerForbidden = isTargetAdmin && !isCurrentLoggedInAdmin;

                  return (
                    <button
                      type="submit"
                      disabled={isSaving || isManagerForbidden}
                      className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                      title={isManagerForbidden ? 'لا يمكن لمدير المنشأة تعديل حساب الدعم الفني Admin' : undefined}
                    >
                      <Check className="w-4 h-4 text-amber-400" />
                      <span>
                        {isSaving
                          ? 'جاري الحفظ...'
                          : isManagerForbidden
                          ? 'تعديل الأدمن محظور'
                          : isNewUser
                          ? 'إنشاء المستخدم'
                          : 'حفظ التعديلات'}
                      </span>
                    </button>
                  );
                })()}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة تأكيد حذف المستخدم */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {/* أيقونة التحذير والعنوان */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 ring-8 ring-rose-50">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900">
                  تأكيد حذف المستخدم نهائياً
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  هل أنت متأكد من رغبتك في حذف هذا الحساب من النظام وقاعدة البيانات؟
                </p>
              </div>
            </div>

            {/* بطاقة معلومات المستخدم المراد حذفه */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">اسم المستخدم:</span>
                <span className="font-black text-slate-900">{userToDelete.fullName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">البريد الإلكتروني:</span>
                <span className="font-mono text-slate-700">{userToDelete.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">الدور الوظيفي:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    ROLE_DEFINITIONS[userToDelete.roleKey]?.badgeColor || 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {ROLE_DEFINITIONS[userToDelete.roleKey]?.nameAr || userToDelete.roleKey}
                </span>
              </div>
              {userToDelete.phone && (
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-500">رقم الهاتف:</span>
                  <span className="font-mono text-slate-700">{userToDelete.phone}</span>
                </div>
              )}
            </div>

            {/* تنبيه تحذيري */}
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">إجراء غير قابل للتراجع:</p>
                <p className="text-[11px] text-rose-700 leading-relaxed">
                  سيتم سحب كافة صلاحيات المستخدم وإلغاء إمكانية دخوله إلى نقاط البيع وكافة واجهات النظام فوراً.
                </p>
                {userToDelete.id === currentUser?.id && (
                  <p className="text-[11px] font-bold text-rose-800 mt-1">
                    ⚠️ تنبيه: هذا هو حسابك الحالي المسجل دخول به، سيتم تسجيل خروجك تلقائياً بعد الحذف.
                  </p>
                )}
              </div>
            </div>

            {/* أزرار الإجراءات */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 cursor-pointer text-xs transition-colors"
              >
                إلغاء التراجع
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-md transition-all disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'جاري الحذف...' : 'تأكيد الحذف النهائي'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
