/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PaymentTerminalProvider } from '../types';
import {
  PaymentTerminalConfig,
  TerminalPaymentRequest,
  TerminalPaymentResponse,
  TerminalPaymentStatus,
  TerminalProviderCode,
} from '../../../types';

/**
 * محول جهاز الدفع الافتراضي للتطوير والاختبار (Mock Payment Terminal Adapter)
 * يتيح محاكاة عملية الدفع بالكامل عبر بطاقات مدى والبطاقات الائتمانية دون الحاجة لجهاز حقيقي،
 * مع دعم سيناريوهات النجاح، الرفض، الإلغاء، وانتهاء المهلة بدقة.
 */
export class MockTerminalAdapter implements PaymentTerminalProvider {
  readonly id = 'mock_terminal_adapter';
  readonly name = 'محاكي جهاز نقاط البيع المعتمد (Mock POS Terminal)';
  readonly code: TerminalProviderCode = 'mock';
  readonly description = 'محول محاكاة متكامل لاختبار إرسال المبالغ ومعالجة استجابات الشبكة السعودية مدى.';

  private config: PaymentTerminalConfig | null = null;
  private currentTransaction: {
    request: TerminalPaymentRequest;
    status: TerminalPaymentStatus;
    timer?: any;
    resolve?: (res: TerminalPaymentResponse) => void;
  } | null = null;

  async initialize(config: PaymentTerminalConfig): Promise<void> {
    this.config = config;
  }

  async sendPayment(request: TerminalPaymentRequest): Promise<TerminalPaymentResponse> {
    if (request.amount <= 0) {
      throw new Error('مبلغ العملية غير صالح، يجب أن يكون أكبر من الصفر.');
    }

    const tid = this.config?.terminalId || 'TID-MADA-8812';
    const mid = this.config?.merchantId || 'MID-EMADCO-9944';

    // تسجيل العملية في الذاكرة
    return new Promise((resolve) => {
      this.currentTransaction = {
        request,
        status: 'Processing',
        resolve,
      };

      // في حال الإرسال التلقائي، محاكاة معالجة تستغرق 2.5 ثانية للاتصال بالبنك
      const autoTimer = setTimeout(() => {
        if (this.currentTransaction && this.currentTransaction.status === 'Processing') {
          // نجاح افتراضي بمعايير شبكة مدى
          const response = this.buildApprovedResponse(request, tid, mid, 'mada');
          this.currentTransaction.status = 'Approved';
          resolve(response);
          this.currentTransaction = null;
        }
      }, 2500);

      this.currentTransaction.timer = autoTimer;
    });
  }

  /**
   * محاكاة فورية يتم استدعاؤها من واجهة المحاكاة للتحكم بالنتيجة (Approve / Decline / Cancel / Timeout)
   */
  public triggerSimulationOutcome(
    outcome: 'Approved' | 'Declined' | 'Cancelled' | 'Timeout' | 'Duplicate',
    options?: {
      cardScheme?: 'mada' | 'visa' | 'mastercard' | 'apple_pay';
      declineReason?: string;
    }
  ): TerminalPaymentResponse {
    if (!this.currentTransaction) {
      throw new Error('لا توجد عملية نشطة بانتظار الاستجابة على جهاز الدفع.');
    }

    if (this.currentTransaction.timer) {
      clearTimeout(this.currentTransaction.timer);
    }

    const { request, resolve } = this.currentTransaction;
    const tid = this.config?.terminalId || 'TID-MADA-8812';
    const mid = this.config?.merchantId || 'MID-BUNYAN-9944';
    const now = new Date().toISOString();

    let response: TerminalPaymentResponse;

    switch (outcome) {
      case 'Approved':
        response = this.buildApprovedResponse(
          request,
          tid,
          mid,
          options?.cardScheme || 'mada'
        );
        break;

      case 'Declined':
        response = {
          success: false,
          status: 'Declined',
          transactionId: request.transactionId,
          idempotencyKey: request.idempotencyKey,
          terminalId: tid,
          amount: request.amount,
          currency: request.currency || 'SAR',
          cardScheme: options?.cardScheme || 'mada',
          cardLast4: '4921',
          errorCode: '51', // Insufficient funds in ISO-8583
          errorMessage: options?.declineReason || 'تم رفض العملية من البنك: رصيد غير كافٍ (Declined: 51 Insufficient Funds).',
          timestamp: now,
        };
        break;

      case 'Cancelled':
        response = {
          success: false,
          status: 'Cancelled',
          transactionId: request.transactionId,
          idempotencyKey: request.idempotencyKey,
          terminalId: tid,
          amount: request.amount,
          currency: request.currency || 'SAR',
          errorCode: 'ECR_CANCELLED',
          errorMessage: 'تم إلغاء العملية بواسطة حامل البطاقة أو الكاشير على جهاز الدفع.',
          timestamp: now,
        };
        break;

      case 'Timeout':
        response = {
          success: false,
          status: 'Timeout',
          transactionId: request.transactionId,
          idempotencyKey: request.idempotencyKey,
          terminalId: tid,
          amount: request.amount,
          currency: request.currency || 'SAR',
          errorCode: 'ECR_TIMEOUT',
          errorMessage: 'انتهت مهلة انتظار تمرير البطاقة أو استجابة البنك (Terminal Timeout).',
          timestamp: now,
        };
        break;

      case 'Duplicate':
        response = {
          success: false,
          status: 'Declined',
          transactionId: request.transactionId,
          idempotencyKey: request.idempotencyKey,
          terminalId: tid,
          amount: request.amount,
          currency: request.currency || 'SAR',
          errorCode: '94', // Duplicate Transmission in ISO-8583
          errorMessage: 'تم رفض العملية: تم الكشف عن إرسال مكرر لنفس المعاملة (Duplicate Transaction Detected - Code 94).',
          timestamp: now,
        };
        break;
    }

    this.currentTransaction.status = response.status;
    if (resolve) {
      resolve(response);
    }
    this.currentTransaction = null;
    return response;
  }

