import React from 'react';

export interface SaudiRiyalSymbolProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

/**
 * الرمز الرسمي المعتمد للريال السعودي (Saudi Riyal Official Symbol)
 * مطابق للتصميم الهندسي المعتمد والملف المرفق من البنك المركزي السعودي
 */
export const SaudiRiyalSymbol: React.FC<SaudiRiyalSymbolProps> = ({
  className = 'w-4 h-4',
  size,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 1124.14 1256.39"
      fill="currentColor"
      aria-label="ر.س"
      role="img"
      style={size ? { width: size, height: size } : undefined}
      className={`inline-block shrink-0 ${className}`}
      {...props}
    >
      <path d="M699.62 1113.02c-20.06 44.48-33.32 92.75-38.4 143.37l424.51-90.24c20.06-44.47 33.31-92.75 38.4-143.37zm386.11-217.22c20.06-44.47 33.32-92.75 38.4-143.37l-330.68 70.33v-135.2l292.27-62.11c20.06-44.47 33.32-92.75 38.4-143.37l-330.68 70.27V66.13c-50.67 28.45-95.67 66.32-132.25 110.99v403.35l-132.25 28.11V0c-50.67 28.44-95.67 66.32-132.25 110.99v525.69l-295.91 62.88c-20.06 44.47-33.33 92.75-38.42 143.37l334.33-71.05v170.26l-358.3 76.14c-20.06 44.47-33.32 92.75-38.4 143.37l375.04-79.7c30.53-6.35 56.77-24.4 73.83-49.24l68.78-101.97v-.02c7.14-10.55 11.3-23.27 11.3-36.97V743.77l132.25-28.11v270.4l424.53-90.28Z" />
    </svg>
  );
};

export const SaudiRiyalIcon = SaudiRiyalSymbol;
export { SaudiReceiptIcon, SaudiReceiptIcon as ReceiptIcon } from './SaudiReceiptIcon';
export default SaudiRiyalSymbol;
