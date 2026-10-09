import React from 'react';
import { X, BookOpen, Volume2, Globe, Radio, Sparkles, CheckCircle2 } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-amber-500/10 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">
                Cẩm Nang Vận Hành Phát Thanh Đa Ngữ (PA Studio)
              </h3>
              <p className="text-xs text-slate-400">
                Quy chuẩn phát thanh thông báo qua hệ thống loa nén và âm thanh công cộng
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs text-slate-300 leading-relaxed">
          {/* Section 1 */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <h4 className="font-bold text-sm text-amber-400 mb-2 flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-amber-400" /> 1. Cấu trúc một bản tin phát thanh tiêu chuẩn
            </h4>
            <p className="text-slate-400 mb-2">
              Tại các khu vực công cộng và sự kiện đông người, âm thanh cần rõ ràng, ngắt nghỉ đúng nhịp:
            </p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-200">
              <span className="px-2 py-1 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                🔔 1. Chuông hiệu (2-3s)
              </span>
              <span>➔</span>
              <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                🇻🇳 2. Tiếng Việt (chính)
              </span>
              <span>➔</span>
              <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
                🇬🇧 3. Tiếng Anh (quốc tế)
              </span>
              <span>➔</span>
              <span className="px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
                🇰🇷 4. Hàn Quốc
              </span>
              <span>➔</span>
              <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded border border-red-500/30">
                🇨🇳 5. Trung Quốc
              </span>
              <span>➔</span>
              <span className="px-2 py-1 bg-violet-500/20 text-violet-300 rounded border border-violet-500/30">
                🇷🇺 6. Nga
              </span>
              <span>➔</span>
              <span className="px-2 py-1 bg-slate-800 text-slate-300 rounded border border-slate-700">
                🔔 7. Chuông kết thúc
              </span>
            </div>
          </div>

          {/* Section 2 */}
          <div className="space-y-2">
            <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-emerald-400" /> 2. Tùy chỉnh chất giọng, tốc độ & tông giọng cho từng ngôn ngữ
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                <span className="font-semibold text-slate-200 block mb-1">⏱️ Tốc độ đọc (Speed)</span>
                <p className="text-slate-400 text-[11px]">
                  Khu vực Show ồn ào gió biển nên để tốc độ từ <strong className="text-amber-400">0.9x đến 1.05x</strong> để du khách nghe trọn vẹn từng từ.
                </p>
              </div>
              <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                <span className="font-semibold text-slate-200 block mb-1">🎵 Tông giọng (Pitch)</span>
                <p className="text-slate-400 text-[11px]">
                  Tông trầm ấm (Low shelf) cho thông báo an toàn hoặc buổi tối; tông cao thanh (High shelf) cho thông báo chúc mừng, lễ hội.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3 */}
          <div className="space-y-2">
            <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-orange-400" /> 3. Tính năng Mô phỏng Loa Ngoài Trời (PA Horn Mode)
            </h4>
            <p className="text-slate-400">
              Bộ lọc âm thanh tích hợp dải tần số 300Hz - 4200Hz và tăng cường âm trung (midrange boost), tái tạo chân thực cảm giác tiếng phát thanh qua các cụm loa nén cột ngoài trời, giúp bạn kiểm âm trước khi phát sóng thực tế.
            </p>
          </div>

          {/* Section 4 */}
          <div className="space-y-2">
            <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" /> 4. Xuất file MP3 & Phương án tối ưu ít API nhất
            </h4>
            <ul className="space-y-1.5 text-slate-400">
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>File MP3 (128 kbps tiêu chuẩn):</strong> Dung lượng siêu nhẹ, tương thích hoàn hảo với mọi đầu phát USB, thẻ nhớ SD, amply TOA/Bosch tại các trạm phát thanh công cộng.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>1 Nút tải trọn bộ 5 file (.ZIP):</strong> Đóng gói tự động cả 5 file ngôn ngữ + 1 file Master liên hoàn + file văn bản kịch bản trong 1 cú click.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Chiến lược tiết kiệm API:</strong> Dịch thuật gom 4 thứ tiếng vào đúng 1 request API duy nhất; bộ nhớ đệm client lưu audio sẵn có; việc nén MP3, ghép chuông và tạo file ZIP diễn ra 100% trên máy không tốn API.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Tải từng ngôn ngữ độc lập:</strong> Cho phép cài đặt vào từng zone loa chuyên biệt nếu cần phân luồng du khách quốc tế.</span>
              </li>
            </ul>
          </div>

          {/* Section 5 */}
          <div className="space-y-2">
            <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-400" /> 5. Đồng bộ Google Drive cá nhân (Tùy chọn)
            </h4>
            <p className="text-slate-400">
              Bạn có thể bấm nút <strong className="text-blue-300">Google Drive</strong> hoặc <strong className="text-blue-300">"Lưu vào Google Drive"</strong> để tự động đưa file MP3 đã tạo lên thư mục riêng biệt <span className="text-amber-300 font-mono">PA Voice Studio - File MP3</span> trên tài khoản Google Drive cá nhân. Quyền hạn tối thiểu bảo mật (<code className="text-blue-300">drive.file</code>) chỉ cho phép ứng dụng truy cập các file do chính bạn tạo ra từ công cụ này.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition cursor-pointer"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
};
