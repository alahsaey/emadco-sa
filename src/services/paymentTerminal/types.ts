/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  PaymentTerminalConfig,
  TerminalPaymentRequest,
  TerminalPaymentResponse,
  TerminalProviderCode,
} from '../../types';

/**
 * واجهة موحدة لمزودي أجهزة الدفع ونقاط البيع (Payment Terminal Provider Interface)
 * تتيح تبديل وتوسيع الأجهزة (Adapters) دون المساس ببرمجة الكاشير ونقاط البيع
 */
export interface PaymentTerminalProvider {
  readonly id: string;
  readonly name: string;
  readonly code: TerminalProviderCode;
  readonly description: string;

  /**
   * تهيئة الاتصال بالجهاز والتحقق من المعلمات
   */
  initialize(config: PaymentTerminalConfig): Promise<void>;

  /**
   * إرسال مبلغ الفاتورة إلى جهاز الدفع وبدء العملية
   */
  sendPayment(request: TerminalPaymentRequest): Promise<TerminalPaymentResponse>;

  /**
   * الاستعلام عن حالة العملية الحالية
   */
  checkStatus(transactionId: string): Promise<TerminalPaymentResponse>;

  /**
   * إلغاء العملية الجارية على شاشة الجهاز
   */
  cancelPayment(transactionId: string): Promise<boolean>;

  /**
   * فحص الاتصال ونبض الحياة مع الجهاز (Health Check / Ping)
   */
  ping(): Promise<{ success: boolean; latencyMs: number; message: string }>;
}
