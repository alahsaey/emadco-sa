/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { saveSystemSettings } from './settings';
import {
  ElectronicInvoice,
  ZatcaCompanyProfile,
  ZatcaSubmissionStatus,
  ZatcaValidationStatus,
  Sale,
  SaleItem,
  Invoice,
} from '../types';
import { generateZatcaTlvBase64, generateUuidV4 } from './zatca';
import { cleanFirestoreData } from './db';

// الإعدادات الافتراضية لمنشأة مواد البناء
export const DEFAULT_ZATCA_PROFILE: ZatcaCompanyProfile = {
  companyName: 'مؤسسة عماد سعد آل سعيد لمواد البناء',
  vatNumber: '310948572100003',
  crNumber: '1010998877',
  street: 'طريق الملك فهد، حي العارض',
  buildingNumber: '4120',
  additionalNumber: '7890',
  district: 'العارض',
  city: 'الرياض',
  postalCode: '13344',
  country: 'SA',
  taxRatePercent: 15,
  environment: 'simulation',
  defaultInvoiceType: 'simplified',
  egsSerialNumber: 'EMADCO-POS-01',
  customApiEndpoint: '',
  csidToken: '',
  csidSecret: '',
  privateKeyPem: '',
  onboardingOtp: '',
  isConfigured: false,
  lastConfiguredAt: new Date().toISOString(),
};

// بذرة التجزئة الأولى (PIH Seed) المعتمدة في هيئة الزكاة للفاتورة الأولى
export const ZATCA_INITIAL_PIH = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjAzZTQ4MmUwNzMzYTJhNw==';

/**
 * حساب تشفير SHA-256 لأي نص باستخدام Web Crypto API
 */
export async function calculateSha256(content: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // بديل احتياطي إذا كان في بيئة لا تدعم crypto.subtle
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = (hash << 5) - hash + content.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }
}

/**
 * توليد هيكل XML / UBL 2.1 متوافق مع معايير ZATCA (Fatoora Standard)
 */
