/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface GeneratePdfOptions {
  fileName: string;
  format?: 'a4' | 'thermal';
  quality?: number;
}

export interface GeneratedPdfResult {
  file: File;
  blob: Blob;
  dataUrl: string;
  blobUrl: string;
  fileName: string;
}

const canvas2dCtx =
  typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;

/**
 * تحويل رياضي مباشر ودقيق من OKLCH إلى sRGB لضمان التوافق التام مع html2canvas بدون أي خطأ
 */
function parseAndConvertOklch(str: string): string | null {
  const match = str.match(/oklch\(\s*([0-9.]+%?)\s+([0-9.]+%?)\s+([0-9.]+(?:deg)?)(?:\s*\/\s*([0-9.]+%?))?\s*\)/i);
  if (!match) return null;
  const l = match[1].endsWith('%') ? parseFloat(match[1]) / 100 : parseFloat(match[1]);
  const c = match[2].endsWith('%') ? (parseFloat(match[2]) / 100) * 0.4 : parseFloat(match[2]);
  const h = parseFloat(match[3]);
  const alpha = match[4] ? (match[4].endsWith('%') ? parseFloat(match[4]) / 100 : parseFloat(match[4])) : 1;

  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b;

  const L = l_ * l_ * l_;
  const M = m_ * m_ * m_;
  const S = s_ * s_ * s_;

  const rLin = +4.0767434757 * L - 3.3077115913 * M + 0.2309699291 * S;
  const gLin = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const bLin = -0.0041960863 * L - 0.7034186147 * M + 1.7076147010 * S;

  const gamma = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(0, x), 1 / 2.4) - 0.055);

  const r = Math.min(255, Math.max(0, Math.round(gamma(rLin) * 255)));
  const g = Math.min(255, Math.max(0, Math.round(gamma(gLin) * 255)));
  const bVal = Math.min(255, Math.max(0, Math.round(gamma(bLin) * 255)));

  return alpha < 1 ? `rgba(${r}, ${g}, ${bVal}, ${alpha})` : `rgb(${r}, ${g}, ${bVal})`;
}

/**
 * تحويل رياضي مباشر من OKLAB إلى sRGB
 */
function parseAndConvertOklab(str: string): string | null {
  const match = str.match(/oklab\(\s*([0-9.]+%?)\s+([+-]?[0-9.]+%?)\s+([+-]?[0-9.]+%?)(?:\s*\/\s*([0-9.]+%?))?\s*\)/i);
  if (!match) return null;
  const l = match[1].endsWith('%') ? parseFloat(match[1]) / 100 : parseFloat(match[1]);
  const a = match[2].endsWith('%') ? (parseFloat(match[2]) / 100) * 0.4 : parseFloat(match[2]);
  const b = match[3].endsWith('%') ? (parseFloat(match[3]) / 100) * 0.4 : parseFloat(match[3]);
  const alpha = match[4] ? (match[4].endsWith('%') ? parseFloat(match[4]) / 100 : parseFloat(match[4])) : 1;

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b;

  const L = l_ * l_ * l_;
  const M = m_ * m_ * m_;
  const S = s_ * s_ * s_;

  const rLin = +4.0767434757 * L - 3.3077115913 * M + 0.2309699291 * S;
  const gLin = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const bLin = -0.0041960863 * L - 0.7034186147 * M + 1.7076147010 * S;

  const gamma = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(0, x), 1 / 2.4) - 0.055);

  const r = Math.min(255, Math.max(0, Math.round(gamma(rLin) * 255)));
  const g = Math.min(255, Math.max(0, Math.round(gamma(gLin) * 255)));
  const bVal = Math.min(255, Math.max(0, Math.round(gamma(bLin) * 255)));

  return alpha < 1 ? `rgba(${r}, ${g}, ${bVal}, ${alpha})` : `rgb(${r}, ${g}, ${bVal})`;
}

