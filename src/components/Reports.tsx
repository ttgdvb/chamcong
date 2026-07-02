import React, { useState, useEffect } from 'react';
import { Employee, Location, CheckinLog } from '../types';
import { getAllEmployees, getAllLocations, getAllLogs } from '../lib/firebase';
import { Users, CheckCircle, AlertTriangle, Calendar, UserX, MapPin, RefreshCw } from 'lucide-react';

export default function Reports() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [logs, setLogs] = useState<CheckinLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const [empData, locData, logData] = await Promise.all([
        getAllEmployees(),
        getAllLocations(),
        getAllLogs()
      ]);
      setEmployees(empData.filter(e => e.status === 'active')); // Only evaluate active employees
      setLocations(locData);
      setLogs(logData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to check if a timestamp is on the current local day
  const isToday = (timestamp: number) => {
    const d1 = new Date(timestamp);
    const d2 = new Date();
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  // Get list of employees who checked in today successfully
  const checkedInLogsToday = logs
    .filter(log => isToday(log.timestamp) && log.type === 'checkin' && log.status === 'success');

  const checkedInEmpIdsToday = checkedInLogsToday.map(log => log.employeeId);

  // List of employees who did NOT check in today
  const absentEmployees = employees.filter(emp => !checkedInEmpIdsToday.includes(emp.id));

  // Some fun statistics
  const totalActive = employees.length;
  const checkedInCount = totalActive - absentEmployees.length;
  const attendanceRate = totalActive > 0 ? Math.round((checkedInCount / totalActive) * 100) : 0;

  const getLocationName = (locId: string) => {
    const loc = locations.find(l => l.id === locId);
    return loc ? loc.name : 'Chưa phân công';
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Active Employees */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-55 text-indigo-600 rounded-xl border border-indigo-100 shadow-inner">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nhân sự hoạt động</div>
            <div className="text-2xl font-black text-slate-900 font-mono">{totalActive}</div>
          </div>
        </div>

        {/* Checked In Today */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shadow-inner">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Đã điểm danh hôm nay</div>
            <div className="text-2xl font-black text-slate-900 font-mono">
              {checkedInCount} <span className="text-sm font-bold text-slate-400">/ {totalActive}</span>
            </div>
          </div>
        </div>

        {/* Attendance Rate */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-teal-50 text-teal-600 rounded-xl border border-teal-100 shadow-inner">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tỷ lệ đi làm hôm nay</div>
            <div className="text-2xl font-black text-teal-700 font-mono">{attendanceRate}%</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Checked-in List */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-black tracking-tight text-slate-900 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                Đã Điểm danh Hôm nay
              </h3>
              <p className="text-[11px] text-slate-500">
                Nhân sự đã thực hiện Check-in thành công hôm nay
              </p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              Đang tải danh sách...
            </div>
          ) : checkedInLogsToday.length === 0 ? (
            <div className="text-center py-8 bg-slate-55 border border-slate-150 rounded-xl text-slate-450 text-xs italic">
              Chưa có nhân viên nào điểm danh hôm nay.
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {checkedInLogsToday.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/50 border border-slate-150 rounded-xl transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 bg-emerald-55 text-emerald-750 font-mono font-bold text-[9px] rounded border border-emerald-100">
                        {log.employeeId}
                      </span>
                      <h4 className="font-extrabold text-slate-800 text-xs">{log.employeeName || 'Chưa rõ'}</h4>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-slate-500">
                      <span>Lúc: <strong className="text-slate-650 font-mono">{new Date(log.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</strong></span>
                      {log.shift && (
                        <span className="px-1 py-0.2 bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-bold rounded">
                          Ca {log.shift}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-3 flex flex-col items-end gap-1">
                    <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-bold rounded uppercase tracking-wider">
                      Thành công
                    </span>
                    {log.isLate && (
                      <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold rounded">
                        Trễ ca
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Absent List */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-black tracking-tight text-slate-900 flex items-center gap-2">
                <UserX className="h-5 w-5 text-rose-600" />
                Chưa Điểm danh Hôm nay
              </h3>
              <p className="text-[11px] text-slate-500">
                Nhân sự hoạt động chưa thực hiện Check-in hôm nay
              </p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              Đang tải danh sách...
            </div>
          ) : absentEmployees.length === 0 ? (
            <div className="text-center py-8 bg-emerald-50 border border-emerald-100 rounded-xl">
              <CheckCircle className="h-8 w-8 text-emerald-600 mx-auto mb-1 animate-bounce" />
              <p className="text-emerald-800 font-extrabold text-xs">Đã điểm danh đầy đủ 100%!</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {absentEmployees.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/50 border border-slate-150 rounded-xl transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-100 font-mono font-bold text-[9px] rounded">
                        {emp.id}
                      </span>
                      <h4 className="font-extrabold text-slate-800 text-xs">{emp.fullName}</h4>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                      <MapPin className="h-3 w-3 shrink-0 text-rose-500/70" />
                      <span>{getLocationName(emp.locationId)}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-3">
                    <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-150 text-[9px] font-bold rounded uppercase tracking-wider">
                      Vắng mặt
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
