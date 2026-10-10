/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PrintElementOptions {
  title?: string;
  autoPrint?: boolean;
}

/**
 * دالة طباعة مخصصة وموثوقة بنسبة 100% تعمل بسلاسة حتى داخل الـ iFrame والبيئات المقيدة
 */
export function printElement(
  element: HTMLElement | null,
  title: string = 'مستند طباعة',
  options: PrintElementOptions = { autoPrint: true }
): boolean {
  if (!element) {
    window.print();
    return true;
  }

  // استخراج العنصر المستهدف للطباعة
  const targetElement =
    (element.querySelector('.printable-a4, .printable-receipt') as HTMLElement) || element;
  const contentHtml = targetElement.innerHTML;

  // جلب جميع ملفات وتنسيقات CSS من المستند الحالي
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((el) => el.outerHTML)
    .join('\n');

  const fullPrintHtml = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
        ${styles}
        <style>
          @page {
            size: auto;
            margin: 6mm;
          }
          @media print {
            body {
              font-family: 'Cairo', 'IBM Plex Sans Arabic', sans-serif !important;
              background-color: #ffffff !important;
              color: #000000 !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .no-print {
              display: none !important;
            }
          }
          body {
            font-family: 'Cairo', 'IBM Plex Sans Arabic', sans-serif !important;
            background-color: #f8fafc;
            color: #0f172a;
            margin: 0;
            padding: 12px;
          }
          .no-print-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: #0f172a;
            color: white;
            padding: 10px 16px;
            border-radius: 12px;
            margin-bottom: 16px;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
          }
          .no-print-btn {
            background: #059669;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            font-weight: bold;
            font-family: inherit;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .no-print-btn-close {
            background: #334155;
            color: white;
            border: none;
            padding: 8px 14px;
            border-radius: 8px;
            font-weight: bold;
            font-family: inherit;
            cursor: pointer;
          }
          .printable-content-wrapper {
            background: #ffffff;
            margin: 0 auto;
            padding: 0;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
        </style>
      </head>
      <body>
        <div class="no-print no-print-bar">
          <div style="font-weight: bold; font-size: 14px;">🖨️ ${title}</div>
          <div style="display: flex; gap: 8px;">
            <button class="no-print-btn" onclick="window.print()">
              <span>إرسال أمر الطباعة الآن</span>
            </button>
            <button class="no-print-btn-close" onclick="window.close()">
              <span>إغلاق النافذة</span>
            </button>
          </div>
        </div>
        <div class="printable-content-wrapper">
          ${contentHtml}
        </div>
      </body>
    </html>
  `;

  // المحاولة الأولى: نافذة منبثقة مستقلة (تتجاوز قيود وحظر iFrame Sandbox تماماً)
  try {
    const printWindow = window.open('', '_blank', 'width=880,height=960,top=40,left=100');
    if (printWindow && !printWindow.closed) {
      printWindow.document.open();
      printWindow.document.write(fullPrintHtml);
      printWindow.document.close();

      if (options.autoPrint !== false) {
        setTimeout(() => {
          try {
            printWindow.focus();
            printWindow.print();
          } catch (e) {
            console.warn('استدعاء printWindow.print() واجه استثناء:', e);
          }
        }, 800);
      }
      return true;
    }
  } catch (err) {
    console.warn('تعذر فتح نافذة طباعة خارجية، جاري المحاولة عبر الإطار المخفي:', err);
  }

  // المحاولة الثانية: إنشاء إطار طباعة iframe خفي في نفس الصفحة
  try {
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.title = title;
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(fullPrintHtml);
      doc.close();

      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } catch (e) {
          console.warn('حظر الطباعة عبر الإطار، التراجع إلى window.print():', e);
          window.print();
        } finally {
          setTimeout(() => {
            if (document.body.contains(printFrame)) {
              document.body.removeChild(printFrame);
            }
          }, 4000);
        }
      }, 400);
      return true;
    }
  } catch (err) {
    console.warn('خطأ في إطار الطباعة:', err);
  }

  // المحاولة الثالثة: طباعة المتصفح المباشرة
  try {
    window.print();
    return true;
  } catch (err) {
    console.error('فشلت جميع محاولات استدعاء الطباعة:', err);
    return false;
  }
}
