import React from 'react';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { EmadcoLogo } from './EmadcoLogo';
import { useSystemSettings } from '../../context/SettingsContext';
import {
  Download,
  X,
  Smartphone,
  Laptop,
  CheckCircle2,
  Share,
  PlusSquare,
  Sparkles,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

interface PwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PwaInstallModal: React.FC<PwaInstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, promptInstall, platform, markAsInstalled } = usePwaInstall();
  const { facility } = useSystemSettings();
  const companyNameAr = facility?.nameAr || 'مؤسسة عماد سعد آل سعيد لمواد البناء';

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    const success = await promptInstall();
    if (success) {
      onClose();
    }
  };

  const handleManualMarkInstalled = () => {
    markAsInstalled();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden text-right dir-rtl">
        {/* الترويسة العليا */}
        <div className="relative p-6 bg-linear-to-b from-slate-900 via-slate-900 to-slate-800 text-white">
          <button
            type="button"
            onClick={onClose}
            className="absolute left-4 top-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            {/* الشعار بالأيقونة الشفافة المعتمدة من المنشأة */}
            <div className="w-16 h-16 rounded-2xl bg-slate-800/80 p-2 border border-slate-700/60 flex items-center justify-center shrink-0 shadow-lg backdrop-blur-xs">
              <EmadcoLogo size="lg" variant="icon" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                  PWA App
                </span>
                <span className="text-xs text-slate-300 font-mono flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  آمن وبدون إعلانات
                </span>
              </div>
              <h2 className="text-lg font-black text-white mt-1 leading-tight">
                تثبيت تطبيق {companyNameAr}
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                احصل على تجربة تطبيق هاتف ومكتب كاملة مع وصول سريع وشريط مهام مستقل!
              </p>
            </div>
          </div>
        </div>

        {/* محتوى الشاشة */}
        <div className="p-6 space-y-5">
          {/* حالة التثبيت الفعلية */}
          {isInstalled ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-bold flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="font-black text-sm">التطبيق مثبت بالفعل على جهازك!</p>
                <p className="text-emerald-700 text-xs mt-0.5 font-normal">
                  يمكنك تشغيل التطبيق مباشرة من الشاشة الرئيسية أو شريط المهام على سطح المكتب.
                </p>
              </div>
            </div>
          ) : isInstallable ? (
            /* زر التثبيت المباشر بنقرة واحدة */
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs space-y-3">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-amber-600 shrink-0" />
                <div>
                  <p className="font-black text-sm text-slate-900">جاهز للتثبيت الفوري!</p>
                  <p className="text-slate-600 text-xs mt-0.5">
                    اضغط على الزر أدناه لإضافة التطبيق إلى جهازك فوراً بدون الحاجة لمتجر التطبيقات.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-black rounded-xl shadow-lg transition-all cursor-pointer group"
              >
                <Download className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                <span>تثبيت التطبيق الآن على الجهاز</span>
              </button>
            </div>
          ) : (
            /* تعليمات التثبيت اليدوي لمختلف الأجهزة */
            <div className="space-y-3">
              <p className="text-xs font-black text-slate-800 flex items-center gap-2">
                <Laptop className="w-4 h-4 text-amber-600" />
                طريقة التثبيت اليدوية بحسب نوع جهازك:
              </p>

              {platform === 'ios' ? (
                /* تعليمات آيفون وآيباد iOS */
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-2 text-slate-700">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-amber-600" />
                    على أجهزة آيفون / آيباد (متصفح Safari):
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 font-medium">
                    <li>اضغط على زر <strong className="text-slate-900">المشاركة (Share <Share className="w-3 h-3 inline text-blue-600" />)</strong> في أسفل متصفح Safari.</li>
                    <li>اختر <strong className="text-slate-900">"إضافة إلى الشاشة الرئيسية" (Add to Home Screen <PlusSquare className="w-3 h-3 inline text-slate-700" />)</strong>.</li>
                    <li>اضغط على <strong className="text-slate-900">"إضافة" (Add)</strong> بالأعلى لتظهر أيقونة التطبيق الشفافة على شاشتك.</li>
                  </ol>
                </div>
              ) : (
                /* تعليمات الكمبيوتر وأندرويد Chrome/Edge */
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-2 text-slate-700">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-blue-600" />
                    على أجهزة الكمبيوتر (Windows / Mac) وأندرويد:
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600 font-medium">
                    <li>ابحث عن أيقونة <strong className="text-slate-900">التثبيت (Install <Download className="w-3 h-3 inline text-amber-600" />)</strong> في شريط عنوان المتصفح بالأعلى.</li>
                    <li>أو اضغط على نقاط القائمة الثلاث <strong className="text-slate-900">(⋮)</strong> ثم اختر <strong className="text-slate-900">"تثبيت التطبيق" (Install App)</strong> أو <strong className="text-slate-900">"حفظ ومشاركة"</strong>.</li>
                    <li>ستظهر أيقونة الشعار الشفافة المعتمدة على سطح المكتب وشريط المهام متوافقة مع خلفيتك.</li>
                  </ol>
                </div>
              )}

              {/* زر تأكيد التثبيت اليدوي لإخفاء زر التثبيت العائم نهائياً لهذا المستخدم */}
              <button
                type="button"
                onClick={handleManualMarkInstalled}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs mt-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>تم تثبيت التطبيق على جهازي بنجاح (إخفاء زر التثبيت)</span>
              </button>
            </div>
          )}

          {/* مزايا التثبيت كـ PWA */}
          <div className="border-t border-slate-100 pt-4 space-y-2">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              مميزات التثبيت كـ PWA:
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl text-slate-700 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>أيقونة شفافة متناسقة مع الخلفيات</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl text-slate-700 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>عمل مباشر بدون شريط المتصفح</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl text-slate-700 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>سرعة استجابة فائقة وعمل أوفلاين</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl text-slate-700 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>وصول بنقرة واحدة من شريط المهام</span>
              </div>
            </div>
          </div>
        </div>

        {/* التذييل */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
          <span>PWA Version 1.0.0 • آمن ومستقل</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
};
