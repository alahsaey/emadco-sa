/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 1. الأدوار والصلاحيات والمستخدمين
export type RoleKey = 'system_owner' | 'manager' | 'cashier' | 'sales_rep' | 'inventory_officer';

export interface Role {
  id: string;
  nameAr: string;
  nameEn: string;
  key: RoleKey;
  description: string;
  isSystem: boolean;
  permissionIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: string;
  module: 'products' | 'inventory' | 'sales' | 'purchases' | 'users' | 'reports' | 'settings' | 'customers' | 'suppliers';
  code: string;
  nameAr: string;
  description: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  avatarUrl?: string;
  telegramChatId?: string;
  telegramUsername?: string;
  telegramLinkedAt?: string;
  roleId: string;
  roleKey: RoleKey;
  branchId: string;
  warehouseId?: string;
  isActive: boolean;
  password?: string;
  pinCode?: string;
  customPermissions?: string[];
  lastLoginAt?: string;
  lastActiveAt?: string;
  isOnline?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  assignedAt: string;
  assignedBy: string;
}

// 2. التصنيفات، الماركات، والوحدات
export interface Category {
  id: string;
  nameAr: string;
  nameEn: string;
  code: string;
  parentId?: string | null;
  icon?: string;
  isActive: boolean;
  displayOrder: number;
}

export interface Brand {
  id: string;
  nameAr: string;
  nameEn: string;
  countryOfOrigin?: string;
  logoUrl?: string;
  isActive: boolean;
}

export interface Unit {
  id: string;
  nameAr: string;
  symbolAr: string;
  nameEn: string;
  isFractional: boolean;
}

// 3. المنتجات وخياراتها
export interface Product {
  id: string;
  sku: string;
  barcode: string;
  nameAr: string;
  nameEn?: string;
  description?: string;
  categoryId: string;
  brandId: string;
  baseUnitId: string;
  costPrice: number;
  retailPrice: number;
  wholesalePrice: number;
  contractorPrice: number;
  taxRate: number;
  minStockLevel: number;
  maxStockLevel: number;
  imageUrl?: string;
  isActive: boolean;
  isDeleted?: boolean;
  storageLocation?: string;
  currentStock?: number;
  specifications?: string;
  requiresBuyerName?: boolean; // يلزم تسجيل اسم المشتري عند بيع هذا الصنف (مثل الكوالين والسلندرات والضمانات)
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  variantSku: string;
  variantNameAr: string;
  attributes: Record<string, string>;
  additionalPrice: number;
  barcode: string;
  currentStock?: number;
}

// 4. العملاء والموردين
export type CustomerType = 'individual' | 'contractor' | 'company' | 'wholesale';

