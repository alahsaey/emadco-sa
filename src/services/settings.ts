/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc, setDoc, collection, getDocs, writeBatch, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logAuditEvent } from './audit';
import { DatabaseCollectionName } from '../types';
import { setStoredLogoUrl } from '../utils/favicon';

export interface CompanyFacilitySettings {
  nameAr: string;
  nameEn: string;
  crNumber: string;
  vatNumber: string;
  street: string;
  district: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  logoUrl?: string;
  currency: string;
  // موقع المنشأة الجغرافي والخرائط
  googleMapsUrl?: string;
  locationDescription?: string;
  warehouseDescription?: string;
  commercialDescription?: string;
}

export interface TaxSettingsData {
  defaultVatPercent: number; // 15%
  isPriceInclusiveVat: boolean;
  taxRegistrationCity: string;
  vatCategoryCode: string; // 'S' for Standard
  exemptionNotes?: string;
}

export interface InvoicingSettingsData {
  invoicePrefix: string; // 'INV-'
  returnPrefix: string; // 'RET-'
  quotationPrefix: string; // 'QUO-'
  purchasePrefix: string; // 'PO-'
  termsAndConditions: string;
  returnPolicyDays: number; // 7
  autoSendToZatca: boolean;
  requireCustomerPhone: boolean;
}

export interface PrintingSettingsData {
  defaultPrinterType: 'thermal_80mm' | 'standard_a4';
  numberOfCopies: number;
  autoPrintOnPayment: boolean;
  showCompanyLogo: boolean;
  showZatcaQr: boolean;
  showTaxBreakdown: boolean;
  footerNotes: string;
}

export interface StorefrontSettingsData {
  isStoreActive: boolean;
  storeName: string;
  whatsappOrderNumber: string;
  minimumOrderAmount: number;
  freeDeliveryThreshold: number;
  deliveryFee: number;
  announcementBanner: string;
  workingHoursText: string;
}

export interface EmailSmtpSettingsData {
  isEnabled: boolean;
  provider: 'custom_smtp' | 'gmail' | 'outlook';
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  senderEmail: string;
  senderName: string;
  authUsername: string;
  authPassword?: string;
  lastTestStatus?: 'success' | 'failed';
  lastTestMessage?: string;
  lastTestedAt?: string;
}

export interface EmailSmtpConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  senderEmail: string;
  senderName: string;
}

export interface WhatsAppGatewayConfig {
  enabled: boolean;
  provider: 'direct_qr' | 'meta_cloud' | 'ultramsg' | 'custom';
  // Direct QR Pairing session & Server URL (for GitHub / remote deployments)
  backendServerUrl?: string; // e.g. https://ais-dev-... or custom backend URL
  sessionStatus?: 'connected' | 'disconnected' | 'qr_ready' | 'connecting';
  pairedPhoneNumber?: string;
  pairedDeviceName?: string;
  pairedAt?: string;
  qrCodeData?: string;
  // UltraMsg
  instanceId: string;
  token: string;
  // Meta Cloud API
  phoneNumberId: string;
  accessToken: string;
  // Custom Gateway / Webhook
  apiUrl: string;
  apiKey: string;
  // Configuration options
  defaultSendMode: 'direct' | 'app'; // direct = إرسال مباشر دون فتح التطبيق, app = فتح تطبيق واتساب
  autoSendInvoices: boolean;
  autoSendQuotations?: boolean;
  autoSendReceipts?: boolean;
  invoiceTemplate?: string;
  quotationTemplate?: string;
  receiptTemplate?: string;
  antiBanDelaySeconds?: number;
  lastTestStatus?: 'success' | 'failed';
  lastTestMessage?: string;
  lastTestedAt?: string;
}

export interface TelegramGatewayConfig {
  enabled: boolean;
  botToken: string;
  botUsername: string; // e.g. EmadcoSecurityBot
  adminChatId?: string;
  welcomeMessage?: string;
  sendOtpOnPasswordReset: boolean;
  lastTestStatus?: 'success' | 'failed';
  lastTestMessage?: string;
  lastTestedAt?: string;
}

export interface CompleteSystemSettings {
  id: string;
  facility: CompanyFacilitySettings;
  tax: TaxSettingsData;
  invoicing: InvoicingSettingsData;
  printing: PrintingSettingsData;
  storefront: StorefrontSettingsData;
  email: EmailSmtpSettingsData;
  emailSmtp?: EmailSmtpConfig;
  whatsappGateway?: WhatsAppGatewayConfig;
  telegramGateway?: TelegramGatewayConfig;
  updatedAt: string;
  updatedBy: string;
}