/**
 * تحويل أي لون CSS حديث مثل oklch(...) أو oklab(...) إلى لون RGB/RGBA قياسي يدعمه html2canvas
 */
export function resolveCssColorToRgb(colorStr: string): string {
  const trimmed = colorStr.trim();
  if (!trimmed) return 'rgb(0, 0, 0)';

  if (trimmed.toLowerCase().startsWith('oklch')) {
    const mathConverted = parseAndConvertOklch(trimmed);
    if (mathConverted) return mathConverted;
  }
  if (trimmed.toLowerCase().startsWith('oklab')) {
    const mathConverted = parseAndConvertOklab(trimmed);
    if (mathConverted) return mathConverted;
  }

  if (canvas2dCtx) {
    try {
      canvas2dCtx.fillStyle = '#000000';
      canvas2dCtx.fillStyle = trimmed;
      const resolved = canvas2dCtx.fillStyle;
      if (resolved && resolved !== '#000000') return resolved;
    } catch {
      // متابعة
    }
  }

  if (trimmed.includes('0 0 0') || trimmed.includes('0, 0, 0')) {
    return 'rgb(0, 0, 0)';
  }
  return 'rgb(30, 41, 59)';
}

/**
 * تنظيف واستبدال كافة دالات الألوان الحديثة (oklch, oklab, color) بنصوص CSS بصيغ RGB/HEX متوافقة
 */
export function sanitizeCssOklch(cssText: string): string {
  if (!cssText || typeof cssText !== 'string') {
    return cssText || '';
  }
  if (!cssText.includes('oklch') && !cssText.includes('oklab') && !cssText.includes('color(')) {
    return cssText;
  }
  return cssText
    .replace(/(?:oklch|oklab)\([^)]+\)/gi, (match) => resolveCssColorToRgb(match))
    .replace(/color\([^)]+\)/gi, () => 'rgb(30, 41, 59)');
}

/**
 * بروتوكول وسيط (Proxy) آمن لحماية getComputedStyle ومنع وصول أي دالة لون oklch/oklab إلى محرك html2canvas
 */
function createSanitizedStyleProxy(style: CSSStyleDeclaration): CSSStyleDeclaration {
  return new Proxy(style, {
    get(target, prop) {
      if (prop === 'getPropertyValue') {
        return (propertyName: string) => {
          try {
            // في اللغة العربية، تباعد الحروف (letter-spacing) يفصل الحروف المتصلة ويشوه الخط، لذا نجعله 0 دائماً
            if (propertyName === 'letter-spacing') {
              return '0px';
            }
            const val = target.getPropertyValue(propertyName);
            if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab') || val.includes('color('))) {
              return sanitizeCssOklch(val);
            }
            return val;
          } catch {
            return '';
          }
        };
      }
      if (prop === 'letterSpacing') {
        return '0px';
      }
      if (prop === 'getPropertyPriority') {
        return (propertyName: string) => {
          try {
            return target.getPropertyPriority(propertyName);
          } catch {
            return '';
          }
        };
      }
      if (prop === 'item') {
        return (index: number) => {
          try {
            return target.item(index);
          } catch {
            return '';
          }
        };
      }

      try {
        // نستخدم target المباشر لمنع خطأ TypeError: Illegal invocation من محرك WebIDL
        const val = (target as any)[prop];
        if (typeof val === 'function') {
          return val.bind(target);
        }
        if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab') || val.includes('color('))) {
          return sanitizeCssOklch(val);
        }
        return val;
      } catch {
        return '';
      }
    },
  });
}

/**
 * تجهيز وتنظيف العنصر والعدسة المستنسخة لبرنامج html2canvas قبل التصدير
 */
