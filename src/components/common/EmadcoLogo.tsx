/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { getStoredLogoUrl, onLogoChange } from '../../utils/favicon';
import { useSystemSettings } from '../../context/SettingsContext';

interface EmadcoLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?: 'icon' | 'compact' | 'full' | 'vertical';
  showSubtitle?: boolean;
  className?: string;
  theme?: 'dark' | 'light' | 'auto';
  customLogoUrl?: string | null;
}

export const EmadcoLogo: React.FC<EmadcoLogoProps> = ({
  size = 'md',
  variant = 'compact',
  showSubtitle = true,
  className = '',
  theme = 'auto',
  customLogoUrl,
}) => {
  const { facility } = useSystemSettings();
  const companyNameAr = facility?.nameAr || 'مؤسسة عماد سعد آل سعيد لمواد البناء';
  const companyNameEn = facility?.nameEn || 'Emad Saad Al-Saeed Building Materials';

  const [activeLogo, setActiveLogo] = useState<string | null>(customLogoUrl ?? getStoredLogoUrl());
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (customLogoUrl !== undefined) {
      setActiveLogo(customLogoUrl);
      setImageError(false);
      return;
    }
    const unsub = onLogoChange((url) => {
      setActiveLogo(url);
      setImageError(false);
    });
    return unsub;
  }, [customLogoUrl]);

  const sizeMap = {
    xs: { iconSize: 24, textTitle: 'text-xs', textSub: 'text-[9px]' },
    sm: { iconSize: 32, textTitle: 'text-sm', textSub: 'text-[10px]' },
    md: { iconSize: 42, textTitle: 'text-base', textSub: 'text-xs' },
    lg: { iconSize: 56, textTitle: 'text-lg', textSub: 'text-xs' },
    xl: { iconSize: 72, textTitle: 'text-xl', textSub: 'text-sm' },
    '2xl': { iconSize: 96, textTitle: 'text-2xl', textSub: 'text-base' },
  };

  const { iconSize, textTitle, textSub } = sizeMap[size];

  // شعار أيقونة عمادكو الأصلي المتجهي الشفاف المطابق لشعار "عماد سعد آل سعيد لمواد البناء"
  const renderEmblem = () => {
    const src = (activeLogo && !imageError) ? activeLogo : '/pwa-icon.svg';
    return (
      <img
        src={src}
        alt="شعار عماد سعد آل سعيد لمواد البناء"
        style={{ width: iconSize, height: iconSize }}
        className="shrink-0 object-contain drop-shadow-md select-none"
        referrerPolicy="no-referrer"
        onError={() => {
          if (activeLogo) setImageError(true);
        }}
      />
    );
  };

  const isDark = theme === 'dark';
  const titleColor = isDark ? 'text-white' : 'text-slate-950';
  const subColor = isDark ? 'text-amber-400/90' : 'text-slate-500';

  if (variant === 'icon') {
    return <div className={`inline-flex items-center justify-center ${className}`}>{renderEmblem()}</div>;
  }

  if (variant === 'vertical') {
    return (
      <div className={`flex flex-col items-center text-center gap-2 ${className}`}>
        {renderEmblem()}
        <div>
          <div className={`font-black tracking-tight flex items-center justify-center gap-1.5 ${titleColor} ${textTitle}`}>
            <span className="font-black">{companyNameAr}</span>
          </div>
          {showSubtitle && (
            <div className="space-y-0.5 mt-1">
              <p className={`font-mono text-[11px] tracking-wider uppercase ${subColor}`}>
                {companyNameEn}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div className={`flex items-center gap-3.5 ${className}`}>
        {renderEmblem()}
        <div className="space-y-0.5">
          <div className={`font-black flex flex-wrap items-center gap-2 ${titleColor} ${textTitle}`}>
            <span className="font-black">{companyNameAr}</span>
          </div>
          {showSubtitle && (
            <>
              <p className={`text-[10px] font-mono tracking-wider uppercase ${subColor}`}>
                {companyNameEn}
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Variant === 'compact' (Default for Header & Navbar)
  return (
    <div className={`flex items-center gap-2 sm:gap-2.5 min-w-0 ${className}`}>
      {renderEmblem()}
      <div className="text-right min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`font-black tracking-tight truncate ${titleColor} ${textTitle}`}>{companyNameAr}</span>
          <span className="text-[10px] font-bold text-slate-500 font-mono hidden sm:inline shrink-0">ERP & POS</span>
        </div>
        {showSubtitle && companyNameEn && (
          <p className={`font-medium truncate ${subColor} ${textSub}`}>
            {companyNameEn}
          </p>
        )}
      </div>
    </div>
  );
};
