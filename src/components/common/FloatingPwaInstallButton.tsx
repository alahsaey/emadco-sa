import React, { useState } from 'react';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { PwaInstallModal } from './PwaInstallModal';
import { Download, Sparkles, X, Smartphone } from 'lucide-react';

export const FloatingPwaInstallButton: React.FC = () => {
  const { isInstalled, isInstallable, promptInstall } = usePwaInstall();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDismissedSession, setIsDismissedSession] = useState(false);

  // إذا كان التطبيق مثبتاً بالفعل على جهاز هذا المستخدم، يُخفى الزر تماماً ولا يظهر له
  if (isInstalled) {
    return null;
  }

  // إذا تم إخفاؤه مؤقتاً خلال الجلسة الحالية
  if (isDismissedSession) {
    return null;
  }

  const handleClick = async () => {
    // إذا كان المتصفح يدعم المطالبة الفورية بنقرة واحدة، نحاول إطلاقها مباشرة، أو نفتح النافذة الإرشادية
    if (isInstallable) {
      const accepted = await promptInstall();
      if (!accepted) {
        setIsModalOpen(true);
      }
    } else {
      setIsModalOpen(true);
    }
  };

  return (
    <>
      {/* زر التثبيت العائم (Floating Action Button) */}
      <aside
        aria-label="تثبيت التطبيق على الجهاز"
        className="fixed bottom-20 lg:bottom-6 left-4 sm:left-6 z-40 flex items-center select-none animate-in fade-in slide-in-from-bottom-4 duration-300"
      >
        <div className="relative group">
          {/* حلقة التوهج الخارجي */}
          <div className="absolute -inset-1 bg-linear-to-r from-amber-500 via-amber-400 to-amber-600 rounded-2xl blur-xs opacity-75 group-hover:opacity-100 transition duration-300 animate-pulse" />

          {/* الحاوية الرئيسية للزر العائم */}
          <div className="relative flex items-center bg-slate-900 text-white rounded-2xl p-1.5 sm:p-2 border border-amber-400/80 shadow-2xl shadow-slate-950/40 backdrop-blur-md">
            {/* الزر الرئيسي للتشغيل والتثبيت */}
            <button
              type="button"
              onClick={handleClick}
              className="flex items-center gap-2.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-right transition-transform active:scale-95 cursor-pointer group/btn"
              title="تثبيت برنامج مؤسسة عماد سعد آل سعيد لمواد البناء على جهازك أو شريط المهام"
            >
              {/* أيقونة التحميل مع نبض حركي ملفت */}
              <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-linear-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shrink-0 shadow-md group-hover/btn:scale-105 transition-transform">
                <Download className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950 stroke-[2.5]" />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-200"></span>
                </span>
              </div>

              {/* النصوص التوضيحية */}
              <div className="flex flex-col text-right">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-black text-white group-hover/btn:text-amber-300 transition-colors">
                    تثبيت البرنامج
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30 px-1.5 py-0.2 rounded-md">
                    PWA
                  </span>
                </div>
                <span className="text-[10px] text-slate-300 hidden sm:inline">
                  إضافة للشاشة الرئيسية وشريط المهام
                </span>
              </div>
            </button>

            {/* زر إغلاق مصغر للجلسة الحالية */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsDismissedSession(true);
              }}
              className="p-1 sm:p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer mr-1"
              title="إخفاء مؤقتاً لهذه الجلسة"
              aria-label="إخفاء مؤقت"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* نافذة التثبيت التفاعلية والإرشادية */}
      <PwaInstallModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};
