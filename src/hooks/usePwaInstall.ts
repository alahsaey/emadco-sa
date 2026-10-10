import { useState, useEffect, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PWA_INSTALLED_STORAGE_KEY = 'emadco_pwa_installed_device';

/**
 * فحص ما إذا كان التطبيق مثبتاً بالفعل على جهاز المستخدم
 * عبر فحص وضع Standalone أو القيمة المخزنة في الذاكرة المحلية
 */
export function isDeviceAppInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    const storedInstalled = localStorage.getItem(PWA_INSTALLED_STORAGE_KEY) === 'true';
    return isStandalone || storedInstalled;
  } catch {
    return false;
  }
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isDeviceAppInstalled());
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');

  useEffect(() => {
    // التحقق من البيئة
    const ua = navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);

    if (isIos) {
      setPlatform('ios');
    } else if (isAndroid) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }

    // التحقق الفوري من التثبيت
    if (isDeviceAppInstalled()) {
      setIsInstalled(true);
      setIsInstallable(false);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // إذا كان التطبيق مثبتاً بالفعل لا داعي لعرض المطالبة
      if (isDeviceAppInstalled()) {
        setIsInstalled(true);
        setIsInstallable(false);
        return;
      }
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      try {
        localStorage.setItem(PWA_INSTALLED_STORAGE_KEY, 'true');
      } catch (err) {
        console.warn('Failed to save install status:', err);
      }
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      window.dispatchEvent(new CustomEvent('pwa-installed-changed', { detail: { isInstalled: true } }));
      console.log('[PWA] App successfully installed on device');
    };

    const handleInstalledSync = (e: any) => {
      if (e?.detail?.isInstalled) {
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('pwa-installed-changed', handleInstalledSync);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('pwa-installed-changed', handleInstalledSync);
    };
  }, []);

  const markAsInstalled = useCallback(() => {
    try {
      localStorage.setItem(PWA_INSTALLED_STORAGE_KEY, 'true');
    } catch (err) {
      console.warn('Failed to save install status:', err);
    }
    setIsInstalled(true);
    setIsInstallable(false);
    setDeferredPrompt(null);
    window.dispatchEvent(new CustomEvent('pwa-installed-changed', { detail: { isInstalled: true } }));
  }, []);

  const promptInstall = async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        try {
          localStorage.setItem(PWA_INSTALLED_STORAGE_KEY, 'true');
        } catch (err) {
          console.warn('Failed to save install status:', err);
        }
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
        window.dispatchEvent(new CustomEvent('pwa-installed-changed', { detail: { isInstalled: true } }));
        return true;
      }
    } catch (err) {
      console.warn('Error launching PWA install prompt:', err);
    }
    return false;
  };

  return {
    isInstallable,
    isInstalled,
    deferredPrompt,
    promptInstall,
    markAsInstalled,
    platform,
  };
}