export const DEFAULT_SYSTEM_SETTINGS: CompleteSystemSettings = {
  id: 'general_settings',
  facility: {
    nameAr: 'مؤسسة عماد سعد آل سعيد لمواد البناء',
    nameEn: 'Emad Saad Al-Saeed Building Materials (Emadco)',
    crNumber: '1010998877',
    vatNumber: '310948572100003',
    street: 'شارع المقاولين الرئيسي - طريق الخرج',
    district: 'حي الصناعية القديمة',
    city: 'الرياض',
    postalCode: '12844',
    country: 'المملكة العربية السعودية',
    phone: '0114567890',
    email: 'info@emadco.sa',
    website: 'https://emadco.sa',
    currency: 'ر.س',
    googleMapsUrl: 'https://maps.google.com/?q=24.6333,46.7167',
    locationDescription: 'الرياض، طريق الخرج القديم، حي الصناعية، بجوار سوق مواد البناء، هنجر رقم 14 و 18.',
    warehouseDescription: 'مجهزة برافعة شوكية وأرصفة تحميل دينا وتريلا لتسريع تسليم البضائع.',
    commercialDescription: 'مؤسسة وطنية متخصصة في تجارة وتوريد مواد البناء والتشييد ومستلزمات المقاولين. نلتزم بأعلى معايير الجودة والمواصفات السعودية مع توفير عروض أسعار فورية للمشاريع الكبرى والورش.',
  },
  tax: {
    defaultVatPercent: 15,
    isPriceInclusiveVat: true,
    taxRegistrationCity: 'الرياض',
    vatCategoryCode: 'S',
    exemptionNotes: 'تطبق النسبة الأساسية 15% على كافة مواد البناء والأقفال ومستلزمات التشطيب حسب لوائح ZATCA.',
  },
  invoicing: {
    invoicePrefix: 'INV-',
    returnPrefix: 'RET-',
    quotationPrefix: 'QUO-',
    purchasePrefix: 'PO-',
    termsAndConditions: 'البضاعة المباعة ترد وتستبدل خلال 7 أيام من تاريخ الشراء بحالتها الأصلية مع الفاتورة الضريبية.',
    returnPolicyDays: 7,
    autoSendToZatca: true,
    requireCustomerPhone: false,
  },
  printing: {
    defaultPrinterType: 'thermal_80mm',
    numberOfCopies: 1,
    autoPrintOnPayment: true,
    showCompanyLogo: true,
    showZatcaQr: true,
    showTaxBreakdown: true,
    footerNotes: 'شكراً لتعاملكم مع مؤسسة عماد سعد آل سعيد لمواد البناء (عمادكو) • نسعد بخدمتكم دائماً',
  },
  storefront: {
    isStoreActive: true,
    storeName: 'متجر عمادكو لمواد البناء والأقفال',
    whatsappOrderNumber: '966501112233',
    minimumOrderAmount: 100,
    freeDeliveryThreshold: 500,
    deliveryFee: 35,
    announcementBanner: 'خصم خاص للمقاولين والكميات للمشاريع الإنشائية • توصيل سريع للمواقع',
    workingHoursText: 'السبت - الخميس: 7:00 ص - 9:00 م | الجمعة: 4:00 م - 9:00 م',
  },
  email: {
    isEnabled: true,
    provider: 'gmail',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpSecure: false,
    senderEmail: 'alahsaey@gmail.com',
    senderName: 'عمادكو لمواد البناء - نظام الأمان',
    authUsername: 'alahsaey@gmail.com',
    authPassword: '',
  },
  emailSmtp: {
    enabled: true,
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: 'alahsaey@gmail.com',
    pass: '',
    senderEmail: 'alahsaey@gmail.com',
    senderName: 'عمادكو لمواد البناء - نظام الأمان',
  },
  whatsappGateway: {
    enabled: true,
    provider: 'direct_qr',
    backendServerUrl: '',
    sessionStatus: 'connected',
    pairedPhoneNumber: '0500680180',
    pairedDeviceName: 'هاتف المحاسبة والإدارة الرئيسي',
    pairedAt: new Date().toISOString(),
    instanceId: '',
    token: '',
    phoneNumberId: '',
    accessToken: '',
    apiUrl: '',
    apiKey: '',
    defaultSendMode: 'direct',
    autoSendInvoices: true,
    autoSendQuotations: true,
    autoSendReceipts: false,
    invoiceTemplate: 'مرحباً بك عميلنا العزيز {customerName}،\nمرفق لكم فاتورتكم الضريبية رقم {invoiceNumber} الصادرة من {facilityName} بإجمالي: {totalAmount} ر.س.\nشكراً لتعاملكم معنا ونسعد بخدمتكم دائماً!',
    quotationTemplate: 'مرحباً بك عميلنا العزيز {customerName}،\nيسر مؤسسة {facilityName} تقديم عرض السعر رقم {documentNumber} بقيمة إجمالية: {totalAmount} ر.س.\nالعرض ساري لمدة 7 أيام عمل.',
    receiptTemplate: 'عميلنا العزيز {customerName}،\nتم استلام دفعة مالية بقيمة {amount} ر.س لسند القبض رقم {receiptNumber}. شكراً لكم.',
    antiBanDelaySeconds: 4,
  },
  telegramGateway: {
    enabled: true,
    botToken: '',
    botUsername: '',
    adminChatId: '',
    welcomeMessage: 'مرحباً بك في بوت الأمان لنظام عمادكو لمواد البناء 🛡️',
    sendOtpOnPasswordReset: true,
  },
  updatedAt: new Date().toISOString(),
  updatedBy: 'المدير العام',
};