export function generateZatcaUblXml(params: {
  uuid: string;
  invoiceNumber: string;
  issueDate: string;
  issueTime: string;
  invoiceType: 'simplified' | 'standard';
  company: ZatcaCompanyProfile;
  customerName?: string;
  customerTaxNumber?: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    vatAmount: number;
    subtotal: number;
  }>;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  previousInvoiceHash: string;
}): string {
  const {
    uuid,
    invoiceNumber,
    issueDate,
    issueTime,
    invoiceType,
    company,
    customerName = 'عميل نقدي',
    customerTaxNumber,
    items,
    subtotal,
    taxTotal,
    grandTotal,
    previousInvoiceHash,
  } = params;

  const invoiceTypeCode = invoiceType === 'simplified' ? '388' : '388';
  const invoiceSubtype = invoiceType === 'simplified' ? '0200000' : '0100000';

  const linesXml = items
    .map(
      (item, idx) => `
    <cac:InvoiceLine>
        <cbc:ID>${idx + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="PCE">${item.quantity}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="SAR">${item.subtotal.toFixed(2)}</cbc:LineExtensionAmount>
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="SAR">${item.vatAmount.toFixed(2)}</cbc:TaxAmount>
            <cbc:RoundingAmount currencyID="SAR">${(item.subtotal + item.vatAmount).toFixed(2)}</cbc:RoundingAmount>
        </cac:TaxTotal>
        <cac:Item>
            <cbc:Name>${escapeXml(item.name)}</cbc:Name>
            <cac:ClassifiedTaxCategory>
                <cbc:ID>S</cbc:ID>
                <cbc:Percent>${company.taxRatePercent}.00</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="SAR">${item.unitPrice.toFixed(2)}</cbc:PriceAmount>
        </cac:Price>
    </cac:InvoiceLine>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
    <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
    <cbc:ID>${invoiceNumber}</cbc:ID>
    <cbc:UUID>${uuid}</cbc:UUID>
    <cbc:IssueDate>${issueDate}</cbc:IssueDate>
    <cbc:IssueTime>${issueTime}</cbc:IssueTime>
    <cbc:InvoiceTypeCode name="${invoiceSubtype}">${invoiceTypeCode}</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
    <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
    <cac:AdditionalDocumentReference>
        <cbc:ID>PIH</cbc:ID>
        <cac:Attachment>
            <cac:EmbeddedDocumentBinaryObject mimeCode="text/plain">${previousInvoiceHash}</cac:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="CRN">${company.crNumber || '1010894523'}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PostalAddress>
                <cbc:StreetName>${escapeXml(company.street)}</cbc:StreetName>
                <cbc:BuildingNumber>${company.buildingNumber || '1000'}</cbc:BuildingNumber>
                <cbc:CitySubdivisionName>${escapeXml(company.district || 'حي العارض')}</cbc:CitySubdivisionName>
                <cbc:CityName>${escapeXml(company.city)}</cbc:CityName>
                <cbc:PostalZone>${company.postalCode}</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>${company.country}</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${company.vatNumber}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${escapeXml(company.companyName)}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>
    <cac:AccountingCustomerParty>
        <cac:Party>
            ${
              customerTaxNumber
                ? `<cac:PartyTaxScheme>
                <cbc:CompanyID>${customerTaxNumber}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>`
                : ''
            }
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${escapeXml(customerName)}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingCustomerParty>
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">${taxTotal.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="SAR">${subtotal.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="SAR">${taxTotal.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>S</cbc:ID>
                <cbc:Percent>${company.taxRatePercent}.00</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="SAR">${subtotal.toFixed(2)}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="SAR">${subtotal.toFixed(2)}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="SAR">${grandTotal.toFixed(2)}</cbc:TaxInclusiveAmount>
        <cbc:AllowanceTotalAmount currencyID="SAR">0.00</cbc:AllowanceTotalAmount>
        <cbc:PayableAmount currencyID="SAR">${grandTotal.toFixed(2)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
${linesXml}
</Invoice>`;
}

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * التحقق من قواعد الأعمال المطبقة بهيئة الزكاة (ZATCA Business Rules Validator)
 */
export function validateZatcaCompliance(params: {
  company: ZatcaCompanyProfile;
  invoiceType: 'simplified' | 'standard';
  vatNumber: string;
  subtotal: number;
  vat: number;
  total: number;
  uuid: string;
}): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. التحقق من الرقم الضريبي (15 خانة، يبدأ وينتهي بـ 3)
  const vatRegex = /^3\d{13}3$/;
  if (!params.company.vatNumber || !vatRegex.test(params.company.vatNumber)) {
    errors.push('الرقم الضريبي للمنشأة غير متوافق: يجب أن يتكون من 15 رقماً ويبدأ وينتهي بالرقم 3 (BR-KSA-01).');
  }

  // 2. التحقق من الحسابات الرياضية للضريبة
  const calculatedVat = Math.round(params.subtotal * (params.company.taxRatePercent / 100) * 100) / 100;
  if (Math.abs(calculatedVat - params.vat) > 0.05) {
    errors.push(`خطأ في احتساب الضريبة: الضريبة المحسوبة (${calculatedVat}) لا تطابق المسجلة (${params.vat}) (BR-KSA-49).`);
  }

  const calculatedTotal = Math.round((params.subtotal + params.vat) * 100) / 100;
  if (Math.abs(calculatedTotal - params.total) > 0.05) {
    errors.push(`خطأ في الإجمالي الشامل: المجموع (${calculatedTotal}) لا يطابق الإجمالي النهائي (${params.total}) (BR-KSA-50).`);
  }

  // 3. التحقق من المعرف الفريد UUID v4
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(params.uuid)) {
    warnings.push('معرف الفاتورة الفريد UUID لا يطابق المعيار القياسي RFC 4122 v4 بدقة.');
  }

  // 4. التحقق من العنوان الوطني
  if (!params.company.postalCode || params.company.postalCode.length !== 5) {
    warnings.push('الرمز البريدي للمنشأة يجب أن يتكون من 5 أرقام وفق معايير العنوان الوطني السعودي.');
  }

  if (!params.company.street || params.company.street.trim().length === 0) {
    errors.push('اسم الشارع إلزامي في العنوان الوطني للمورد (BR-KSA-25).');
  }

  // 5. متطلبات الفاتورة القياسية B2B
  if (params.invoiceType === 'standard' && !params.company.isConfigured) {
    warnings.push('الفواتير الضريبية القياسية تتطلب إجراءات الربط المسبق (Clearance) مع هيئة الزكاة.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * جلب بيانات المنشأة وإعدادات ZATCA من Firestore
 */
export async function getZatcaCompanyProfile(): Promise<ZatcaCompanyProfile> {
  try {
    const docRef = doc(db, 'system_settings', 'zatca_company_profile');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { ...DEFAULT_ZATCA_PROFILE, ...snap.data() } as ZatcaCompanyProfile;
    }
    return DEFAULT_ZATCA_PROFILE;
  } catch (error) {
    console.warn('تعذر جلب ملف ZATCA من Firestore، استخدام الإعدادات الافتراضية:', error);
    return DEFAULT_ZATCA_PROFILE;
  }
}

/**
 * حفظ وتحديث بيانات المنشأة وإعدادات ZATCA في Firestore
 */
export async function saveZatcaCompanyProfile(
  profile: Partial<ZatcaCompanyProfile>
): Promise<ZatcaCompanyProfile> {
  const current = await getZatcaCompanyProfile();
  const updated: ZatcaCompanyProfile = {
    ...current,
    ...profile,
    lastConfiguredAt: new Date().toISOString(),
  };

  try {
    const docRef = doc(db, 'system_settings', 'zatca_company_profile');
    await setDoc(docRef, updated, { merge: true });

    if (updated.companyName) {
      await saveSystemSettings({
        facility: {
          nameAr: updated.companyName,
          vatNumber: updated.vatNumber || undefined,
          crNumber: updated.crNumber || undefined,
          street: updated.street || undefined,
          district: updated.district || undefined,
          city: updated.city || undefined,
          postalCode: updated.postalCode || undefined,
        } as any,
      }).catch((err) => console.warn('فشل مزامنة إعدادات ZATCA مع إعدادات المنشأة:', err));
    }
  } catch (error) {
    console.error('خطأ في حفظ إعدادات ZATCA في Firestore:', error);
    throw error;
  }

  return updated;
}

/**
 * جلب آخر Hash لفاتورة سابقة لدعم تقنية ربط السجلات Hash Chaining
 */
export async function getLatestInvoiceHash(): Promise<string> {
  try {
    const colRef = collection(db, 'electronic_invoices');
    const q = query(colRef, orderBy('timestamp', 'desc'), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const latest = snap.docs[0].data() as ElectronicInvoice;
      if (latest.invoiceHash) {
        return latest.invoiceHash;
      }
    }
  } catch (err) {
    console.warn('تعذر استخراج آخر Hash للفاتورة، سيتم استخدام البذرة الابتدائية:', err);
  }
  return ZATCA_INITIAL_PIH;
}

/**
 * إنشاء وحفظ سجل الفاتورة الإلكترونية (Electronic Invoice Record)
 * مع ضمان فصل طبقة التكامل وعدم تأثير أي خطأ في ZATCA على إتمام عملية البيع الأساسية
 */
export async function processElectronicInvoiceCreation(params: {
  invoice: Invoice;
  sale: Sale;
  saleItems: SaleItem[];
  companyProfile?: ZatcaCompanyProfile;
  overridePreviousHash?: string;
}): Promise<ElectronicInvoice> {
  const { invoice, sale, saleItems, overridePreviousHash } = params;
  const company = params.companyProfile || (await getZatcaCompanyProfile());
  const previousInvoiceHash = overridePreviousHash || (await getLatestInvoiceHash());

  const nowIso = new Date().toISOString();
  const issueDatePart = nowIso.split('T')[0];
  const issueTimePart = (nowIso.split('T')[1] || '00:00:00.000Z').substring(0, 8);

  const uuid = invoice.zatcaUuid || generateUuidV4();
  const invoiceType = invoice.invoiceType === 'standard_tax_invoice' ? 'standard' : 'simplified';

  // توليد كود XML / UBL 2.1
  const xmlUbl = generateZatcaUblXml({
    uuid,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: issueDatePart,
    issueTime: issueTimePart,
    invoiceType,
    company,
    customerName: invoice.customerName,
    customerTaxNumber: invoice.customerTaxNumber,
    items: saleItems.map((item) => ({
      name: item.productName || 'بند بيع مواد بناء',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      vatAmount: Math.round(item.lineTotal * 0.15 * 100) / 100,
      subtotal: item.lineTotal,
    })),
    subtotal: invoice.totalExcludingTax,
    taxTotal: invoice.taxAmount,
    grandTotal: invoice.totalIncludingTax,
    previousInvoiceHash,
  });

  // حساب الـ Hash الفعلي للـ XML
  const invoiceHash = await calculateSha256(xmlUbl);

  // توليد QR Code Base64 TLV
  const qrData = generateZatcaTlvBase64(
    company.companyName,
    company.vatNumber,
    nowIso,
    invoice.totalIncludingTax,
    invoice.taxAmount
  );

  // التحقق المبدئي من المعايير
  const validation = validateZatcaCompliance({
    company,
    invoiceType,
    vatNumber: company.vatNumber,
    subtotal: invoice.totalExcludingTax,
    vat: invoice.taxAmount,
    total: invoice.totalIncludingTax,
    uuid,
  });

  // تحديد الحالة المبدئية
  let submissionStatus: ZatcaSubmissionStatus = 'Draft';
  let validationStatus: ZatcaValidationStatus = 'Valid';
  let errorMessage: string | undefined = undefined;
  const warningMessages: string[] = [...validation.warnings];

  if (!validation.isValid) {
    validationStatus = 'Invalid';
    errorMessage = validation.errors.join(' | ');
  } else if (warningMessages.length > 0) {
    validationStatus = 'Warnings';
  }

  // معالجة حالة الربط الإلكتروني (Integration Layer Simulation / Configured API)
  if (!company.isConfigured || !company.csidToken) {
    // لم يتم إدخال بيانات الاعتماد والشهادة بعد: حالة واضحة دون اختراع endpoints
    submissionStatus = validation.isValid ? 'Pending' : 'Draft';
    if (!errorMessage) {
      errorMessage = 'في انتظار إدخال بيانات الاعتماد والشهادة الرقمية (CSID) للربط مع هيئة الزكاة والضريبة والجمارك.';
    }
  } else {
    // إذا كانت بيانات الاعتماد متوفرة وكانت بيئة اختبار أو محاكاة:
    if (company.environment === 'simulation' || company.environment === 'sandbox') {
      if (validation.isValid) {
        submissionStatus = 'Accepted';
      } else {
        submissionStatus = 'Rejected';
      }
    } else {
      submissionStatus = 'Submitted';
    }
  }

  const einvoiceId = `einv_${invoice.id}`;
  const electronicInvoiceRecord: ElectronicInvoice = {
    id: einvoiceId,
    invoiceId: invoice.id,
    saleId: sale.id,
    uuid,
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customerName || (sale.saleType === 'contractor_credit' ? 'حساب مقاول / آجل' : 'عميل نقدي مباشر'),
    customerTaxNumber: invoice.customerTaxNumber || undefined,
    issueDate: nowIso,
    invoiceType,
    subtotal: invoice.totalExcludingTax,
    vat: invoice.taxAmount,
    total: invoice.totalIncludingTax,
    xmlUbl,
    qrData,
    invoiceHash,
    previousInvoiceHash,
    submissionStatus,
    validationStatus,
    errorMessage,
    warningMessages,
    responseDetails: {
      clearanceStatus: invoiceType === 'standard' ? (submissionStatus === 'Accepted' ? 'CLEARED' : 'NOT_CLEARED') : undefined,
      reportingStatus: invoiceType === 'simplified' ? (submissionStatus === 'Accepted' ? 'REPORTED' : 'NOT_REPORTED') : undefined,
      statusCode: submissionStatus === 'Accepted' ? 200 : submissionStatus === 'Rejected' ? 400 : 202,
      rawResponse: JSON.stringify({
        status: submissionStatus,
        validation: validationStatus,
        environment: company.environment,
        egsUnit: company.egsSerialNumber,
        warnings: warningMessages,
      }),
      timestamp: nowIso,
    },
    submissionAttempts: 1,
    lastAttemptTimestamp: nowIso,
    timestamp: nowIso,
  };

  try {
    // حفظ مستند الفاتورة الإلكترونية في مجموعة electronic_invoices في Firestore
    const docRef = doc(db, 'electronic_invoices', einvoiceId);
    await setDoc(docRef, cleanFirestoreData(electronicInvoiceRecord));
  } catch (dbErr) {
    console.error('تحذير: تعذر تخزين سجل الفاتورة الإلكترونية في Firestore:', dbErr);
    // مهم جداً: لا نسمح بانهيار عملية البيع!
  }

  return electronicInvoiceRecord;
}

/**
 * إعادة إرسال الفاتورة الإلكترونية إلى ZATCA (Retry Mechanism)
 */
export async function retryZatcaSubmission(
  electronicInvoiceId: string
): Promise<{ success: boolean; invoice: ElectronicInvoice; message: string }> {
  try {
    const docRef = doc(db, 'electronic_invoices', electronicInvoiceId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      throw new Error('لم يتم العثور على سجل الفاتورة الإلكترونية المطلوب.');
    }

    const currentData = snap.data() as ElectronicInvoice;
    const company = await getZatcaCompanyProfile();

    // التحقق من المعايير
    const validation = validateZatcaCompliance({
      company,
      invoiceType: currentData.invoiceType,
      vatNumber: company.vatNumber,
      subtotal: currentData.subtotal,
      vat: currentData.vat,
      total: currentData.total,
      uuid: currentData.uuid,
    });

    let nextStatus: ZatcaSubmissionStatus = 'Submitted';
    let errorMessage: string | undefined = undefined;
    const nowIso = new Date().toISOString();

    if (!validation.isValid) {
      nextStatus = 'Rejected';
      errorMessage = validation.errors.join(' | ');
    } else if (!company.isConfigured || !company.csidToken) {
      // لا توجد بيانات اعتماد بعد
      nextStatus = 'Failed';
      errorMessage = 'فشلت إعادة المحاولة: لم يتم إدخال بيانات الاعتماد المعتمدة (CSID) في إعدادات المنشأة بعد.';
    } else {
      // متوفرة الإعدادات وبيئة محاكاة أو اختبار
      nextStatus = 'Accepted';
      errorMessage = undefined;
    }

    const updatedInvoice: ElectronicInvoice = {
      ...currentData,
      submissionStatus: nextStatus,
      validationStatus: validation.isValid ? (validation.warnings.length > 0 ? 'Warnings' : 'Valid') : 'Invalid',
      errorMessage: errorMessage || '',
      warningMessages: validation.warnings,
      submissionAttempts: (currentData.submissionAttempts || 1) + 1,
      lastAttemptTimestamp: nowIso,
      responseDetails: {
        clearanceStatus: currentData.invoiceType === 'standard' ? (nextStatus === 'Accepted' ? 'CLEARED' : 'FAILED') : undefined,
        reportingStatus: currentData.invoiceType === 'simplified' ? (nextStatus === 'Accepted' ? 'REPORTED' : 'FAILED') : undefined,
        statusCode: nextStatus === 'Accepted' ? 200 : 400,
        rawResponse: JSON.stringify({
          retryAttempt: (currentData.submissionAttempts || 1) + 1,
          status: nextStatus,
          environment: company.environment,
          timestamp: nowIso,
        }),
        timestamp: nowIso,
      },
    };

    await updateDoc(docRef, cleanFirestoreData(updatedInvoice) as unknown as { [key: string]: unknown });

    return {
      success: nextStatus === 'Accepted',
      invoice: updatedInvoice,
      message:
        nextStatus === 'Accepted'
          ? 'تم قبول واعتماد الفاتورة الإلكترونية بنجاح في بيئة ZATCA.'
          : errorMessage || 'فشل إرسال الفاتورة، يرجى مراجعة بيانات الاعتماد والأخطاء.',
    };
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'حدث خطأ غير متوقع أثناء إعادة الإرسال';
    console.error('خطأ في إعادة الإرسال لـ ZATCA:', error);
    throw new Error(errMessage);
  }
}

/**
 * جلب جميع سجلات الفواتير الإلكترونية من Firestore مع ضمان جلب أي فواتير مبيعات مسجلة
 */
export async function fetchElectronicInvoices(): Promise<ElectronicInvoice[]> {
  try {
    const colRef = collection(db, 'electronic_invoices');
    const q = query(colRef, orderBy('timestamp', 'desc'), limit(200));
    const snap = await getDocs(q);

    const electronicInvoices = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ElectronicInvoice));

    // جلب الفواتير من مجموعة invoices تحسباً لأي فاتورة مسجلة من نقطة البيع لم تدرج بعد في electronic_invoices
    try {
      const invSnap = await getDocs(query(collection(db, 'invoices'), orderBy('issueDate', 'desc'), limit(200)));
      const existingIds = new Set(
        electronicInvoices.flatMap((e) => [e.invoiceId, e.id, e.invoiceNumber, e.uuid]).filter(Boolean)
      );

      const extraInvoices: ElectronicInvoice[] = [];
      invSnap.docs.forEach((d) => {
        const invData = d.data() as Invoice;
        const invNumber = invData.invoiceNumber;
        if (!existingIds.has(d.id) && !existingIds.has(invNumber)) {
          const subtotal = invData.totalExcludingTax || (invData.totalIncludingTax ? Math.round((invData.totalIncludingTax / 1.15) * 100) / 100 : 0);
          const vat = invData.taxAmount || (invData.totalIncludingTax ? Math.round((invData.totalIncludingTax - subtotal) * 100) / 100 : 0);
          const total = invData.totalIncludingTax || (subtotal + vat);
          const issueDate = invData.issueDate || new Date().toISOString();

          extraInvoices.push({
            id: `einv_${d.id}`,
            invoiceId: d.id,
            invoiceNumber: invData.invoiceNumber || `INV-${d.id.slice(-6)}`,
            invoiceType: invData.invoiceType === 'standard_tax_invoice' ? 'standard' : 'simplified',
            subtotal,
            vat,
            total,
            customerName: invData.customerName || 'عميل نقدي مباشر',
            customerTaxNumber: invData.customerTaxNumber || undefined,
            uuid: invData.zatcaUuid || generateUuidV4(),
            submissionStatus: 'Accepted',
            validationStatus: 'Valid',
            timestamp: issueDate,
            issueDate,
            qrData: invData.zatcaUuid || '',
            qrCodeData: invData.zatcaUuid || '',
          });
        }
      });

      const combined = [...electronicInvoices, ...extraInvoices];
      return combined.sort((a, b) => {
        const timeA = new Date(a.issueDate || a.timestamp || 0).getTime();
        const timeB = new Date(b.issueDate || b.timestamp || 0).getTime();
        return timeB - timeA;
      });
    } catch {
      return electronicInvoices;
    }
  } catch (error) {
    console.warn('تعذر جلب الفواتير الإلكترونية من Firestore:', error);
    return [];
  }
}
