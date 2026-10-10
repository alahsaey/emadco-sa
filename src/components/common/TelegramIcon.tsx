/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export interface TelegramIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

export const TelegramIcon: React.FC<TelegramIconProps> = ({
  className = 'w-5 h-5',
  size,
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Telegram"
      role="img"
      style={size ? { width: size, height: size } : undefined}
      className={`inline-block shrink-0 ${className}`}
      {...props}
    >
      <path
        d="M21.6 3.6L2.4 11.2C1.1 11.7 1.1 12.5 2.1 12.8L7 14.3L18.4 7.1C18.9 6.8 19.4 7 19 7.4L9.8 15.7L9.4 20.3C9.9 20.3 10.1 20.1 10.4 19.8L12.8 17.5L17.7 21.1C18.6 21.6 19.3 21.2 19.5 20.1L22.7 4.9C23 3.7 22.3 3.1 21.6 3.6Z"
        fill="currentColor"
      />
    </svg>
  );
};

export default TelegramIcon;