export interface Customer {
  id: string;
  customerType: CustomerType;
  name: string;
  phone: string;
  email?: string;
  taxNumber?: string;
  commercialRegister?: string;
  address?: string;
  creditLimit: number;
  currentBalance: number;
  priceTier: 'retail' | 'wholesale' | 'contractor';
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Supplier {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email?: string;
  taxNumber?: string;
  address?: string;
  balance: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// 5. الفروع والمستودعات والمخزون
export interface Branch {
  id: string;
  nameAr: string;
  code: string;
  city: string;
  address: string;
  phone: string;
  isMain: boolean;
  isActive: boolean;
}

export interface Warehouse {
  id: string;
  nameAr: string;
  code: string;
  branchId: string;
  location?: string;
  managerName?: string;
  isPrimary: boolean;
  isActive: boolean;
  order?: number;
}

export interface Inventory {
  id: string;
  productId: string;
  variantId?: string | null;
  warehouseId: string;
  quantityOnHand: number;
  reservedQuantity: number;
  availableQuantity: number;
  averageCost: number;
  lastUpdated: string;
}

export type InventoryMovementType = 'purchase' | 'sale' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'damage' | 'waste' | 'return';

export interface InventoryMovement {
  id: string;
  productId: string;
  productName?: string;
  sku?: string;
  warehouseId: string;
  movementType: InventoryMovementType;
  referenceId: string;
  quantity: number;
  unitCost: number;
  previousQty: number;
  newQty: number;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

// 6. المشتريات والتوريد
export type PurchaseStatus = 'draft' | 'ordered' | 'received' | 'partially_received' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid';

export interface Purchase {
  id: string;
  orderNumber: string;
  supplierInvoiceNumber?: string;
  supplierId: string;
  supplierName?: string;
  warehouseId: string;
  warehouseName?: string;
  status: PurchaseStatus;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethodCode?: string; // CASH, TRANSFER, MADA, CREDIT (on account)
  orderDate: string;
  receivedDate?: string;
  notes?: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  productId: string;
  productName?: string;
  sku?: string;
  unitSymbol?: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}

// 7. المبيعات ونقاط البيع POS
export type SaleType = 'pos_cash' | 'contractor_credit' | 'wholesale' | 'online';
export type SaleStatus = 'completed' | 'on_hold' | 'cancelled' | 'refunded';

export interface Sale {
  id: string;
  saleNumber: string;
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  branchId: string;
  warehouseId: string;
  cashierId: string;
  saleType: SaleType;
  status: SaleStatus;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  paidAmount: number;
  createdAt: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
}

// 8. الفواتير والفوترة الإلكترونية
export type InvoiceType = 'simplified_tax_invoice' | 'standard_tax_invoice';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  saleId: string;
  invoiceType: InvoiceType;
  issueDate: string;
  dueDate?: string;
  customerId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerTaxNumber?: string;
  totalExcludingTax: number;
  taxAmount: number;
  totalIncludingTax: number;
  paidAmount?: number;
  paymentStatus: PaymentStatus;
  paymentMethodId?: string;
  zatcaUuid?: string;
  status?: string;
  whatsappStatus?: 'sent' | 'pending' | 'not_sent' | string;
  whatsappSentAt?: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxAmount: number;
  total: number;
}

// 9. المدفوعات والمعاملات
export interface Payment {
  id: string;
  receiptNumber: string;
  paymentType: 'receipt' | 'disbursement'; // سند قبض أو صرف
  partyType: 'customer' | 'supplier';
  partyId: string;
  partyName?: string;
  amount: number;
  paymentMethodId: string;
  reference?: string;
  date: string;
  collectedBy: string;
  notes?: string;
  invoiceId?: string;
  purchaseId?: string;
  createdAt?: string;
}

export interface PaymentTransaction {
  id: string;
  paymentId: string;
  saleId?: string;
  invoiceId?: string;
  gateway: 'mada' | 'visa' | 'mastercard' | 'pos_terminal' | 'bank_transfer';
  transactionReference: string;
  authCode?: string;
  rrn?: string;
  cardScheme?: string;
  cardLast4?: string;
  amount: number;
  status: 'approved' | 'declined' | 'pending' | 'cancelled' | 'failed' | 'timeout';
  idempotencyKey?: string;
  terminalId?: string;
  providerId?: string;
  errorMessage?: string;
  timestamp: string;
}

export interface PaymentMethod {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  requiresReference: boolean;
  isActive: boolean;
}

export interface StatementEntry {
  id: string;
  date: string;
  type: 'sale_invoice' | 'purchase_invoice' | 'payment_receipt' | 'payment_disbursement' | 'return' | 'opening_balance';
  typeLabel: string;
  referenceNumber: string;
  description: string;
  debit: number; // مدين
  credit: number; // دائن
  runningBalance: number;
}

// 10. المرتجعات
export type ReturnReason = 'عيب' | 'مقاس غير مناسب' | 'خطأ في الطلب' | 'سبب آخر';

export interface Return {
  id: string;
  returnNumber: string;
  originalSaleId: string;
  originalInvoiceNumber: string;
  customerId?: string | null;
  customerName: string;
  warehouseId: string;
  warehouseName?: string;
  subtotal: number;
  taxTotal: number;
  refundAmount: number;
  refundMethod: 'cash' | 'card' | 'customer_balance' | 'bank_transfer';
  reason: ReturnReason;
  reasonDetails?: string;
  status: 'pending' | 'approved' | 'rejected';
  processedBy: string;
  createdAt: string;
  items?: ReturnItem[];
}

export interface ReturnItem {
  id: string;
  returnId: string;
  productId: string;
  productName: string;
  sku?: string;
  unitSymbol?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate: number;
  taxAmount: number;
  refundTotal: number;
  reason?: ReturnReason | string;
  returnCondition?: 'good_as_new' | 'damaged' | 'defective';
}

// 11. عروض الأسعار
export type QuotationStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired' | 'Converted';

export interface Quotation {
  id: string;
  quotationNumber: string;
  customerId?: string | null;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerTaxNumber?: string;
  customerAddress?: string;
  projectName?: string;
  issueDate: string;
  validUntil: string;
  subtotal: number;
  discountTotal: number;
  discountType?: 'amount' | 'percent';
  discountPercentValue?: number;
  taxRate: number; // e.g. 15
  taxTotal: number;
  grandTotal: number;
  status: QuotationStatus;
  notes?: string;
  terms?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  convertedSaleId?: string;
  convertedInvoiceNumber?: string;
  convertedAt?: string;
  items?: QuotationItem[];
}

export interface QuotationItem {
  id: string;
  quotationId: string;
  productId: string;
  productName: string;
  sku?: string;
  unitSymbol?: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  originalRetailPrice?: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}

// 12. إعدادات الضرائب وتكامل POS وسجلات التدقيق وإعدادات النظام
export interface TaxSetting {
  id: string;
  nameAr: string;
  ratePercent: number;
  taxNumber: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface PosIntegration {
  id: string;
  branchId: string;
  deviceType: 'thermal_printer' | 'barcode_scanner' | 'cash_drawer' | 'customer_display' | 'pos_terminal';
  deviceName: string;
  ipAddress?: string;
  status: 'connected' | 'disconnected' | 'error';
  configJson?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'SEED_DATABASE' | 'PRICE_CHANGE' | 'INVENTORY_ADJUST' | 'RESTORE' | 'SECURITY_ALERT';
  entity: string;
  entityId?: string;
  details: string;
  ipAddress?: string;
  timestamp: string;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  category: 'company' | 'vat' | 'pos' | 'printing' | 'alerts' | 'zatca';
  description?: string;
  updatedAt: string;
}

// 13. الفوترة الإلكترونية وهيئة الزكاة والضريبة والجمارك (ZATCA)
export type ZatcaSubmissionStatus = 'Draft' | 'Pending' | 'Submitted' | 'Accepted' | 'Rejected' | 'Failed';
export type ZatcaValidationStatus = 'Valid' | 'Warnings' | 'Invalid' | 'Pending';

export interface ElectronicInvoice {
  id: string;
  invoiceId: string;
  saleId?: string;
  uuid: string;
  invoiceNumber: string;
  customerName?: string;
  customerTaxNumber?: string;
  issueDate: string;
  invoiceType: 'simplified' | 'standard'; // 'simplified' (مبسطة B2C) | 'standard' (ضريبية قياسية B2B)
  subtotal: number;
  vat: number;
  total: number;
  xmlUbl?: string;
  qrData: string;
  qrCodeData?: string;
  cryptographicStamp?: string;
  zatcaStatus?: 'reported' | 'cleared' | 'failed' | 'pending';
  complianceTimestamp?: string;
  invoiceHash?: string;
  previousInvoiceHash?: string;
  submissionStatus: ZatcaSubmissionStatus;
  validationStatus: ZatcaValidationStatus;
  errorMessage?: string;
  warningMessages?: string[];
  responseDetails?: {
    clearanceStatus?: string;
    reportingStatus?: string;
    statusCode?: number;
    rawResponse?: string;
    timestamp?: string;
  };
  submissionAttempts?: number;
  lastAttemptTimestamp?: string;
  timestamp: string;
}

export interface ZatcaCompanyProfile {
  id?: string;
  companyName: string;
  vatNumber: string;
  crNumber?: string;
  street: string;
  buildingNumber?: string;
  additionalNumber?: string;
  district?: string;
  city: string;
  postalCode: string;
  country: string; // 'SA'
  taxRatePercent: number; // 15
  // إعدادات التكامل التقني مع ZATCA
  environment: 'sandbox' | 'simulation' | 'production';
  defaultInvoiceType: 'simplified' | 'standard';
  egsSerialNumber: string;
  customApiEndpoint?: string;
  // بيانات الاعتماد المشفرة
  csidToken?: string;
  csidSecret?: string;
  privateKeyPem?: string;
  onboardingOtp?: string;
  isConfigured: boolean;
  lastConfiguredAt?: string;
}

// 14. تكامل أجهزة نقاط البيع والشبكة (Payment Terminal / POS Integration Layer)
export type TerminalPaymentStatus =
  | 'Pending'
  | 'Processing'
  | 'Approved'
  | 'Declined'
  | 'Cancelled'
  | 'Failed'
  | 'Timeout';

export type TerminalProviderCode = 'mock' | 'geidea' | 'nearpay' | 'standard_ecr';

export interface TerminalPaymentRequest {
  idempotencyKey: string;
  transactionId: string;
  amount: number;
  currency?: string; // Default: 'SAR'
  invoiceNumber?: string;
  referenceId?: string;
  cashierId?: string;
  cashierName?: string;
  terminalId?: string;
  timeoutSeconds?: number;
}

export interface TerminalPaymentResponse {
  success: boolean;
  status: TerminalPaymentStatus;
  transactionId: string;
  idempotencyKey: string;
  terminalId: string;
  amount: number;
  currency: string;
  cardScheme?: 'mada' | 'visa' | 'mastercard' | 'amex' | 'apple_pay';
  cardLast4?: string;
  cardholderName?: string;
  rrn?: string; // Retrieval Reference Number (الرقم المرجعي للعملية المصرفية)
  authCode?: string; // رمز التفويض البنكي
  terminalReceiptText?: string;
  errorCode?: string;
  errorMessage?: string;
  timestamp: string;
}

export interface PaymentTerminalConfig {
  id?: string;
  providerId: TerminalProviderCode;
  providerName: string;
  terminalId: string; // TID (معرّف الجهاز المسجل لدى البنك/الشبكة)
  merchantId: string; // MID (معرّف التاجر)
  connectionType: 'local_network_ip' | 'cloud_api' | 'serial_usb';
  terminalIp?: string;
  port?: number;
  environment: 'sandbox' | 'production';
  // Credentials (مخفية ومحمية تماماً عن العرض بالواجهة)
  apiKey?: string;
  secretKey?: string;
  timeoutSeconds: number;
  isAutoSendEnabled: boolean;
  isSimulationMode: boolean;
  notes?: string;
  lastUpdated?: string;
}

export interface PosTerminalIntegrationRecord {
  id: string;
  terminalId: string;
  terminalName: string;
  providerId: TerminalProviderCode;
  ipAddress?: string;
  status: 'online' | 'offline' | 'busy';
  lastPing?: string;
  isDefault: boolean;
}

export type DatabaseCollectionName =
  | 'users'
  | 'roles'
  | 'permissions'
  | 'user_roles'
  | 'products'
  | 'categories'
  | 'brands'
  | 'units'
  | 'product_variants'
  | 'customers'
  | 'suppliers'
  | 'warehouses'
  | 'branches'
  | 'inventory'
  | 'inventory_movements'
  | 'purchases'
  | 'purchase_items'
  | 'sales'
  | 'sale_items'
  | 'invoices'
  | 'invoice_items'
  | 'payments'
  | 'payment_transactions'
  | 'returns'
  | 'return_items'
  | 'quotations'
  | 'quotation_items'
  | 'tax_settings'
  | 'electronic_invoices'
  | 'pos_integrations'
  | 'payment_methods'
  | 'audit_logs'
  | 'system_settings'
  | 'zatca_settings'
  | 'password_resets';

export interface PasswordResetRequest {
  id: string;
  userId: string;
  email: string;
  userFullName: string;
  code: string;
  createdAt: string;
  expiresAt: string;
  isUsed: boolean;
  attempts: number;
}

