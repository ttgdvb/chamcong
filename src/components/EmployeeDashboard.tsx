import React, { useState, useEffect } from 'react';
import { Employee, Location, CheckinLog } from '../types';
import { getAllLocations, addCheckinLog, getLogsForEmployee, saveLocation } from '../lib/firebase';
import { calculateDistance, formatDistance } from '../lib/geo';
import {
  MapPin,
  Clock,
  LogOut,
  Navigation,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  History,
  Calendar,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface EmployeeDashboardProps {
  employee: Employee;
  onLogout: () => void;
}

export default function EmployeeDashboard({ employee, onLogout }: EmployeeDashboardProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [assignedLoc, setAssignedLoc] = useState<Location | null>(null);
  const [logs, setLogs] = useState<CheckinLog[]>([]);
  const [loading, setLoading] = useState(true);

  // GPS State
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  // Checkin state variables
  const [selectedShift, setSelectedShift] = useState<string>('');
  const [distance, setDistance] = useState<number | null>(null);
  const [inRange, setInRange] = useState(false);
  const [isLate, setIsLate] = useState(false);
  const [lateReason, setLateReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const locData = await getAllLocations();
      setLocations(locData);
      
      const foundLoc = locData.find(l => l.id === employee.locationId);
      if (foundLoc) {
        setAssignedLoc(foundLoc);
        if (foundLoc.shiftStartTimes && foundLoc.shiftStartTimes.length > 0) {
          setSelectedShift(foundLoc.shiftStartTimes[0]);
        }
      }

      const logData = await getLogsForEmployee(employee.id);
      setLogs(logData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch only logs
  const refreshLogs = async () => {
    try {
      const logData = await getLogsForEmployee(employee.id);
      setLogs(logData);
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch Device GPS Location
  const getGPSLocation = () => {
    setGpsLoading(true);
    setGpsError(null);
    setMsg(null);

    if (!navigator.geolocation) {
      setGpsError('Trình duyệt hoặc thiết bị của bạn không hỗ trợ Geolocation.');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setCoords({ latitude, longitude });
        setGpsAccuracy(accuracy);
        setGpsLoading(false);
      },
      (err) => {
        console.error(err);
        let errMsg = 'Không thể định vị GPS. Vui lòng cấp quyền truy cập vị trí.';
        if (err.code === err.PERMISSION_DENIED) {
          errMsg = 'Bạn đã từ chối cấp quyền định vị GPS. Hãy cấp quyền trong cài đặt trình duyệt.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          errMsg = 'Vị trí hiện tại không khả dụng. Hãy bật định vị của thiết bị.';
        } else if (err.code === err.TIMEOUT) {
          errMsg = 'Hết thời gian yêu cầu định vị GPS. Vui lòng thử lại.';
        }
        setGpsError(errMsg);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // Automatically request GPS location on load
  useEffect(() => {
    getGPSLocation();
  }, []);

  // Recalculate distance and late state when GPS coords, assigned location, or selected shift changes
  useEffect(() => {
    if (coords && assignedLoc) {
      const dist = calculateDistance(
        coords.latitude,
        coords.longitude,
        assignedLoc.latitude,
        assignedLoc.longitude
      );
      setDistance(dist);
      setInRange(dist <= assignedLoc.radius);

      // Check if late based on selected shift
      if (selectedShift) {
        const [shiftHour, shiftMin] = selectedShift.split(':').map(Number);
        
        const now = new Date();
        const currentHour = now.getHours();
        const currentMin = now.getMinutes();

        const shiftMinutesTotal = shiftHour * 60 + shiftMin;
        const currentMinutesTotal = currentHour * 60 + currentMin;

        // If current time is past the shift start, mark as late
        setIsLate(currentMinutesTotal > shiftMinutesTotal);
      } else {
        setIsLate(false);
      }
    } else {
      setDistance(null);
      setInRange(false);
      setIsLate(false);
    }
  }, [coords, assignedLoc, selectedShift]);

  // Usability feature: Update 'DYNAMIC-TEST' location to player's current coordinates
  const handleUpdateTestLocationCoords = async () => {
    if (!coords || !assignedLoc) return;
    
    setActionLoading(true);
    try {
      const updatedLoc: Location = {
        ...assignedLoc,
        latitude: coords.latitude,
        longitude: coords.longitude
      };
      
      await saveLocation(updatedLoc);
      setAssignedLoc(updatedLoc);
      
      // Update locations state
      setLocations(prev => prev.map(l => l.id === updatedLoc.id ? updatedLoc : l));
      
      setMsg({
        text: 'Cập nhật vị trí Thử nghiệm thành công! Bạn hiện đang nằm đúng trong bán kính.',
        isError: false
      });
    } catch (err: any) {
      setMsg({ text: 'Lỗi khi cập nhật tọa độ thử nghiệm: ' + err.message, isError: true });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Check-in & Check-out Actions
  const handleLogAttendance = async (type: 'checkin' | 'checkout') => {
    if (!coords || !assignedLoc || !inRange) {
      setMsg({ text: 'Bạn phải nằm trong bán kính cho phép của văn phòng để điểm danh.', isError: true });
      return;
    }

    if (!selectedShift) {
      setMsg({ text: 'Vui lòng chọn ca làm việc trước khi thực hiện điểm danh.', isError: true });
      return;
    }

    if (isLate && type === 'checkin' && !lateReason.trim()) {
      setMsg({ text: 'Vui lòng nhập lý do đi muộn trước khi thực hiện Check-in.', isError: true });
      return;
    }

    setActionLoading(true);
    setMsg(null);

    try {
      const logData = {
        employeeId: employee.id,
        employeeName: employee.fullName,
        locationName: assignedLoc.name,
        timestamp: Date.now(),
        latitude: coords.latitude,
        longitude: coords.longitude,
        status: 'success' as const,
        type,
        distance: distance || 0,
        isLate: type === 'checkin' ? isLate : false,
        lateReason: type === 'checkin' && isLate ? lateReason.trim() : '',
        shift: selectedShift
      };

      await addCheckinLog(logData);
      await refreshLogs();
      
      setMsg({
        text: `${type === 'checkin' ? 'Check-in' : 'Check-out'} ca ${selectedShift} thành công lúc ${new Date().toLocaleTimeString('vi-VN')}!`,
        isError: false
      });
      setLateReason(''); // reset
    } catch (err: any) {
      console.error(err);
      setMsg({ text: 'Lỗi khi ghi nhận điểm danh: ' + err.message, isError: true });
    } finally {
      setActionLoading(false);
    }
  };

  // Helper to format Date
  const formatLogTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' - ' + d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div id="employee_dashboard" className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-850">
      
      {/* Navigation Header */}
      {/* Elegant Header */}
      <header className="bg-white/80 border-b border-slate-200/80 sticky top-0 z-20 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shadow-sm">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-slate-900">CHẤM CÔNG VIỆT BẮC</h1>
              <p className="text-[9px] text-indigo-600 font-bold tracking-widest uppercase">CỔNG THÔNG TIN NHÂN SỰ</p>
            </div>
          </div>

          <button
            onClick={onLogout}
            id="employee_logout_btn"
            className="flex items-center gap-1.5 py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl border border-red-200/60 transition-all cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        
        {/* Profile Card & Office Assignment */}
        <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 rounded-2xl p-6 border border-indigo-600/50 shadow-xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5">
            <div className="space-y-2">
              <span className="inline-block px-2.5 py-0.5 bg-white/15 text-indigo-100 border border-white/25 text-[9px] font-extrabold tracking-widest uppercase rounded-md">
                Mã nhân sự: {employee.id}
              </span>
              <h2 className="text-2xl font-black tracking-tight text-white">{employee.fullName}</h2>
              <div className="flex items-center gap-1.5 text-indigo-100 text-sm">
                <MapPin className="h-4 w-4 text-indigo-200 shrink-0" />
                <span>Nơi làm việc: <strong className="text-white font-bold">{assignedLoc ? assignedLoc.name : 'Chưa gán'}</strong></span>
              </div>
            </div>

            {assignedLoc && (
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 text-xs space-y-1.5 self-stretch sm:self-auto min-w-[240px]">
                <div className="font-extrabold text-indigo-250 uppercase tracking-widest text-[9px] mb-1">CẤU HÌNH VĂN PHÒNG</div>
                <div className="font-medium text-indigo-100 flex justify-between">
                  <span>Tọa độ:</span>
                  <span className="font-mono text-white font-bold">{assignedLoc.latitude.toFixed(4)}, {assignedLoc.longitude.toFixed(4)}</span>
                </div>
                <div className="font-medium text-indigo-100 flex justify-between">
                  <span>Bán kính cho phép:</span>
                  <span className="font-mono text-white font-bold">{assignedLoc.radius}m</span>
                </div>
                <div className="font-medium text-indigo-100 flex justify-between">
                  <span>Ca vào ca:</span>
                  <span className="font-mono text-white font-bold">{assignedLoc.shiftStartTimes.join(' | ')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Background decoration */}
          <div className="absolute right-0 bottom-0 translate-x-8 translate-y-8 h-32 w-32 rounded-full bg-white/5 blur-xl" />
        </div>

        {/* GPS Verification Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Geolocation Status Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                <Navigation className="h-4 w-4 text-indigo-600" />
                Xác thực Vị trí GPS hiện tại
              </h3>
              
              <button
                onClick={getGPSLocation}
                disabled={gpsLoading}
                id="refresh_gps_btn"
                className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-750 border border-slate-200 transition-all cursor-pointer"
                title="Lấy lại vị trí GPS"
              >
                <RefreshCw className={`h-4 w-4 ${gpsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {gpsLoading ? (
              <div className="py-10 text-center space-y-3 bg-slate-50 rounded-xl border border-slate-200/50">
                <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin mx-auto" />
                <p className="text-xs text-slate-500 font-medium">Đang quét sóng GPS vệ tinh...</p>
              </div>
            ) : gpsError ? (
              <div id="gps_error_box" className="p-4 bg-red-50 border border-red-100 rounded-xl space-y-2 text-red-750 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-red-650">
                  <AlertCircle className="h-4 w-4" />
                  <span>Cảnh báo định vị</span>
                </div>
                <p className="text-red-600 leading-relaxed">{gpsError}</p>
                <button
                  onClick={getGPSLocation}
                  className="mt-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-[10px] transition-all cursor-pointer"
                >
                  Thử lại GPS
                </button>
              </div>
            ) : coords ? (
              <div className="space-y-4" id="gps_success_box">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl">
                    <span className="text-[9px] font-extrabold text-slate-400 block uppercase tracking-wider mb-1">VĨ ĐỘ (LAT)</span>
                    <span className="font-mono text-sm font-bold text-slate-700">{coords.latitude.toFixed(6)}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl">
                    <span className="text-[9px] font-extrabold text-slate-400 block uppercase tracking-wider mb-1">KINH ĐỘ (LON)</span>
                    <span className="font-mono text-sm font-bold text-slate-700">{coords.longitude.toFixed(6)}</span>
                  </div>
                </div>

                {gpsAccuracy !== null && (
                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Độ chính xác định vị:</span>
                    <strong className="font-mono text-slate-700 font-extrabold">±{Math.round(gpsAccuracy)} mét</strong>
                  </p>
                )}

                {/* Distance visual indicator */}
                {distance !== null && assignedLoc && (
                  <div className={`p-4 rounded-xl border transition-all ${
                    inRange 
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                      : 'bg-red-50 border-red-100 text-red-800'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold">Khoảng cách tới văn phòng:</span>
                      <span className={`text-base font-black ${inRange ? 'text-emerald-650' : 'text-red-655'}`}>
                        {formatDistance(distance)}
                      </span>
                    </div>

                    <div className="mt-2 flex items-start gap-2 text-xs">
                      {inRange ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                          <p className="text-emerald-700 leading-relaxed">Bạn đã ở <strong>Hợp lệ bên trong</strong> phạm vi văn phòng. Các tác vụ điểm danh hiện đã sẵn sàng.</p>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="font-bold">Bạn đang ở Ngoài bán kính tối đa của văn phòng.</p>
                            <p className="text-[11px] text-red-650">Bạn vui lòng di chuyển lại gần văn phòng để thực hiện điểm danh. (Phạm vi tối đa: {assignedLoc.radius}m).</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500 italic bg-slate-50 rounded-xl border border-slate-150">
                Chưa có dữ liệu GPS. Hãy click nút reload bên trên để bắt đầu định vị.
              </div>
            )}

            {/* Special Test Hack for Developer: Let them align DYNAMIC-TEST to their coordinates */}
            {employee.locationId === 'DYNAMIC-TEST' && coords && assignedLoc && (
              <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-amber-800 font-bold">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  <span>Trình giả lập kiểm thử nhanh GPS</span>
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  Vì bạn đang gán ở văn phòng thử nghiệm, bạn có thể thiết lập tâm địa điểm trùng khớp với tọa độ GPS hiện tại của bạn để kiểm thử Check-in sáng đèn ngay lập tức!
                </p>
                <button
                  type="button"
                  onClick={handleUpdateTestLocationCoords}
                  disabled={actionLoading}
                  className="w-full py-1.5 bg-amber-600 hover:bg-amber-550 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer text-center"
                >
                  Thiết lập văn phòng tại đây (Distance = 0m)
                </button>
              </div>
            )}
          </div>

          {/* Core Check-in / Check-out Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <h3 className="font-extrabold text-slate-800 flex items-center gap-1.5 text-xs uppercase tracking-wider mb-4">
                <Clock className="h-4 w-4 text-indigo-600" />
                Điểm danh ca làm việc
              </h3>

              {/* Shift Selector */}
              {assignedLoc && assignedLoc.shiftStartTimes && assignedLoc.shiftStartTimes.length > 0 && (
                <div className="mb-4">
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">
                    Chọn ca làm việc *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {assignedLoc.shiftStartTimes.map((shift) => {
                      const isSelected = selectedShift === shift;
                      return (
                        <button
                          key={shift}
                          type="button"
                          onClick={() => setSelectedShift(shift)}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                            isSelected 
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' 
                              : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200 text-slate-600'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                          <span>Ca {shift}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Late check warning */}
              {inRange && isLate && (
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl space-y-2 mb-4">
                  <div className="flex items-center gap-1.5 text-amber-850 text-xs font-bold">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span>Hệ thống phát hiện bạn đi muộn</span>
                  </div>
                  <p className="text-[11px] text-amber-700">
                    Thời gian hiện tại đã trễ hơn giờ vào ca ({selectedShift}). Vui lòng điền lý do đi muộn của bạn bên dưới:
                  </p>
                  <input
                    type="text"
                    placeholder="Nhập lý do đi muộn (ví dụ: Kẹt xe, hỏng xe...)"
                    value={lateReason}
                    onChange={(e) => setLateReason(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none text-xs focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              )}

              {/* Status Messages */}
              {msg && (
                <div className={`p-3 text-xs rounded-xl border mb-4 ${
                  msg.isError 
                    ? 'bg-red-50 text-red-750 border-red-100' 
                    : 'bg-emerald-50 text-emerald-800 border-emerald-100'
                }`}>
                  {msg.text}
                </div>
              )}
            </div>

            {/* Attendance Buttons Grid */}
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                disabled={!inRange || actionLoading || (isLate && !lateReason.trim())}
                onClick={() => handleLogAttendance('checkin')}
                id="btn_checkin_submit"
                className={`py-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all text-center border font-bold text-xs select-none cursor-pointer ${
                  inRange
                    ? 'bg-emerald-600 border-emerald-550 text-white hover:bg-emerald-550 hover:shadow-lg hover:shadow-emerald-500/10 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200'
                    : 'bg-slate-100 border-slate-200 text-slate-450 cursor-not-allowed'
                }`}
              >
                <span className="text-xl">📥</span>
                <span>Check-in Vào Ca</span>
              </button>

              <button
                type="button"
                disabled={!inRange || actionLoading}
                onClick={() => handleLogAttendance('checkout')}
                id="btn_checkout_submit"
                className={`py-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all text-center border font-bold text-xs select-none cursor-pointer ${
                  inRange
                    ? 'bg-indigo-600 border-indigo-550 text-white hover:bg-indigo-550 hover:shadow-lg hover:shadow-indigo-500/10 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200'
                    : 'bg-slate-100 border-slate-200 text-slate-450 cursor-not-allowed'
                }`}
              >
                <span className="text-xl">📤</span>
                <span>Check-out Về</span>
              </button>
            </div>

            <p className="text-[9px] text-slate-400 text-center italic mt-2">
              * Nút điểm danh sẽ tự động sáng lên khi GPS định vị bạn ở trong bán kính văn phòng thành công.
            </p>
          </div>

        </div>

        {/* Attendance Log History Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-slate-800 flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <History className="h-4 w-4 text-indigo-600" />
              Lịch sử điểm danh cá nhân
            </h3>
            <span className="text-xs text-slate-500 font-mono">Mã: {employee.id}</span>
          </div>

          {logs.length === 0 ? (
            <div className="py-12 text-center text-slate-500 italic text-xs bg-slate-50 rounded-xl border border-slate-150">
              Bạn chưa thực hiện check-in/out nào trong dữ liệu lưu trữ.
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {logs.map((log) => {
                const isSuccess = log.status === 'success';
                return (
                  <div
                    key={log.id}
                    className="flex justify-between items-center p-3.5 bg-slate-50/50 border border-slate-150 rounded-xl hover:border-slate-200 transition-all text-xs"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          log.type === 'checkin'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        }`}>
                          {log.type === 'checkin' ? 'Check-in' : 'Check-out'}
                        </span>

                        {log.shift && (
                          <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-650 text-[9px] font-bold rounded">
                            Ca {log.shift}
                          </span>
                        )}
                        
                        <span className="font-bold text-slate-800 font-mono">{formatLogTime(log.timestamp)}</span>
                      </div>
                      
                      <div className="text-slate-500 flex flex-wrap gap-x-3 text-[11px]">
                        <span>Khoảng cách: <strong className="text-slate-600">{formatDistance(log.distance)}</strong></span>
                        <span className="font-mono text-slate-400">({log.latitude.toFixed(4)}, {log.longitude.toFixed(4)})</span>
                      </div>
                      
                      {log.isLate && (
                        <div className="flex items-center gap-1 text-[11px] text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded border border-amber-100 w-fit">
                          <span>⚠️ Trễ ca. Lý do: "{log.lateReason || 'Không ghi rõ'}"</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      {isSuccess ? (
                        <span className="flex items-center gap-0.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[9px] rounded-full border border-emerald-100">
                          <CheckCircle2 className="h-3 w-3" />
                          Hợp lệ
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 px-2 py-0.5 bg-red-50 text-red-750 font-bold text-[9px] rounded-full border border-red-100">
                          <AlertCircle className="h-3 w-3" />
                          Ngoài vùng
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>

      {/* Humble Footer */}
      <footer className="bg-white border-t border-slate-150 py-4 mt-auto">
        <div className="max-w-4xl mx-auto px-4 text-center text-xs text-slate-400 font-mono">
          Hệ thống Quản lý Điểm danh GPS • Powered by Firebase Firestore
        </div>
      </footer>
    </div>
  );
}
