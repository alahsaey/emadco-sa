/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const STORAGE_KEY = 'emadco_custom_logo';
const LOGO_CHANGE_EVENT = 'emadco_logo_changed';

/**
 * تحديث أيقونة الموقع (Favicon) في المتصفح ديناميكياً
 */
export function updateAppFavicon(iconUrl?: string): void {
  if (typeof document === 'undefined') return;

  try {
    let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }

    if (iconUrl && iconUrl.trim().length > 0) {
      link.type = iconUrl.startsWith('data:image/svg') ? 'image/svg+xml' : 'image/png';
      link.href = iconUrl;
    } else {
      // الشعار الافتراضي الشفاف
      link.type = 'image/png';
      link.href = '/favicon.png';
    }

    // تحديث أيقونة الأبل والمظهر الخارجي
    let appleLink: HTMLLinkElement | null = document.querySelector("link[rel='apple-touch-icon']");
    if (appleLink) {
      appleLink.href = iconUrl && iconUrl.trim().length > 0 ? iconUrl : '/apple-touch-icon.png';
    }
  } catch (err) {
    console.warn('تعذر تحديث أيقونة المتصفح Favicon:', err);
  }
}

/**
 * جلب رابط الشعار المخصص المخزن محلياً
 */
export function getStoredLogoUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * حفظ الشعار المخصص وتحديث المتصفح وإشعار كافة مكونات النظام
 */
export function setStoredLogoUrl(logoUrl?: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (logoUrl && logoUrl.trim().length > 0) {
      localStorage.setItem(STORAGE_KEY, logoUrl);
      updateAppFavicon(logoUrl);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      updateAppFavicon();
    }

    window.dispatchEvent(
      new CustomEvent(LOGO_CHANGE_EVENT, {
        detail: { logoUrl: logoUrl || null },
      })
    );
  } catch (err) {
    console.warn('تعذر حفظ الشعار محلياً:', err);
  }
}

/**
 * الاستماع للتغيرات الفورية على الشعار في أي مكان بالنظام
 */
export function onLogoChange(callback: (logoUrl: string | null) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (event: any) => {
    callback(event?.detail?.logoUrl ?? getStoredLogoUrl());
  };

  window.addEventListener(LOGO_CHANGE_EVENT, handler);
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      callback(getStoredLogoUrl());
    }
  });

  return () => {
    window.removeEventListener(LOGO_CHANGE_EVENT, handler);
  };
}