function sanitizeClonedDoc(
  clonedDoc: Document,
  clonedElement: HTMLElement,
  targetElement: HTMLElement,
  format: 'thermal' | 'a4'
) {
  // 1. إخفاء العناصر المعلمة بـ no-print
  const noPrintElements = clonedDoc.querySelectorAll('.no-print');
  noPrintElements.forEach((el) => {
    (el as HTMLElement).style.display = 'none';
  });

  // 2. ضبط قياسات العنصر المستنسخ
  clonedElement.style.maxHeight = 'none';
  clonedElement.style.height = 'auto';
  clonedElement.style.overflow = 'visible';
  clonedElement.style.width = format === 'thermal' ? '380px' : '820px';
  clonedElement.style.margin = '0 auto';

  // فرض إلغاء تباعد الحروف (letter-spacing) تماماً لضمان اتصال الحروف العربية وعدم تقطيعها
  try {
    const antiLetterSpacingStyle = clonedDoc.createElement('style');
    antiLetterSpacingStyle.textContent = `
      * {
        letter-spacing: 0px !important;
        font-feature-settings: "liga" 1, "calt" 1 !important;
      }
    `;
    clonedDoc.head?.appendChild(antiLetterSpacingStyle);
  } catch {
    // متابعة
  }

  // 3. معالجة وحل مشكلة الألوان الحديثة غير المدعومة في html2canvas (مثل oklch و oklab)
  // أ) تنظيف كافة عناصر <style> المستنسخة وتحويل oklch إلى rgb/hex
  const styleEls = clonedDoc.querySelectorAll('style');
  styleEls.forEach((styleEl) => {
    if (styleEl.textContent && (styleEl.textContent.includes('oklch') || styleEl.textContent.includes('oklab'))) {
      styleEl.textContent = sanitizeCssOklch(styleEl.textContent);
    }
  });

  // ب) تنظيف الخاصية inline style لكافة العناصر
  const allElements = clonedDoc.querySelectorAll('*');
  allElements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.getAttribute && htmlEl.getAttribute('style')) {
      const styleAttr = htmlEl.getAttribute('style') || '';
      if (styleAttr.includes('oklch') || styleAttr.includes('oklab')) {
        htmlEl.setAttribute('style', sanitizeCssOklch(styleAttr));
      }
    }
  });

  // ج) نسخ الألوان المحسوبة (Computed Styles) المباشرة من العناصر الأصلية لمنع الاعتماد على متغيرات CSS ذات صياغة oklch
  try {
    const origEls = targetElement.querySelectorAll('*');
    const cloneEls = clonedElement.querySelectorAll('*');

    const compStyle = window.getComputedStyle(targetElement);
    if (compStyle.color) clonedElement.style.color = sanitizeCssOklch(compStyle.color);
    if (compStyle.backgroundColor && compStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      clonedElement.style.backgroundColor = sanitizeCssOklch(compStyle.backgroundColor);
    }

    for (let i = 0; i < origEls.length && i < cloneEls.length; i++) {
      const orig = origEls[i] as HTMLElement;
      const clone = cloneEls[i] as HTMLElement;
      if (orig && clone && clone.style) {
        const cs = window.getComputedStyle(orig);
        if (cs.color) {
          clone.style.color = sanitizeCssOklch(cs.color);
        }
        if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') {
          clone.style.backgroundColor = sanitizeCssOklch(cs.backgroundColor);
        }
        if (cs.borderColor) {
          clone.style.borderColor = sanitizeCssOklch(cs.borderColor);
        }
        if (cs.boxShadow && cs.boxShadow !== 'none') {
          clone.style.boxShadow = sanitizeCssOklch(cs.boxShadow);
        }
      }
    }
  } catch {
    // تجاهل أي خطأ ثانوي في حساب الألوان
  }

  // 4. ضبط الصور وتجهيزها
  const images = clonedDoc.querySelectorAll('img');
  images.forEach((img) => {
    try {
      if (img.src && !img.src.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
    } catch {
      // تجاهل
    }
  });
}

/**
 * توليد ملف PDF عالي الدقة واحترافي من عنصر DOM (يدعم اللغة العربية ورموز QR والباركود بدقة متناهية)
 */
