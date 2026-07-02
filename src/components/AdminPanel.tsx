import React, { useState } from 'react';
import { Employee } from '../types';
import LocationManager from './LocationManager';
import EmployeeManager from './EmployeeManager';
import AttendanceLogs from './AttendanceLogs';
import Reports from './Reports';
import { resetDatabase } from '../lib/firebase';
import { MapPin, Users, FileText, PieChart, LogOut, Shield, ChevronRight, RefreshCw, AlertTriangle } from 'lucide-react';

interface AdminPanelProps {
  adminUser: Employee;
  onLogout: () => void;
}

type TabType = 'locations' | 'employees' | 'logs' | 'reports';

export default function AdminPanel({ adminUser, onLogout }: AdminPanelProps) {
  const isSuperAdmin = adminUser.id.toUpperCase() === 'ADMIN';
  const [activeTab, setActiveTab] = useState<TabType>(isSuperAdmin ? 'locations' : 'employees');
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleResetDatabase = async () => {
    if (!isSuperAdmin) return;
    setIsResetting(true);
    try {
      await resetDatabase();
      // Clear localStorage session to force clean re-login with the updated user data
      localStorage.removeItem('gps_attendance_user');
      window.location.reload();
    } catch (error) {
      console.error('Error resetting database:', error);
      alert('Đã xảy ra lỗi khi xóa dữ liệu.');
    } finally {
      setIsResetting(false);
      setShowResetModal(false);
    }
  };

  const allTabs = [
    {
      id: 'locations' as TabType,
      label: 'Quản lý Địa điểm',
      icon: MapPin,
      description: 'Cấu hình văn phòng, tọa độ GPS & bán kính hợp lệ'
    },
    {
      id: 'employees' as TabType,
      label: 'Quản lý Nhân sự',
      icon: Users,
      description: 'Quản lý hồ sơ nhân viên, trạng thái hoạt động & phân quyền'
    },
    {
      id: 'logs' as TabType,
      label: 'Lịch sử Điểm danh',
      icon: FileText,
      description: 'Theo dõi chi tiết nhật ký check-in/out của tất cả nhân sự'
    },
    {
      id: 'reports' as TabType,
      label: 'Thống kê & Báo cáo',
      icon: PieChart,
      description: 'Báo cáo nhân viên vắng mặt, tỷ lệ chuyên cần hôm nay'
    }
  ];

  const visibleTabs = allTabs.filter(tab => isSuperAdmin || tab.id !== 'locations');

  return (
    <div id="admin_panel" className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* Top Header Navigation */}
      <header className="bg-white/80 border-b border-slate-200/80 sticky top-0 z-20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo/Title */}
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shadow-sm">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight text-slate-900 leading-none">CHẤM CÔNG VIỆT BẮC</h1>
                <p className="text-[9px] font-extrabold text-indigo-600 tracking-widest uppercase mt-0.5">ADMIN PORTAL</p>
              </div>
            </div>

            {/* Admin User Info & Logout */}
            <div className="flex items-center gap-2.5 sm:gap-4">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-bold text-slate-700">{adminUser.fullName}</div>
                <div className="text-[10px] text-slate-400 font-mono">
                  ID: {adminUser.id} {!isSuperAdmin && <span className="text-indigo-600 font-sans font-bold">(Staff Admin)</span>}
                </div>
              </div>

              {isSuperAdmin && (
                <button
                  onClick={() => setShowResetModal(true)}
                  id="admin_reset_db_btn"
                  className="flex items-center gap-1.5 py-1.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-xl border border-amber-200 transition-all cursor-pointer"
                  title="Xóa sạch toàn bộ dữ liệu và khôi phục chỉ 1 tài khoản Admin"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="hidden xs:inline">Reset DB</span>
                </button>
              )}

              <button
                onClick={onLogout}
                id="admin_logout_btn"
                className="flex items-center gap-1.5 py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl border border-red-200/50 transition-all cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 mb-8 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-sm">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col sm:flex-row items-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10 border border-indigo-550/10'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="text-center sm:text-left">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Tab Panel */}
        <div className="bg-transparent">
          {activeTab === 'locations' && isSuperAdmin && <LocationManager />}
          {activeTab === 'employees' && <EmployeeManager currentAdmin={adminUser} />}
          {activeTab === 'logs' && <AttendanceLogs />}
          {activeTab === 'reports' && <Reports />}
        </div>
      </main>

      {/* Humble footer */}
      <footer className="bg-white border-t border-slate-150 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-400 font-mono">
          Hệ thống Quản lý Điểm danh GPS • Powered by Firebase Firestore
        </div>
      </footer>

      {/* Database Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
            onClick={() => !isResetting && setShowResetModal(false)}
          />
          
          {/* Content Card */}
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-6 z-10 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 shrink-0">
                <AlertTriangle className="h-6 w-6 animate-bounce" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Xác nhận Khởi tạo lại Hệ thống?</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Hành động này sẽ <strong className="text-red-600">XÓA SẠCH HOÀN TOÀN</strong> toàn bộ thông tin địa điểm làm việc, danh sách nhân sự khác, và tất cả nhật ký điểm danh (check-in/out) hiện có trên cơ sở dữ liệu Firestore.
                </p>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Hệ thống sẽ được khởi tạo lại với duy nhất <strong className="text-indigo-600">01 tài khoản Quản trị viên (ADMIN)</strong> để đăng nhập.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setShowResetModal(false)}
                className="py-2 px-4 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              
              <button
                type="button"
                disabled={isResetting}
                onClick={handleResetDatabase}
                className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-red-600/10 flex items-center gap-1.5 disabled:opacity-80"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  'Đồng ý xóa & Reset'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
