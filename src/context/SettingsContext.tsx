/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  CompleteSystemSettings,
  CompanyFacilitySettings,
  StorefrontSettingsData,
  TaxSettingsData,
  InvoicingSettingsData,
  PrintingSettingsData,
  DEFAULT_SYSTEM_SETTINGS,
  getSystemSettings,
  saveSystemSettings,
  subscribeToSystemSettings,
} from '../services/settings';
import { updateAppFavicon } from '../utils/favicon';

interface SettingsContextType {
  settings: CompleteSystemSettings;
  facility: CompanyFacilitySettings;
  storefront: StorefrontSettingsData;
  tax: TaxSettingsData;
  invoicing: InvoicingSettingsData;
  printing: PrintingSettingsData;
  isLoading: boolean;
  updateSettings: (updates: Partial<CompleteSystemSettings>, actorName?: string) => Promise<CompleteSystemSettings>;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<CompleteSystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // جلب أولي سريع
    getSystemSettings()
      .then((data) => {
        setSettings(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.warn('تعذر تحميل إعدادات النظام الأولية:', err);
        setIsLoading(false);
      });

    // اشتراك حي ومباشر مع Firestore
    const unsubscribe = subscribeToSystemSettings((updated) => {
      setSettings(updated);
      setIsLoading(false);
      if (updated.facility?.logoUrl) {
        updateAppFavicon(updated.facility.logoUrl);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (settings.facility?.logoUrl) {
      updateAppFavicon(settings.facility.logoUrl);
    }
  }, [settings.facility?.logoUrl]);

  const handleUpdateSettings = async (
    updates: Partial<CompleteSystemSettings>,
    actorName = 'المدير'
  ): Promise<CompleteSystemSettings> => {
    const result = await saveSystemSettings(updates, actorName);
    setSettings(result);
    return result;
  };

  const handleRefreshSettings = async () => {
    try {
      const data = await getSystemSettings();
      setSettings(data);
    } catch (err) {
      console.warn('فشل تحديث إعدادات النظام:', err);
    }
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        facility: settings.facility,
        storefront: settings.storefront,
        tax: settings.tax,
        invoicing: settings.invoicing,
        printing: settings.printing,
        isLoading,
        updateSettings: handleUpdateSettings,
        refreshSettings: handleRefreshSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSystemSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    return {
      settings: DEFAULT_SYSTEM_SETTINGS,
      facility: DEFAULT_SYSTEM_SETTINGS.facility,
      storefront: DEFAULT_SYSTEM_SETTINGS.storefront,
      tax: DEFAULT_SYSTEM_SETTINGS.tax,
      invoicing: DEFAULT_SYSTEM_SETTINGS.invoicing,
      printing: DEFAULT_SYSTEM_SETTINGS.printing,
      isLoading: false,
      updateSettings: async () => DEFAULT_SYSTEM_SETTINGS,
      refreshSettings: async () => {},
    };
  }
  return context;
};