export async function generatePdfFromElement(
  element: HTMLElement,
  options: GeneratePdfOptions
): Promise<GeneratedPdfResult> {
  const format = options.format || 'a4';
  const quality = options.quality ?? 0.95;
  const safeFileName = options.fileName.endsWith('.pdf') ? options.fileName : `${options.fileName}.pdf`;

  // الانتظار حتى تحميل كافة الخطوط والتنسيقات بالكامل لمنع أي تشوه في الحروف العربية
  try {
    await document.fonts.ready;
  } catch {
    // تجاهل
  }
  await new Promise((resolve) => setTimeout(resolve, 300));

  // العثور على العنصر الفعلي المخصص للطباعة لتفادي قيود الـ overflow والـ scrollbar
  const targetElement =
    (element.querySelector('.printable-a4, .printable-receipt') as HTMLElement) || element;

  let canvas: HTMLCanvasElement | null = null;

  // تركيب درع حماية متقدم لـ window.getComputedStyle لمنع html2canvas من رؤية أي oklch/oklab
  const originalGetComputedStyle = window.getComputedStyle;
  let isComputedStylePatched = false;

  try {
    window.getComputedStyle = function (elt: Element, pseudoElt?: string | null): CSSStyleDeclaration {
      try {
        const real = pseudoElt !== undefined
          ? originalGetComputedStyle.call(window, elt, pseudoElt)
          : originalGetComputedStyle.call(window, elt);
        return createSanitizedStyleProxy(real);
      } catch {
        return originalGetComputedStyle.call(window, elt, pseudoElt);
      }
    };
    isComputedStylePatched = true;
  } catch (e) {
    console.warn('تعذر حماية getComputedStyle عبر نافذة المتصفح الرئيسية:', e);
  }

  try {
    // المحاولة الأولى: تحويل العنصر إلى صورة عالية الدقة عبر html2canvas مع الحماية الكاملة
    canvas = await html2canvas(targetElement, {
      scale: Math.min(2.0, window.devicePixelRatio || 1.5),
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: format === 'thermal' ? 420 : 880,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc, clonedElement) => {
        if (clonedDoc.defaultView && clonedDoc.defaultView !== window) {
          const iframeWin = clonedDoc.defaultView;
          const origIframeGCS = iframeWin.getComputedStyle;
          iframeWin.getComputedStyle = function (elt: Element, pseudoElt?: string | null): CSSStyleDeclaration {
            try {
              const s = pseudoElt !== undefined
                ? origIframeGCS.call(iframeWin, elt, pseudoElt)
                : origIframeGCS.call(iframeWin, elt);
              return createSanitizedStyleProxy(s);
            } catch {
              return origIframeGCS.call(iframeWin, elt, pseudoElt);
            }
          };
        }
        sanitizeClonedDoc(clonedDoc, clonedElement, targetElement, format);
      },
    });
  } catch (err) {
    console.warn('المحاولة الأولى عبر html2canvas فشلت، جاري استخدام المحاولة الثانية المبسطة:', err);
    try {
      // المحاولة الثانية: html2canvas بخصائص مبسطة للبيئات المقيدة (كالـ WebAPK والجوال)
      canvas = await html2canvas(targetElement, {
        scale: 1.5,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc, clonedElement) => {
          if (clonedDoc.defaultView && clonedDoc.defaultView !== window) {
            const iframeWin = clonedDoc.defaultView;
            const origIframeGCS = iframeWin.getComputedStyle;
            iframeWin.getComputedStyle = function (elt: Element, pseudoElt?: string | null): CSSStyleDeclaration {
              try {
                const s = pseudoElt !== undefined
                  ? origIframeGCS.call(iframeWin, elt, pseudoElt)
                  : origIframeGCS.call(iframeWin, elt);
                return createSanitizedStyleProxy(s);
              } catch {
                return origIframeGCS.call(iframeWin, elt, pseudoElt);
              }
            };
          }
          sanitizeClonedDoc(clonedDoc, clonedElement, targetElement, format);
        },
      });
    } catch (err2) {
      console.error('فشلت محاولات html2canvas، جاري استخدام محرك SVG المباشر:', err2);
    }
  } finally {
    if (isComputedStylePatched) {
      window.getComputedStyle = originalGetComputedStyle;
    }
  }

  // في حال فشل html2canvas، نستخدم محول SVG المباشر الذي لا يعتمد على html2canvas إطلاقاً
  if (!canvas) {
    canvas = await domToSvgCanvasFallback(targetElement, format);
  }

  const imgData = canvas.toDataURL('image/jpeg', quality);
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  let pdf: jsPDF;

  if (format === 'thermal') {
    // تنسيق إيصال حراري (80mm) بطول ديناميكي يناسب المحتوى بالكامل في صفحة واحدة مستمرة
    const pdfWidth = 80;
    const pdfHeight = (imgHeight * pdfWidth) / imgWidth;
    pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [pdfWidth, Math.max(pdfHeight, 90)],
    });
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
  } else {
    // تنسيق ورقة A4 قياسية (210mm x 297mm)
    const pdfWidth = 210;
    const pageHeight = 297;
    const pdfHeight = (imgHeight * pdfWidth) / imgWidth;

    pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    if (pdfHeight <= pageHeight) {
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    } else {
      // تقسيم الصفحات في حال كانت الفاتورة تتجاوز صفحة A4 واحدة
      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = position - pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }
    }
  }

  const pdfBlob = pdf.output('blob');
  const pdfFile = new File([pdfBlob], safeFileName, { type: 'application/pdf' });
  const dataUrl = URL.createObjectURL(pdfBlob);

  return {
    file: pdfFile,
    blob: pdfBlob,
    dataUrl,
    blobUrl: dataUrl,
    fileName: safeFileName,
  };
}

