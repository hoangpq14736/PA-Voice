import React, { useState } from 'react';
import { X, Sparkles, Loader2, Wand2, MapPin, AlertCircle } from 'lucide-react';
import { LanguageCode } from '../types';
import { getApiHeaders } from '../utils/apiKeyManager';

interface AiScriptGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyScripts: (scripts: Record<LanguageCode, string>, title: string) => void;
}

export const AiScriptGeneratorModal: React.FC<AiScriptGeneratorModalProps> = ({
  isOpen,
  onClose,
  onApplyScripts,
}) => {
  const [topic, setTopic] = useState('');
  const [location, setLocation] = useState('Khu vực sân khấu & Sảnh sự kiện');
  const [tone, setTone] = useState('Trang trọng, ấm áp và rõ ràng');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const quickPrompts = [
    'Thông báo chương trình biểu diễn bắt đầu sau 15 phút tại khán đài chính',
    'Tìm bé trai 6 tuổi, mặc áo thun đỏ, đi giày thể thao trắng tại sảnh chính',
    'Nhắc nhở du khách không sử dụng flycam / thiết bị bay tại khu vực sự kiện',
    'Mở thêm cửa kiểm soát số 3 & 4 để hỗ trợ khách di chuyển vào sảnh nhanh chóng',
    'Cảnh báo thời tiết mưa gió, tạm hoãn các hoạt động ngoài trời trong 15 phút',
  ];

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Vui lòng nhập nội dung hoặc tình huống cần phát thanh');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          topic,
          location,
          tone,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Không thể tạo kịch bản lúc này');
      }

      const data = await res.json();
      const scripts: Record<LanguageCode, string> = {
        vi: data.vi || topic,
        en: data.en || '',
        ko: data.ko || '',
        zh: data.zh || '',
        ru: data.ru || '',
      };

      onApplyScripts(scripts, data.title || topic.slice(0, 40));
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra khi gọi trợ lý AI. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">
                Soạn Kịch Bản Phát Thanh Đa Ngữ Tự Động (AI)
              </h3>
              <p className="text-xs text-slate-400">
                Nhập tình huống thực tế, AI tự động dịch & chuẩn hóa 5 thứ tiếng chuyên nghiệp
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

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Nội dung tình huống cần phát thanh qua loa *
            </label>
            <textarea
              rows={3}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ví dụ: Thông báo bắt đầu đón khách vào khán đài show Kiss of the Sea sớm 15 phút hoặc tìm người đánh rơi ví..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition resize-none"
            />
          </div>

          {/* Quick situation samples */}
          <div>
            <span className="text-[11px] font-medium text-slate-400 mb-1.5 block">
              Gợi ý tình huống mẫu cho phát thanh công cộng:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setTopic(q)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-700/60 transition text-left cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-amber-400" /> Khu vực phát thanh
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none cursor-pointer"
              >
                <option value="Sân khấu chính & Khán đài sự kiện">Sân khấu chính & Khán đài</option>
                <option value="Khu vực sảnh đón & Cửa kiểm soát vé">Khu vực sảnh đón & Cửa vào</option>
                <option value="Khuôn viên vui chơi & Không gian công cộng">Khuôn viên tham quan & Công cộng</option>
                <option value="Trạm đón xe & Bãi đỗ xe trung chuyển">Trạm xe & Bãi đỗ xe</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Âm điệu phát thanh
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none cursor-pointer"
              >
                <option value="Trang trọng, ấm áp và rõ ràng">Trang trọng, ấm áp (Chuẩn resort)</option>
                <option value="Vui tươi, sôi động và chào đón">Vui tươi, sôi động (Trước giờ Show)</option>
                <option value="Nhẹ nhàng, thư giãn ngắm hoàng hôn">Nhẹ nhàng, thư giãn (Cầu Hôn)</option>
                <option value="Khẩn cấp, dứt khoát và rõ ràng">Khẩn cấp, dứt khoát (An toàn / Trẻ lạc)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading || !topic.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-lg shadow-amber-500/20 transition cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang khởi tạo 5 ngôn ngữ...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>Tạo Kịch Bản 5 Ngôn Ngữ</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
