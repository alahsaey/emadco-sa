import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { useSystemSettings } from '../../context/SettingsContext';
import { EmadcoLogo } from './EmadcoLogo';
import {
  Share2,
  X,
  Copy,
  Check,
  QrCode,
  MessageSquare,
  Send,
  ExternalLink,
  Globe,
  Sparkles,
} from 'lucide-react';

interface ShareWebsiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  customUrl?: string;
  customTitle?: string;
}

export const ShareWebsiteModal: React.FC<ShareWebsiteModalProps> = ({
  isOpen,
  onClose,
  customUrl,
  customTitle,
}) => {
  const { facility } = useSystemSettings();
  const companyName = facility?.nameAr || 'مؤسسة عماد سعد آل سعيد لمواد البناء';

  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [siteUrl, setSiteUrl] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentUrl = customUrl || window.location.origin + window.location.pathname;
      setSiteUrl(currentUrl);

      // توليد رمز الاستجابة السريعة QR Code
      QRCode.toDataURL(currentUrl, {
        width: 280,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.warn('فشل توليد رمز QR:', err));
    }
  }, [customUrl, isOpen]);

  if (!isOpen) return null;

  const shareTitle = customTitle || `${companyName} — نظام إدارة ومبيعات مواد البناء`;
  const shareText = `تفضل بزيارة رابط النظام السحابي المعتمد لـ ${companyName}:`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(siteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn('تعذر نسخ الرابط تلقائياً:', err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: siteUrl,
        });
      } catch (err) {
        console.warn('تم إلغاء المشاركة بواسطة المستخدم:', err);
      }
    } else {
      handleCopyLink();
    }
  };

  // روابط المشاركة المباشرة
  const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
    `${shareText}\n${siteUrl}`
  )}`;

  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(
    siteUrl
  )}&text=${encodeURIComponent(shareText)}`;

  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    shareText
  )}&url=${encodeURIComponent(siteUrl)}`;

  const emailShareUrl = `mailto:?subject=${encodeURIComponent(
    shareTitle
  )}&body=${encodeURIComponent(`${shareText}\n\n${siteUrl}`)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden text-right dir-rtl">
        {/* الترويسة */}
        <div className="relative p-5 bg-linear-to-b from-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-400/30 flex items-center justify-center font-bold shrink-0">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">مشاركة رابط الموقع والنظام</h2>
              <p className="text-xs text-slate-300">انسخ الرابط أو شاركه مباشرة عبر التواصل</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* جسم النافذة */}
        <div className="p-5 space-y-5">
          {/* رمز الاستجابة السريعة QR Code */}
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-2">
            <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-amber-600" />
              <span>امسح الكود بالكاميرا لفتح الموقع على الجوال:</span>
            </div>

            {qrDataUrl ? (
              <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-200">
                <img src={qrDataUrl} alt="رمز QR للموقع" className="w-40 h-40 object-contain" />
              </div>
            ) : (
              <div className="w-40 h-40 bg-slate-200 animate-pulse rounded-xl flex items-center justify-center text-xs text-slate-500">
                جاري توليد الكود...
              </div>
            )}
            <p className="text-[11px] text-slate-500">
              مسح الرمز المباشر يتيح فتح المتجر ونقطة البيع على الجوال والتابلت فوراً.
            </p>
          </div>

          {/* حقل الرابط مع زر النسخ */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-slate-500" />
              <span>رابط الموقع المباشر:</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={siteUrl}
                className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-800 select-all focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  copied
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>تم النسخ!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-amber-400" />
                    <span>نسخ الرابط</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* أزرار المشاركة المباشرة عبر تطبيقات التواصل */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>مشاركة سريعة عبر التطبيقات:</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* واتساب */}
              <a
                href={whatsappShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-colors"
              >
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span>واتساب (WhatsApp)</span>
              </a>

              {/* تلجرام */}
              <a
                href={telegramShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 p-2.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-xl text-xs font-bold transition-colors"
              >
                <Send className="w-4 h-4 text-sky-600" />
                <span>تلجرام (Telegram)</span>
              </a>

              {/* X / تويتر */}
              <a
                href={twitterShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-slate-600" />
                <span>منصة X (Twitter)</span>
              </a>

              {/* البريد الإلكتروني */}
              <a
                href={emailShareUrl}
                className="flex items-center justify-center gap-2 p-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold transition-colors"
              >
                <Globe className="w-4 h-4 text-amber-600" />
                <span>إيميل (Email)</span>
              </a>
            </div>

            {/* المشاركة العامة لنظام التشغيل إذا توفرت */}
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="w-full mt-1 flex items-center justify-center gap-2 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-slate-600" />
                <span>فتح قائمة المشاركة الخاصة بالجهاز</span>
              </button>
            )}
          </div>
        </div>

        {/* التذييل */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