/**
 * دالة طوارئ لإنشاء Canvas يحتوي على شاشة الفاتورة الكاملة بكافة تفاصيلها
 */
function renderFullInvoiceToCanvas(targetElement: HTMLElement, width: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const scale = 2;
  const targetWidth = width;

  // استخراج الأسطر والبنود والأسعار من DOM الفاتورة
  const textRows: string[] = [];
  const allElements = targetElement.querySelectorAll('h1, h2, h3, h4, p, span, div, tr, td, th');
  allElements.forEach((el) => {
    if (el.children.length === 0 && el.textContent?.trim()) {
      const txt = el.textContent.trim();
      if (txt.length > 0 && !textRows.includes(txt)) {
        textRows.push(txt);
      }
    }
  });

  // استخراج أسطر الجدول إن وجد
  const tableRows: { col1: string; col2: string; col3: string; col4: string }[] = [];
  const trs = targetElement.querySelectorAll('tr');
  trs.forEach((tr) => {
    const tds = tr.querySelectorAll('th, td');
    if (tds.length >= 2) {
      tableRows.push({
        col1: tds[0]?.textContent?.trim() || '',
        col2: tds[1]?.textContent?.trim() || '',
        col3: tds[2]?.textContent?.trim() || '',
        col4: tds[3]?.textContent?.trim() || '',
      });
    }
  });

  // البحث عن صورة الـ QR Code
  const qrImg = targetElement.querySelector('img[src^="data:image"]') as HTMLImageElement | null;

  const contentHeight = Math.max(750, 360 + (tableRows.length * 30) + 220);
  canvas.width = targetWidth * scale;
  canvas.height = contentHeight * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetWidth, contentHeight);

  // رسم إطار خارجي أنيق
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, targetWidth - 24, contentHeight - 24);

  let y = 45;

  // 1. الهيدر الرئيسي
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px "Cairo", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('مؤسسة عماد سعد آل سعيد لمواد البناء', targetWidth / 2, y);

  y += 24;
  ctx.fillStyle = '#d97706';
  ctx.font = 'bold 13px "Cairo", sans-serif';
  ctx.fillText('عمادكو • EMADCO', targetWidth / 2, y);

  y += 20;
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('الرقم الضريبي: 310948572100003', targetWidth / 2, y);

  y += 18;
  ctx.font = '11px sans-serif';
  ctx.fillText('س.ت: 1010998877 • الرياض - شارع المقاولين', targetWidth / 2, y);

  // 2. شريط عنوان الفاتورة
  y += 24;
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(24, y, targetWidth - 48, 32);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(24, y, targetWidth - 48, 32);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('فاتورة ضريبية مبسطة (SIMPLIFIED TAX INVOICE)', targetWidth / 2, y + 21);

  y += 50;

  // 3. جدول المواد والمنتجات إذا وجد
  if (tableRows.length > 0) {
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(24, y, targetWidth - 48, 28);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px sans-serif';

    const colW = (targetWidth - 48) / 4;
    ctx.textAlign = 'center';
    ctx.fillText(tableRows[0].col1 || 'المادة / البيان', 24 + colW * 3.5, y + 18);
    ctx.fillText(tableRows[0].col2 || 'الكمية', 24 + colW * 2.5, y + 18);
    ctx.fillText(tableRows[0].col3 || 'السعر', 24 + colW * 1.5, y + 18);
    ctx.fillText(tableRows[0].col4 || 'الإجمالي', 24 + colW * 0.5, y + 18);

    y += 28;

    ctx.font = '11px sans-serif';
    for (let r = 1; r < tableRows.length; r++) {
      const row = tableRows[r];
      if (r % 2 === 0) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(24, y, targetWidth - 48, 26);
      }
      ctx.fillStyle = '#1e293b';
      ctx.fillText(row.col1, 24 + colW * 3.5, y + 17);
      ctx.fillText(row.col2, 24 + colW * 2.5, y + 17);
      ctx.fillText(row.col3, 24 + colW * 1.5, y + 17);
      ctx.fillText(row.col4, 24 + colW * 0.5, y + 17);
      y += 26;
    }
  } else {
    // رسم الأسطر النصية المستخرجة
    ctx.textAlign = 'right';
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#1e293b';
    const sampleTexts = textRows.slice(0, 16);
    sampleTexts.forEach((txt) => {
      if (txt.length < 80) {
        ctx.fillText(txt, targetWidth - 30, y);
        y += 22;
      }
    });
  }

  y += 20;

  // 4. رسم رمز QR إذا توفر
  if (qrImg && qrImg.src) {
    try {
      const qImg = new Image();
      qImg.src = qrImg.src;
      ctx.drawImage(qImg, (targetWidth / 2) - 60, y, 120, 120);
      y += 130;
    } catch {
      // تجاهل
    }
  }

  // 5. تذييل الفاتورة
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('فاتورة معتمدة ومسجلة بنظام هيئة الزكاة والضريبة والجمارك', targetWidth / 2, y);

  return canvas;
}

