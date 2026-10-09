import React from 'react';
import { BroadcastHistoryItem, LanguageCode } from '../types';
import { Bookmark, Clock, Trash2, ArrowUpRight, Radio, Volume2 } from 'lucide-react';

interface SavedRecordingsProps {
  savedItems: BroadcastHistoryItem[];
  onLoadItem: (item: BroadcastHistoryItem) => void;
  onDeleteItem: (id: string) => void;
}

export const SavedRecordings: React.FC<SavedRecordingsProps> = ({
  savedItems,
  onLoadItem,
  onDeleteItem,
}) => {
  if (savedItems.length === 0) return null;

  return (
    <div className="ios-card rounded-[24px] p-5 sm:p-6 space-y-4 border border-white/[0.08]">
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-amber-400" />
          Kịch Bản Đã Lưu Trong Ca Trực ({savedItems.length})
        </h3>
        <span className="text-xs text-slate-500">Lưu cục bộ</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {savedItems.map((item) => {
          const dateStr = new Date(item.timestamp).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={item.id}
              className="bg-black/40 border border-white/[0.08] hover:border-white/[0.18] p-4 rounded-2xl flex flex-col justify-between transition-all duration-200 group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold text-white group-hover:text-amber-300 transition-colors truncate">
                    {item.title}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteItem(item.id);
                    }}
                    className="text-slate-500 hover:text-rose-400 p-1 transition cursor-pointer"
                    title="Xóa kịch bản"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-2 mb-3 leading-relaxed italic">
                  "{item.scripts.vi}"
                </p>
              </div>

              <div className="pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3 text-slate-400" /> {dateStr}
                  {item.duration > 0 && ` • ~${Math.round(item.duration)}s`}
                </span>

                <button
                  type="button"
                  onClick={() => onLoadItem(item)}
                  className="flex items-center gap-1 text-amber-400 hover:text-white font-medium transition-colors cursor-pointer text-xs"
                >
                  <span>Mở lại</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
