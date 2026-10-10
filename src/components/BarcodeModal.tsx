/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import { Product } from '../types';
import { X, Printer, Barcode as BarcodeIcon, Copy, Check } from 'lucide-react';
import { Barcode } from './common/Barcode';
import { formatSAR } from '../utils/formatters';
import { printElement } from '../utils/print';

interface BarcodeModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export const BarcodeModal: React.FC<BarcodeModalProps> = ({ product, isOpen, onClose }) => {
  const [copied, setCopied] = React.useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !product) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(product.barcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    printElement(cardRef.current, `ملصق باركود - ${product.nameAr}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="print-dialog-wrapper bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 text-center">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4 no-print">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <BarcodeIcon className="w-5 h-5 text-amber-500" />
            <span>بطاقة باركود الصنف</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* بطاقة ملصق الرف / السلعة */}
        <div ref={cardRef} className="printable-document bg-white p-5 border-2 border-dashed border-slate-300 rounded-xl space-y-3 print:border-none print:shadow-none">
          <div className="text-xs font-black text-slate-800 line-clamp-2 leading-snug">
            {product.nameAr}
          </div>

          {/* باركود احترافي عالي الدقة */}
          <div className="py-2 flex flex-col items-center justify-center bg-slate-50 p-2 rounded-lg border border-slate-200">
            <Barcode
              value={product.barcode || product.sku}
              width={1.6}
              height={44}
              fontSize={11}
              displayValue={true}
            />
          </div>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 text-slate-600">
            <div>
              <span className="text-[10px] text-slate-400 block">رمز SKU</span>
              <span className="font-mono font-bold text-slate-800">{product.sku}</span>
            </div>
            <div className="text-left">
              <span className="text-[10px] text-slate-400 block">السعر شامل الضريبة</span>
              <span className="text-base font-black font-mono text-emerald-600">
                {formatSAR(Number(product.retailPrice || 0) * 1.15)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-5 no-print">
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
            <span>{copied ? 'تم النسخ' : 'نسخ الكود'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>طباعة الملصق</span>
          </button>
        </div>
      </div>
    </div>
  );
};
