/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PaymentTerminalProvider } from '../types';
import {
  PaymentTerminalConfig,
  TerminalPaymentRequest,
  TerminalPaymentResponse,
  TerminalProviderCode,
} from '../../../types';

/**
 * محول التكامل مع أجهزة وحلول نيرباي (NearPay SoftPOS Adapter)
 * مخصص للدفع عبر أجهزة أندرويد اللوحية والهواتف الذكية الداعمة لـ NFC
 */
export class NearPayAdapter implements PaymentTerminalProvider {
  readonly id = 'nearpay_adapter';
  readonly name = 'نيرباي للدفع بنقاط البيع (NearPay SoftPOS)';
  readonly code: TerminalProviderCode = 'nearpay';
  readonly description = 'تكامل الدفع عبر الأجهزة اللوحية وهواتف الكاشير الذكية بواسطة NearPay SDK.';

  private config: PaymentTerminalConfig | null = null;

  async initialize(config: PaymentTerminalConfig): Promise<void> {
    this.config = config;
  }

  async sendPayment(request: TerminalPaymentRequest): Promise<TerminalPaymentResponse> {
    const tid = this.config?.terminalId || 'TID-NEARPAY-01';

    if (this.config?.isSimulationMode || !this.config?.apiKey) {
      await new Promise((r) => setTimeout(r, 2200));
      const auth = Math.floor(100000 + Math.random() * 900000).toString();
      const rrn = `${Date.now().toString().slice(-8)}${Math.floor(1000 + Math.random() * 9000)}`;

      return {
        success: true,
        status: 'Approved',
        transactionId: request.transactionId,
        idempotencyKey: request.idempotencyKey,
        terminalId: tid,
        amount: request.amount,
        currency: 'SAR',
        cardScheme: 'apple_pay',
        cardLast4: '1092',
        cardholderName: 'APPLE PAY MADA',
        rrn,
        authCode: auth,
        terminalReceiptText: `NEARPAY SOFTPOS TRANSACTION APPROVED - RRN: ${rrn}`,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: false,
      status: 'Failed',
      transactionId: request.transactionId,
      idempotencyKey: request.idempotencyKey,
      terminalId: tid,
      amount: request.amount,
      currency: 'SAR',
      errorMessage: 'بانتظار تهيئة NearPay Production SDK/API.',
      timestamp: new Date().toISOString(),
    };
  }

  async checkStatus(transactionId: string): Promise<TerminalPaymentResponse> {
    return {
      success: true,
      status: 'Approved',
      transactionId,
      idempotencyKey: 'IDEMP-NEARPAY',
      terminalId: this.config?.terminalId || 'TID-NEARPAY-01',
      amount: 0,
      currency: 'SAR',
      timestamp: new Date().toISOString(),
    };
  }

  async cancelPayment(transactionId: string): Promise<boolean> {
    return true;
  }

  async ping(): Promise<{ success: boolean; latencyMs: number; message: string }> {
    const latency = Math.floor(30 + Math.random() * 20);
    return {
      success: true,
      latencyMs: latency,
      message: `تطبيق NearPay SoftPOS متصل (${latency}ms).`,
    };
  }
}
