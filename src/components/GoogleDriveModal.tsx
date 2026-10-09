import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  CheckCircle2,
  FolderOpen,
  ExternalLink,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Loader2,
  FileAudio,
  LogOut,
  HardDrive,
  ShieldCheck,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  googleSignIn,
  googleSignOut,
  getOrCreateAppFolder,
  listAppDriveFiles,
  deleteDriveFile,
  DriveFileInfo,
  DriveFolderInfo,
} from '../services/googleDriveService';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  accessToken: string | null;
  onAuthChange: (user: User | null, token: string | null) => void;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  accessToken,
  onAuthChange,
  onShowToast,
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isLoadingFolder, setIsLoadingFolder] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [appFolder, setAppFolder] = useState<DriveFolderInfo | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFileInfo[]>([]);
  
  // Destructive action state for explicit confirmation dialog
  const [fileToDelete, setFileToDelete] = useState<DriveFileInfo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load folder & files whenever accessToken is present
  useEffect(() => {
    if (!isOpen || !accessToken) return;

    let isMounted = true;

    const loadDriveData = async () => {
      try {
        setIsLoadingFolder(true);
        const folder = await getOrCreateAppFolder(accessToken);
        if (!isMounted) return;
        setAppFolder(folder);

        setIsLoadingFiles(true);
        const files = await listAppDriveFiles(accessToken, folder.id);
        if (!isMounted) return;
        setDriveFiles(files);
      } catch (err: any) {
        console.error('Lỗi tải dữ liệu Drive:', err);
        if (isMounted) {
          onShowToast('Không thể đồng bộ với Google Drive: ' + (err.message || ''), 'error');
        }
      } finally {
        if (isMounted) {
          setIsLoadingFolder(false);
          setIsLoadingFiles(false);
        }
      }
    };

    loadDriveData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, accessToken]);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      const { user, accessToken: token } = await googleSignIn();
      onAuthChange(user, token);
      onShowToast(`Đã liên kết Google Drive với tài khoản: ${user.email}`, 'success');
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        onShowToast('Đăng nhập Google thất bại: ' + (err.message || 'Lỗi không xác định'), 'error');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await googleSignOut();
      onAuthChange(null, null);
      setAppFolder(null);
      setDriveFiles([]);
      onShowToast('Đã ngắt kết nối Google Drive.', 'info');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const handleRefreshFiles = async () => {
    if (!accessToken) return;
    try {
      setIsLoadingFiles(true);
      const folderId = appFolder?.id;
      const files = await listAppDriveFiles(accessToken, folderId);
      setDriveFiles(files);
      onShowToast('Đã làm mới danh sách file trên Google Drive', 'info');
    } catch (err: any) {
      onShowToast('Lỗi làm mới file: ' + err.message, 'error');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete || !accessToken) return;
    try {
      setIsDeleting(true);
      await deleteDriveFile(accessToken, fileToDelete.id);
      setDriveFiles((prev) => prev.filter((f) => f.id !== fileToDelete.id));
      onShowToast(`Đã xóa file "${fileToDelete.name}" khỏi Google Drive`, 'success');
      setFileToDelete(null);
    } catch (err: any) {
      onShowToast('Lỗi khi xóa file: ' + err.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatFileSize = (bytesStr?: string) => {
    if (!bytesStr) return '—';
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes)) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-emerald-500/20 border border-blue-500/30 text-blue-400">
              <Cloud className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Liên kết Google Drive
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  Tùy chọn
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Tự động lưu và đồng bộ các file thông báo MP3 thẳng vào Google Drive của bạn
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {!currentUser ? (
            /* Not logged in State */
            <div className="space-y-5">
              <div className="p-5 rounded-xl bg-slate-800/50 border border-slate-700/80 space-y-4">
                <div className="flex items-start gap-3">
                  <HardDrive className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h3 className="font-semibold text-slate-200">
                      Lưu trữ file MP3 an toàn trên đám mây
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Khi liên kết với Google Drive, bạn có thể:
                    </p>
                    <ul className="text-xs text-slate-300 space-y-1.5 pt-1.5 list-disc list-inside">
                      <li>
                        Tự động gom tất cả file âm thanh MP3 vào thư mục riêng biệt{' '}
                        <strong className="text-amber-300">PA Voice Studio - File MP3</strong> trên Drive.
                      </li>
                      <li>
                        Chia sẻ link phát thanh cho đồng nghiệp, ban quản lý ca trực hoặc mở trực tiếp trên điện thoại/máy tính bảng.
                      </li>
                      <li>
                        Quyền hạn tối thiểu bảo mật: Ứng dụng chỉ có quyền đọc/ghi các file và thư mục do chính ứng dụng tạo ra.
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="pt-2 flex flex-col items-center justify-center">
                  {/* Official Google Sign In Button */}
                  <button
                    type="button"
                    onClick={handleSignIn}
                    disabled={isSigningIn}
                    className="flex items-center gap-3 px-5 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-medium shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 48 48">
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                    </svg>
                    <span>{isSigningIn ? 'Đang mở cửa sổ đăng nhập...' : 'Đăng nhập với Google'}</span>
                  </button>
                  <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Bảo mật tuyệt đối qua Google OAuth với quyền hạn tối thiểu (drive.file)
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Logged in State */
            <div className="space-y-6">
              {/* Account summary banner */}
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || 'Google User'}
                      className="w-11 h-11 rounded-full border border-blue-400/40"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-blue-600/30 flex items-center justify-center text-blue-400 font-bold border border-blue-500/30">
                      {(currentUser.displayName || currentUser.email || 'G')[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100">
                        {currentUser.displayName || 'Tài khoản Google'}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" /> Đã kết nối
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{currentUser.email}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-700 hover:border-rose-500/30 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Đăng xuất</span>
                </button>
              </div>

              {/* Dedicated App Folder Card */}
              <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <FolderOpen className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-blue-200">Thư mục trên Google Drive</div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      {appFolder?.name || 'PA Voice Studio - File MP3'}
                      {isLoadingFolder && <Loader2 className="w-3 h-3 animate-spin text-blue-400" />}
                    </div>
                  </div>
                </div>

                {appFolder?.webViewLink && (
                  <a
                    href={appFolder.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition"
                  >
                    <span>Mở thư mục trên Drive</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Saved Files Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      File âm thanh đã lưu trên Drive ({driveFiles.length})
                    </h4>
                    {isLoadingFiles && <Loader2 className="w-3 h-3 animate-spin text-amber-400" />}
                  </div>

                  <button
                    type="button"
                    onClick={handleRefreshFiles}
                    disabled={isLoadingFiles}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                    <span>Làm mới</span>
                  </button>
                </div>

                {driveFiles.length === 0 ? (
                  <div className="p-8 text-center rounded-xl bg-slate-800/30 border border-dashed border-slate-700/60 text-slate-500 text-xs">
                    Chưa có file âm thanh nào được lưu vào thư mục Drive này.
                    <br />
                    Hãy dùng nút <span className="text-amber-400 font-semibold">"Lưu vào Google Drive"</span> ở thanh xuất âm thanh hoặc các thẻ kịch bản để tải file lên.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {driveFiles.map((file) => (
                      <div
                        key={file.id}
                        className="p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800/80 border border-slate-700/60 flex items-center justify-between gap-3 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 flex-shrink-0">
                            <FileAudio className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-200 truncate" title={file.name}>
                              {file.name}
                            </p>
                            <p className="text-[11px] text-slate-500 flex items-center gap-2">
                              <span>{formatDate(file.createdTime)}</span>
                              <span>•</span>
                              <span>{formatFileSize(file.size)}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {file.webViewLink && (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition"
                              title="Xem/Nghe trên Google Drive"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => setFileToDelete(file)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                            title="Xóa file khỏi Google Drive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs text-slate-500">
          <span>Google Drive API v3 • Quyền hạn tối thiểu drive.file</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-medium cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Mandatory Destructive Action Confirmation Modal */}
      {fileToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Xác nhận xóa file từ Google Drive?</h3>
                <p className="text-xs text-slate-400">
                  Hành động này sẽ xóa vĩnh viễn file sau đây khỏi Google Drive của bạn:
                </p>
                <p className="text-xs font-semibold text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded-lg p-2.5 mt-2 break-all">
                  {fileToDelete.name}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/30 transition cursor-pointer disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDeleting ? 'Đang xóa...' : 'Đồng ý xóa'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
