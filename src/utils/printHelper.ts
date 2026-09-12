/**
 * High-Performance Universal Isolated Print Engine
 * Optimized for INSTANT (zero-lag) print preview dialog launch.
 *
 * Key Optimizations:
 * 1. ZERO network delay: Extracts in-memory computed CSS rules directly via CSSOM
 *    instead of copying external stylesheet <link> tags that trigger slow network downloads.
 * 2. Instant A4/A4-Landscape formatting with 100% color and border fidelity.
 * 3. Removes interactive toolbars, buttons, and sidebars cleanly.
 * 4. Microtask execution via requestAnimationFrame for immediate dialog popup without freezes.
 */

export function printElement(
  target?: string | HTMLElement | null,
  options?: { title?: string; pageOrientation?: 'portrait' | 'landscape' }
) {
  const isLandscape = options?.pageOrientation === 'landscape';

  // 1. Resolve Target Element
  let targetEl: HTMLElement | null = null;
  if (typeof target === 'string') {
    targetEl = document.getElementById(target);
  } else if (target instanceof HTMLElement) {
    targetEl = target;
  }

  // Auto-detect printable container if not explicitly provided
  if (!targetEl) {
    targetEl = (document.querySelector('[id^="printable-"]') ||
      document.querySelector('.printable-doc') ||
      document.querySelector('[role="dialog"] .p-6, [role="dialog"] .p-8') ||
      document.querySelector('[role="dialog"]') ||
      document.querySelector('main')) as HTMLElement | null;
  }

  if (!targetEl) {
    window.print();
    return;
  }

  const docTitle = options?.title || document.title || 'Print Document';

  // 2. Extract in-memory CSS rules directly without re-fetching across network
  let collectedStyles = '';
  try {
    const styleSheets = Array.from(document.styleSheets);
    for (const sheet of styleSheets) {
      try {
        if (sheet.cssRules) {
          for (let j = 0; j < sheet.cssRules.length; j++) {
            collectedStyles += sheet.cssRules[j].cssText + '\n';
          }
        }
      } catch {
        // If stylesheet is cross-origin restricted, skip or fallback
      }
    }
  } catch (e) {
    console.warn('Fast print CSSOM extraction note:', e);
  }

  // If CSSOM is empty (e.g. style tags without rules parsed yet), grab existing <style> tag texts
  if (!collectedStyles.trim()) {
    document.querySelectorAll('style').forEach((st) => {
      collectedStyles += st.innerHTML + '\n';
    });
  }

  // 3. Strict, high-fidelity A4 Print CSS
  const printResetCss = `
    @page {
      size: ${isLandscape ? 'A4 landscape' : 'A4 portrait'};
      margin: 6mm 6mm 6mm 6mm;
    }
    *, *::before, *::after {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
      text-shadow: none !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      width: 100% !important;
      min-width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
      overflow: visible !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      font-size: 11px;
      line-height: 1.35;
    }
    .no-print,
    .print\\:hidden,
    button,
    input[type="button"],
    input[type="submit"],
    [role="tooltip"],
    .toast,
    .sonner-toast,
    [data-sonner-toaster] {
      display: none !important;
      visibility: hidden !important;
    }
    .printable-doc,
    [id^="printable-"] {
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      box-shadow: none !important;
      border-color: #cbd5e1 !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
    }
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      page-break-inside: auto !important;
    }
    thead {
      display: table-header-group !important;
    }
    tfoot {
      display: table-footer-group !important;
    }
    tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .avoid-break,
    .avoid-page-break,
    .signature-block,
    .doc-header,
    .doc-footer {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
  `;

  // 4. Clone target and sync form values (inputs/selects/checkboxes)
  const clonedTarget = targetEl.cloneNode(true) as HTMLElement;
  const originalInputs = targetEl.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea');
  const clonedInputs = clonedTarget.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea');

  originalInputs.forEach((orig, idx) => {
    const clone = clonedInputs[idx];
    if (clone) {
      if (orig instanceof HTMLInputElement && (orig.type === 'checkbox' || orig.type === 'radio')) {
        (clone as HTMLInputElement).checked = orig.checked;
      } else {
        clone.value = orig.value;
      }
    }
  });

  // Remove interactive control buttons from cloned view
  clonedTarget.querySelectorAll('button, .no-print, .print\\:hidden').forEach((btn) => {
    btn.remove();
  });

  // 5. Setup hidden iframe
  const iframeId = 'isolated-print-frame';
  let iframe = document.getElementById(iframeId) as HTMLIFrameElement | null;
  if (iframe && iframe.parentNode) {
    iframe.parentNode.removeChild(iframe);
  }

  iframe = document.createElement('iframe');
  iframe.id = iframeId;
  iframe.setAttribute(
    'style',
    'position:fixed;right:-9999px;bottom:-9999px;width:0;height:0;border:0;visibility:hidden;'
  );
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    window.print();
    return;
  }

  // 6. Assemble Self-Contained In-Memory Document (ZERO network downloads)
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${docTitle.replace(/[<>&"]/g, '')}</title>
    <style>
      ${collectedStyles}
      ${printResetCss}
    </style>
  </head>
  <body>
    <div class="printable-wrapper">
      ${clonedTarget.outerHTML}
    </div>
  </body>
</html>`;

  iframeDoc.open();
  iframeDoc.write(fullHtml);
  iframeDoc.close();

  const printWindow = iframe.contentWindow;
  if (!printWindow) {
    window.print();
    return;
  }

  // 7. Instant execution via requestAnimationFrame (no arbitrary multi-second timeouts)
  const executePrint = () => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch (e) {
      console.warn('Iframe print fallback to window.print', e);
      window.print();
    } finally {
      // Clean up iframe after slight delay to ensure browser print dialog finishes reading DOM
      setTimeout(() => {
        if (iframe && iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 2000);
    }
  };

  // Micro-tick to allow DOM tree construction in iframe
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      executePrint();
    });
  });
}

export function initializePrintHandler() {
  // Global initializer ready
}

if (typeof window !== 'undefined') {
  initializePrintHandler();
}
