import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Clock, AlertCircle } from 'lucide-react';
import { CheckinLog } from '../types';

interface AttendanceCalendarProps {
  logs: CheckinLog[];
  shifts: string[];
}

const getDayOfWeekVN = (date: Date): string => {
  const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  return days[date.getDay()];
};

export default function AttendanceCalendar({ logs, shifts }: AttendanceCalendarProps) {
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); // 0-indexed

  // Navigation handlers
  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  // Get total check-ins in the selected month
  const monthlyCheckinCount = logs.filter(log => {
    if (log.type !== 'checkin' || log.status !== 'success') return false;
    const logDate = new Date(log.timestamp);
    return logDate.getFullYear() === year && logDate.getMonth() === month;
  }).length;

  // Generate calendar days
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // In VN, calendar often starts on Monday (Thứ Hai)
  // getDay() returns 0 for Sunday, 1 for Monday...
  // Convert so Monday is 0, Sunday is 6
  const getVNStartDay = (date: Date) => {
    const day = date.getDay();
    return day === 0 ? 6 : day - 1;
  };

  const startOffset = getVNStartDay(firstDayOfMonth);
  const daysInMonth = lastDayOfMonth.getDate();

  const calendarDays: (Date | null)[] = [];
  // Fill offset days with null
  for (let i = 0; i < startOffset; i++) {
    calendarDays.push(null);
  }
  // Fill actual days
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(new Date(year, month, i));
  }

  // Get logs for a specific day
  const getLogsForDay = (date: Date) => {
    return logs.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate.getFullYear() === date.getFullYear() &&
             logDate.getMonth() === date.getMonth() &&
             logDate.getDate() === date.getDate() &&
             log.status === 'success';
    });
  };

  // Check if a day has any check-in
  const hasCheckinOnDay = (date: Date) => {
    return logs.some(log => {
      if (log.type !== 'checkin' || log.status !== 'success') return false;
      const logDate = new Date(log.timestamp);
      return logDate.getFullYear() === date.getFullYear() &&
             logDate.getMonth() === date.getMonth() &&
             logDate.getDate() === date.getDate();
    });
  };

  // Modal info for selected day
  const renderDetailModal = () => {
    if (!selectedDay) return null;

    const dayLogs = getLogsForDay(selectedDay);
    const checkins = dayLogs.filter(l => l.type === 'checkin');
    const totalCong = checkins.length.toFixed(1); // Calculate Công based on successful check-ins

    // Find all unique shifts of this day
    const dayShifts = Array.from(new Set([
      ...(shifts || []),
      ...dayLogs.map(l => l.shift).filter(Boolean)
    ])) as string[];

    // Sort chronologically
    dayShifts.sort((a, b) => {
      const [hA, mA] = a.split(':').map(Number);
      const [hB, mB] = b.split(':').map(Number);
      return (hA * 60 + mA) - (hB * 60 + mB);
    });

    const formattedDayTitle = `${getDayOfWeekVN(selectedDay)}, ${selectedDay.getDate()}/${selectedDay.getMonth() + 1}`;

    return (
      <div 
        id="calendar_detail_modal" 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm animate-in fade-in duration-150"
      >
        <div 
          className="absolute inset-0" 
          onClick={() => setSelectedDay(null)}
        />
        
        {/* Modal Container */}
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] z-10 animate-in zoom-in-95 duration-150 overflow-hidden">
          
          {/* STICKY HEADER */}
          <div className="sticky top-0 bg-slate-50 border-b border-slate-150 px-5 py-4 flex justify-between items-center z-20 shadow-sm">
            <div className="space-y-0.5">
              <h4 className="text-sm font-black text-slate-900 tracking-tight">
                {formattedDayTitle}
              </h4>
              <p className="text-xs text-indigo-700 font-extrabold flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                <span>Tổng cộng: <strong className="font-mono text-sm">{totalCong}</strong> Công</span>
              </p>
            </div>
            
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              id="close_calendar_modal_btn"
              className="p-2.5 bg-white text-slate-450 hover:text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition-all cursor-pointer flex items-center justify-center"
              title="Đóng chi tiết"
            >
              <X className="h-5 w-5 stroke-[2.5]" />
            </button>
          </div>

          {/* SCROLLABLE CONTENT */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">
              Nhật ký điểm danh chi tiết theo Ca
            </div>

            {dayShifts.map((shiftTime, idx) => {
              const checkinLog = dayLogs.find(l => l.type === 'checkin' && l.shift === shiftTime);
              const checkoutLog = dayLogs.find(l => l.type === 'checkout' && l.shift === shiftTime);

              if (checkinLog) {
                const checkInTime = new Date(checkinLog.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                const checkOutTime = checkoutLog 
                  ? new Date(checkoutLog.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) 
                  : 'Chưa Check-out';

                return (
                  <div 
                    key={shiftTime}
                    className="p-4 rounded-xl border-2 border-red-100 bg-red-50/20 text-slate-800 space-y-2 transition-all relative overflow-hidden"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 animate-ping" />
                        <span className="text-xs font-black text-red-700 uppercase tracking-tight">
                          Ca {idx + 1} ({shiftTime})
                        </span>
                      </div>
                      <span className="text-[10px] font-extrabold bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                        Đã Làm Việc
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                      <div className="bg-white/80 p-2 border border-slate-100 rounded-lg">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider mb-0.5">Giờ vào</span>
                        <span className="font-mono font-extrabold text-red-600">{checkInTime}</span>
                        {checkinLog.isLate && (
                          <span className="text-[9px] text-amber-700 block font-medium mt-0.5">⚠️ Đi muộn</span>
                        )}
                      </div>
                      <div className="bg-white/80 p-2 border border-slate-100 rounded-lg">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider mb-0.5">Giờ ra</span>
                        <span className={`font-mono font-extrabold ${checkoutLog ? 'text-indigo-600' : 'text-slate-400 italic'}`}>
                          {checkOutTime}
                        </span>
                      </div>
                    </div>

                    {checkinLog.isTemporary && (
                      <div className="text-[10px] text-indigo-800 bg-indigo-50 border border-indigo-100 rounded p-1.5 font-medium">
                        📍 {checkinLog.note || 'Địa điểm tạm thời'}
                      </div>
                    )}
                  </div>
                );
              } else {
                return (
                  <div 
                    key={shiftTime}
                    className="p-3.5 rounded-xl border border-slate-200/60 bg-slate-50/50 text-slate-400 space-y-1 opacity-65 transition-all"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500">
                        Ca {idx + 1} ({shiftTime})
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Nghỉ / Không làm
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 italic">
                      Không có lịch làm hoặc không ghi nhận điểm danh ca này
                    </p>
                  </div>
                );
              }
            })}

            {dayShifts.length === 0 && (
              <div className="py-8 text-center text-slate-400 italic text-xs bg-slate-50 rounded-xl border border-slate-150">
                Văn phòng chưa thiết lập ca hoạt động nào.
              </div>
            )}
          </div>

          {/* MODAL FOOTER */}
          <div className="border-t border-slate-100 p-4 bg-slate-50/80 flex justify-end">
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              className="w-full py-2.5 bg-slate-850 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer text-center"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Banner: Check-in statistics */}
      <div className="bg-indigo-50 border border-indigo-150 rounded-2xl p-4.5 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
            Thống kê Tháng {month + 1}/{year}
          </div>
          <p className="text-xs text-slate-700 font-medium">
            Bạn đã hoàn thành <strong className="text-indigo-800 font-extrabold text-sm font-mono">{monthlyCheckinCount}</strong> ca điểm danh thành công.
          </p>
        </div>
        <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black shadow-inner">
          {monthlyCheckinCount}
        </div>
      </div>

      {/* Calendar Interface */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4.5 shadow-sm space-y-4">
        {/* Navigation Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <CalendarIcon className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-850 uppercase tracking-tight">
                Lịch sử tháng {month + 1} năm {year}
              </h3>
              <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">
                Chạm bất kỳ ngày nào để xem chi tiết
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-550 hover:text-slate-800 border border-slate-150 transition-all cursor-pointer"
              title="Tháng trước"
            >
              <ChevronLeft className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-550 hover:text-slate-800 border border-slate-150 transition-all cursor-pointer"
              title="Tháng sau"
            >
              <ChevronRight className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Calendar Days Headers */}
        <div className="grid grid-cols-7 gap-1 text-center border-b border-slate-100 pb-2">
          {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => (
            <span key={day} className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              {day}
            </span>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="aspect-square bg-slate-50/30 rounded-xl" />;
            }

            const dayNum = day.getDate();
            const isTodayDate = day.getDate() === new Date().getDate() &&
                                day.getMonth() === new Date().getMonth() &&
                                day.getFullYear() === new Date().getFullYear();
            const checkedIn = hasCheckinOnDay(day);

            return (
              <button
                key={`day-${dayNum}`}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`aspect-square flex flex-col items-center justify-center rounded-xl border relative transition-all group cursor-pointer ${
                  isTodayDate 
                    ? 'border-indigo-600 bg-indigo-50/10 hover:bg-indigo-50/30' 
                    : checkedIn
                      ? 'border-slate-150 bg-slate-50/40 hover:bg-slate-100/50'
                      : 'border-slate-100 hover:bg-slate-50'
                }`}
              >
                {/* Day number */}
                <span className={`text-xs font-extrabold ${
                  isTodayDate ? 'text-indigo-600 scale-105' : 'text-slate-700'
                }`}>
                  {dayNum}
                </span>

                {/* Dot marker below */}
                {checkedIn ? (
                  <span className="absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Details Popup */}
      {renderDetailModal()}
    </div>
  );
}