let cachedSettings: CompleteSystemSettings = { ...DEFAULT_SYSTEM_SETTINGS };

/**
 * الحصول على الإعدادات المخزنة مؤقتاً بصورة متزامنة وسريعة
 */
export function getCachedSystemSettings(): CompleteSystemSettings {
  return cachedSettings;
}

/**
 * تحديث الكاش المحلي
 */
export function setCachedSystemSettings(settings: CompleteSystemSettings): void {
  cachedSettings = settings;
  if (settings.facility?.logoUrl) {
    setStoredLogoUrl(settings.facility.logoUrl);
  }
}

/**
 * اشتراك حي ومباشر في إعدادات النظام من Firestore لتحديث التطبيق فوراً عند أي تعديل
 */
export function subscribeToSystemSettings(
  onUpdate: (settings: CompleteSystemSettings) => void
): () => void {
  const docRef = doc(db, 'system_settings', 'general_settings');
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const raw = snap.data() as Partial<CompleteSystemSettings>;
        const data: CompleteSystemSettings = {
          ...DEFAULT_SYSTEM_SETTINGS,
          ...raw,
          facility: { ...DEFAULT_SYSTEM_SETTINGS.facility, ...(raw.facility || {}) },
          tax: { ...DEFAULT_SYSTEM_SETTINGS.tax, ...(raw.tax || {}) },
          invoicing: { ...DEFAULT_SYSTEM_SETTINGS.invoicing, ...(raw.invoicing || {}) },
          printing: { ...DEFAULT_SYSTEM_SETTINGS.printing, ...(raw.printing || {}) },
          storefront: { ...DEFAULT_SYSTEM_SETTINGS.storefront, ...(raw.storefront || {}) },
          email: { ...DEFAULT_SYSTEM_SETTINGS.email, ...(raw.email || {}) },
        };
        setCachedSystemSettings(data);
        onUpdate(data);
      } else {
        setCachedSystemSettings(DEFAULT_SYSTEM_SETTINGS);
        onUpdate(DEFAULT_SYSTEM_SETTINGS);
      }
    },
    (err) => {
      console.warn('تنبيه اشتراك إعدادات النظام الحي:', err);
      onUpdate(cachedSettings);
    }
  );
}

/**
 * جلب إعدادات النظام الشاملة من Firestore
 */
export async function getSystemSettings(): Promise<CompleteSystemSettings> {
  try {
    const docRef = doc(db, 'system_settings', 'general_settings');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const raw = snap.data() as Partial<CompleteSystemSettings>;
      const data: CompleteSystemSettings = {
        ...DEFAULT_SYSTEM_SETTINGS,
        ...raw,
        facility: { ...DEFAULT_SYSTEM_SETTINGS.facility, ...(raw.facility || {}) },
        tax: { ...DEFAULT_SYSTEM_SETTINGS.tax, ...(raw.tax || {}) },
        invoicing: { ...DEFAULT_SYSTEM_SETTINGS.invoicing, ...(raw.invoicing || {}) },
        printing: { ...DEFAULT_SYSTEM_SETTINGS.printing, ...(raw.printing || {}) },
        storefront: { ...DEFAULT_SYSTEM_SETTINGS.storefront, ...(raw.storefront || {}) },
        email: { ...DEFAULT_SYSTEM_SETTINGS.email, ...(raw.email || {}) },
      };
      setCachedSystemSettings(data);
      return data;
    }
  } catch (err) {
    console.warn('استخدام الإعدادات الافتراضية للنظام:', err);
  }
  return cachedSettings;
}

