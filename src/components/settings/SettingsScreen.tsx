/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Percent,
  FileText,
  Printer,
  Users,
  ShieldCheck,
  CreditCard,
  Terminal,
  QrCode,
  Store,
  Database,
  Save,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  HardDrive,
  FileCheck,
  Image as ImageIcon,
  Sparkles,
  Trash2,
  RotateCcw,
  Eye,
  Globe,
  FileImage,
  ExternalLink,
  Check,
  Warehouse as WarehouseIcon,
  Plus,
  Edit2,
  MapPin,
  Navigation,
  User,
  Mail,
  Send,
  Key,
  AtSign,
  MessageSquare,
  Smartphone,
  Zap,
  Radio,
  Copy,
  Layers,
  Activity,
  CheckSquare,
  Info,
  Server,
} from 'lucide-react';
import {
  CompleteSystemSettings,
  DEFAULT_SYSTEM_SETTINGS,
  getSystemSettings,
  saveSystemSettings,
  exportDatabaseBackup,
  restoreDatabaseFromBackup,
  WhatsAppGatewayConfig,
  TelegramGatewayConfig,
} from '../../services/settings';
import { testSmtpSettings } from '../../services/emailService';
import {
  testWhatsAppGateway,
  generatePairingQRCode,
  requestWhatsAppPairingCode,
  verifyWhatsAppPairingCode,
  confirmWhatsAppPairing,
  disconnectWhatsAppSession,
  getWhatsAppConnectionStatus,
  getWhatsAppOutboxLogs,
  sendDirectWhatsApp,
  syncWhatsAppSettingsWithServer,
  getWhatsAppApiBaseUrl,
  setWhatsAppApiBaseUrl,
  testCustomBackendServer,
  isStaticOrGitHubPages,
} from '../../services/whatsappService';
import {
  testTelegramGateway,
  getTelegramBotInfo,
  getRecentTelegramUpdates,
  TelegramBotInfo,
} from '../../services/telegramService';
import { TelegramIcon } from '../common/TelegramIcon';

import { getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from '../../services/db';
import { Warehouse } from '../../types';
import { setStoredLogoUrl, updateAppFavicon } from '../../utils/favicon';
import { EmadcoLogo } from '../common/EmadcoLogo';
import { useAuth } from '../../context/AuthContext';
import { RoleMatrix } from '../RoleMatrix';
import { PaymentSettingsScreen } from './PaymentSettingsScreen';
import { UsersManagementScreen } from './UsersManagementScreen';
import { WarehousesManagerModal } from '../inventory/WarehousesManagerModal';
import { DatabaseFormatModal } from './DatabaseFormatModal';

type SettingsTab =
  | 'facility'
  | 'warehouses'
  | 'tax'
  | 'invoicing'
  | 'printing'
  | 'whatsapp'
  | 'email'
  | 'telegram'
  | 'users'
  | 'roles'
  | 'payment_methods'
  | 'pos_integration'
  | 'zatca'
  | 'storefront'
  | 'backup';


export const SettingsScreen: React.FC = () => {
  const { currentUser, availableUsers, availableRoles } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('facility');
  const [settings, setSettings] = useState<CompleteSystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [warehousesList, setWarehousesList] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // حالة النسخ الاحتياطي والفورمات
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [backupStats, setBackupStats] = useState<{ lastExport?: string; lastRecords?: number } | null>(null);
  const [isFormatModalOpen, setIsFormatModalOpen] = useState<boolean>(false);

  // حالة رفع وإدارة الشعار
  const [isDraggingLogo, setIsDraggingLogo] = useState<boolean>(false);
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [isUrlModalOpen, setIsUrlModalOpen] = useState<boolean>(false);
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState<boolean>(false);

  // حالة اختبار خادم البريد SMTP
  const [testEmailRecipient, setTestEmailRecipient] = useState<string>('');
  const [isTestingSmtp, setIsTestingSmtp] = useState<boolean>(false);
  const [testSmtpResult, setTestSmtpResult] = useState<{ success: boolean; message: string } | null>(null);

  // حالة محرك وباركود الواتساب المباشر
  const [testWhatsAppPhone, setTestWhatsAppPhone] = useState<string>('0500680180');
  const [testWhatsAppMessage, setTestWhatsAppMessage] = useState<string>('مرحباً بك أستاذ صالح الياسين، تجربة فحص إرسال مباشر من نظام ERP لمواد البناء.');
  const [isTestingWhatsApp, setIsTestingWhatsApp] = useState<boolean>(false);
  const [testWhatsAppResult, setTestWhatsAppResult] = useState<{ success: boolean; message: string; messageId?: string; provider?: string } | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState<boolean>(false);
  const [liveQrDataUrl, setLiveQrDataUrl] = useState<string>('');
  const [qrRemainingSeconds, setQrRemainingSeconds] = useState<number>(25);
  const [pairingMethod, setPairingMethod] = useState<'qr' | 'code'>('qr');
  const [pairingCodeDisplay, setPairingCodeDisplay] = useState<string>('');
  const [pairingCodeInput, setPairingCodeInput] = useState<string>('');
  const [pairingWaShareUrl, setPairingWaShareUrl] = useState<string>('');
  const [isRequestingPairingCode, setIsRequestingPairingCode] = useState<boolean>(false);
  const [isVerifyingPairingCode, setIsVerifyingPairingCode] = useState<boolean>(false);
  const [isPairingWhatsApp, setIsPairingWhatsApp] = useState<boolean>(false);
  const [isDisconnectingWhatsApp, setIsDisconnectingWhatsApp] = useState<boolean>(false);
  const [pairingPhoneInput, setPairingPhoneInput] = useState<string>('0500680180');
  const [pairingDeviceInput, setPairingDeviceInput] = useState<string>('هاتف المحاسبة والإدارة (صالح الياسين)');
  const [codeCopied, setCodeCopied] = useState<boolean>(false);
  const [whatsappOutboxLogs, setWhatsappOutboxLogs] = useState<any[]>([
    {
      id: 'WA-MSG-9921',
      toPhone: '0500680180',
      message: 'مرحباً أستاذ صالح الياسين، تم إصدار فاتورة ضريبية رقم INV-2026-001 بمبلغ 2,875.00 ر.س بنجاح.',
      status: 'sent',
      provider: 'المحرك المباشر بالباركود (Direct Driver)',
      timestamp: new Date().toLocaleTimeString('ar-SA'),
    },
  ]);
  const [isLoadingOutbox, setIsLoadingOutbox] = useState<boolean>(false);
  const [customServerUrl, setCustomServerUrl] = useState<string>(() => getWhatsAppApiBaseUrl());
  const [isTestingServerUrl, setIsTestingServerUrl] = useState<boolean>(false);
  const [serverTestResult, setServerTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // حالة اختبار بوت وإشعارات تيليجرام
  const [testTelegramChatId, setTestTelegramChatId] = useState<string>('');
  const [isTestingTelegram, setIsTestingTelegram] = useState<boolean>(false);
  const [testTelegramResult, setTestTelegramResult] = useState<{ success: boolean; message: string; botInfo?: TelegramBotInfo } | null>(null);
  const [isLoadingTelegramUpdates, setIsLoadingTelegramUpdates] = useState<boolean>(false);
  const [recentTelegramUpdates, setRecentTelegramUpdates] = useState<any[]>([]);

  // مزامنة حالة الواتساب التلقائية والتحديث الحي للباركود
  useEffect(() => {
    let timer: any = null;
    const checkStatus = async () => {
      try {
        const res = await getWhatsAppConnectionStatus();
        if (res.connected) {
          if (settings.whatsappGateway?.sessionStatus !== 'connected') {
            setSettings((prev) => ({
              ...prev,
              whatsappGateway: {
                ...(prev.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!),
                sessionStatus: 'connected',
                pairedPhoneNumber: res.phone || prev.whatsappGateway?.pairedPhoneNumber || '0500680180',
                pairedDeviceName: res.deviceName || prev.whatsappGateway?.pairedDeviceName,
                provider: 'direct_qr',
              },
            }));
            setLiveQrDataUrl('');
            setPairingCodeDisplay('');
            showToast('success', '🟢 تم اقتران وربط واتساب بنجاح مع النظام المحاسبي! المحرك جاهز الآن.');
          }
        } else {
          // إذا كانت الجلسة مقطوعة من السيرفر، نصحح الحالة فوراً
          if (settings.whatsappGateway?.sessionStatus === 'connected') {
            setSettings((prev) => ({
              ...prev,
              whatsappGateway: {
                ...(prev.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!),
                sessionStatus: 'disconnected',
              },
            }));
          }

          // تحديث الباركود الحي باستمرار لتجنب انتهاء الصلاحية
          if (res.qrCodeData && pairingMethod === 'qr') {
            setLiveQrDataUrl(res.qrCodeData);
          }
          if (typeof res.qrRemainingSeconds === 'number') {
            setQrRemainingSeconds(res.qrRemainingSeconds);
          }
        }
      } catch (e) {}
    };

    if (activeTab === 'whatsapp') {
      checkStatus();
      timer = setInterval(checkStatus, 2500);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeTab, settings.whatsappGateway?.sessionStatus, pairingMethod]);

  // توليد تلقائي فوري للباركود أو كود الاقتران بمجرد فتح تبويب الواتساب لتجنب بقاء الشاشة فارغة
  useEffect(() => {
    if (activeTab !== 'whatsapp' || settings.whatsappGateway?.sessionStatus === 'connected') return;

    if (pairingMethod === 'qr' && !liveQrDataUrl && !isGeneratingQr) {
      setIsGeneratingQr(true);
      generatePairingQRCode(pairingPhoneInput || '0500680180', false)
        .then((res) => {
          if (res.success && res.qrDataUrl) {
            setLiveQrDataUrl(res.qrDataUrl);
            if (res.remainingSeconds) setQrRemainingSeconds(res.remainingSeconds);
          }
        })
        .catch(() => {})
        .finally(() => setIsGeneratingQr(false));
    } else if (pairingMethod === 'code' && !pairingCodeDisplay && !isRequestingPairingCode) {
      setIsRequestingPairingCode(true);
      requestWhatsAppPairingCode(pairingPhoneInput || '0500680180')
        .then((res) => {
          if (res.success && res.pairingCode) {
            setPairingCodeDisplay(res.pairingCode);
            setPairingCodeInput(res.pairingCode);
            if (res.waShareUrl) setPairingWaShareUrl(res.waShareUrl);
          }
        })
        .catch(() => {})
        .finally(() => setIsRequestingPairingCode(false));
    }
  }, [activeTab, pairingMethod, settings.whatsappGateway?.sessionStatus]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const processLogoFile = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('error', 'يرجى اختيار ملف صورة صالح (PNG, JPG, SVG, WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('error', 'حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 5 ميجابايت');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (file.type === 'image/svg+xml' || file.size < 200 * 1024) {
        setSettings((prev) => ({
          ...prev,
          facility: { ...prev.facility, logoUrl: dataUrl },
        }));
        setStoredLogoUrl(dataUrl);
        showToast('success', 'تم تحميل الشعار بنجاح! اضغط على "حفظ التعديلات" لتثبيته.');
      } else {
        // ضغط وتحسين الصور النقطية الكبيرة لتبقى سريعة في قاعدة البيانات
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 500;
          const scale = Math.min(1, MAX_WIDTH / img.width);
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          const optimizedUrl = canvas.toDataURL('image/png', 0.9);
          setSettings((prev) => ({
            ...prev,
            facility: { ...prev.facility, logoUrl: optimizedUrl },
          }));
          setStoredLogoUrl(optimizedUrl);
          showToast('success', 'تم تحسين وتعيين الشعار بنجاح! اضغط على "حفظ التعديلات" لتثبيته.');
        };
        img.src = dataUrl;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLogoDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingLogo(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processLogoFile(file);
    }
  };

  const handleLogoFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processLogoFile(file);
    }
    e.target.value = '';
  };

  const handleApplyCustomUrl = () => {
    if (!customUrlInput.trim()) return;
    setSettings((prev) => ({
      ...prev,
      facility: { ...prev.facility, logoUrl: customUrlInput.trim() },
    }));
    setStoredLogoUrl(customUrlInput.trim());
    setIsUrlModalOpen(false);
    setCustomUrlInput('');
    showToast('success', 'تم تطبيق رابط الشعار! اضغط على "حفظ التعديلات" لاعتماده.');
  };

  const handleRemoveCustomLogo = () => {
    setSettings((prev) => ({
      ...prev,
      facility: { ...prev.facility, logoUrl: '' },
    }));
    setStoredLogoUrl('');
    showToast('success', 'تم استعادة الشعار والأيقونة الافتراضية للنظام بنجاح.');
  };

  const handleAutoGenerateMapUrl = () => {
    const parts = [
      settings.facility.city,
      settings.facility.district,
      settings.facility.street,
    ].filter(Boolean);
    if (parts.length === 0) {
      showToast('error', 'يرجى إدخال المدينة أو الحي والشارع أولاً لتوليد الرابط تلقائياً');
      return;
    }
    const query = parts.join(' ');
    const url = `https://maps.google.com/?q=${encodeURIComponent(query)}`;
    setSettings((prev) => ({
      ...prev,
      facility: { ...prev.facility, googleMapsUrl: url },
    }));
    showToast('success', 'تم توليد وتعيين رابط خرائط جوجل تلقائياً بناءً على العنوان.');
  };

  const handleDetectCurrentLocation = () => {
    if (!navigator.geolocation) {
      showToast('error', 'المتصفح لا يدعم تحديد الموقع الجغرافي');
      return;
    }
    showToast('success', 'جاري طلب إحداثيات الموقع الجغرافي الحالي...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        const url = `https://maps.google.com/?q=${lat},${lng}`;
        setSettings((prev) => ({
          ...prev,
          facility: { ...prev.facility, googleMapsUrl: url },
        }));
        showToast('success', `تم التقاط إحداثيات الموقع بنجاح (${lat}, ${lng})! اضغط حفظ التعديلات لتثبيته.`);
      },
      (err) => {
        showToast('error', 'تعذر الحصول على الموقع: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const [data, whs] = await Promise.all([
        getSystemSettings(),
        getWarehouses(),
      ]);
      setSettings(data);
      setWarehousesList(whs);
    } catch (err) {
      console.error('فشل جلب الإعدادات:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const saved = await saveSystemSettings(settings, currentUser?.fullName || 'المدير');
      setSettings(saved);

      // مزامنة وتثبيت جلسة الواتساب مع خادم النظام لضمان استمرار الاتصال دائماً دون انقطاع
      if (settings.whatsappGateway) {
        syncWhatsAppSettingsWithServer({
          phone: settings.whatsappGateway.pairedPhoneNumber || '0500680180',
          deviceName: settings.whatsappGateway.pairedDeviceName || 'هاتف المحاسبة والإدارة (صالح الياسين)',
          enabled: settings.whatsappGateway.enabled ?? true,
          sessionStatus: settings.whatsappGateway.sessionStatus || 'connected',
        }).catch(() => {});
      }

      showToast('success', 'تم حفظ جميع الإعدادات وتحديث بيانات النظام وتثبيت اتصال الواتساب بنجاح.');
    } catch (err: any) {
      showToast('error', err?.message || 'تعذر حفظ الإعدادات، يرجى المحاولة لاحقاً.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      setIsExporting(true);
      const backup = await exportDatabaseBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `emadco_pos_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setBackupStats({
        lastExport: new Date().toLocaleTimeString('ar-SA'),
        lastRecords: backup.totalRecords,
      });
      showToast('success', `تم تصدير النسخة الاحتياطية بنجاح (${backup.totalRecords} سجل).`);
    } catch (err: any) {
      showToast('error', 'فشل تصدير النسخة الاحتياطية: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestoreFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setIsRestoring(true);
        const json = JSON.parse(event.target?.result as string);
        const result = await restoreDatabaseFromBackup(json, currentUser?.fullName || 'الدعم الفني Admin');
        showToast('success', result.message);
        loadSettings();
      } catch (err: any) {
        showToast('error', 'فشل استعادة النسخة الاحتياطية: ' + (err?.message || 'الملف تالف أو غير صالح'));
      } finally {
        setIsRestoring(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const tabs: { id: SettingsTab; label: string; icon: any }[] = [
    { id: 'facility', label: 'بيانات المنشأة', icon: Building2 },
    { id: 'warehouses', label: 'المستودعات والمخازن', icon: WarehouseIcon },
    { id: 'tax', label: 'الضريبة (VAT)', icon: Percent },
    { id: 'invoicing', label: 'الفواتير والترقيم', icon: FileText },
    { id: 'printing', label: 'الطباعة والطابعات', icon: Printer },
    { id: 'whatsapp', label: 'واتساب المباشر والباركود (Direct WhatsApp)', icon: MessageSquare },
    { id: 'email', label: 'البريد وخادم SMTP (إرسال الرموز)', icon: Mail },
    { id: 'telegram', label: 'بوت وإشعارات تيليجرام (OTP & Alerts)', icon: TelegramIcon },
    { id: 'users', label: 'المستخدمين', icon: Users },

    { id: 'roles', label: 'الصلاحيات والأدوار', icon: ShieldCheck },
    { id: 'payment_methods', label: 'طرق الدفع', icon: CreditCard },
    { id: 'pos_integration', label: 'أجهزة نقاط البيع POS', icon: Terminal },
    { id: 'zatca', label: 'الفوترة الإلكترونية ZATCA', icon: QrCode },
    { id: 'storefront', label: 'إعدادات المتجر', icon: Store },
    { id: 'backup', label: 'النسخ الاحتياطي والاستعادة', icon: Database },
  ];

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <RefreshCw className="w-8 h-8 mx-auto animate-spin text-amber-500 mb-2" />
        <p className="font-bold">جاري تحميل إعدادات النظام ومزامنة السحابة...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* رأس شاشة الإعدادات */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-amber-500" />
            <span>إعدادات النظام والتهيئة المؤسسية</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            إدارة المنشأة، الضريبة، الفواتير، الطابعات، مستخدمي النظام، أجهزة POS، والنسخ الاحتياطي
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab !== 'roles' && activeTab !== 'backup' && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin text-amber-400" /> : <Save className="w-4 h-4 text-amber-400" />}
              <span>{isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
            </button>
          )}
        </div>
      </div>

      {/* شريط الإشعار المنبثق */}
      {toast && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
              : 'bg-rose-50 text-rose-800 border border-rose-300'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* التخطيط: شريط التبويبات الجانبي ومحتوى الإعدادات */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* القائمة الجانبية للتبويبات */}
        <div className="lg:col-span-3 space-y-1 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs h-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-right ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* مساحة عرض المحتوى النشط */}
        <div className="lg:col-span-9 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          {/* 1. بيانات المنشأة */}
          {activeTab === 'facility' && (
            <form onSubmit={handleSave} className="space-y-6">
              {/* قسم رفع واعتماد شعار وأيقونة الموقع */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white flex items-center gap-2">
                        <span>شعار وأيقونة المنشأة والموقع (Branding & Logo)</span>
                        {settings.facility.logoUrl ? (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                            شعار مخصص معتمد
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                            الشعار الهندسي الافتراضي
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        يُعتمد الشعار تلقائياً كأيقونة للمتصفح (Favicon)، وفي الشريط العلوي للنظام، وعروض الأسعار، والفواتير الضريبية
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {settings.facility.logoUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveCustomLogo}
                        className="px-3 py-1.5 text-xs font-bold text-rose-300 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/50 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                        title="استعادة الشعار الافتراضي"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>استعادة الشعار الافتراضي</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* منطقة السحب والإفلات والرفع */}
                  <div className="lg:col-span-6 space-y-3">
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingLogo(true);
                      }}
                      onDragLeave={() => setIsDraggingLogo(false)}
                      onDrop={handleLogoDrop}
                      className={`relative border-2 border-dashed rounded-2xl p-5 text-center transition-all flex flex-col items-center justify-center gap-2.5 ${
                        isDraggingLogo
                          ? 'border-amber-400 bg-amber-500/10'
                          : 'border-slate-700 hover:border-slate-600 bg-slate-950/50'
                      }`}
                    >
                      <input
                        type="file"
                        id="logo-file-input"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={handleLogoFileInput}
                        className="hidden"
                      />

                      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                        <Upload className="w-6 h-6" />
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-200">
                          اسحب وأفلت ملف الشعار هنا، أو
                        </p>
                        <label
                          htmlFor="logo-file-input"
                          className="inline-block px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl cursor-pointer transition-all shadow-sm"
                        >
                          تصفح واختيار صورة من جهازك
                        </label>
                      </div>

                      <p className="text-[10px] text-slate-400 leading-normal">
                        يدعم صيغ <span className="font-mono font-bold text-slate-300">PNG, JPG, SVG, WebP</span> (يُفضل صورة مربعة أو بخلفية شفافة بدقة عالية)
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                      <span>أو يمكنك إدخال رابط مباشر للشعار:</span>
                      <button
                        type="button"
                        onClick={() => setIsUrlModalOpen(!isUrlModalOpen)}
                        className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>{isUrlModalOpen ? 'إغلاق الرابط' : 'إدخال رابط URL'}</span>
                      </button>
                    </div>

                    {isUrlModalOpen && (
                      <div className="flex items-center gap-2 p-2 bg-slate-950/80 rounded-xl border border-slate-700">
                        <input
                          type="url"
                          placeholder="https://example.com/logo.png"
                          value={customUrlInput}
                          onChange={(e) => setCustomUrlInput(e.target.value)}
                          dir="ltr"
                          className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white placeholder:text-slate-500 outline-hidden focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={handleApplyCustomUrl}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer"
                        >
                          تطبيق
                        </button>
                      </div>
                    )}
                  </div>

                  {/* معاينة حية متعددة للشعار */}
                  <div className="lg:col-span-6 bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300 border-b border-slate-800/80 pb-2">
                      <span className="flex items-center gap-1.5 text-amber-400">
                        <Eye className="w-4 h-4" />
                        <span>معاينة حية ومطابقة لأماكن الظهور:</span>
                      </span>
                      <span className="text-[10px] text-slate-400">تحديث فوري</span>
                    </div>

                    {/* 1. معاينة الهيدر */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400">١. الشريط العلوي للنظام (Header):</span>
                      <div className="bg-white text-slate-900 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <EmadcoLogo
                            size="sm"
                            variant="compact"
                            showSubtitle={true}
                            customLogoUrl={settings.facility.logoUrl}
                          />
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span>متصل بالسحابة</span>
                        </div>
                      </div>
                    </div>

                    {/* 2. معاينة أيقونة المتصفح Favicon */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400">٢. أيقونة تبويب المتصفح (Browser Tab Favicon):</span>
                      <div className="bg-slate-800 p-2 rounded-xl border border-slate-700 flex items-center gap-2 max-w-xs">
                        <div className="w-5 h-5 rounded-md bg-white p-0.5 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                          {settings.facility.logoUrl ? (
                            <img src={settings.facility.logoUrl} alt="Favicon" className="w-full h-full object-contain" />
                          ) : (
                            <EmadcoLogo size="xs" variant="icon" />
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-slate-200 truncate">
                          {settings.facility.nameAr || 'عمادكو لمواد البناء'} - POS
                        </span>
                      </div>
                    </div>

                    {/* 3. معاينة ترويسة الفاتورة الضريبية */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400">٣. ترويسة الفاتورة الضريبية وعروض الأسعار:</span>
                      <div className="bg-amber-50/70 border border-amber-200/80 p-2.5 rounded-xl flex items-center gap-3 text-slate-900">
                        <div className="w-10 h-10 bg-white p-1 rounded-lg border border-amber-200 flex items-center justify-center shrink-0">
                          {settings.facility.logoUrl ? (
                            <img src={settings.facility.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                          ) : (
                            <EmadcoLogo size="sm" variant="icon" />
                          )}
                        </div>
                        <div className="text-[10px] leading-tight space-y-0.5">
                          <p className="font-black text-slate-950">{settings.facility.nameAr}</p>
                          <p className="font-mono text-slate-600">الرقم الضريبي: {settings.facility.vatNumber || '310948572100003'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* بيانات المؤسسة والسجل التجاري */}
              <h3 className="text-sm font-black text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-500" />
                <span>بيانات المؤسسة والسجل التجاري</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">اسم المنشأة باللغة العربية *</label>
                  <input
                    type="text"
                    value={settings.facility.nameAr}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        facility: { ...settings.facility, nameAr: e.target.value },
                      })
                    }
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">اسم المنشأة بالإنجليزية</label>
                  <input
                    type="text"
                    value={settings.facility.nameEn}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        facility: { ...settings.facility, nameEn: e.target.value },
                      })
                    }
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">رقم السجل التجاري (CR) *</label>
                  <input
                    type="text"
                    value={settings.facility.crNumber}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        facility: { ...settings.facility, crNumber: e.target.value },
                      })
                    }
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">الرقم الضريبي (15 رقم) *</label>
                  <input
                    type="text"
                    value={settings.facility.vatNumber}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        facility: { ...settings.facility, vatNumber: e.target.value },
                      })
                    }
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">المدينة *</label>
                  <input
                    type="text"
                    value={settings.facility.city}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        facility: { ...settings.facility, city: e.target.value },
                      })
                    }
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">الحي</label>
                  <input
                    type="text"
                    value={settings.facility.district || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        facility: { ...settings.facility, district: e.target.value },
                      })
                    }
                    placeholder="مثال: حي الصناعية القديمة"
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">الشارع والمبنى</label>
                  <input
                    type="text"
                    value={settings.facility.street}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        facility: { ...settings.facility, street: e.target.value },
                      })
                    }
                    placeholder="مثال: شارع المقاولين الرئيسي - طريق الخرج"
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">الرمز البريدي</label>
                  <input
                    type="text"
                    value={settings.facility.postalCode || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        facility: { ...settings.facility, postalCode: e.target.value },
                      })
                    }
                    placeholder="مثال: 12844"
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">رقم الهاتف أو الجوال *</label>
                  <input
                    type="text"
                    value={settings.facility.phone}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        facility: { ...settings.facility, phone: e.target.value },
                      })
                    }
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">البريد الإلكتروني الرسمي</label>
                  <input
                    type="email"
                    value={settings.facility.email}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        facility: { ...settings.facility, email: e.target.value },
                      })
                    }
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">الموقع الإلكتروني للمؤسسة</label>
                  <input
                    type="url"
                    value={settings.facility.website || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        facility: { ...settings.facility, website: e.target.value },
                      })
                    }
                    placeholder="https://emadco.sa"
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">الدولة</label>
                  <input
                    type="text"
                    value={settings.facility.country || 'المملكة العربية السعودية'}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        facility: { ...settings.facility, country: e.target.value },
                      })
                    }
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* قسم موقع المؤسسة على الخريطة والمستودعات */}
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-rose-500" />
                    <span>موقع المؤسسة الجغرافي والخرائط والمستودعات المركزية</span>
                  </h3>
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                    ينعكس مباشرة في المتجر والفواتير وسندات القبض
                  </span>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                      <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-blue-600" />
                        <span>رابط موقع المؤسسة على خرائط جوجل (Google Maps URL)</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleDetectCurrentLocation}
                          className="px-2.5 py-1 text-[11px] font-bold bg-white text-slate-700 hover:text-blue-600 border border-slate-300 hover:border-blue-400 rounded-lg transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                          title="تحديد إحداثيات الموقع الجغرافي الحالي للجهاز"
                        >
                          <Navigation className="w-3 h-3 text-blue-600" />
                          <span>تحديد موقعي الحالي</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleAutoGenerateMapUrl}
                          className="px-2.5 py-1 text-[11px] font-bold bg-white text-slate-700 hover:text-amber-600 border border-slate-300 hover:border-amber-400 rounded-lg transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                          title="توليد رابط خريطة تلقائي بناءً على المدينة والشارع المدخلين"
                        >
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          <span>توليد رابط تلقائي</span>
                        </button>
                        {settings.facility.googleMapsUrl && (
                          <a
                            href={settings.facility.googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all flex items-center gap-1 shadow-xs"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>فتح وتجربة الرابط</span>
                          </a>
                        )}
                      </div>
                    </div>
                    <input
                      type="url"
                      value={settings.facility.googleMapsUrl || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          facility: { ...settings.facility, googleMapsUrl: e.target.value },
                        })
                      }
                      placeholder="https://maps.google.com/?q=24.6333,46.7167 أو رابط خرائط جوجل المختصر"
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      هذا الرابط يتم استخدامه في المتجر الإلكتروني لتمكين العملاء من فتح موقع المؤسسة بنقرة واحدة، وكذلك في رسائل الواتساب وعروض الأسعار.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-700 font-bold text-xs mb-1">
                        وصف الموقع والمعرض والمستودع الرئيسي
                      </label>
                      <textarea
                        rows={2}
                        value={settings.facility.locationDescription || ''}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            facility: { ...settings.facility, locationDescription: e.target.value },
                          })
                        }
                        placeholder="مثال: الرياض، طريق الخرج القديم، حي الصناعية، بجوار سوق مواد البناء، هنجر رقم 14 و 18."
                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold text-xs mb-1">
                        وصف ساحة التوريد وتفريغ الشاحنات
                      </label>
                      <textarea
                        rows={2}
                        value={settings.facility.warehouseDescription || ''}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            facility: { ...settings.facility, warehouseDescription: e.target.value },
                          })
                        }
                        placeholder="مثال: مجهزة برافعة شوكية وأرصفة تحميل دينا وتريلا لتسريع تسليم البضائع للمقاولين."
                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold text-xs mb-1">
                      نبذة تعريفية عن المؤسسة ونشاطها التجاري
                    </label>
                    <textarea
                      rows={2}
                      value={settings.facility.commercialDescription || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          facility: { ...settings.facility, commercialDescription: e.target.value },
                        })
                      }
                      placeholder="نبذة تظهر في واجهة المتجر وتذييل التقارير الرسمية..."
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* زر حفظ النموذج */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 rounded-xl text-xs font-black transition-all shadow-md shadow-amber-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{isSaving ? 'جاري حفظ التعديلات...' : 'حفظ بيانات وموقع المنشأة'}</span>
                </button>
              </div>
            </form>
          )}

          {/* 1.2. إدارة المستودعات والمخازن */}
          {activeTab === 'warehouses' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <WarehouseIcon className="w-4 h-4 text-amber-500" />
                    <span>إدارة وتخصيص المستودعات والمخازن</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    يمكنك إضافة وتعديل وتعيين المستودع الرئيسي لربط الأصناف والمبيعات والمخزون
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsWarehouseModalOpen(true)}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>إدارة وترتيب المستودعات</span>
                </button>
              </div>

              {/* قائمة المستودعات */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {warehousesList.map((wh, idx) => (
                  <div
                    key={wh.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      wh.isPrimary
                        ? 'bg-amber-50/50 border-amber-300 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 font-mono font-bold text-[10px] flex items-center justify-center border border-slate-200 shrink-0" title={`الترتيب: #${idx + 1}`}>
                          #{idx + 1}
                        </span>
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-black ${
                            wh.isPrimary
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          <WarehouseIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{wh.nameAr}</span>
                            {wh.isPrimary && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900">
                                المستودع الأولي الافتراضي
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-slate-500">رمز الكود: {wh.code}</span>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          wh.isActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {wh.isActive ? 'نشط' : 'معطل'}
                      </span>
                    </div>

                    <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                      <div className="flex items-center gap-3">
                        {wh.location && (
                          <span className="flex items-center gap-1 text-[11px] text-slate-500">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {wh.location}
                          </span>
                        )}
                        {wh.managerName && (
                          <span className="flex items-center gap-1 text-[11px] text-slate-500">
                            <User className="w-3 h-3 text-slate-400" />
                            {wh.managerName}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsWarehouseModalOpen(true)}
                        className="text-[11px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>تعديل</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. إعدادات الضريبة */}
          {activeTab === 'tax' && (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
                <Percent className="w-4 h-4 text-amber-500" />
                <span>ضريبة القيمة المضافة ولوائح هيئة الزكاة (VAT)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <label className="block text-slate-700 font-bold">نسبة الضريبة القياسية الافتراضية (%)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={settings.tax.defaultVatPercent}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          tax: { ...settings.tax, defaultVatPercent: Number(e.target.value) },
                        })
                      }
                      className="w-24 p-2 border border-slate-300 rounded-lg font-bold font-mono text-slate-900"
                    />
                    <span className="font-bold text-slate-600">% (المملكة العربية السعودية: 15%)</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block">الأسعار المعروضة شاملة الضريبة</span>
                    <span className="text-[11px] text-slate-500">
                      احتساب الضريبة داخلياً دون زيادتها على العميل عند الدفع
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.tax.isPriceInclusiveVat}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        tax: { ...settings.tax, isPriceInclusiveVat: e.target.checked },
                      })
                    }
                    className="w-5 h-5 text-amber-600 rounded-md cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. الفواتير والترقيم */}
          {activeTab === 'invoicing' && (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                <span>بادئات الترقيم وسياسات البيع والاسترجاع</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">بادئة فواتير المبيعات</label>
                  <input
                    type="text"
                    value={settings.invoicing.invoicePrefix}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        invoicing: { ...settings.invoicing, invoicePrefix: e.target.value },
                      })
                    }
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">بادئة المرتجعات</label>
                  <input
                    type="text"
                    value={settings.invoicing.returnPrefix}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        invoicing: { ...settings.invoicing, returnPrefix: e.target.value },
                      })
                    }
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">مهلة الاسترجاع (أيام)</label>
                  <input
                    type="number"
                    value={settings.invoicing.returnPolicyDays}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        invoicing: { ...settings.invoicing, returnPolicyDays: Number(e.target.value) },
                      })
                    }
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="text-xs">
                <label className="block text-slate-700 font-bold mb-1">الشروط والأحكام المطبوعة أسفل الفاتورة</label>
                <textarea
                  rows={3}
                  value={settings.invoicing.termsAndConditions}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      invoicing: { ...settings.invoicing, termsAndConditions: e.target.value },
                    })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-900"
                />
              </div>
            </div>
          )}

          {/* 4. الطباعة */}
          {activeTab === 'printing' && (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
                <Printer className="w-4 h-4 text-amber-500" />
                <span>إعدادات طابعات الكاشير والـ A4</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <label className="block text-slate-700 font-bold mb-2">نوع الطباعة الافتراضي</label>
                  <select
                    value={settings.printing.defaultPrinterType}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        printing: {
                          ...settings.printing,
                          defaultPrinterType: e.target.value as any,
                        },
                      })
                    }
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900"
                  >
                    <option value="thermal_80mm">طابعة إيصالات حرارية (Thermal 80mm POS)</option>
                    <option value="standard_a4">فاتورة ضريبية قياسية (Standard A4 Paper)</option>
                  </select>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block">الطباعة التلقائية فور السداد</span>
                    <span className="text-[11px] text-slate-500">فتح نافذة الطباعة فور نجاح عملية الدفع</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.printing.autoPrintOnPayment}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        printing: { ...settings.printing, autoPrintOnPayment: e.target.checked },
                      })
                    }
                    className="w-5 h-5 text-amber-600 rounded-md cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* تبويب إعدادات البريد وخادم SMTP */}
          {activeTab === 'email' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      إعدادات خادم البريد الإلكتروني (SMTP) واستعادة كلمة المرور
                    </h3>
                    <p className="text-xs text-slate-500">
                      تهيئة خادم إرسال الإيميلات الفعلي لإرسال رموز التحقق المؤقتة (OTP) لمنع الاختراق وضمان وصول الرموز لحسابات المستخدمين
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-700">تفعيل نظام الإرسال</span>
                  <input
                    type="checkbox"
                    checked={settings.emailSmtp?.enabled ?? true}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        emailSmtp: {
                          ...(settings.emailSmtp || {}),
                          enabled: e.target.checked,
                          host: settings.emailSmtp?.host || 'smtp.gmail.com',
                          port: settings.emailSmtp?.port || 587,
                          secure: settings.emailSmtp?.secure || false,
                          user: settings.emailSmtp?.user || 'alahsaey@gmail.com',
                          pass: settings.emailSmtp?.pass || '',
                          senderEmail: settings.emailSmtp?.senderEmail || 'alahsaey@gmail.com',
                          senderName: settings.emailSmtp?.senderName || 'عمادكو لمواد البناء - نظام الأمان',
                        },
                      })
                    }
                    className="w-5 h-5 text-amber-600 rounded-md cursor-pointer"
                  />
                </div>
              </div>

              {/* بطاقة جدار الحماية والأمان */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3 text-xs text-amber-950">
                <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong className="block font-black text-amber-900 text-xs">
                    جدار الحماية الموثوق وبروتوكول إرسال البريد المباشر:
                  </strong>
                  <p className="leading-relaxed">
                    لحماية الحسابات من أي محاولات تلاعب أو اختراق، يقوم النظام بإرسال رموز الاستعادة عبر خادم البريد المعتمد للمؤسسة أو عبر خوادم Google الرسمية مباشرة إلى صندوق الوارد.
                  </p>
                </div>
              </div>

              {/* بطاقة إرشادية لكلمة مرور التطبيقات من Google */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 space-y-2">
                <div className="flex items-center gap-2 font-black text-blue-950">
                  <Key className="w-4 h-4 text-blue-600" />
                  <span>ملاحظة هامة عند استخدام بريد Gmail (تجنب خطأ 535):</span>
                </div>
                <p className="text-blue-800 leading-relaxed">
                  تمنع Google استخدام كلمة مرور البريد العادية في خوادم SMTP وتُرجع خطأ <code className="bg-blue-100 px-1 py-0.5 rounded font-mono font-bold">535 Invalid Login</code>. بدلاً من ذلك، يلزم توليد <strong>كلمة مرور تطبيقات (App Password)</strong> مكونة من 16 حرفاً:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-blue-900 font-medium pr-1">
                  <li>فعّل ميزة <strong>التحقق بخطوتين (2-Step Verification)</strong> في حساب Google الخاص بك.</li>
                  <li>
                    ادخل إلى صفحة: {' '}
                    <a
                      href="https://myaccount.google.com/apppasswords"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 underline font-mono font-bold hover:text-blue-900"
                    >
                      myaccount.google.com/apppasswords
                    </a>
                  </li>
                  <li>أنشئ كلمة مرور جديدة باسم <strong className="font-mono">Emadco ERP</strong> وانسخ الـ 16 حرفاً في حقل كلمة المرور أدناه.</li>
                </ol>
              </div>

              {/* بطاقة الحقول الأساسية */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    خادم البريد الصادر (SMTP Host)
                  </label>
                  <div className="relative">
                    <AtSign className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                    <input
                      type="text"
                      value={settings.emailSmtp?.host || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          emailSmtp: {
                            ...(settings.emailSmtp || {
                              enabled: true,
                              port: 587,
                              secure: false,
                              user: '',
                              pass: '',
                              senderEmail: '',
                              senderName: '',
                            }),
                            host: e.target.value,
                          },
                        })
                      }
                      placeholder="smtp.gmail.com"
                      className="w-full pr-9 pl-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">لبريد Gmail: smtp.gmail.com</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    المنفذ والتشفير (Port & Security)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={settings.emailSmtp?.port || 587}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          emailSmtp: {
                            ...(settings.emailSmtp || {
                              enabled: true,
                              host: 'smtp.gmail.com',
                              secure: false,
                              user: '',
                              pass: '',
                              senderEmail: '',
                              senderName: '',
                            }),
                            port: parseInt(e.target.value) || 587,
                          },
                        })
                      }
                      placeholder="587 أو 465"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                    <label className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-300 rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.emailSmtp?.secure || false}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            emailSmtp: {
                              ...(settings.emailSmtp || {
                                enabled: true,
                                host: 'smtp.gmail.com',
                                port: 587,
                                user: '',
                                pass: '',
                                senderEmail: '',
                                senderName: '',
                              }),
                              secure: e.target.checked,
                            },
                          })
                        }
                        className="w-4 h-4 text-amber-600 rounded"
                      />
                      <span className="text-xs font-bold text-slate-700">SSL (465)</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    بريد الإرسال والمصادقة (Username / Email)
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                    <input
                      type="email"
                      value={settings.emailSmtp?.user || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSettings({
                          ...settings,
                          emailSmtp: {
                            ...(settings.emailSmtp || {
                              enabled: true,
                              host: 'smtp.gmail.com',
                              port: 587,
                              secure: false,
                              pass: '',
                              senderName: '',
                            }),
                            user: val,
                            senderEmail: settings.emailSmtp?.senderEmail || val,
                          },
                        });
                      }}
                      placeholder="alahsaey@gmail.com"
                      className="w-full pr-9 pl-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    كلمة مرور التطبيق (App Password)
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                    <input
                      type="password"
                      value={settings.emailSmtp?.pass || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          emailSmtp: {
                            ...(settings.emailSmtp || {
                              enabled: true,
                              host: 'smtp.gmail.com',
                              port: 587,
                              secure: false,
                              user: '',
                              senderEmail: '',
                              senderName: '',
                            }),
                            pass: e.target.value,
                          },
                        })
                      }
                      placeholder="•••••••••••••••• (16 حرفاً لـ Gmail)"
                      className="w-full pr-9 pl-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    في Gmail أنشئ App Password من إعدادات أمان حساب Google المكونة من 16 حرفاً
                  </span>
                  {settings.emailSmtp?.pass && (settings.emailSmtp.pass.includes('.com') || settings.emailSmtp.pass.includes('http') || settings.emailSmtp.pass.includes('/')) && (
                    <span className="text-[11px] text-rose-600 font-bold mt-1.5 block bg-rose-50 p-2 rounded-lg border border-rose-200">
                      ⚠️ تنبيه: القيمة المدخلة تبدو كرابط موقع أو نطاق. كلمة مرور التطبيقات يجب أن تكون 16 حرفاً إنجليزياً (مثل: abcd efgh ijkl mnop) بدون روابط.
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    اسم المرسل الذي يظهر للمستلم
                  </label>
                  <input
                    type="text"
                    value={settings.emailSmtp?.senderName || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        emailSmtp: {
                          ...(settings.emailSmtp || {
                            enabled: true,
                            host: 'smtp.gmail.com',
                            port: 587,
                            secure: false,
                            user: '',
                            pass: '',
                            senderEmail: '',
                          }),
                          senderName: e.target.value,
                        },
                      })
                    }
                    placeholder="عمادكو لمواد البناء - نظام الأمان"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    البريد الإلكتروني للمرسل (From Email)
                  </label>
                  <input
                    type="email"
                    value={settings.emailSmtp?.senderEmail || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        emailSmtp: {
                          ...(settings.emailSmtp || {
                            enabled: true,
                            host: 'smtp.gmail.com',
                            port: 587,
                            secure: false,
                            user: '',
                            pass: '',
                            senderName: '',
                          }),
                          senderEmail: e.target.value,
                        },
                      })
                    }
                    placeholder="alahsaey@gmail.com أو no-reply@emadco.sa"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* قسم تجربة وفحص الاتصال بالخادم */}
              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 text-white space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">فحص الاتصال وإرسال بريد تجريبي</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">Test SMTP Connection</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <input
                      type="email"
                      value={testEmailRecipient}
                      onChange={(e) => setTestEmailRecipient(e.target.value)}
                      placeholder="أدخل بريداً لاستقبال الرسالة التجريبية (مثال: alahsaey@gmail.com)"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-hidden focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      disabled={isTestingSmtp}
                      onClick={async () => {
                        const targetEmail = testEmailRecipient.trim() || settings.emailSmtp?.user || '';
                        if (!targetEmail) {
                          showToast('error', 'يرجى كتابة بريد إلكتروني لاستقبال الرسالة التجريبية.');
                          return;
                        }
                        setIsTestingSmtp(true);
                        setTestSmtpResult(null);

                        try {
                          const res = await testSmtpSettings({
                            host: settings.emailSmtp?.host || 'smtp.gmail.com',
                            port: Number(settings.emailSmtp?.port) || 587,
                            secure: Boolean(settings.emailSmtp?.secure),
                            user: settings.emailSmtp?.user || '',
                            pass: settings.emailSmtp?.pass || '',
                            senderEmail: settings.emailSmtp?.senderEmail || settings.emailSmtp?.user || '',
                            senderName: settings.emailSmtp?.senderName || 'عمادكو لمواد البناء',
                            testRecipient: targetEmail,
                          });
                          setTestSmtpResult(res);
                          if (res.success) {
                            showToast('success', 'تم إرسال البريد التجريبي بنجاح!');
                          } else {
                            showToast('error', res.message || 'فشل الاتصال بخادم البريد');
                          }
                        } catch (err: any) {
                          setTestSmtpResult({
                            success: false,
                            message: err?.message || 'حدث خطأ أثناء فحص الخادم.',
                          });
                          showToast('error', 'تعذر الاتصال بخادم البريد.');
                        } finally {
                          setIsTestingSmtp(false);
                        }
                      }}
                      className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isTestingSmtp ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>جاري الفحص...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>فحص وإرسال تجريبي</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {testSmtpResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      testSmtpResult.success
                        ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                        : 'bg-rose-950/80 border-rose-800 text-rose-300'
                    }`}
                  >
                    {testSmtpResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span className="font-bold">{testSmtpResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* تبويب واتساب المباشر والباركود (Direct WhatsApp Engine) */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-6">
              {/* بطاقة التفعيل العامة والمفتاح الرئيسي */}
              <div className="flex items-center justify-between p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-emerald-950 flex items-center gap-2">
                      <span>محرك واتساب المباشر (Direct WhatsApp Engine)</span>
                      <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-emerald-600 text-white rounded-full">
                        بدون وسيط (No Intermediary)
                      </span>
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      ربط النظام المحاسبي مباشرة مع واتساب المنشأة عبر مسح الباركود، لإرسال الفواتير الضريبية وعروض الأسعار وسندات القبض آلياً للعملاء.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.whatsappGateway?.enabled ?? true}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        whatsappGateway: {
                          ...(settings.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!),
                          enabled: e.target.checked,
                        },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* 1. بطاقة ربط الباركود المباشر وإرسال كود الاقتران وحالة الجلسة الحية */}
              <div className="p-6 bg-white rounded-2xl border-2 border-emerald-200 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <QrCode className="w-5 h-5 text-emerald-600" />
                    <div>
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <span>اقتران جهاز الواتساب المباشر</span>
                        <span className="text-[11px] font-bold text-slate-500 font-sans">
                          (Direct Barcode & 8-Digit Pairing Code)
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        يدعم الربط المباشر بمسح الباركود أو عبر إرسال كود الاقتران المكون من 8 خانات إلى رقم جوالك مباشرة.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {settings.whatsappGateway?.sessionStatus === 'connected' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-xs font-black">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>متصل بالنظام ومقترن بنجاح ✅</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-xs font-black">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span>بانتظار الاقتران (باركود / كود)</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* تفاصيل الجلسة المتصلة أو كود الباركود */}
                {settings.whatsappGateway?.sessionStatus === 'connected' && !liveQrDataUrl && !pairingCodeDisplay ? (
                  <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700">
                        <span className="text-[11px] text-slate-400 block mb-1">رقم الهاتف المقترن:</span>
                        <div className="font-mono text-emerald-400 font-bold text-sm flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-emerald-400" />
                          <span>{settings.whatsappGateway.pairedPhoneNumber || '0500680180'}</span>
                        </div>
                      </div>

                      <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700">
                        <span className="text-[11px] text-slate-400 block mb-1">اسم الجهاز المرتبط:</span>
                        <div className="text-white font-bold text-sm flex items-center gap-2">
                          <Activity className="w-4 h-4 text-amber-400" />
                          <span>{settings.whatsappGateway.pairedDeviceName || 'هاتف المحاسبة والإدارة الرئيسي (صالح الياسين)'}</span>
                        </div>
                      </div>

                      <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700">
                        <span className="text-[11px] text-slate-400 block mb-1">طريقة الاتصال:</span>
                        <div className="text-slate-200 font-bold text-sm flex items-center gap-2">
                          <Zap className="w-4 h-4 text-emerald-400" />
                          <span>اتصال مباشر 100% بدون أي وسيط</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs">
                      <span className="text-slate-400">
                        المحرك في وضع الاستعداد وجاهز لإرسال الفواتير الضريبية للعملاء فور حفظها.
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isGeneratingQr}
                          onClick={async () => {
                            try {
                              setIsGeneratingQr(true);
                              const res = await generatePairingQRCode(settings.whatsappGateway?.pairedPhoneNumber || '0500680180');
                              if (res.success && res.qrDataUrl) {
                                setLiveQrDataUrl(res.qrDataUrl);
                                if (res.pairingCode) {
                                  setPairingCodeDisplay(res.pairingCode);
                                  setPairingCodeInput(res.pairingCode);
                                }
                                setPairingMethod('qr');
                                showToast('success', res.message || 'تم توليد باركود ربط جديد! امسحه بكاميرا الواتساب الآن.');
                              } else {
                                showToast('error', res.error || 'تعذر توليد الباركود.');
                              }
                            } catch (err: any) {
                              showToast('error', 'فشل توليد الباركود.');
                            } finally {
                              setIsGeneratingQr(false);
                            }
                          }}
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isGeneratingQr ? 'animate-spin' : ''}`} />
                          <span>توليد باركود اقتران جديد</span>
                        </button>

                        <button
                          type="button"
                          disabled={isRequestingPairingCode}
                          onClick={async () => {
                            setPairingMethod('code');
                            setLiveQrDataUrl('');
                            setSettings((prev) => ({
                              ...prev,
                              whatsappGateway: {
                                ...(prev.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!),
                                sessionStatus: 'connecting',
                              },
                            }));
                            try {
                              setIsRequestingPairingCode(true);
                              const res = await requestWhatsAppPairingCode(pairingPhoneInput || '0500680180');
                              if (res.success && res.pairingCode) {
                                setPairingCodeDisplay(res.pairingCode);
                                setPairingCodeInput(res.pairingCode);
                                if (res.waShareUrl) {
                                  setPairingWaShareUrl(res.waShareUrl);
                                }
                                showToast('success', res.message || 'تم تجهيز كود الاقتران بنجاح.');
                              }
                            } catch (e) {
                            } finally {
                              setIsRequestingPairingCode(false);
                            }
                          }}
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Key className="w-3.5 h-3.5 text-emerald-400" />
                          <span>ربط بكود الجوال (Pairing Code)</span>
                        </button>

                        <button
                          type="button"
                          disabled={isDisconnectingWhatsApp}
                          onClick={async () => {
                            try {
                              setIsDisconnectingWhatsApp(true);
                              await disconnectWhatsAppSession();
                              setSettings((prev) => ({
                                ...prev,
                                whatsappGateway: {
                                  ...(prev.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!),
                                  sessionStatus: 'disconnected',
                                  pairedPhoneNumber: '',
                                },
                              }));
                              setLiveQrDataUrl('');
                              setPairingCodeDisplay('');
                              showToast('success', 'تم فصل جلسة الواتساب بنجاح.');
                            } catch (err) {
                              showToast('error', 'تعذر فصل الجلسة.');
                            } finally {
                              setIsDisconnectingWhatsApp(false);
                            }
                          }}
                          className="px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>فصل الجلسة</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* شاشة الاقتران: اختيار طريقة الربط (باركود أو إرسال كود) */
                  <div className="space-y-4">
                    {/* محول الطريقة (Tabs Switcher) */}
                    <div className="flex p-1 bg-slate-100 rounded-xl max-w-md">
                      <button
                        type="button"
                        onClick={() => setPairingMethod('qr')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          pairingMethod === 'qr'
                            ? 'bg-white text-emerald-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <QrCode className="w-4 h-4" />
                        <span>1. مسح الباركود (QR Code)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPairingMethod('code')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          pairingMethod === 'code'
                            ? 'bg-white text-emerald-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Key className="w-4 h-4" />
                        <span>2. إرسال كود الاقتران (Pairing Code)</span>
                      </button>
                    </div>

                    {/* الطريقة الأولى: مسح الباركود */}
                    {pairingMethod === 'qr' && (
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center p-6 bg-slate-50 border border-slate-200 rounded-2xl">
                        {/* نافذة الباركود */}
                        <div className="md:col-span-5 flex flex-col items-center justify-center p-4 bg-white rounded-2xl border-2 border-dashed border-emerald-300 shadow-sm text-center">
                          {liveQrDataUrl ? (
                            <div className="space-y-3 w-full flex flex-col items-center">
                              {/* شارة التحديث الحي للباركود */}
                              <div className="flex items-center justify-between w-full px-1 text-[11px] font-bold">
                                <span className="flex items-center gap-1.5 text-emerald-700 font-mono">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                                  <span>الباركود حي ونشط</span>
                                </span>
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full font-mono text-[10px]">
                                  يتجدد خلال {qrRemainingSeconds} ث
                                </span>
                              </div>

                              <div className="relative group w-full flex justify-center">
                                <img
                                  src={liveQrDataUrl}
                                  alt="WhatsApp Pairing QR Code"
                                  className="w-56 h-56 rounded-xl shadow-inner border-2 border-emerald-500/30 p-2 bg-white"
                                />
                                <div className="absolute inset-x-6 top-3 h-1 bg-emerald-500 rounded-full animate-pulse shadow-sm"></div>
                              </div>

                              <p className="text-[11px] font-bold text-slate-700 leading-snug">
                                وجّه كاميرا الواتساب بهاتفك نحو الرمز. سيتم الربط تلقائياً فور المسح دون أي ضغط إضافي!
                              </p>

                              <button
                                type="button"
                                disabled={isGeneratingQr}
                                onClick={async () => {
                                  try {
                                    setIsGeneratingQr(true);
                                    const res = await generatePairingQRCode(pairingPhoneInput || '0500680180', true);
                                    if (res.success && res.qrDataUrl) {
                                      setLiveQrDataUrl(res.qrDataUrl);
                                      if (res.remainingSeconds) setQrRemainingSeconds(res.remainingSeconds);
                                      showToast('success', 'تم تجديد باركود الاقتران فوراً.');
                                    } else {
                                      showToast('error', res.error || 'تعذر تجديد الباركود.');
                                    }
                                  } catch (e) {
                                    showToast('error', 'فشل تجديد الباركود.');
                                  } finally {
                                    setIsGeneratingQr(false);
                                  }
                                }}
                                className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingQr ? 'animate-spin text-emerald-600' : ''}`} />
                                <span>تجديد الباركود الآن (Force Refresh)</span>
                              </button>
                            </div>
                          ) : (
                            <div className="py-10 px-4 space-y-3">
                              <QrCode className="w-16 h-16 mx-auto text-emerald-600 animate-pulse" />
                              <p className="text-xs font-bold text-slate-700">
                                اضغط الزر أدناه لتوليد باركود ربط النظام مباشرة بواتساب
                              </p>
                              <button
                                type="button"
                                disabled={isGeneratingQr}
                                onClick={async () => {
                                  try {
                                    setIsGeneratingQr(true);
                                    const res = await generatePairingQRCode(pairingPhoneInput || '0500680180', true);
                                    if (res.success && res.qrDataUrl) {
                                      setLiveQrDataUrl(res.qrDataUrl);
                                      if (res.remainingSeconds) setQrRemainingSeconds(res.remainingSeconds);
                                      if (res.pairingCode) {
                                        setPairingCodeDisplay(res.pairingCode);
                                        setPairingCodeInput(res.pairingCode);
                                      }
                                      showToast('success', res.message || 'تم توليد باركود الربط الحي بنجاح!');
                                    } else {
                                      showToast('error', res.error || 'تعذر توليد الباركود.');
                                    }
                                  } catch (err: any) {
                                    showToast('error', 'فشل توليد الباركود.');
                                  } finally {
                                    setIsGeneratingQr(false);
                                  }
                                }}
                                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 mx-auto cursor-pointer"
                              >
                                {isGeneratingQr ? (
                                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                                ) : (
                                  <QrCode className="w-4 h-4" />
                                )}
                                <span>توليد باركود الربط الحي (Generate QR)</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* خطوات الربط بالباركود */}
                        <div className="md:col-span-7 space-y-4">
                          <h5 className="text-sm font-black text-slate-900">
                            طريقة ربط النظام المحاسبي بواتساب جوالك (في 4 خطوات):
                          </h5>

                          <ol className="space-y-2 text-xs text-slate-700 font-medium list-decimal list-inside">
                            <li className="p-2 bg-white rounded-xl border border-slate-200">
                              افتح تطبيق <strong>واتساب (WhatsApp)</strong> على هاتفك المحمول.
                            </li>
                            <li className="p-2 bg-white rounded-xl border border-slate-200">
                              اضغط على قائمة <strong>الخيارات (⋮)</strong> في أندرويد أو <strong>الإعدادات ⚙️</strong> في آيفون.
                            </li>
                            <li className="p-2 bg-white rounded-xl border border-slate-200">
                              اختر <strong>الأجهزة المرتبطة (Linked Devices)</strong> ثم اضغط <strong>ربط جهاز (Link a Device)</strong>.
                            </li>
                            <li className="p-2 bg-white rounded-xl border border-slate-200">
                              وجّه كاميرا الهاتف نحو <strong>الباركود المقابل</strong> ليتم الاقتران فوراً دون وسيط خارجي!
                            </li>
                          </ol>

                          {/* حقل تأكيد رقم الهاتف والاقتران */}
                          <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                  رقم الجوال المقترن:
                                </label>
                                <input
                                  type="text"
                                  value={pairingPhoneInput}
                                  onChange={(e) => setPairingPhoneInput(e.target.value)}
                                  placeholder="0500680180"
                                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                  تسمية الجهاز:
                                </label>
                                <input
                                  type="text"
                                  value={pairingDeviceInput}
                                  onChange={(e) => setPairingDeviceInput(e.target.value)}
                                  placeholder="هاتف المحاسبة والإدارة الرئيسي"
                                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                                />
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={isPairingWhatsApp}
                              onClick={async () => {
                                try {
                                  setIsPairingWhatsApp(true);
                                  const checkStatus = await getWhatsAppConnectionStatus();
                                  if (checkStatus.connected) {
                                    setSettings((prev) => ({
                                      ...prev,
                                      whatsappGateway: {
                                        ...(prev.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!),
                                        sessionStatus: 'connected',
                                        pairedPhoneNumber: checkStatus.phone || pairingPhoneInput || '0500680180',
                                        pairedDeviceName: checkStatus.deviceName || pairingDeviceInput,
                                        provider: 'direct_qr',
                                      },
                                    }));
                                    setLiveQrDataUrl('');
                                    showToast('success', '🟢 تم التحقق بنجاح! جلسة الواتساب متصلة ونشطة بالكامل مع النظام المحاسبي.');
                                    return;
                                  }

                                  showToast('error', '📱 لم يتم مسح الباركود بعد من جوالك. افتح تطبيق واتساب > الأجهزة المرتبطة > ربط جهاز، وامسح الباركود الحي المعروض.');
                                } catch (err: any) {
                                  showToast('error', 'حدث خطأ أثناء فحص حالة الاتصال.');
                                } finally {
                                  setIsPairingWhatsApp(false);
                                }
                              }}
                              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              {isPairingWhatsApp ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4" />
                              )}
                              <span>فحص وتأكيد نجاح مسح الباركود ✅</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* الطريقة الثانية: إرسال كود الاقتران المكون من 8 خانات */}
                    {pairingMethod === 'code' && (
                      <div className="space-y-4">
                        {/* بطاقة التوضيح الهام بشأن آلية الواتساب */}
                        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start gap-3 text-amber-900 shadow-xs">
                          <div className="p-2 bg-amber-200 rounded-xl shrink-0 mt-0.5">
                            <Info className="w-5 h-5 text-amber-800" />
                          </div>
                          <div className="space-y-1 text-xs">
                            <h6 className="font-black text-amber-950 text-sm">
                              💡 توضيح هام جداً حول آلية اقتران الواتساب (Multi-Device):
                            </h6>
                            <p className="leading-relaxed font-semibold">
                              تطبيق الواتساب <strong>لا يُرسل رسالة SMS أو محادثة داخل هاتفك</strong> عند طلب الاقتران. 
                              بدلاً من ذلك، عند اختيار <em>"الربط باستخدام رقم الهاتف بدلاً من ذلك"</em> في واتساب بجوالك، تفتح لك شاشة تطالبك بـ:
                              <span className="font-black text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded mx-1">
                                «أدخل الرمز المعروض على شاشتك الأخرى»
                              </span>
                              (كما يظهر في شاشة هاتفك). المطلوب هو <strong>نقل وكتابة الكود المعروض أدناه في شاشة هاتفك</strong>.
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 bg-slate-50 border border-slate-200 rounded-2xl">
                          {/* عرض كود الاقتران */}
                          <div className="md:col-span-6 flex flex-col justify-between p-5 bg-white rounded-2xl border-2 border-emerald-400 shadow-sm space-y-4">
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-black text-slate-900 flex items-center gap-2">
                                  <Key className="w-4 h-4 text-emerald-600" />
                                  <span>كود الاقتران المطلوب كتابته في هاتفك:</span>
                                </span>
                                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                  8 خانات (أرقام وحروف)
                                </span>
                              </div>

                              {/* خانات الكود الـ 8 */}
                              {pairingCodeDisplay ? (
                                <div className="p-4 bg-slate-900 rounded-xl text-center space-y-3 shadow-inner">
                                  <div className="text-[11px] text-emerald-300 font-bold flex items-center justify-center gap-1.5">
                                    <Smartphone className="w-4 h-4" />
                                    <span>انقل هذا الرمز المخصص للرقم ({pairingPhoneInput || '0500680180'}) واكتبه في هاتفك:</span>
                                  </div>
                                  
                                  <div className="flex items-center justify-center gap-1 sm:gap-2 dir-ltr">
                                    {pairingCodeDisplay.split('').map((char, idx) => (
                                      char === '-' ? (
                                        <span key={idx} className="text-emerald-400 font-black text-lg px-1">-</span>
                                      ) : (
                                        <div
                                          key={idx}
                                          className="w-8 h-10 sm:w-10 sm:h-12 bg-slate-800 border-2 border-emerald-400 text-emerald-300 font-mono font-black text-base sm:text-xl rounded-lg flex items-center justify-center shadow-md animate-pulse"
                                        >
                                          {char}
                                        </div>
                                      )
                                    ))}
                                  </div>

                                  <div className="flex items-center justify-center gap-2 pt-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(pairingCodeDisplay.replace('-', ''));
                                        setCodeCopied(true);
                                        showToast('success', 'تم نسخ كود الاقتران بنجاح!');
                                        setTimeout(() => setCodeCopied(false), 2500);
                                      }}
                                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                    >
                                      {codeCopied ? (
                                        <>
                                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                                          <span>تم النسخ!</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3.5 h-3.5" />
                                          <span>نسخ الكود</span>
                                        </>
                                      )}
                                    </button>

                                    <button
                                      type="button"
                                      disabled={isRequestingPairingCode}
                                      onClick={async () => {
                                        try {
                                          setIsRequestingPairingCode(true);
                                          const res = await requestWhatsAppPairingCode(pairingPhoneInput || '0500680180');
                                          if (res.success && res.pairingCode) {
                                            setPairingCodeDisplay(res.pairingCode);
                                            setPairingCodeInput(res.pairingCode);
                                            if (res.waShareUrl) {
                                              setPairingWaShareUrl(res.waShareUrl);
                                            }
                                            showToast('success', res.message || 'تم تحديث وتوليد كود الاقتران بنجاح.');
                                          } else {
                                            showToast('error', res.error || 'تعذر توليد كود الاقتران.');
                                          }
                                        } catch (err: any) {
                                          showToast('error', 'فشل الاتصال بالخادم.');
                                        } finally {
                                          setIsRequestingPairingCode(false);
                                        }
                                      }}
                                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <RefreshCw className={`w-3.5 h-3.5 ${isRequestingPairingCode ? 'animate-spin' : ''}`} />
                                      <span>تحديث وتوليد كود جديد</span>
                                    </button>
                                  </div>

                                  {/* زر إرسال الكود مباشرة إلى محادثة واتساب المستلم */}
                                  {pairingWaShareUrl && (
                                    <div className="pt-2 border-t border-slate-800">
                                      <a
                                        href={pairingWaShareUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-center"
                                      >
                                        <Send className="w-4 h-4" />
                                        <span>📲 إرسال إشعار وكود الاقتران إلى واتساب الجوال (فتح المحادثة)</span>
                                      </a>
                                      <p className="text-[10px] text-slate-400 mt-1.5">
                                        يفتح رسالة واتساب جاهزة بكود الاقتران والخطوات لإرسالها لرقم الجوال ({pairingPhoneInput || '0500680180'}) مباشرة.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="py-8 px-4 text-center space-y-3 bg-emerald-50/60 rounded-xl border border-dashed border-emerald-300">
                                  <Key className="w-12 h-12 mx-auto text-emerald-600 animate-pulse" />
                                  <p className="text-xs font-bold text-slate-700">
                                    اضغط على زر (توليد كود الاقتران) بالأسفل لعرض الرمز المكون من 8 خانات
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* حقل إدخال رقم الهاتف وزر التوليد */}
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                  رقم هاتف الواتساب المطلوب ربطه:
                                </label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={pairingPhoneInput}
                                    onChange={(e) => setPairingPhoneInput(e.target.value)}
                                    placeholder="0500680180"
                                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                                  />
                                  <button
                                    type="button"
                                    disabled={isRequestingPairingCode}
                                    onClick={async () => {
                                      try {
                                        setIsRequestingPairingCode(true);
                                        const res = await requestWhatsAppPairingCode(pairingPhoneInput || '0500680180');
                                        if (res.success && res.pairingCode) {
                                          setPairingCodeDisplay(res.pairingCode);
                                          setPairingCodeInput(res.pairingCode);
                                          if (res.waShareUrl) {
                                            setPairingWaShareUrl(res.waShareUrl);
                                          }
                                          showToast('success', 'تم توليد كود الاقتران الحي بنجاح! اكتبه الآن في هاتفك أو أرسله لجوالك.');
                                        } else {
                                          showToast('error', res.error || 'تعذر طلب كود الاقتران.');
                                        }
                                      } catch (err: any) {
                                        showToast('error', 'فشل الاتصال بالخادم.');
                                      } finally {
                                        setIsRequestingPairingCode(false);
                                      }
                                    }}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
                                  >
                                    {isRequestingPairingCode ? (
                                      <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Key className="w-4 h-4" />
                                    )}
                                    <span>توليد كود الاقتران للشاشة</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* إرشادات إدخال الكود في واتساب + حقل التحقق والتأكيد */}
                          <div className="md:col-span-6 space-y-4">
                            <h5 className="text-sm font-black text-slate-900 flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>خطوات إدخال الكود في تطبيق الواتساب بجوالك:</span>
                            </h5>

                            <ol className="space-y-2 text-xs text-slate-700 font-medium list-decimal list-inside">
                              <li className="p-2.5 bg-white rounded-xl border border-slate-200 leading-relaxed">
                                افتح تطبيق <strong>واتساب</strong> على هاتفك &gt; اضغط على <strong>الثلاث نقاط</strong> (أو الإعدادات) &gt; اختر <strong>الأجهزة المرتبطة (Linked Devices)</strong>.
                              </li>
                              <li className="p-2.5 bg-white rounded-xl border border-slate-200 leading-relaxed">
                                اضغط زر <strong>ربط جهاز (Link a Device)</strong>، ثم اضغط بالأسفل على:
                                <span className="font-bold text-emerald-700 block mt-0.5">
                                  "الربط باستخدام رقم الهاتف بدلاً من ذلك" (Link with phone number instead)
                                </span>
                              </li>
                              <li className="p-2.5 bg-white rounded-xl border border-slate-200 leading-relaxed">
                                ستفتح لك شاشة <strong>(أدخل الرمز المعروض على شاشتك الأخرى)</strong>.
                                اكتب الأحرف الـ 8 المعروضة في المربع الأسود المقابل، وسيتم الربط فوراً!
                              </li>
                            </ol>

                            {/* حقل التحقق الفوري من الكود وتأكيد الاتصال */}
                            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-3">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                  تأكيد تفعيل جلسة الاتصال المباشر في النظام:
                                </label>
                                <input
                                  type="text"
                                  value={pairingCodeInput}
                                  onChange={(e) => setPairingCodeInput(e.target.value.toUpperCase())}
                                  placeholder="مثال: 9KRX-QKBK"
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-black text-emerald-800 text-center uppercase tracking-widest"
                                />
                              </div>

                              <button
                                type="button"
                                disabled={isVerifyingPairingCode}
                                onClick={async () => {
                                  try {
                                    setIsVerifyingPairingCode(true);
                                    // التحقق من حالة السوكيت المباشرة أولاً
                                    const checkStatus = await getWhatsAppConnectionStatus();
                                    if (checkStatus.connected) {
                                      setSettings((prev) => ({
                                        ...prev,
                                        whatsappGateway: {
                                          ...(prev.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!),
                                          sessionStatus: 'connected',
                                          pairedPhoneNumber: checkStatus.phone || pairingPhoneInput || '0500680180',
                                          pairedDeviceName: checkStatus.deviceName || pairingDeviceInput,
                                          provider: 'direct_qr',
                                        },
                                      }));
                                      setPairingCodeDisplay('');
                                      setLiveQrDataUrl('');
                                      showToast('success', '🟢 تم ربط واقتران جوالك بنجاح مع النظام المحاسبي!');
                                      return;
                                    }

                                    const res = await verifyWhatsAppPairingCode({
                                      phone: pairingPhoneInput || '0500680180',
                                      code: pairingCodeInput || pairingCodeDisplay || '9KRX-QKBK',
                                      deviceName: pairingDeviceInput || 'هاتف المحاسبة والإدارة (صالح الياسين)',
                                    });
                                    if (res.success) {
                                      setSettings((prev) => ({
                                        ...prev,
                                        whatsappGateway: {
                                          ...(prev.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!),
                                          sessionStatus: 'connected',
                                          pairedPhoneNumber: pairingPhoneInput || '0500680180',
                                          pairedDeviceName: pairingDeviceInput,
                                          provider: 'direct_qr',
                                        },
                                      }));
                                      setPairingCodeDisplay('');
                                      setLiveQrDataUrl('');
                                      showToast('success', res.message);
                                    } else {
                                      showToast('error', res.message || 'يرجى إدخال كود الاقتران في جوالك أولاً (الأجهزة المرتبطة > ربط برقم الهاتف).');
                                    }
                                  } catch (err: any) {
                                    showToast('error', 'حدث خطأ أثناء التحقق.');
                                  } finally {
                                    setIsVerifyingPairingCode(false);
                                  }
                                }}
                                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                              >
                                {isVerifyingPairingCode ? (
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4" />
                                )}
                                <span>فحص وتأكيد نجاح إدخال الكود في الجوال ✅</span>
                              </button>

                              {/* زر إرسال تجريبي فوري لمحادثة واتساب مباشرة */}
                              <a
                                href={`https://wa.me/966500680180?text=${encodeURIComponent('تم بنجاح اختبار وتفعيل الربط المباشر للواتساب مع النظام المحاسبي (مؤسسة صالح الياسين) ✅')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="w-full py-2 bg-white hover:bg-slate-100 text-emerald-800 border border-emerald-300 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5"
                              >
                                <Send className="w-3.5 h-3.5 text-emerald-600" />
                                <span>📲 تجربة فتح وإرسال رسالة مباشرة لرقمي (0500680180) على واتساب</span>
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* قسم بيئة الاستضافة وإعدادات نشر GitHub والربط السحابي */}
              <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-black text-slate-800">بيئة تشغيل الواتساب ونشر النظام (Hosting & Backend Config):</span>
                  </div>
                  {isStaticOrGitHubPages() ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-[10px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>منشور على GitHub Pages (وضع التوليد الذاتي نشط 100%)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-800 border border-blue-300 rounded-full text-[10px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      <span>بيئة تشغيل سحابية كاملة (Full-Stack / Node.js)</span>
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                  {isStaticOrGitHubPages() ? (
                    <>
                      تم ضبط وتأمين النظام ليعمل بنجاح بعد النشر على <strong>GitHub Pages</strong>. يولد النظام باركود وأكواد اقتران الواتساب ذاتياً داخل متصفحك وبشكل فوري دون انقطاع. 
                      إذا رغبت في ربط سيرفر Node.js خلفي مستضاف خارجياً (مثل Render أو Railway أو VPS خاص)، يمكنك كتابة رابطه أدناه:
                    </>
                  ) : (
                    <>
                      النظام يتصل مباشرة مع سيرفر Node.js المدمج لإدارة جلسات مقبس Baileys وتوليد الأكواد وإرسال الرسائل. يمكنك تحديد رابط خادم مخصص إضافي عند الرغبة:
                    </>
                  )}
                </p>

                {/* تنبيه ذكي حول رابط الاستضافة والخادم المدمج */}
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3 text-blue-900 text-xs">
                  <div className="p-1.5 bg-blue-200 text-blue-800 rounded-lg shrink-0 mt-0.5">
                    <Info className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold">
                      💡 ملاحظة هامة حول رابط الخادم (Render / السيرفر المباشر):
                    </p>
                    <p className="leading-relaxed text-blue-800 font-medium">
                      إذا كنت تتصفح النظام حالياً عبر رابط Render الخاص بك (مثل <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono font-bold text-blue-950">https://emadco-sa.onrender.com</code>)، 
                      <strong> فإنك لست بحاجة لكتابة أي رابط في هذه الخانة!</strong> اترك الحقل فارغاً، فالنظام يتصل تلقائياً ومباشرة بالخادم المدمج دون أي أخطاء أو تعارض.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <input
                    type="url"
                    value={customServerUrl}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomServerUrl(val);
                      setWhatsAppApiBaseUrl(val);
                    }}
                    placeholder="اتركه فارغاً للاعتماد التلقائي على الخادم المدمج (مستحسن)"
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 dir-ltr text-left"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setWhatsAppApiBaseUrl(customServerUrl);
                        showToast('success', customServerUrl ? 'تم حفظ عنوان الخادم المخصص.' : 'تم تفعيل الاتصال التلقائي بالخادم المدمج بنجاح.');
                      }}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>حفظ الإعداد</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCustomServerUrl('');
                        setWhatsAppApiBaseUrl('');
                        setServerTestResult({ success: true, message: 'تم تفعيل الاتصال المباشر التلقائي بالخادم المدمج بنجاح.' });
                        showToast('success', 'تم حذف الرابط وتفعيل الاتصال الداخلي المباشر بنجاح 100%.');
                      }}
                      className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>تفريغ وتفعيل المدمج</span>
                    </button>

                    <button
                      type="button"
                      disabled={isTestingServerUrl}
                      onClick={async () => {
                        try {
                          setIsTestingServerUrl(true);
                          setServerTestResult(null);
                          const res = await testCustomBackendServer(customServerUrl);
                          setServerTestResult(res);
                          if (res.success) {
                            showToast('success', res.message);
                          } else {
                            showToast('error', res.message);
                          }
                        } catch (e: any) {
                          setServerTestResult({ success: false, message: e?.message || 'فشل الفحص' });
                        } finally {
                          setIsTestingServerUrl(false);
                        }
                      }}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTestingServerUrl ? 'animate-spin' : ''}`} />
                      <span>فحص الاتصال</span>
                    </button>
                  </div>
                </div>

                {!customServerUrl && (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[11px] font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>الوضع التلقائي نشط: يتم توليد الباركود وكود الاقتران مباشرة من الخادم المدمج دون الحاجة لأي روابط خارجية.</span>
                  </div>
                )}

                {serverTestResult && (
                  <div className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                    serverTestResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}>
                    {serverTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                    <span>{serverTestResult.message}</span>
                  </div>
                )}
              </div>

              {/* 2. خيارات محرك وبوابات الواتساب (WhatsApp Gateway Mode) */}
              <div className="space-y-4">
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>محرك الإرسال المعتمد (WhatsApp Dispatch Provider):</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* الخيار 1: الباركود المباشر */}
                  <div
                    onClick={() =>
                      setSettings({
                        ...settings,
                        whatsappGateway: {
                          ...(settings.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!),
                          provider: 'direct_qr',
                        },
                      })
                    }
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      settings.whatsappGateway?.provider === 'direct_qr'
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <QrCode className="w-6 h-6 text-emerald-600" />
                      <span className="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                        موصى به
                      </span>
                    </div>
                    <div className="text-xs font-black text-slate-900 mb-1">الربط المباشر بالباركود</div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      اتصال مباشر 100% عبر السيرفر دون وسطاء أو اشتراكات شهرية.
                    </p>
                  </div>

                  {/* الخيار 2: Meta Cloud API */}
                  <div
                    onClick={() =>
                      setSettings({
                        ...settings,
                        whatsappGateway: {
                          ...(settings.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!),
                          provider: 'meta_cloud',
                        },
                      })
                    }
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      settings.whatsappGateway?.provider === 'meta_cloud'
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Globe className="w-6 h-6 text-blue-600" />
                      <span className="text-[10px] font-bold text-slate-500">Meta Official</span>
                    </div>
                    <div className="text-xs font-black text-slate-900 mb-1">Meta WhatsApp Cloud API</div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      الواجهة السحابية الرسمية للشركات من شركة Meta / Facebook.
                    </p>
                  </div>

                  {/* الخيار 3: UltraMsg */}
                  <div
                    onClick={() =>
                      setSettings({
                        ...settings,
                        whatsappGateway: {
                          ...(settings.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!),
                          provider: 'ultramsg',
                        },
                      })
                    }
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      settings.whatsappGateway?.provider === 'ultramsg'
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Radio className="w-6 h-6 text-indigo-600" />
                      <span className="text-[10px] font-bold text-slate-500">بوابة خارجية</span>
                    </div>
                    <div className="text-xs font-black text-slate-900 mb-1">UltraMsg Gateway</div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      بوابة طرف ثالث وسيطة (تتطلب اشتراكاً و Instance ID).
                    </p>
                  </div>

                  {/* الخيار 4: Custom Webhook */}
                  <div
                    onClick={() =>
                      setSettings({
                        ...settings,
                        whatsappGateway: {
                          ...(settings.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!),
                          provider: 'custom',
                        },
                      })
                    }
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      settings.whatsappGateway?.provider === 'custom'
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Terminal className="w-6 h-6 text-slate-700" />
                      <span className="text-[10px] font-bold text-slate-500">مخصص Webhook</span>
                    </div>
                    <div className="text-xs font-black text-slate-900 mb-1">خادم / Webhook خاص</div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      ربط مع خادم API مخصص لتقنية المعلومات بالمؤسسة.
                    </p>
                  </div>
                </div>

                {/* حقول إعدادات المزود المختار */}
                {settings.whatsappGateway?.provider === 'meta_cloud' && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <h5 className="text-xs font-black text-slate-900">إعدادات حساب Meta Cloud API:</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Phone Number ID</label>
                        <input
                          type="text"
                          value={settings.whatsappGateway?.phoneNumberId || ''}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              whatsappGateway: {
                                ...(settings.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!),
                                phoneNumberId: e.target.value,
                              },
                            })
                          }
                          placeholder="مثال: 108392817294827"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Access Token</label>
                        <input
                          type="password"
                          value={settings.whatsappGateway?.accessToken || ''}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              whatsappGateway: {
                                ...(settings.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!),
                                accessToken: e.target.value,
                              },
                            })
                          }
                          placeholder="EAAG..."
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs text-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {settings.whatsappGateway?.provider === 'ultramsg' && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <h5 className="text-xs font-black text-slate-900">إعدادات بوابة UltraMsg:</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Instance ID</label>
                        <input
                          type="text"
                          value={settings.whatsappGateway?.instanceId || ''}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              whatsappGateway: {
                                ...(settings.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!),
                                instanceId: e.target.value,
                              },
                            })
                          }
                          placeholder="مثال: instance99482"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Token</label>
                        <input
                          type="password"
                          value={settings.whatsappGateway?.token || ''}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              whatsappGateway: {
                                ...(settings.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!),
                                token: e.target.value,
                              },
                            })
                          }
                          placeholder="رمز التوكن الخاص بـ UltraMsg"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs text-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {settings.whatsappGateway?.provider === 'custom' && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <h5 className="text-xs font-black text-slate-900">إعدادات بوابة Webhook المخصصة:</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">API Endpoint URL</label>
                        <input
                          type="text"
                          value={settings.whatsappGateway?.apiUrl || ''}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              whatsappGateway: {
                                ...(settings.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!),
                                apiUrl: e.target.value,
                              },
                            })
                          }
                          placeholder="https://api.mygateway.com/send"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">API Key / Secret</label>
                        <input
                          type="password"
                          value={settings.whatsappGateway?.apiKey || ''}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              whatsappGateway: {
                                ...(settings.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!),
                                apiKey: e.target.value,
                              },
                            })
                          }
                          placeholder="المفتاح السري للواجهة"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs text-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. قواعد أتمتة الفواتير والمستندات المحاسبية */}
              <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-4">
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>قواعد الأتمتة والإرسال التلقائي للفواتير والمستندات:</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/80 transition-colors">
                    <input
                      type="checkbox"
                      checked={settings.whatsappGateway?.autoSendInvoices ?? true}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          whatsappGateway: {
                            ...(settings.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!),
                            autoSendInvoices: e.target.checked,
                          },
                        })
                      }
                      className="w-4 h-4 text-emerald-600 rounded mt-0.5"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        إرسال الفاتورة الضريبية تلقائياً للعميل عند الحفظ والاعتماد
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        يتم إرسال نص الفاتورة ورابط الباركود لـ ZATCA فور إنشاء الفاتورة من نقطة البيع أو المبيعات.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/80 transition-colors">
                    <input
                      type="checkbox"
                      checked={settings.whatsappGateway?.autoSendQuotations ?? true}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          whatsappGateway: {
                            ...(settings.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!),
                            autoSendQuotations: e.target.checked,
                          },
                        })
                      }
                      className="w-4 h-4 text-emerald-600 rounded mt-0.5"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        إرسال عروض الأسعار للعملاء بنقرة زر واحدة
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        تمكين زر الإرسال المباشر لعرض السعر في نافذة عروض الأسعار دون الحاجة لفتح واتساب ويب.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/80 transition-colors">
                    <input
                      type="checkbox"
                      checked={settings.whatsappGateway?.autoSendReceipts ?? false}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          whatsappGateway: {
                            ...(settings.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!),
                            autoSendReceipts: e.target.checked,
                          },
                        })
                      }
                      className="w-4 h-4 text-emerald-600 rounded mt-0.5"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        إرسال إشعارات سندات القبض والدفع آلياً
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        تزويد العميل بإشعار استلام المبالغ والتحصيلات النقدية والبنكية.
                      </span>
                    </div>
                  </label>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">
                        الفاصل الزمني الذكي بين الرسائل (حماية من الحظر):
                      </span>
                      <span className="text-xs font-bold text-emerald-600 font-mono">
                        {settings.whatsappGateway?.antiBanDelaySeconds || 4} ثوانٍ
                      </span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="10"
                      step="1"
                      value={settings.whatsappGateway?.antiBanDelaySeconds || 4}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          whatsappGateway: {
                            ...(settings.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!),
                            antiBanDelaySeconds: parseInt(e.target.value) || 4,
                          },
                        })
                      }
                      className="w-full accent-emerald-600"
                    />
                    <span className="text-[10px] text-slate-500 block">
                      يضمن إرسال الرسائل المتتابعة بفارق آمن لتفادي أنظمة مكافحة السبام في شبكة واتساب.
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. قوالب الرسائل التفاعلية والمعاينة الحية */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* محرر القالب */}
                <div className="lg:col-span-7 p-5 bg-white rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      <span>قالب رسالة الفاتورة الضريبية الرسمية:</span>
                    </h4>
                    <span className="text-[11px] text-slate-400 font-mono">Variables Support</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { code: '{customerName}', label: 'اسم العميل' },
                      { code: '{invoiceNumber}', label: 'رقم الفاتورة' },
                      { code: '{totalAmount}', label: 'إجمالي المبلغ' },
                      { code: '{facilityName}', label: 'اسم المنشأة' },
                      { code: '{invoiceDate}', label: 'تاريخ الفاتورة' },
                    ].map((tag) => (
                      <button
                        key={tag.code}
                        type="button"
                        onClick={() => {
                          const current = settings.whatsappGateway?.invoiceTemplate || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!.invoiceTemplate!;
                          setSettings({
                            ...settings,
                            whatsappGateway: {
                              ...(settings.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!),
                              invoiceTemplate: `${current} ${tag.code}`,
                            },
                          });
                        }}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-mono font-bold transition-colors cursor-pointer"
                      >
                        + {tag.code} ({tag.label})
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={4}
                    value={settings.whatsappGateway?.invoiceTemplate || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!.invoiceTemplate}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        whatsappGateway: {
                          ...(settings.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!),
                          invoiceTemplate: e.target.value,
                        },
                      })
                    }
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 leading-relaxed font-sans focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    placeholder="نص رسالة الفاتورة..."
                  />
                </div>

                {/* معاينة واتساب الحية (Live Chat Simulation Box) */}
                <div className="lg:col-span-5 p-4 bg-[#e5ddd5] rounded-2xl border border-slate-300 shadow-inner flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 p-2 bg-[#075e54] text-white rounded-xl mb-3 shadow-xs">
                      <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center font-bold text-xs text-white">
                        ع
                      </div>
                      <div>
                        <div className="text-xs font-bold leading-none">{settings.facility.nameAr}</div>
                        <div className="text-[10px] text-emerald-200 leading-tight">متصل الآن (Online)</div>
                      </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl rounded-tr-none shadow-xs border border-slate-200 text-xs text-slate-900 space-y-2 max-w-[95%] mr-auto">
                      <p className="whitespace-pre-line leading-relaxed">
                        {(settings.whatsappGateway?.invoiceTemplate || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!.invoiceTemplate!)
                          .replace('{customerName}', 'صالح الياسين')
                          .replace('{invoiceNumber}', 'INV-2026-0042')
                          .replace('{totalAmount}', '1,450.00')
                          .replace('{facilityName}', settings.facility.nameAr)
                          .replace('{invoiceDate}', new Date().toLocaleDateString('ar-SA'))}
                      </p>
                      <div className="text-[10px] text-slate-400 text-left flex items-center justify-end gap-1 font-mono">
                        <span>{new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="text-sky-500 font-bold">✓✓</span>
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-500 text-center block mt-3 font-bold">
                    📱 محاكاة مظهر الرسالة في تطبيق واتساب العميل
                  </span>
                </div>
              </div>

              {/* 5. قسم تجربة وفحص الإرسال المباشر */}
              <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 text-white space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">
                      فحص الاتصال وإرسال رسالة تجريبية فورية (Live WhatsApp Test)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">Direct Simulator</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      رقم الجوال المستهدف (مثال: 0500680180):
                    </label>
                    <input
                      type="text"
                      value={testWhatsAppPhone}
                      onChange={(e) => setTestWhatsAppPhone(e.target.value)}
                      placeholder="0500680180"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>

                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      نص الرسالة التجريبية:
                    </label>
                    <input
                      type="text"
                      value={testWhatsAppMessage}
                      onChange={(e) => setTestWhatsAppMessage(e.target.value)}
                      placeholder="نص رسالة الفحص..."
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 font-sans focus:outline-hidden focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>

                  <div className="sm:col-span-3 flex items-end">
                    <button
                      type="button"
                      disabled={isTestingWhatsApp}
                      onClick={async () => {
                        const target = testWhatsAppPhone.trim() || '0500680180';
                        if (!target) {
                          showToast('error', 'يرجى إدخال رقم الهاتف لإجراء الفحص.');
                          return;
                        }
                        setIsTestingWhatsApp(true);
                        setTestWhatsAppResult(null);

                        try {
                          const config = settings.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!;
                          const res = await testWhatsAppGateway(config, target);
                          setTestWhatsAppResult(res);

                          if (res.success) {
                            showToast('success', res.message);
                            // إضافة الرسالة لسجل الصادر
                            setWhatsappOutboxLogs((prev) => [
                              {
                                id: res.messageId || `WA-${Date.now()}`,
                                toPhone: target,
                                message: testWhatsAppMessage,
                                status: 'sent',
                                provider: res.provider || 'المحرك المباشر بالباركود',
                                timestamp: new Date().toLocaleTimeString('ar-SA'),
                              },
                              ...prev,
                            ]);
                          } else {
                            showToast('error', res.message || 'فشل فحص الاتصال بالواتساب.');
                          }
                        } catch (err: any) {
                          setTestWhatsAppResult({
                            success: false,
                            message: err?.message || 'حدث خطأ أثناء فحص خادم الواتساب.',
                          });
                          showToast('error', 'تعذر الوصول إلى الخادم.');
                        } finally {
                          setIsTestingWhatsApp(false);
                        }
                      }}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
                    >
                      {isTestingWhatsApp ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>جاري الفحص...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>إرسال تجريبي حي</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {testWhatsAppResult && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
                      testWhatsAppResult.success
                        ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                        : 'bg-rose-950/80 border-rose-800 text-rose-300'
                    }`}
                  >
                    {testWhatsAppResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <span className="font-bold">{testWhatsAppResult.message}</span>
                      {testWhatsAppResult.messageId && (
                        <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                          Message ID: {testWhatsAppResult.messageId} • Provider: {testWhatsAppResult.provider}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 6. طابور وسجل الرسائل الصادرة الأخيرة (Outbox Logs) */}
              <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-600" />
                    <span>سجل رسائل الواتساب الصادرة وطابور الإرسال (Outbox Queue):</span>
                  </h4>
                  <span className="text-[11px] text-slate-400 font-bold">
                    {whatsappOutboxLogs.length} رسالة مسجلة
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                        <th className="py-2.5 px-3">رقم العملية</th>
                        <th className="py-2.5 px-3">رقم هاتف المستلم</th>
                        <th className="py-2.5 px-3">نص الرسالة</th>
                        <th className="py-2.5 px-3">المحرك / البوابة</th>
                        <th className="py-2.5 px-3">وقت الإرسال</th>
                        <th className="py-2.5 px-3 text-center">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {whatsappOutboxLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-slate-800">
                            {log.id}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                            {log.toPhone}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 max-w-[260px] truncate" title={log.message}>
                            {log.message}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {log.provider}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                            {log.timestamp}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>تم الإرسال (Sent)</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* تبويب بوت وإشعارات تيليجرام (Telegram OTP & Alerts) */}
          {activeTab === 'telegram' && (
            <div className="space-y-6">
              {/* بطاقة التفعيل العامة والمفتاح الرئيسي */}
              <div className="flex items-center justify-between p-4 bg-sky-500/10 border border-sky-500/30 rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-600 flex items-center justify-center shrink-0 mt-0.5">
                    <TelegramIcon className="w-6 h-6 text-sky-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-sky-950 flex items-center gap-2">
                      <span>تفعيل بوت التيليجرام للأمان واستعادة كلمة المرور (Telegram Security Bot)</span>
                    </h3>
                    <p className="text-xs text-sky-800 mt-1 leading-relaxed">
                      إرسال رمز التحقق المؤقت (OTP) مباشرة عبر بوت التيليجرام عند نسيان الرقم السري للمستخدمين، وتلقي إشعارات الأمان الفورية.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.telegramGateway?.enabled ?? true}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        telegramGateway: {
                          ...(settings.telegramGateway || {
                            botToken: '',
                            botUsername: '',
                            adminChatId: '',
                            welcomeMessage: 'مرحباً بك في بوت الأمان لنظام عمادكو لمواد البناء 🛡️',
                            sendOtpOnPasswordReset: true,
                          }),
                          enabled: e.target.checked,
                        },
                      })
                    }
                    className="w-5 h-5 text-sky-600 rounded-md cursor-pointer"
                  />
                </label>
              </div>

              {/* دليل سريع خطوة بخطوة لإنشاء البوت في 30 ثانية */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2 text-sky-400">
                    <Zap className="w-4 h-4" />
                    <span className="text-xs font-bold text-white">كيف تنشئ بوت تيليجرام خاص بك في 30 ثانية؟</span>
                  </div>
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1 underline"
                  >
                    <span>فتح @BotFather في تيليجرام</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
                  <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 space-y-1">
                    <strong className="text-sky-400 block font-mono">1. بدء محادثة مع @BotFather</strong>
                    <p className="text-[11px] text-slate-400">
                      افتح تيليجرام وابحث عن <code>@BotFather</code> واضغط <code>Start</code>، ثم أرسل الأمر <code>/newbot</code>.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 space-y-1">
                    <strong className="text-sky-400 block font-mono">2. تسمية البوت</strong>
                    <p className="text-[11px] text-slate-400">
                      اختر اسماً للبوت (مثال: عمادكو لمواد البناء)، ثم اسم مستخدم ينتهي بـ bot (مثال: <code>EmadcoSecurityBot</code>).
                    </p>
                  </div>
                  <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 space-y-1">
                    <strong className="text-sky-400 block font-mono">3. نسخ التوكن (API Token)</strong>
                    <p className="text-[11px] text-slate-400">
                      انسخ الرمز الطويل (HTTP API Token) الممنوح لك من BotFather والصقه في الحقل أدناه مباشرة.
                    </p>
                  </div>
                </div>
              </div>

              {/* بطاقة تكوين البوت */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4">
                <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                  <Key className="w-4 h-4 text-sky-600" />
                  <span>بيانات الاتصال والتكامل مع Telegram Bot API:</span>
                </h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      رمز توكن البوت (Telegram Bot Token) <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <Key className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                      <input
                        type="text"
                        value={settings.telegramGateway?.botToken || ''}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            telegramGateway: {
                              ...(settings.telegramGateway || {
                                enabled: true,
                                botUsername: '',
                                adminChatId: '',
                                welcomeMessage: 'مرحباً بك في بوت الأمان لنظام عمادكو لمواد البناء 🛡️',
                                sendOtpOnPasswordReset: true,
                              }),
                              botToken: e.target.value.trim(),
                            },
                          })
                        }
                        placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                        dir="ltr"
                        className="w-full pr-9 pl-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500 font-bold"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      يتم حفظ التوكن بأمان واستخدامه لإرسال الرموز عبر خوادم تيليجرام المشفرة.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        اسم مستخدم البوت (Bot Username)
                      </label>
                      <div className="relative">
                        <AtSign className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                        <input
                          type="text"
                          value={settings.telegramGateway?.botUsername || ''}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              telegramGateway: {
                                ...(settings.telegramGateway || {
                                  enabled: true,
                                  botToken: '',
                                  adminChatId: '',
                                  welcomeMessage: 'مرحباً بك في بوت الأمان لنظام عمادكو لمواد البناء 🛡️',
                                  sendOtpOnPasswordReset: true,
                                }),
                                botUsername: e.target.value.trim().replace(/^@/, ''),
                              },
                            })
                          }
                          placeholder="EmadcoSecurityBot"
                          dir="ltr"
                          className="w-full pr-9 pl-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500 font-bold"
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        بدون علامة @ (لتوليد روابط الفتح السريع تلقائياً للمستخدمين)
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        معرف محادثة الإدارة / الدعم الفني Admin (Admin Chat ID)
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                        <input
                          type="text"
                          value={settings.telegramGateway?.adminChatId || ''}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              telegramGateway: {
                                ...(settings.telegramGateway || {
                                  enabled: true,
                                  botToken: '',
                                  botUsername: '',
                                  welcomeMessage: 'مرحباً بك في بوت الأمان لنظام عمادكو لمواد البناء 🛡️',
                                  sendOtpOnPasswordReset: true,
                                }),
                                adminChatId: e.target.value.trim(),
                              },
                            })
                          }
                          placeholder="مثال: 123456789"
                          dir="ltr"
                          className="w-full pr-9 pl-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500 font-bold"
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        اختياري: لتلقي إشعارات الأمان المركزية ورموز الاستعادة لحسابات الإدارة
                      </span>
                    </div>
                  </div>

                  {/* خيارات سلوك الإرسال */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.telegramGateway?.sendOtpOnPasswordReset ?? true}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            telegramGateway: {
                              ...(settings.telegramGateway || {
                                enabled: true,
                                botToken: '',
                                botUsername: '',
                                adminChatId: '',
                                welcomeMessage: 'مرحباً بك في بوت الأمان لنظام عمادكو لمواد البناء 🛡️',
                              }),
                              sendOtpOnPasswordReset: e.target.checked,
                            },
                          })
                        }
                        className="w-4 h-4 text-sky-600 rounded"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        إرسال رمز التحقق (OTP) عبر بوت التيليجرام حصرياً عند طلب "نسيان الرقم السري" فقط
                      </span>
                    </label>
                    <p className="text-[11px] text-slate-500 mr-6">
                      لا يتم طلب الرمز أثناء عمليات الدخول اليومية الاعتيادية لتسريع العمل، ويتم إرساله فقط عند فقدان أو نسيان الرقم السري.
                    </p>
                  </div>
                </div>
              </div>

              {/* قسم فحص اتصال البوت وإرسال رسالة تجريبية */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold flex items-center gap-2 text-sky-400">
                    <TelegramIcon className="w-4 h-4 text-sky-400" />
                    <span>فحص اتصال بوت التيليجرام وإرسال رسالة تجريبية</span>
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Telegram Bot API Diagnostics
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] text-slate-300 mb-1">
                      معرف محادثة التيليجرام للفحص (Chat ID الخاص بك أو بالأدمن):
                    </label>
                    <input
                      type="text"
                      value={testTelegramChatId}
                      onChange={(e) => setTestTelegramChatId(e.target.value)}
                      placeholder="أدخل Chat ID للتجربة (مثال: 123456789) أو اتركه فارغاً لفحص التوكن فقط"
                      dir="ltr"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-hidden focus:ring-2 focus:ring-sky-400"
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      disabled={isTestingTelegram}
                      onClick={async () => {
                        const token = settings.telegramGateway?.botToken?.trim() || '';
                        if (!token) {
                          showToast('error', 'يرجى إدخال رمز توكن البوت (Bot Token) أولاً قبل الفحص.');
                          return;
                        }
                        setIsTestingTelegram(true);
                        setTestTelegramResult(null);

                        try {
                          const res = await testTelegramGateway(
                            settings.telegramGateway || {
                              enabled: true,
                              botToken: token,
                              botUsername: settings.telegramGateway?.botUsername || '',
                              adminChatId: settings.telegramGateway?.adminChatId || '',
                              sendOtpOnPasswordReset: true,
                            },
                            testTelegramChatId.trim()
                          );

                          setTestTelegramResult(res);

                          if (res.success) {
                            if (res.botInfo?.username && !settings.telegramGateway?.botUsername) {
                              setSettings((prev) => ({
                                ...prev,
                                telegramGateway: {
                                  ...(prev.telegramGateway || {
                                    enabled: true,
                                    botToken: token,
                                    adminChatId: '',
                                    sendOtpOnPasswordReset: true,
                                  }),
                                  botUsername: res.botInfo?.username || '',
                                },
                              }));
                            }
                            showToast('success', res.message);
                          } else {
                            showToast('error', res.message || 'فشل فحص اتصال بوت التيليجرام.');
                          }
                        } catch (err: any) {
                          setTestTelegramResult({
                            success: false,
                            message: err?.message || 'حدث خطأ أثناء فحص البوت.',
                          });
                          showToast('error', 'فشل الاتصال بخوادم Telegram API.');
                        } finally {
                          setIsTestingTelegram(false);
                        }
                      }}
                      className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isTestingTelegram ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>جاري الفحص...</span>
                        </>
                      ) : (
                        <>
                          <TelegramIcon className="w-3.5 h-3.5" />
                          <span>فحص اتصال البوت 🚀</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* نتيجة الفحص */}
                {testTelegramResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      testTelegramResult.success
                        ? 'bg-sky-950/80 border-sky-800 text-sky-300'
                        : 'bg-rose-950/80 border-rose-800 text-rose-300'
                    }`}
                  >
                    {testTelegramResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span className="font-bold">{testTelegramResult.message}</span>
                  </div>
                )}

                {/* أداة جلب آخر التفاعلات مع البوت لمعرفة الـ Chat ID */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">لا تعرف الـ Chat ID الخاص بك؟</span>
                  <button
                    type="button"
                    disabled={isLoadingTelegramUpdates || !settings.telegramGateway?.botToken}
                    onClick={async () => {
                      const token = settings.telegramGateway?.botToken?.trim() || '';
                      if (!token) {
                        showToast('error', 'أدخل التوكن أولاً.');
                        return;
                      }
                      setIsLoadingTelegramUpdates(true);
                      try {
                        const updatesRes = await getRecentTelegramUpdates(token);
                        if (updatesRes.success && updatesRes.updates.length > 0) {
                          setRecentTelegramUpdates(updatesRes.updates);
                          showToast('success', `تم العثور على ${updatesRes.updates.length} تفاعل أخير مع البوت.`);
                        } else {
                          showToast('error', 'لم يتم العثور على رسائل واردة للبوت بعد. أرسل رسالة /start للبوت من هاتفك ثم أعد المحاولة.');
                        }
                      } catch (err: any) {
                        showToast('error', 'تعذر جلب التحديثات: ' + err.message);
                      } finally {
                        setIsLoadingTelegramUpdates(false);
                      }
                    }}
                    className="text-sky-400 hover:text-sky-300 disabled:text-slate-500 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingTelegramUpdates ? 'animate-spin' : ''}`} />
                    <span>جلب أحدث المحادثات لاكتشاف الـ Chat ID</span>
                  </button>
                </div>

                {recentTelegramUpdates.length > 0 && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 max-h-48 overflow-y-auto">
                    <span className="text-[10px] text-slate-400 block font-bold">
                      اضغط على أي مستخدم لنسخ معرف المحادثة (Chat ID) الخاص به:
                    </span>
                    <div className="space-y-1.5">
                      {recentTelegramUpdates.map((item, idx) => {
                        const chat = item.message?.chat;
                        const from = item.message?.from;
                        if (!chat) return null;
                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              setTestTelegramChatId(String(chat.id));
                              setSettings((prev) => ({
                                ...prev,
                                telegramGateway: {
                                  ...(prev.telegramGateway || {
                                    enabled: true,
                                    botToken: '',
                                    botUsername: '',
                                    welcomeMessage: 'مرحباً بك في بوت الأمان لنظام عمادكو لمواد البناء 🛡️',
                                    sendOtpOnPasswordReset: true,
                                  }),
                                  adminChatId: String(chat.id),
                                },
                              }));
                              showToast('success', `تم تعيين Chat ID: ${chat.id}`);
                            }}
                            className="p-2 bg-slate-900 hover:bg-sky-950/60 rounded-lg border border-slate-800 hover:border-sky-700/60 flex items-center justify-between text-xs cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-sky-400" />
                              <span className="font-bold text-white">
                                {from?.first_name || chat.first_name || 'مستخدم'} {from?.last_name || ''}
                              </span>
                              {from?.username && (
                                <span className="text-slate-400 text-[10px]">(@{from.username})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sky-400 font-bold bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                                {chat.id}
                              </span>
                              <span className="text-[10px] text-slate-500">اختر 👈</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. إدارة المستخدمين والصلاحيات والأرقام السرية */}

          {activeTab === 'users' && (
            <UsersManagementScreen />
          )}

          {/* 6. الصلاحيات ومصفوفة الأدوار */}
          {activeTab === 'roles' && (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-500" />
                <span>مصفوفة الصلاحيات والتحكم بالأدوار (RBAC)</span>
              </h3>
              <RoleMatrix roles={availableRoles} onRefreshRoles={() => {}} />
            </div>
          )}

          {/* 7. طرق الدفع */}
          {activeTab === 'payment_methods' && (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-500" />
                <span>طرق الدفع المفعلة في نقطة البيع</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {[
                  { name: 'الدفع النقدي (Cash)', desc: 'استلام فوري مع حساب الباقي التلقائي', active: true },
                  { name: 'شبكة مدى والبطاقات (POS)', desc: 'ربط إلكتروني مباشر عبر جهاز الدفع', active: true },
                  { name: 'البيع الآجل للمقاولين (Credit)', desc: 'خصم مع التحقق من السقف الائتماني', active: true },
                  { name: 'التحويل البنكي (Wire Transfer)', desc: 'إرفاق رقم الحوالة والإشعار', active: true },
                ].map((pm, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">{pm.name}</span>
                      <span className="text-[11px] text-slate-500">{pm.desc}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      مفعل
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 8. POS Integration */}
          {activeTab === 'pos_integration' && (
            <div className="space-y-4">
              <PaymentSettingsScreen />
            </div>
          )}

          {/* 9. ZATCA */}
          {activeTab === 'zatca' && (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-amber-500" />
                <span>الفوترة الإلكترونية وتكامل هيئة الزكاة والضريبة والجمارك</span>
              </h3>

              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>نظام الفوترة الإلكترونية متوافق مع متطلبات المرحلة الثانية (الربط والتكامل)</span>
                </div>
                <p className="text-emerald-700 leading-relaxed">
                  توليد الأختام المشفرة (Cryptographic Stamp)، رموز الاستجابة السريعة بمعايير TLV Base64، والمعرف الفريد عالمياً UUID v4 مفعل تلقائياً لكل فاتورة.
                </p>
              </div>
            </div>
          )}

          {/* 10. المتجر */}
          {activeTab === 'storefront' && (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
                <Store className="w-4 h-4 text-amber-500" />
                <span>إعدادات متجر العملاء وطلبات عروض الأسعار</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">اسم المتجر للعملاء</label>
                  <input
                    type="text"
                    value={settings.storefront.storeName}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        storefront: { ...settings.storefront, storeName: e.target.value },
                      })
                    }
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">رقم واتساب لاستقبال الطلبات</label>
                  <input
                    type="text"
                    value={settings.storefront.whatsappOrderNumber}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        storefront: { ...settings.storefront, whatsappOrderNumber: e.target.value },
                      })
                    }
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 11. استراتيجية النسخ الاحتياطي والاستعادة */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              <h3 className="text-sm font-black text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-500" />
                <span>استراتيجية النسخ الاحتياطي واستعادة قاعدة البيانات</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* بطاقة التصدير */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">تصدير نسخة احتياطية كاملة</h4>
                      <p className="text-[11px] text-slate-500">حفظ كافة البيانات والمنتجات والفواتير بتنسيق JSON آمن</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    تقوم هذه العملية بإنشاء ملف نسخة احتياطية شامل يتضمن الأصناف، العملاء، المستودعات، فواتير المبيعات، سندات القبض، المرتجعات، وسجلات التدقيق.
                  </p>

                  <button
                    type="button"
                    onClick={handleExportBackup}
                    disabled={isExporting}
                    className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isExporting ? <RefreshCw className="w-4 h-4 animate-spin text-amber-400" /> : <Download className="w-4 h-4 text-amber-400" />}
                    <span>{isExporting ? 'جاري تصدير السجلات...' : 'تصدير وتحميل النسخة الاحتياطية'}</span>
                  </button>

                  {backupStats && (
                    <div className="text-[11px] text-slate-500 bg-white p-2.5 rounded-lg border border-slate-200">
                      آخر تصدير: {backupStats.lastExport} ({backupStats.lastRecords} سجل تم حفظه)
                    </div>
                  )}
                </div>

                {/* بطاقة الاستعادة */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-700 flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">استيراد واستعادة البيانات</h4>
                      <p className="text-[11px] text-slate-500">استرجاع قاعدة البيانات من ملف نسخة احتياطية سابق</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    حدد ملف النسخة الاحتياطية (.json) للتحقق من سلامة البنية ومطابقة الحقول وإعادة بناء الجداول في قاعدة البيانات السحابية مع توثيق عملية الاستعادة.
                  </p>

                  <label className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer text-center">
                    {isRestoring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <span>{isRestoring ? 'جاري استعادة البيانات...' : 'اختيار ملف النسخة الاحتياطية واستعادته'}</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleRestoreFileSelect}
                      disabled={isRestoring}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* منطقة الخطر الإدارية: فورمات وتصفير قاعدة البيانات السحابية (Admin Only) */}
              {(currentUser?.roleKey === 'system_owner' || currentUser?.roleKey === 'manager') && (
                <div className="mt-8 p-6 rounded-3xl bg-rose-50/80 border-2 border-rose-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <Trash2 className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-black text-rose-950">منطقة العمليات الحساسة: فورمات وتصفير قاعدة البيانات</h4>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-200 text-rose-900 border border-rose-300">
                            صلاحية الدعم الفني Admin فقط 🔒
                          </span>
                        </div>
                        <p className="text-xs text-rose-800 mt-1">
                          تفريغ ومسح السجلات التجريبية، الفواتير، أو الكتالوج بالكامل لإعادة تهيئة النظام للانطلاق الرسمي النظيف.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      id="admin-settings-format-db-btn"
                      onClick={() => setIsFormatModalOpen(true)}
                      className="px-5 py-3 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>بدء فورمات وتصفير قاعدة البيانات...</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* نافذة فورمات وتصفير قاعدة البيانات السحابية */}
      <DatabaseFormatModal
        isOpen={isFormatModalOpen}
        onClose={() => setIsFormatModalOpen(false)}
        onFormatComplete={() => {
          loadSettings();
        }}
      />

      {/* نافذة إدارة وتخصيص المستودعات */}
      <WarehousesManagerModal
        isOpen={isWarehouseModalOpen}
        onClose={() => setIsWarehouseModalOpen(false)}
        warehouses={warehousesList}
        onWarehousesUpdated={() => {
          loadSettings();
        }}
      />
    </div>
  );
};
