import React, { useState, useEffect } from 'react';
import { CheckinLog, Location, Employee } from '../types';
import { getAllLogs, getAllLocations, getAllEmployees } from '../lib/firebase';
import { Calendar, Filter, Search, Clock, MapPin, CheckCircle2, AlertCircle, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { formatDistance } from '../lib/geo';
import * as XLSX from 'xlsx';

const getTodayISO = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AttendanceLogs() {
  const [logs, setLogs] = useState<CheckinLog[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'checkin' | 'checkout' | 'not_checked_in'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error'>('all');
  const [filterLate, setFilterLate] = useState<'all' | 'late'>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>(getTodayISO());
  const [filterEndDate, setFilterEndDate] = useState<string>(getTodayISO());

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const [logsData, locationsData, employeesData] = await Promise.all([
        getAllLogs(),
        getAllLocations(),
        getAllEmployees()
      ]);
      setLogs(logsData || []);
      setLocations(locationsData || []);
      setEmployees(employeesData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to format Date
  const formatDateTime = (timestamp: number) => {
    const d = new Date(timestamp);
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${time} ngày ${date}`;
  };

  const setQuickDateRange = (range: 'today' | 'yesterday' | 'last7days' | 'thismonth' | 'all') => {
    const today = new Date();
    const formatLocalISO = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    switch (range) {
      case 'today': {
        const todayStr = formatLocalISO(today);
        setFilterStartDate(todayStr);
        setFilterEndDate(todayStr);
        break;
      }
      case 'yesterday': {
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const yesterdayStr = formatLocalISO(yesterday);
        setFilterStartDate(yesterdayStr);
        setFilterEndDate(yesterdayStr);
        break;
      }
      case 'last7days': {
        const past = new Date();
        past.setDate(today.getDate() - 6);
        setFilterStartDate(formatLocalISO(past));
        setFilterEndDate(formatLocalISO(today));
        break;
      }
      case 'thismonth': {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        setFilterStartDate(formatLocalISO(firstDay));
        setFilterEndDate(formatLocalISO(today));
        break;
      }
      case 'all': {
        setFilterStartDate('');
        setFilterEndDate('');
        break;
      }
    }
  };

  const filteredLogs = React.useMemo(() => {
    if (filterType === 'not_checked_in') {
      const dates: string[] = [];
      if (filterStartDate && filterEndDate) {
        const start = new Date(filterStartDate + 'T00:00:00');
        const end = new Date(filterEndDate + 'T00:00:00');
        let current = new Date(start);
        let count = 0;
        while (current <= end && count < 31) {
          const y = current.getFullYear();
          const m = String(current.getMonth() + 1).padStart(2, '0');
          const d = String(current.getDate()).padStart(2, '0');
          dates.push(`${y}-${m}-${d}`);
          current.setDate(current.getDate() + 1);
          count++;
        }
      } else if (filterStartDate) {
        dates.push(filterStartDate);
      } else if (filterEndDate) {
        dates.push(filterEndDate);
      } else {
        dates.push(getTodayISO());
      }

      const list: any[] = [];
      dates.forEach(date => {
        employees.forEach(emp => {
          // Skip admins
          if (emp.isAdmin) return;
          // Skip inactive
          if (emp.status === 'inactive') return;
          
          // Filter Location (Cơ sở)
          if (filterLocation !== 'all' && emp.locationId !== filterLocation) {
            return;
          }

          // Search Query
          const queryStr = searchQuery.toLowerCase().trim();
          if (queryStr) {
            const empId = emp.id.toLowerCase();
            const empName = emp.fullName.toLowerCase();
            const locName = (locations.find(l => l.id === emp.locationId)?.name || '').toLowerCase();
            if (!empId.includes(queryStr) && !empName.includes(queryStr) && !locName.includes(queryStr)) {
              return;
            }
          }

          // Check if there is a successful check-in log for this employee on this date
          const hasCheckin = logs.some(log => {
            if (log.employeeId !== emp.id) return false;
            if (log.type !== 'checkin') return false;
            if (log.status !== 'success') return false;
            
            const d = new Date(log.timestamp);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const logDateStr = `${year}-${month}-${day}`;
            
            return logDateStr === date;
          });

          if (!hasCheckin) {
            const [y, m, d] = date.split('-').map(Number);
            const virtualTime = new Date(y, m - 1, d, 17, 30, 0, 0).getTime();
            
            list.push({
              id: `virtual-${emp.id}-${date}`,
              employeeId: emp.id,
              employeeName: emp.fullName,
              timestamp: virtualTime,
              locationName: locations.find(l => l.id === emp.locationId)?.name || 'Chưa rõ',
              type: 'not_checked_in',
              status: 'error',
              distance: 0,
              latitude: 0,
              longitude: 0,
              isLate: false,
              isTemporary: false,
              note: `Chưa Check-in ngày ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`,
              virtualDate: date,
            });
          }
        });
      });

      return list.sort((a, b) => b.timestamp - a.timestamp);
    }

    return logs.filter(log => {
      // 1. Search Query
      const query = searchQuery.toLowerCase().trim();
      if (query) {
        const empId = log.employeeId.toLowerCase();
        const empName = (log.employeeName || '').toLowerCase();
        const locName = (log.locationName || '').toLowerCase();
        if (!empId.includes(query) && !empName.includes(query) && !locName.includes(query)) {
          return false;
        }
      }

      // 2. Filter Type
      if (filterType !== 'all' && log.type !== filterType) {
        return false;
      }

      // 3. Filter Status
      if (filterStatus !== 'all' && log.status !== filterStatus) {
        return false;
      }

      // 4. Filter Late
      if (filterLate === 'late' && !log.isLate) {
        return false;
      }

      // 5. Filter Location (Cơ sở)
      if (filterLocation !== 'all' && log.locationName) {
        const targetLoc = locations.find(l => l.id === filterLocation);
        if (targetLoc && log.locationName !== targetLoc.name) {
          return false;
        }
      }

      // 6. Filter Date range
      if (filterStartDate) {
        const [y, m, d] = filterStartDate.split('-').map(Number);
        const startTs = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
        if (log.timestamp < startTs) {
          return false;
        }
      }

      if (filterEndDate) {
        const [y, m, d] = filterEndDate.split('-').map(Number);
        const endTs = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
        if (log.timestamp > endTs) {
          return false;
        }
      }

      return true;
    });
  }, [logs, locations, employees, searchQuery, filterType, filterStatus, filterLate, filterLocation, filterStartDate, filterEndDate]);

  // Export to Excel function
  const handleExportExcel = () => {
    try {
      const rows = filteredLogs.map((log, index) => {
        const d = new Date(log.timestamp);
        const dateFormatted = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeFormatted = log.type === 'not_checked_in' ? 'Chưa Check-in' : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        return {
          'STT': index + 1,
          'Mã Nhân Viên': log.employeeId,
          'Họ Và Tên': log.employeeName || 'Chưa rõ',
          'Ngày Điểm Danh': dateFormatted,
          'Giờ Điểm Danh': timeFormatted,
          'Loại Tác Vụ': log.type === 'not_checked_in' ? 'Chưa Check-in' : (log.type === 'checkin' ? 'Check-in' : 'Check-out'),
          'Ca Làm Việc': log.shift ? `Ca ${log.shift}` : (log.type === 'not_checked_in' ? 'Chưa Check-in' : 'Không rõ'),
          'Cơ Sở Ghi Nhận': log.locationName || 'Chưa rõ',
          'Trạng Thái Vị Trí': log.type === 'not_checked_in' ? 'Chưa ghi nhận' : (log.status === 'success' ? 'Hợp lệ (Trong bán kính)' : 'Không hợp lệ (Ngoài bán kính)'),
          'Sai Lệch (m)': log.type === 'not_checked_in' ? '' : Math.round(log.distance),
          'Tình Trạng Trễ': log.type === 'not_checked_in' ? 'Chưa Check-in' : (log.isLate ? 'Muộn ca' : 'Đúng giờ'),
          'Lý Do Muộn': log.lateReason || '',
          'Điều Động Tạm Thời': log.isTemporary ? 'Có (Điều động)' : 'Không',
          'Ghi Chú Điều Động': log.note || '',
          'Tọa Độ Ghi Nhận': log.type === 'not_checked_in' ? '' : `${log.latitude}, ${log.longitude}`
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      
      // Auto widths
      const colWidths = [
        { wch: 6 },  // STT
        { wch: 15 }, // Mã NV
        { wch: 25 }, // Họ tên
        { wch: 15 }, // Ngày
        { wch: 15 }, // Giờ
        { wch: 12 }, // Loại
        { wch: 12 }, // Ca
        { wch: 25 }, // Cơ sở
        { wch: 28 }, // Trạng thái
        { wch: 15 }, // Sai lệch
        { wch: 15 }, // Tình trạng
        { wch: 30 }, // Lý do muộn
        { wch: 18 }, // Điều động tạm thời
        { wch: 45 }, // Ghi chú điều động
        { wch: 25 }  // Tọa độ
      ];
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Lịch sử điểm danh');

      // Set nice file name based on selected date ranges
      const dateRangeStr = (filterStartDate && filterEndDate)
        ? `_tu_${filterStartDate}_den_${filterEndDate}`
        : filterStartDate
          ? `_tu_${filterStartDate}`
          : filterEndDate
            ? `_den_${filterEndDate}`
            : '';

      XLSX.writeFile(workbook, `Bao_Cao_Diem_Danh${dateRangeStr}.xlsx`);
    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert('Có lỗi xảy ra khi xuất file Excel. Vui lòng thử lại!');
    }
  };

  // Export shift-based summary to Excel matching mockup
  const handleExportExcelShifts = async () => {
    if (filterLocation === 'all') {
      alert('Vui lòng chọn một Cơ sở / Địa điểm cụ thể ở bộ lọc trước khi xuất file tổng hợp theo ca!');
      return;
    }

    const targetLoc = locations.find(l => l.id === filterLocation);
    if (!targetLoc) {
      alert('Không tìm thấy cơ sở được chọn!');
      return;
    }

    if (!targetLoc.shiftStartTimes || targetLoc.shiftStartTimes.length === 0) {
      alert(`Cơ sở "${targetLoc.name}" chưa được cấu hình ca làm việc nào!`);
      return;
    }

    try {
      setLoading(true);
      const allEmployees = await getAllEmployees();
      
      // Filter active employees belonging to the selected location
      const filteredEmployees = allEmployees
        .filter(emp => emp.locationId === targetLoc.id)
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));

      if (filteredEmployees.length === 0) {
        alert(`Không có nhân viên nào trực thuộc cơ sở "${targetLoc.name}"!`);
        setLoading(false);
        return;
      }

      let reportMonth = new Date().getMonth() + 1;
      let reportYear = new Date().getFullYear();
      if (filterStartDate) {
        const [y, m, d] = filterStartDate.split('-').map(Number);
        reportMonth = m;
        reportYear = y;
      }

      const numDays = new Date(reportYear, reportMonth, 0).getDate();

      // Build AOA (Array of Arrays) representing the grid
      const aoa: any[][] = [];

      // Row 1: Header row 1
      const row1 = ["STT", "Họ và Tên", "Ca"];
      row1.push(`THÁNG ${String(reportMonth).padStart(2, '0')}/${reportYear}`);
      for (let i = 2; i <= numDays; i++) {
        row1.push("");
      }
      aoa.push(row1);

      // Row 2: Header row 2 with day numbers
      const row2: any[] = ["", "", "Tên ca"];
      for (let i = 1; i <= numDays; i++) {
        row2.push(i);
      }
      aoa.push(row2);

      // Merges array
      const merges: any[] = [
        // STT (A1:A2)
        { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
        // Họ và Tên (B1:B2)
        { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
        // Ca (C1:C2)
        { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },
        // THÁNG header (D1:last day)
        { s: { r: 0, c: 3 }, e: { r: 0, c: 3 + numDays - 1 } }
      ];

      // Sort current configured shifts chronologically to map to Ca 1, Ca 2, Ca 3...
      const sortedConfigShifts = [...(targetLoc.shiftStartTimes || [])].sort((a, b) => {
        const [hA, mA] = a.split(':').map(Number);
        const [hB, mB] = b.split(':').map(Number);
        return (hA * 60 + mA) - (hB * 60 + mB);
      });

      // Helper to map log's shift time to closest configured shift index
      const getClosestShiftIndex = (logShift: string, configShifts: string[]): number => {
        if (!configShifts || configShifts.length === 0) return 0;
        const cleanLog = (logShift || '').trim();
        if (!cleanLog) return 0;
        
        const [logH, logM] = cleanLog.split(':').map(Number);
        if (isNaN(logH) || isNaN(logM)) return 0;
        const logMinutes = logH * 60 + logM;
        
        let closestIndex = 0;
        let minDiff = Infinity;
        
        configShifts.forEach((shift, index) => {
          const [sH, sM] = shift.split(':').map(Number);
          if (!isNaN(sH) && !isNaN(sM)) {
            const shiftMinutes = sH * 60 + sM;
            const diff = Math.abs(logMinutes - shiftMinutes);
            if (diff < minDiff) {
              minDiff = diff;
              closestIndex = index;
            }
          }
        });
        
        return closestIndex;
      };

      // Generate employee rows
      filteredEmployees.forEach((emp, empIdx) => {
        const startRow = aoa.length;

        // Get unique shifts from both current configured shifts and employee's historical logs for this month
        const empLogs = logs.filter(log => {
          if (log.employeeId !== emp.id) return false;
          if (log.type !== 'checkin') return false;
          if (log.status !== 'success') return false;
          
          const logDate = new Date(log.timestamp);
          return logDate.getFullYear() === reportYear &&
                 (logDate.getMonth() + 1) === reportMonth;
        });

        const S = sortedConfigShifts.length;
        for (let j = 0; j < S; j++) {
          const shiftName = `Ca ${j + 1}`;

          // We only show STT and Full Name in the first row of each employee (merged later)
          const sttValue = j === 0 ? empIdx + 1 : "";
          const fullNameValue = j === 0 ? emp.fullName : "";

          const rowData = [sttValue, fullNameValue, shiftName];

          // Fill in check-in marker ('x') for each day
          for (let day = 1; day <= numDays; day++) {
            const hasLog = empLogs.some(log => {
              const logDate = new Date(log.timestamp);
              if (logDate.getDate() !== day) return false;

              const logShift = (log.shift || '').trim();
              if (!logShift) return false;

              const closestIndex = getClosestShiftIndex(logShift, sortedConfigShifts);
              return closestIndex === j;
            });

            rowData.push(hasLog ? 'x' : '');
          }

          aoa.push(rowData);
        }

        // Merge STT and Name cells for this employee if S > 1
        if (S > 1) {
          merges.push({ s: { r: startRow, c: 0 }, e: { r: startRow + S - 1, c: 0 } });
          merges.push({ s: { r: startRow, c: 1 }, e: { r: startRow + S - 1, c: 1 } });
        }
      });

      const worksheet = XLSX.utils.aoa_to_sheet(aoa);
      worksheet['!merges'] = merges;

      // Define column widths
      const colWidths: any[] = [
        { wch: 6 },   // STT
        { wch: 22 },  // Họ và tên
        { wch: 12 }   // Tên ca (Ca 1, etc.)
      ];
      for (let i = 1; i <= numDays; i++) {
        colWidths.push({ wch: 4 }); // Narrow column width for day cells
      }
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Bảng chấm công theo ca');

      XLSX.writeFile(workbook, `Bao_Cao_Tong_Hop_Theo_Ca_${targetLoc.code}_Thang_${String(reportMonth).padStart(2, '0')}_${reportYear}.xlsx`);
    } catch (error) {
      console.error('Error exporting shift-based summary:', error);
      alert('Có lỗi xảy ra khi xuất báo cáo theo ca. Vui lòng thử lại!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Lịch sử Điểm danh</h3>
            <p className="text-xs text-slate-500">Xem và xuất báo cáo điểm danh của toàn bộ hệ thống</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={loading || filteredLogs.length === 0}
              className="flex items-center gap-1.5 py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50"
              title="Xuất Excel tổng hợp các bản ghi đang được lọc"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Xuất Excel tổng hợp ({filteredLogs.length})
            </button>

            <button
              onClick={handleExportExcelShifts}
              disabled={loading}
              className="flex items-center gap-1.5 py-2 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50"
              title="Xuất Excel bảng chấm công tổng hợp theo ca của cơ sở được chọn"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Xuất file tổng hợp theo ca
            </button>

            <button
              onClick={fetchLogs}
              disabled={loading}
              className="flex items-center gap-1.5 py-2 px-3.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-850 text-xs font-bold rounded-xl border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Làm mới dữ liệu
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="space-y-4 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-150">
          
          {/* Row 1: Primary Filters & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
            {/* Search Box */}
            <div className="relative">
              <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                Tìm nhân sự / địa điểm
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Mã, tên nhân viên..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs h-[31px]"
                />
              </div>
            </div>

            {/* Filter Location */}
            <div>
              <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                Cơ sở / Địa điểm
              </label>
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs h-[31px] cursor-pointer"
              >
                <option value="all">Tất cả cơ sở</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Start Date */}
            <div>
              <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                Từ ngày
              </label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs h-[31px] cursor-pointer"
              />
            </div>

            {/* Filter End Date */}
            <div>
              <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                Đến ngày
              </label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs h-[31px] cursor-pointer"
              />
            </div>
          </div>

          {/* Quick Dates Selector Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-dashed border-slate-200">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mr-1">
              Chọn nhanh:
            </span>
            <button
              onClick={() => setQuickDateRange('today')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer border ${
                filterStartDate === new Date().toISOString().split('T')[0] && filterEndDate === new Date().toISOString().split('T')[0]
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-bold'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              Hôm nay
            </button>
            <button
              onClick={() => setQuickDateRange('yesterday')}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer border bg-white hover:bg-slate-50 text-slate-600 border-slate-200"
            >
              Hôm qua
            </button>
            <button
              onClick={() => setQuickDateRange('last7days')}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer border bg-white hover:bg-slate-50 text-slate-600 border-slate-200"
            >
              7 ngày qua
            </button>
            <button
              onClick={() => setQuickDateRange('thismonth')}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer border bg-white hover:bg-slate-50 text-slate-600 border-slate-200"
            >
              Tháng này
            </button>
            {(filterStartDate || filterEndDate) && (
              <button
                onClick={() => setQuickDateRange('all')}
                className="px-2 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer border bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
              >
                Xóa lọc ngày
              </button>
            )}
          </div>

          {/* Row 2: Secondary / Advanced Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2 border-t border-slate-200">
            {/* Filter Type */}
            <div>
              <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                Loại tác vụ
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs h-[31px]"
              >
                <option value="all">Tất cả Check-in / Check-out</option>
                <option value="checkin">Chỉ Check-in</option>
                <option value="checkout">Chỉ Check-out</option>
                <option value="not_checked_in">Chưa Check-in</option>
              </select>
            </div>

            {/* Filter Status */}
            <div>
              <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                Trạng thái vị trí
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs h-[31px]"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="success">Hợp lệ (Trong bán kính)</option>
                <option value="error">Không hợp lệ (Ngoài bán kính)</option>
              </select>
            </div>

            {/* Filter Late */}
            <div>
              <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                Đúng giờ / Muộn ca
              </label>
              <select
                value={filterLate}
                onChange={(e) => setFilterLate(e.target.value as any)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs h-[31px]"
              >
                <option value="all">Tất cả</option>
                <option value="late">Chỉ người đi muộn (isLate)</option>
              </select>
            </div>
          </div>

        </div>

        {/* Logs Listing */}
        {loading ? (
          <div className="text-center py-16 text-slate-550 text-xs">
            Đang tải dữ liệu điểm danh...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs italic bg-slate-50 rounded-xl border border-slate-150">
            Không tìm thấy lịch sử điểm danh nào phù hợp.
          </div>
        ) : (
          <div className="overflow-auto max-h-[550px] border border-slate-200 rounded-xl scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            <table className="w-full border-collapse text-left text-sm text-slate-600">
              <thead className="sticky top-0 bg-white z-10 border-b border-slate-200 shadow-sm">
                <tr className="text-slate-550 font-bold bg-white">
                  <th className="py-3 px-4 text-xs tracking-wider uppercase">Nhân viên</th>
                  <th className="py-3 px-4 text-xs tracking-wider uppercase">Thời gian</th>
                  <th className="py-3 px-4 text-xs tracking-wider uppercase">Văn phòng / Địa điểm</th>
                  <th className="py-3 px-4 text-xs tracking-wider uppercase text-center">Hoạt động</th>
                  <th className="py-3 px-4 text-xs tracking-wider uppercase">Khoảng cách</th>
                  <th className="py-3 px-4 text-xs tracking-wider uppercase">Trạng thái đi muộn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => {
                  const isSuccess = log.status === 'success';
                  const isNotCheckedIn = log.type === 'not_checked_in';
                  return (
                    <tr key={log.id} className={`hover:bg-slate-50 transition-colors ${isNotCheckedIn ? 'bg-rose-50/20' : ''}`}>
                      {/* Employee details */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900 text-sm">
                          {log.employeeName || 'Chưa rõ'}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          {log.employeeId}
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td className="py-3.5 px-4 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-650 font-mono">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>{isNotCheckedIn ? `Cả ngày ${new Date(log.timestamp).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}` : formatDateTime(log.timestamp)}</span>
                        </div>
                      </td>

                      {/* Worksite */}
                      <td className="py-3.5 px-4">
                        <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                          <span>{log.locationName || 'Chưa rõ'}</span>
                          {log.isTemporary && (
                            <span className="inline-flex items-center px-1.5 py-0.2 bg-indigo-55 text-indigo-750 border border-indigo-150 text-[9px] font-black rounded-md uppercase tracking-wider">
                              Điều động
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {isNotCheckedIn ? '-' : `${log.latitude.toFixed(5)}, ${log.longitude.toFixed(5)}`}
                        </div>
                        {log.isTemporary && log.note && (
                          <div className="text-[10px] text-indigo-600 font-semibold mt-0.5 max-w-[240px] leading-relaxed italic" title={log.note}>
                            {log.note}
                          </div>
                        )}
                      </td>

                      {/* Check-in / Check-out tag */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            isNotCheckedIn
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : log.type === 'checkin'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                          }`}>
                            {isNotCheckedIn ? 'Chưa Check-in' : log.type === 'checkin' ? 'Check-in' : 'Check-out'}
                          </span>
                          {log.shift && !isNotCheckedIn && (
                            <span className="inline-flex px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 text-[9px] font-bold rounded">
                              Ca {log.shift}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Distance & validity */}
                      <td className="py-3.5 px-4">
                        {isNotCheckedIn ? (
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                            <div>
                              <div className="font-extrabold text-xs text-rose-600">
                                Chưa điểm danh
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Không có bản ghi check-in
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {isSuccess ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                            )}
                            <div>
                              <div className={`font-bold text-xs ${isSuccess ? 'text-slate-750' : 'text-red-655 font-black'}`}>
                                Sai lệch: {formatDistance(log.distance)}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {isSuccess ? 'Trong bán kính' : 'Vượt quá bán kính'}
                              </div>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Late Details */}
                      <td className="py-3.5 px-4">
                        {isNotCheckedIn ? (
                          <span className="text-xs text-slate-400 italic">Vắng mặt</span>
                        ) : log.isLate ? (
                          <div className="space-y-1">
                            <span className="inline-flex px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[9px] font-bold tracking-wider uppercase">
                              Muộn ca
                            </span>
                            {log.lateReason && (
                              <p className="text-xs text-slate-550 font-medium italic max-w-[200px] truncate" title={log.lateReason}>
                                Lý do: "{log.lateReason}"
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Đúng giờ / Không trễ</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
