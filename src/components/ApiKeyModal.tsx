import React, { useState, useEffect } from 'react';
import { X, Key, Check, ShieldCheck, ExternalLink, AlertTriangle, Trash2, Eye, EyeOff } from 'lucide-react';
import { getSavedApiKey, saveApiKey, clearApiKey } from '../utils/apiKeyManager';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyChanged: (hasCustomKey: boolean) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  onKeyChanged,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setApiKey(getSavedApiKey());
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveApiKey(apiKey);
    setSavedSuccess(true);
    onKeyChanged(!!apiKey.trim());
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleClear = () => {
    clearApiKey();
    setApiKey('');
    onKeyChanged(false);
  };

  const hasKey = !!apiKey.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Cấu Hình Khóa Gemini API Cá Nhân</h3>
              <p className="text-xs text-slate-400">Tùy chọn dành cho người dùng tự cấp API Key</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Explain info */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 text-xs space-y-2.5 text-slate-300">
          <div className="flex items-center gap-2 text-amber-400 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Tại sao cần tính năng này khi chia sẻ/publish ứng dụng?</span>
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            Khi bạn chia sẻ hoặc publish ứng dụng này cho người khác sử dụng, họ có thể nhập API Key riêng của mình tại đây. Mọi yêu cầu dịch thuật và tạo âm thanh sẽ sử dụng hạn mức API của chính họ, hoàn toàn không tiêu tốn hay làm nghẽn quota của bạn.
          </p>
          <div className="flex items-center gap-2 pt-1 text-[11px] text-amber-300/90">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Mô hình giọng nói Gemini TTS miễn phí có hạn ngạch 3 RPM (3 lượt/phút). Ứng dụng đã cài đặt chế độ giãn cách 20 giây giữa mỗi lần tạo để đảm bảo luôn hoạt động ổn định.</span>
          </div>
        </div>

        {/* Key input */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Gemini API Key của bạn:</span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
            >
              Lấy key miễn phí tại Google AI Studio <ExternalLink className="w-3 h-3" />
            </a>
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-400 rounded-xl px-4 py-2.5 pr-10 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none transition"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-slate-500">
            {hasKey
              ? 'Khóa được mã hóa và lưu trữ cục bộ trong trình duyệt máy tính của bạn.'
              : 'Nếu để trống, ứng dụng sẽ sử dụng API Key mặc định của máy chủ hệ thống (nếu có).'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <div>
            {hasKey && (
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-xl hover:bg-rose-950/30 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa khóa & Dùng mặc định</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Đã lưu thành công!</span>
                </>
              ) : (
                <span>Lưu cấu hình</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
