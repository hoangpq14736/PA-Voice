import React from 'react';
import { X, BookOpen, Volume2, Globe, Radio, Sparkles, CheckCircle2 } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="ios-card rounded-[28px] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col border border-white/[0.1]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[12px] bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white tracking-tight">
                Cẩm Nang Phát Thanh Đa Ngữ
              </h3>
              <p className="text-xs text-slate-400">
                Quy chuẩn thông báo qua hệ thống loa nén và âm thanh công cộng
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.14] active:scale-95 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs text-slate-300 leading-relaxed">
          {/* Section 1 */}
          <div className="ios-card-nested p-4.5 rounded-2xl border border-white/[0.06]">
            <h4 className="font-semibold text-sm text-amber-300 mb-2 flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-amber-400" /> 1. Cấu trúc bản tin phát thanh tiêu chuẩn
            </h4>
            <p className="text-slate-400 mb-3">
              Tại các khu vực công cộng, âm thanh cần rõ ràng, ngắt nghỉ đúng nhịp:
            </p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-200">
              <span className="px-2.5 py-1 bg-amber-500/15 text-amber-300 rounded-full border border-amber-500/25">
                🔔 1. Chuông hiệu (2-3s)
              </span>
              <span>➔</span>
              <span className="px-2.5 py-1 bg-emerald-500/15 text-emerald-300 rounded-full border border-emerald-500/25">
                🇻🇳 2. Tiếng Việt (chính)
              </span>
              <span>➔</span>
              <span className="px-2.5 py-1 bg-blue-500/15 text-blue-300 rounded-full border border-blue-500/25">
                🇬🇧 3. Tiếng Anh (quốc tế)
              </span>
              <span>➔</span>
              <span className="px-2.5 py-1 bg-indigo-500/15 text-indigo-300 rounded-full border border-indigo-500/25">
                🇰🇷 4. Hàn Quốc
              </span>
              <span>➔</span>
              <span className="px-2.5 py-1 bg-red-500/15 text-red-300 rounded-full border border-red-500/25">
                🇨🇳 5. Trung Quốc
              </span>
              <span>➔</span>
              <span className="px-2.5 py-1 bg-violet-500/15 text-violet-300 rounded-full border border-violet-500/25">
                🇷🇺 6. Nga
              </span>
            </div>
          </div>

          {/* Section 2 */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-white flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-emerald-400" /> 2. Tùy chỉnh chất giọng, tốc độ & tông nhịp
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="ios-card-nested p-3.5 rounded-2xl border border-white/[0.06]">
                <span className="font-semibold text-white block mb-1">⏱️ Tốc độ đọc (Speed)</span>
                <p className="text-slate-400 text-[11px]">
                  Khu vực ngoài trời nên để tốc độ từ <strong className="text-amber-300">0.9x đến 1.05x</strong> để người nghe tiếp nhận rõ từng từ.
                </p>
              </div>
              <div className="ios-card-nested p-3.5 rounded-2xl border border-white/[0.06]">
                <span className="font-semibold text-white block mb-1">🎵 Tông giọng (Pitch)</span>
                <p className="text-slate-400 text-[11px]">
                  Tông trầm ấm cho thông báo an toàn hoặc buổi tối; tông cao thanh cho lễ hội và chào đón.
                </p>
              </div>
            </div>
          </div>

          {/* Section 4 */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" /> 3. Xuất file MP3 & Tối ưu API
            </h4>
            <ul className="space-y-2 text-slate-400">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>File MP3 (128 kbps):</strong> Nhẹ gọn, tương thích hoàn hảo mọi đầu USB, amply tại trạm phát thanh.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>1 Nút tải trọn bộ (.ZIP):</strong> Đóng gói cả 5 file âm thanh cùng lúc trong 1 cú click.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Tiết kiệm API:</strong> Dịch thuật gom vào 1 request, Smart Cache không gọi lại API khi nghe thử.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.08] bg-white/[0.02] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-white/[0.08] hover:bg-white/[0.14] active:scale-95 text-white rounded-full transition-all cursor-pointer"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
};
