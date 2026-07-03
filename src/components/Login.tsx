import React, { useState } from 'react';
import { getEmployeeById } from '../lib/firebase';
import { Employee } from '../types';
import { LogIn, Shield, Users, AlertCircle, Sparkles } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: Employee) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [role, setRole] = useState<'employee' | 'admin'>('employee');
  const [employeeCode, setEmployeeCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeCode.trim()) {
      setError('Vui lòng nhập Số điện thoại hoặc Mã đăng nhập');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const empCode = employeeCode.trim().toUpperCase();
      const employee = await getEmployeeById(empCode);

      if (!employee) {
        setError('Số điện thoại hoặc tài khoản này không tồn tại');
        setLoading(false);
        return;
      }

      if (employee.status !== 'active') {
        setError('Tài khoản nhân viên này đã ngừng hoạt động (inactive)');
        setLoading(false);
        return;
      }

      if (role === 'admin' && !employee.isAdmin) {
        setError('Tài khoản này không có quyền Quản trị viên');
        setLoading(false);
        return;
      }

      // Successful login
      localStorage.setItem('gps_attendance_user', JSON.stringify(employee));
      onLoginSuccess(employee);
    } catch (err: any) {
      console.error(err);
      setError('Đã xảy ra lỗi khi kết nối dữ liệu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login_screen" className="flex min-h-screen items-center justify-center bg-slate-50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/50 via-slate-50 to-white px-4 py-12 sm:px-6 lg:px-8 font-sans">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-xl border border-slate-200/80">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm">
            <Sparkles className="h-7 w-7 animate-pulse" id="login_logo" />
          </div>
          <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-900">
            TRUNG TÂM GIÁO DỤC VIỆT BẮC
          </h2>
          <p className="mt-2 text-xs font-medium text-slate-500 tracking-wide uppercase">
             Hệ thống điểm danh GPS thông minh
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1.5 border border-slate-200">
          <button
            type="button"
            id="role_employee_btn"
            onClick={() => { setRole('employee'); setError(null); }}
            className={`flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              role === 'employee'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 border border-indigo-500/10'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Users className="h-4 w-4" />
            Nhân sự
          </button>
          <button
            type="button"
            id="role_admin_btn"
            onClick={() => { setRole('admin'); setError(null); }}
            className={`flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              role === 'admin'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 border border-indigo-500/10'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Shield className="h-4 w-4" />
            Quản trị viên
          </button>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label htmlFor="employee-code" className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Số điện thoại đăng nhập
            </label>
            <input
              id="employee-code"
              name="code"
              type="text"
              required
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              placeholder="Ví dụ: 0912345678"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all"
            />
          </div>

          {error && (
            <div id="login_error" className="flex items-start gap-2.5 rounded-xl bg-red-50 p-3.5 text-xs text-red-700 border border-red-100">
              <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              id="login_submit_btn"
              className="group relative flex w-full justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-550 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-indigo-750 transition-all cursor-pointer shadow-lg shadow-indigo-600/10"
            >
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <LogIn className="h-4.5 w-4.5 text-indigo-200 group-hover:text-white transition-colors" />
              </span>
              {loading ? 'Đang xác thực...' : 'Đăng nhập'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
