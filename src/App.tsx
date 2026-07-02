import React, { useState, useEffect } from 'react';
import { seedDatabaseIfEmpty, resetDatabase } from './lib/firebase';
import { Employee } from './types';
import Login from './components/Login';
import EmployeeDashboard from './components/EmployeeDashboard';
import AdminPanel from './components/AdminPanel';
import { Sparkles, Shield, Users } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [viewMode, setViewMode] = useState<'employee' | 'admin'>('employee');
  const [appReady, setAppReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Clear all previous info and set up exactly 1 Admin account on first load
        const hasReset = localStorage.getItem('db_reset_v4');
        if (hasReset !== 'true') {
          await resetDatabase();
          localStorage.setItem('db_reset_v4', 'true');
        } else {
          await seedDatabaseIfEmpty();
        }

        // 2. Load stored user session if available
        const storedUser = localStorage.getItem('gps_attendance_user');
        if (storedUser) {
          try {
            const userObj = JSON.parse(storedUser) as Employee;
            setCurrentUser(userObj);
            
            // Default to Admin view if the logged in user is an administrator
            if (userObj.isAdmin) {
              setViewMode('admin');
            } else {
              setViewMode('employee');
            }
          } catch (e) {
            console.error('Failed to restore user session', e);
            localStorage.removeItem('gps_attendance_user');
          }
        }
        setAppReady(true);
      } catch (err: any) {
        console.error('Lỗi khởi tạo ứng dụng:', err);
        setDbError(err.message || String(err));
        setAppReady(true);
      }
    };

    initializeApp();
  }, []);

  const handleLoginSuccess = (user: Employee) => {
    setCurrentUser(user);
    if (user.isAdmin) {
      setViewMode('admin');
    } else {
      setViewMode('employee');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('gps_attendance_user');
    setCurrentUser(null);
    setViewMode('employee');
  };

  if (!appReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <h2 className="text-sm font-semibold text-slate-600 tracking-wider uppercase animate-pulse">
            Đang tải hệ thống Điểm danh GPS...
          </h2>
          <p className="text-xs text-slate-400">Đang đồng bộ Firestore và kết nối tài khoản vệ tinh...</p>
        </div>
      </div>
    );
  }

  // If there's a Firestore Database error (like missing permissions)
  if (dbError) {
    const isPermissionError = dbError.includes('Missing or insufficient permissions') || dbError.includes('permission-denied');
    
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="w-full max-w-2xl bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-xl relative z-10 space-y-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 shrink-0">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100 tracking-tight">
                {isPermissionError ? 'Chưa cấu hình Firestore Rules' : 'Lỗi kết nối Cơ sở dữ liệu'}
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                {isPermissionError 
                  ? 'Database Firestore cá nhân của bạn hiện đang chặn tất cả quyền truy cập đọc/ghi theo mặc định.'
                  : 'Không thể kết nối đến cơ sở dữ liệu Firebase của bạn. Hãy kiểm tra cấu hình config.'}
              </p>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 text-xs font-mono text-red-300 break-all overflow-auto max-h-32">
            <strong>Chi tiết lỗi:</strong> {dbError}
          </div>

          {isPermissionError && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider">
                Hướng dẫn sửa lỗi (Chỉ mất 1 phút):
              </h3>
              
              <ol className="space-y-3 text-sm text-slate-300 list-decimal pl-5">
                <li>
                  Truy cập vào trang quản trị <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline inline-flex items-center gap-0.5">Firebase Console</a>.
                </li>
                <li>
                  Chọn dự án của bạn (<span className="text-emerald-400 font-semibold">chamcong-49621</span>) và click vào <strong className="text-slate-100">Firestore Database</strong> ở thanh bên trái.
                </li>
                <li>
                  Chuyển sang tab <strong className="text-slate-100">Rules</strong> (Quy tắc).
                </li>
                <li>
                  Thay thế toàn bộ nội dung quy tắc cũ bằng đoạn mã dưới đây để cấp quyền truy cập:
                </li>
              </ol>

              {/* Code block */}
              <div className="relative">
                <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 font-mono overflow-x-auto">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}
                </pre>
              </div>

              <div className="flex gap-2 text-xs text-slate-400 bg-slate-800/30 p-3 rounded-lg border border-slate-700/50">
                <Sparkles className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                <p>
                  Sau khi dán xong, nhấn nút <strong className="text-slate-200">Publish</strong> (Xuất bản) màu xanh trên Firebase Console. Quay lại trang này và <strong>F5 tải lại trang</strong> để ứng dụng tự động đồng bộ dữ liệu mẫu!
                </p>
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => window.location.reload()}
              className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-600/25 active:scale-95 cursor-pointer"
            >
              Tải lại ứng dụng (Reload)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Login Screen
  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/40 via-slate-50 to-white text-slate-800 relative">
      {/* Admin Floating Switcher (Only visible for Admin accounts) */}
      {currentUser.isAdmin && (
        <div className="fixed bottom-6 right-6 z-50 bg-white/95 p-1.5 rounded-full shadow-2xl border border-slate-200/80 flex gap-1 backdrop-blur-md">
          <button
            onClick={() => setViewMode('employee')}
            id="toggle_to_employee_view"
            className={`flex items-center gap-1.5 py-2 px-4 rounded-full text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'employee'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
            title="Chuyển sang giao diện chấm công"
          >
            <Users className="h-3.5 w-3.5" />
            Vùng Chấm Công
          </button>
          
          <button
            onClick={() => setViewMode('admin')}
            id="toggle_to_admin_view"
            className={`flex items-center gap-1.5 py-2 px-4 rounded-full text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'admin'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
            title="Chuyển sang giao diện quản trị"
          >
            <Shield className="h-3.5 w-3.5" />
            Trang Quản Trị
          </button>
        </div>
      )}

      {/* Main viewport based on user choices */}
      {viewMode === 'admin' && currentUser.isAdmin ? (
        <AdminPanel adminUser={currentUser} onLogout={handleLogout} />
      ) : (
        <EmployeeDashboard employee={currentUser} onLogout={handleLogout} />
      )}
    </div>
  );
}
