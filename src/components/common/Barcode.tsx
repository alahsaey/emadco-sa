/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeProps {
  value: string;
  format?: 'CODE128' | 'CODE39' | 'EAN13' | 'EAN8' | 'UPC';
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  className?: string;
  lineColor?: string;
  background?: string;
  margin?: number;
}

export const Barcode: React.FC<BarcodeProps> = ({
  value,
  format = 'CODE128',
  width = 1.5,
  height = 38,
  displayValue = true,
  fontSize = 11,
  className = '',
  lineColor = '#000000',
  background = 'transparent',
  margin = 2,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && value && value.trim()) {
      try {
        JsBarcode(svgRef.current, value.trim(), {
          format,
          width,
          height,
          displayValue,
          font: 'Cairo, monospace, sans-serif',
          fontSize,
          fontOptions: 'bold',
          textMargin: 3,
          lineColor,
          background,
          margin,
        });
      } catch (err) {
        console.warn('تعذر توليد الباركود للقيمة:', value, err);
      }
    }
  }, [value, format, width, height, displayValue, fontSize, lineColor, background, margin]);

  if (!value || !value.trim()) return null;

  return (
    <div className={`inline-flex flex-col items-center justify-center ${className}`}>
      <svg ref={svgRef} className="max-w-full h-auto" />
    </div>
  );
};