/**
 * حفظ وتحديث إعدادات النظام
 */
export async function saveSystemSettings(
  updates: Partial<CompleteSystemSettings>,
  actorName = 'المدير'
): Promise<CompleteSystemSettings> {
  const current = await getSystemSettings();
  const merged: CompleteSystemSettings = {
    ...current,
    ...updates,
    facility: { ...current.facility, ...(updates.facility || {}) },
    tax: { ...current.tax, ...(updates.tax || {}) },
    invoicing: { ...current.invoicing, ...(updates.invoicing || {}) },
    printing: { ...current.printing, ...(updates.printing || {}) },
    storefront: { ...current.storefront, ...(updates.storefront || {}) },
    email: { ...current.email, ...(updates.email || {}) },
    emailSmtp: updates.emailSmtp
      ? { ...(current.emailSmtp || DEFAULT_SYSTEM_SETTINGS.emailSmtp!), ...updates.emailSmtp }
      : current.emailSmtp,
    whatsappGateway: updates.whatsappGateway
      ? { ...(current.whatsappGateway || DEFAULT_SYSTEM_SETTINGS.whatsappGateway!), ...updates.whatsappGateway }
      : current.whatsappGateway,
    updatedAt: new Date().toISOString(),
    updatedBy: actorName,
  };

  setCachedSystemSettings(merged);

  const docRef = doc(db, 'system_settings', 'general_settings');
  await setDoc(docRef, merged);

  await logAuditEvent({
    userName: actorName,
    action: 'UPDATE',
    entity: 'system_settings',
    entityId: 'general_settings',
    details: `تم تحديث إعدادات النظام الشاملة بواسطة ${actorName}`,
  });

  return merged;
}

/**
 * تصدير نسخة احتياطية كاملة من قاعدة البيانات (Backup Strategy)
 */
export async function exportDatabaseBackup(): Promise<{
  timestamp: string;
  version: string;
  totalRecords: number;
  collections: Record<string, any[]>;
}> {
  const backupCollections: DatabaseCollectionName[] = [
    'products',
    'categories',
    'brands',
    'units',
    'customers',
    'suppliers',
    'warehouses',
    'branches',
    'inventory',
    'inventory_movements',
    'sales',
    'sale_items',
    'invoices',
    'invoice_items',
    'payments',
    'returns',
    'quotations',
    'users',
    'roles',
    'payment_methods',
    'system_settings',
    'audit_logs',
  ];

  const backupData: Record<string, any[]> = {};
  let totalRecords = 0;

  for (const colName of backupCollections) {
    try {
      const snap = await getDocs(collection(db, colName));
      const records = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));
      backupData[colName] = records;
      totalRecords += records.length;
    } catch (err) {
      console.warn(`تخطي تصدير المجموعة ${colName}:`, err);
      backupData[colName] = [];
    }
  }

  return {
    timestamp: new Date().toISOString(),
    version: '2.0-commercial',
    totalRecords,
    collections: backupData,
  };
}

/**
 * استعادة نسخة احتياطية إلى قاعدة البيانات
 */
export async function restoreDatabaseFromBackup(
  backupJson: any,
  actorName = 'الدعم الفني Admin'
): Promise<{ success: boolean; restoredCount: number; message: string }> {
  if (!backupJson || !backupJson.collections || typeof backupJson.collections !== 'object') {
    throw new Error('ملف النسخة الاحتياطية غير صالح أو تالف. يجب أن يحتوي على كائن collections.');
  }

  let restoredCount = 0;
  const colKeys = Object.keys(backupJson.collections);

  for (const colName of colKeys) {
    const docs = backupJson.collections[colName];
    if (Array.isArray(docs)) {
      // الكتابة على دفعات
      for (const item of docs) {
        const docId = item._id || item.id;
        if (docId) {
          const { _id, ...cleanData } = item;
          await setDoc(doc(db, colName, docId), cleanData);
          restoredCount++;
        }
      }
    }
  }

  await logAuditEvent({
    userName: actorName,
    action: 'RESTORE',
    entity: 'system_settings',
    entityId: 'backup_restore',
    details: `تمت استعادة نسخة احتياطية لقاعدة البيانات بنجاح: ${restoredCount} سجل موزعة على ${colKeys.length} جدول.`,
  });

  return {
    success: true,
    restoredCount,
    message: `تمت استعادة ${restoredCount} سجل بنجاح في قاعدة البيانات السحابية.`,
  };
}