  private buildApprovedResponse(
    request: TerminalPaymentRequest,
    tid: string,
    mid: string,
    scheme: 'mada' | 'visa' | 'mastercard' | 'apple_pay'
  ): TerminalPaymentResponse {
    const randomAuth = Math.floor(100000 + Math.random() * 900000).toString();
    const randomRrn = `${Date.now().toString().slice(-8)}${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();

    const receiptText = `
========================================
       إيصال عملية نقاط البيع (POS)
       شبكة المدفوعات السعودية (mada)
========================================
التاجر: مؤسسة عماد سعد آل سعيد لمواد البناء (عمادكو)
معرّف التاجر (MID): ${mid}
معرّف الجهاز (TID): ${tid}
التاريخ: ${new Date().toLocaleDateString('ar-SA')}  الوقت: ${new Date().toLocaleTimeString('ar-SA')}
رقم الفاتورة: ${request.invoiceNumber || 'POS-INV'}

الشبكة: ${scheme.toUpperCase()}
رقم البطاقة: ************4921
نوع الشريحة: EMV Contactless (A0000000041010)

المبلغ: ${request.amount.toFixed(2)} ر.س
ضريبة القيمة المضافة 15% مشمولة
حالة العملية: مقبولة (APPROVED)
رمز التفويض (AUTH): ${randomAuth}
الرقم المرجعي (RRN): ${randomRrn}
========================================
شكراً لاستخدامكم بطاقة ${scheme === 'mada' ? 'مدى' : scheme}
    `.trim();

    return {
      success: true,
      status: 'Approved',
      transactionId: request.transactionId,
      idempotencyKey: request.idempotencyKey,
      terminalId: tid,
      amount: request.amount,
      currency: request.currency || 'SAR',
      cardScheme: scheme,
      cardLast4: '4921',
      cardholderName: 'MADA CARDHOLDER',
      rrn: randomRrn,
      authCode: randomAuth,
      terminalReceiptText: receiptText,
      timestamp: now,
    };
  }

  async checkStatus(transactionId: string): Promise<TerminalPaymentResponse> {
    if (this.currentTransaction && this.currentTransaction.request.transactionId === transactionId) {
      return {
        success: this.currentTransaction.status === 'Approved',
        status: this.currentTransaction.status,
        transactionId,
        idempotencyKey: this.currentTransaction.request.idempotencyKey,
        terminalId: this.config?.terminalId || 'TID-MADA-8812',
        amount: this.currentTransaction.request.amount,
        currency: 'SAR',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: false,
      status: 'Failed',
      transactionId,
      idempotencyKey: 'NOT_FOUND',
      terminalId: this.config?.terminalId || 'TID-MADA-8812',
      amount: 0,
      currency: 'SAR',
      errorMessage: 'لم يتم العثور على العملية النشطة.',
      timestamp: new Date().toISOString(),
    };
  }

  async cancelPayment(transactionId: string): Promise<boolean> {
    if (this.currentTransaction && this.currentTransaction.request.transactionId === transactionId) {
      if (this.currentTransaction.timer) {
        clearTimeout(this.currentTransaction.timer);
      }
      const response: TerminalPaymentResponse = {
        success: false,
        status: 'Cancelled',
        transactionId,
        idempotencyKey: this.currentTransaction.request.idempotencyKey,
        terminalId: this.config?.terminalId || 'TID-MADA-8812',
        amount: this.currentTransaction.request.amount,
        currency: 'SAR',
        errorMessage: 'تم إلغاء عملية الدفع من الكاشير.',
        timestamp: new Date().toISOString(),
      };

      if (this.currentTransaction.resolve) {
        this.currentTransaction.resolve(response);
      }
      this.currentTransaction = null;
      return true;
    }
    return false;
  }

  async ping(): Promise<{ success: boolean; latencyMs: number; message: string }> {
    const latency = Math.floor(12 + Math.random() * 25);
    return {
      success: true,
      latencyMs: latency,
      message: `جهاز الدفع التجريبي (Mock POS) متصل وجاهز للاستخدام (${latency}ms).`,
    };
  }
}