/**
 * دالة طوارئ فائقة الموثوقية لتحويل عنصر DOM إلى Canvas عبر SVG ForeignObject عند تعثر html2canvas
 */
async function domToSvgCanvasFallback(targetElement: HTMLElement, format: 'thermal' | 'a4'): Promise<HTMLCanvasElement> {
  const width = format === 'thermal' ? 380 : 800;
  const height = Math.max(targetElement.offsetHeight || 900, 600);

  const clone = targetElement.cloneNode(true) as HTMLElement;
  const noPrintEls = clone.querySelectorAll('.no-print');
  noPrintEls.forEach((el) => ((el as HTMLElement).style.display = 'none'));

  clone.style.width = `${width}px`;
  clone.style.backgroundColor = '#ffffff';
  clone.style.boxSizing = 'border-box';
  clone.style.padding = '16px';
  clone.style.margin = '0 auto';

  // استخراج وسوم التنسيقات الداخلي فقط واستبعاد الوسوم الخارجية ذات روابط href أو @import
  const inlineStyles = Array.from(document.querySelectorAll('style'))
    .map((el) => {
      let cssText = el.textContent || '';
      cssText = cssText.replace(/@import\s+url\([^)]+\);?/gi, '');
      cssText = cssText.replace(/@import\s+["'][^"']+["'];?/gi, '');
      return `<style>${sanitizeCssOklch(cssText)}</style>`;
    })
    .join('\n');

  const wrapperHtml = `
    <div xmlns="http://www.w3.org/1999/xhtml" style="background:#ffffff; width:${width}px; font-family:'Cairo', sans-serif; direction:rtl; text-align:right; color:#0f172a;">
      ${inlineStyles}
      ${clone.outerHTML}
    </div>
  `;

  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        ${wrapperHtml}
      </foreignObject>
    </svg>
  `;

  const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(2, 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0);
      }
      resolve(canvas);
    };
    img.onerror = () => {
      // رندر شامل للفاتورة بكافة بياناتها عبر المحرك البصري الاحتياطي
      const fullCanvas = renderFullInvoiceToCanvas(targetElement, width);
      resolve(fullCanvas);
    };
    img.src = dataUrl;
  });
}

/**
 * تنزيل وحفظ ملف PDF في جهاز المستخدم فورياً
 */
export function downloadPdfBlob(blob: Blob, fileName: string): string {
  const safeFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  const url = URL.createObjectURL(blob);

  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = safeFileName;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.warn('تعذر التنزيل عبر رابط a.click()، التراجع:', err);
    window.open(url, '_blank');
  }

  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // تجاهل
    }
  }, 30000);

  return url;
}

/**
 * فتح ملف PDF في تبويب جديد مستقل لمعاينته أو طباعته
 */
export function openPdfInNewTab(blob: Blob): Window | null {
  const url = URL.createObjectURL(blob);
  const newTab = window.open(url, '_blank');
  if (!newTab) {
    console.warn('حظر النوافذ المنبثقة مفعل، التراجع إلى تنزيل الملف');
    downloadPdfBlob(blob, 'فاتورة_ضريبية.pdf');
  }
  return newTab;
}

/**
 * طباعة ملف PDF مباشرة عبر إنشاء إطار مخصص
 */
export function printPdfDirectly(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = url;
  document.body.appendChild(iframe);

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.warn('فشلت طباعة iframe للـ PDF، فتح في نافذة مستقلة:', e);
      window.open(url, '_blank');
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 10000);
    }
  };
}

/**
 * التحقق مما إذا كان المتصفح يدعم مشاركة الملفات مباشرة عبر Web Share API
 */
export function canShareFiles(files: File[]): boolean {
  try {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.canShare &&
      navigator.canShare({ files })
    );
  } catch {
    return false;
  }
}

/**
 * مشاركة ملف PDF مباشرة عبر النظام وتطبيق الواتساب (لأجهزة الجوال والتابلت والمتصفحات المتوافقة)
 */
export async function sharePdfNatively(
  file: File,
  title: string,
  text?: string
): Promise<{ success: boolean; cancelled?: boolean; error?: string }> {
  if (!canShareFiles([file])) {
    return { success: false, error: 'Web Share API not supported for files' };
  }

  try {
    // محاولة المشاركة بالملف مع العنوان والنص إن أمكن
    const shareData: ShareData = {
      files: [file],
      title: title || file.name,
    };
    if (text) {
      shareData.text = text;
    }

    await navigator.share(shareData);
    return { success: true };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, cancelled: true };
    }

    // محاولة ثانية بالملف فقط (لأن بعض إصدارات أندرويد وواتساب ترفض النص والملف معاً)
    try {
      await navigator.share({
        files: [file],
        title: title || file.name,
      });
      return { success: true };
    } catch (err2: any) {
      if (err2.name === 'AbortError') {
        return { success: false, cancelled: true };
      }
      return { success: false, error: err2.message || 'فشلت المشاركة' };
    }
  }
}
