import React, { useState, useEffect } from 'react';
import { read, utils, writeFile } from 'xlsx';
import { Location } from '../types';
import { getAllLocations, saveLocation, deleteLocation } from '../lib/firebase';
import { MapPin, Plus, Trash2, Edit2, Check, X, Navigation, RefreshCw, AlertTriangle, Upload, FileDown, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';

export default function LocationManager() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLoc, setEditingLoc] = useState<Location | null>(null);
  
  // Form fields
  const [id, setId] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('100');
  const [checkinBufferMinutes, setCheckinBufferMinutes] = useState('15');
  const [shiftsList, setShiftsList] = useState<string[]>(['08:00', '13:30']);
  const [newShiftTime, setNewShiftTime] = useState('08:00');
  const [error, setError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [excelParsedMsg, setExcelParsedMsg] = useState<string | null>(null);

  const cleanTime = (t: string) => {
    const parts = t.trim().split(':');
    if (parts.length >= 2) {
      const hh = parseInt(parts[0], 10);
      const mm = parseInt(parts[1], 10);
      if (!isNaN(hh) && !isNaN(mm) && hh >= 0 && hh < 24 && mm >= 0 && mm < 60) {
        return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      }
    }
    return null;
  };

  const processExcelFile = (file: File) => {
    setImportError(null);
    setImportSuccessMsg(null);
    setExcelParsedMsg(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert sheet to json array of arrays
        const rows = utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        
        if (rows.length === 0) {
          setImportError('Tệp excel trống hoặc không đúng định dạng.');
          return;
        }
        
        const textLines: string[] = [];
        let skippedHeader = false;
        
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          const col1 = row[0]?.toString() || '';
          const col2 = row[1]?.toString() || '';
          const col3 = row[2]?.toString() || '';
          const col4 = row[3]?.toString() || '';
          const col5 = row[4]?.toString() || '';
          const col6 = row[5]?.toString() || '';
          
          if (!col1 && !col2) continue;
          
          if (!skippedHeader && i === 0 && (
            col1.toLowerCase().includes('mã') || 
            col1.toLowerCase().includes('code') || 
            col2.toLowerCase().includes('tên') || 
            col2.toLowerCase().includes('name') || 
            col3.toLowerCase().includes('vĩ độ') || 
            col3.toLowerCase().includes('latitude')
          )) {
            skippedHeader = true;
            continue;
          }
          
          textLines.push(`${col1}, ${col2}, ${col3}, ${col4}, ${col5}, ${col6}`);
        }
        
        if (textLines.length === 0) {
          setImportError('Không tìm thấy dữ liệu địa điểm hợp lệ nào trong tệp excel.');
          return;
        }
        
        setImportText(textLines.join('\n'));
        setExcelParsedMsg(`Đã đọc thành công ${textLines.length} dòng dữ liệu từ tệp "${file.name}". Bạn có thể kiểm tra hoặc chỉnh sửa lại nội dung văn bản bên dưới trước khi lưu.`);
      } catch (err: any) {
        setImportError('Lỗi phân tích tệp Excel: ' + err.message);
      }
    };
    
    reader.onerror = () => {
      setImportError('Lỗi trong quá trình đọc tệp.');
    };
    
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadTemplate = () => {
    const headers = ['Mã địa điểm', 'Tên địa điểm', 'Vĩ độ (Latitude)', 'Kinh độ (Longitude)', 'Bán kính (mét)', 'Các ca làm việc (phân cách bằng dấu phẩy)'];
    const sampleRows = [
      ['HN-HQ', 'Văn phòng Hà Nội', 21.0285, 105.8542, 100, '08:00, 13:30, 18:00'],
      ['HCM-OFFICE', 'Văn phòng Hồ Chí Minh', 10.7769, 106.7009, 150, '08:30, 14:00'],
      ['DA-NANG', 'Chi nhánh Đà Nẵng', 16.0544, 108.2022, 120, '07:30, 13:00, 17:30']
    ];

    const worksheet = utils.aoa_to_sheet([headers, ...sampleRows]);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'DS_Dia_Diem');

    writeFile(workbook, 'Mau_Import_Dia_Diem.xlsx');
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processExcelFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processExcelFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    setImportError(null);
    setImportSuccessMsg(null);
    setExcelParsedMsg(null);
    if (!importText.trim()) {
      setImportError('Vui lòng nhập danh sách địa điểm để import.');
      return;
    }

    setImporting(true);
    try {
      const lines = importText.split('\n');
      const importedList: Location[] = [];
      const errors: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        let parts: string[] = [];
        if (line.includes('\t')) {
          parts = line.split('\t');
        } else if (line.includes(';')) {
          parts = line.split(';');
        } else {
          parts = line.split(',');
        }

        if (parts.length < 5) {
          errors.push(`Dòng ${i + 1}: Sai định dạng (Cần tối thiểu Mã, Tên, Vĩ độ, Kinh độ, Bán kính).`);
          continue;
        }

        const rawCode = parts[0]?.trim();
        const rawName = parts[1]?.trim();
        const rawLat = parts[2]?.trim();
        const rawLon = parts[3]?.trim();
        const rawRad = parts[4]?.trim();
        const rawShifts = parts[5]?.trim() || '';

        if (!rawCode || !rawName || !rawLat || !rawLon || !rawRad) {
          errors.push(`Dòng ${i + 1}: Các trường thông tin bắt buộc không được để trống.`);
          continue;
        }

        const codeClean = rawCode.toUpperCase();
        const latNum = parseFloat(rawLat);
        const lonNum = parseFloat(rawLon);
        const radNum = parseInt(rawRad, 10);

        if (isNaN(latNum) || latNum < -90 || latNum > 90) {
          errors.push(`Dòng ${i + 1}: Vĩ độ không hợp lệ (phải từ -90 đến 90).`);
          continue;
        }

        if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
          errors.push(`Dòng ${i + 1}: Kinh độ không hợp lệ (phải từ -180 đến 180).`);
          continue;
        }

        if (isNaN(radNum) || radNum <= 0) {
          errors.push(`Dòng ${i + 1}: Bán kính không hợp lệ (phải là số dương).`);
          continue;
        }

        let parsedShifts: string[] = [];
        if (rawShifts) {
          parsedShifts = rawShifts
            .split(/[,;\|\s]+/)
            .map(cleanTime)
            .filter((x): x is string => x !== null);
        }

        if (parsedShifts.length === 0) {
          parsedShifts = ['08:00', '13:30'];
        } else {
          parsedShifts = Array.from(new Set(parsedShifts)).sort();
        }

        if (importedList.some(l => l.id === codeClean || l.code === codeClean)) {
          errors.push(`Dòng ${i + 1}: Mã địa điểm "${codeClean}" bị trùng lặp trong dữ liệu nhập vào.`);
          continue;
        }

        if (locations.some(l => l.id === codeClean)) {
          errors.push(`Dòng ${i + 1}: Mã địa điểm "${codeClean}" đã tồn tại trên hệ thống.`);
          continue;
        }

        importedList.push({
          id: codeClean,
          code: codeClean,
          name: rawName,
          latitude: latNum,
          longitude: lonNum,
          radius: radNum,
          shiftStartTimes: parsedShifts
        });
      }

      if (errors.length > 0) {
        setImportError(errors.join('\n'));
        setImporting(false);
        return;
      }

      if (importedList.length === 0) {
        setImportError('Không tìm thấy bản ghi hợp lệ nào để nhập.');
        setImporting(false);
        return;
      }

      for (const loc of importedList) {
        await saveLocation(loc);
      }

      await fetchLocations();
      setImportSuccessMsg(`Import thành công ${importedList.length} địa điểm mới vào hệ thống! Các ca làm việc đã được thiết lập tự động.`);
      setImportText('');
    } catch (err: any) {
      setImportError('Lỗi hệ thống khi import: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleAddShift = () => {
    if (!newShiftTime) return;
    const formatted = newShiftTime.slice(0, 5); // Ensure HH:MM format
    if (shiftsList.includes(formatted)) {
      setError(`Ca làm lúc ${formatted} đã tồn tại.`);
      return;
    }
    const updated = [...shiftsList, formatted].sort();
    setShiftsList(updated);
    setError(null);
  };

  const handleRemoveShift = (indexToRemove: number) => {
    const updated = shiftsList.filter((_, idx) => idx !== indexToRemove);
    setShiftsList(updated);
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const data = await getAllLocations();
      setLocations(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGetCurrentLocation = () => {
    setGpsLoading(true);
    setError(null);
    if (!navigator.geolocation) {
      setError('Thiết bị hoặc trình duyệt không hỗ trợ Geolocation.');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toString());
        setLongitude(position.coords.longitude.toString());
        setGpsLoading(false);
      },
      (err) => {
        console.error(err);
        setError('Không thể lấy tọa độ hiện tại. Hãy chắc chắn bạn đã cấp quyền GPS.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleEdit = (loc: Location) => {
    setEditingLoc(loc);
    setId(loc.id);
    setCode(loc.code);
    setName(loc.name);
    setLatitude(loc.latitude.toString());
    setLongitude(loc.longitude.toString());
    setRadius(loc.radius.toString());
    setCheckinBufferMinutes((loc.checkinBufferMinutes !== undefined ? loc.checkinBufferMinutes : 15).toString());
    setShiftsList(loc.shiftStartTimes || []);
    setError(null);
  };

  const handleCancel = () => {
    setEditingLoc(null);
    setId('');
    setCode('');
    setName('');
    setLatitude('');
    setLongitude('');
    setRadius('100');
    setCheckinBufferMinutes('15');
    setShiftsList(['08:00', '13:30']);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!code.trim() || !name.trim() || !latitude.trim() || !longitude.trim() || !radius.trim()) {
      setError('Vui lòng nhập đầy đủ thông tin bắt buộc.');
      return;
    }

    const latNum = parseFloat(latitude);
    const lonNum = parseFloat(longitude);
    const radNum = parseInt(radius, 10);

    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      setError('Vĩ độ không hợp lệ (phải từ -90 đến 90)');
      return;
    }

    if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
      setError('Kinh độ không hợp lệ (phải từ -180 đến 180)');
      return;
    }

    if (isNaN(radNum) || radNum <= 0) {
      setError('Bán kính phải là một số dương');
      return;
    }

    if (shiftsList.length === 0) {
      setError('Vui lòng thêm ít nhất một ca làm việc.');
      return;
    }

    const newId = editingLoc ? editingLoc.id : code.trim().toUpperCase();

    // Check if ID already exists if we're creating a new one
    if (!editingLoc) {
      const exists = locations.some(loc => loc.id === newId);
      if (exists) {
        setError(`Mã địa điểm "${newId}" đã tồn tại.`);
        return;
      }
    }

    const bufferMinutes = parseInt(checkinBufferMinutes, 10);
    const finalBuffer = isNaN(bufferMinutes) || bufferMinutes < 0 ? 15 : bufferMinutes;

    try {
      const updatedLoc: Location = {
        id: newId,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        latitude: latNum,
        longitude: lonNum,
        radius: radNum,
        shiftStartTimes: shiftsList,
        checkinBufferMinutes: finalBuffer
      };

      await saveLocation(updatedLoc);
      await fetchLocations();
      handleCancel();
    } catch (err: any) {
      setError('Lỗi khi lưu địa điểm: ' + err.message);
    }
  };

  const handleDelete = (locId: string) => {
    setDeleteTargetId(locId);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await deleteLocation(deleteTargetId);
      await fetchLocations();
      setDeleteTargetId(null);
    } catch (err: any) {
      setError('Không thể xóa địa điểm này: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-6">
        
        {/* Location Form */}
        <div className="w-full md:w-5/12 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm h-fit">
          <h3 className="text-lg font-black tracking-tight text-slate-900 mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-indigo-600" />
            {editingLoc ? 'Sửa Địa điểm' : 'Thêm Địa điểm Mới'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Mã địa điểm *
              </label>
              <input
                type="text"
                disabled={!!editingLoc}
                placeholder="Ví dụ: HN-HQ, HCM-OFFICE"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-slate-50 disabled:text-slate-450"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Tên địa điểm *
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Văn phòng Cầu Giấy"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Vĩ độ (Latitude) *
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: 21.0285"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Kinh độ (Longitude) *
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: 105.8542"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>
            </div>

            {/* GPS Helper button */}
            <div>
              <button
                type="button"
                onClick={handleGetCurrentLocation}
                disabled={gpsLoading}
                className="flex items-center justify-center gap-1.5 w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer border border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200"
              >
                <Navigation className={`h-3.5 w-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
                {gpsLoading ? 'Đang xác định GPS...' : 'Lấy tọa độ vị trí hiện tại của tôi (Thử nghiệm)'}
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Bán kính điểm danh (mét) *
              </label>
              <input
                type="number"
                placeholder="Ví dụ: 100"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Thời gian được check-in trước ca (phút) *
              </label>
              <input
                type="number"
                placeholder="Mặc định: 15"
                value={checkinBufferMinutes}
                onChange={(e) => setCheckinBufferMinutes(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                min="0"
              />
              <p className="mt-1 text-[9px] text-slate-450 italic">
                Thời gian (phút) cho phép nhân viên có thể Check-in trước khi ca bắt đầu.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Các Ca làm việc *
              </label>
              
              {/* Added Shifts List */}
              {shiftsList.length === 0 ? (
                <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                  Chưa thêm ca làm việc nào. Vui lòng thêm bên dưới.
                </div>
              ) : (
                <div className="space-y-1.5 mb-3 max-h-36 overflow-y-auto pr-1">
                  {shiftsList.map((shift, idx) => (
                    <div 
                      key={shift} 
                      className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border border-slate-150 rounded-xl"
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-extrabold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 text-[9px]">
                          Ca {idx + 1}
                        </span>
                        <span className="font-mono text-slate-700 font-bold">{shift}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveShift(idx)}
                        className="text-rose-500 hover:text-rose-750 hover:bg-rose-50 p-1 rounded-lg transition-all cursor-pointer"
                        title="Xóa ca này"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Shift Control */}
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={newShiftTime}
                  onChange={(e) => setNewShiftTime(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddShift}
                  className="py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-600 font-bold text-xs rounded-xl flex items-center gap-1 transition-all cursor-pointer shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Thêm ca
                </button>
              </div>
              <p className="mt-1 text-[9px] text-slate-450 italic">
                Chọn giờ vào ca và ấn "Thêm ca". Các ca tự động sắp xếp theo thứ tự thời gian.
              </p>
            </div>

            {error && (
              <div className="p-3 text-xs text-red-800 bg-red-50 border border-red-100 rounded-xl">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-550 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                {editingLoc ? 'Lưu thay đổi' : 'Tạo Địa điểm'}
              </button>
              {editingLoc && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-650 border border-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Hủy
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Location List */}
        <div className="w-full md:w-7/12 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm h-fit">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-lg font-black tracking-tight text-slate-900">Danh sách Địa điểm</h3>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-600 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Import Địa điểm</span>
              </button>
              <button
                onClick={fetchLocations}
                className="p-1.5 bg-slate-50 border border-slate-200 hover:text-slate-850 rounded-lg text-slate-500 transition-colors cursor-pointer"
                title="Làm mới"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              Đang tải danh sách địa điểm...
            </div>
          ) : locations.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs italic bg-slate-50 rounded-xl border border-slate-150">
              Chưa có địa điểm nào được thiết lập.
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {locations.map((loc) => (
                <div
                  key={loc.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-150 hover:border-slate-200 transition-all"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-bold rounded-md">
                        {loc.code}
                      </span>
                      <h4 className="font-extrabold text-slate-800 text-sm">{loc.name}</h4>
                    </div>
                    <p className="text-xs text-slate-500">
                      Tọa độ: <span className="font-mono text-slate-600">{loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}</span>
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
                      <span className="text-xs font-bold text-indigo-650">
                        Bán kính: {loc.radius}m
                      </span>
                      <span className="text-xs font-bold text-amber-650">
                        Check-in trước ca: {loc.checkinBufferMinutes !== undefined ? loc.checkinBufferMinutes : 15}p
                      </span>
                      <span className="text-xs font-bold text-teal-650">
                        Ca làm: {loc.shiftStartTimes.map((shift, idx) => `Ca ${idx + 1} (${shift})`).join(' | ')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 ml-4 shrink-0">
                    <button
                      onClick={() => handleEdit(loc)}
                      className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-all cursor-pointer"
                      title="Chỉnh sửa"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(loc.id)}
                      className="p-1.5 hover:bg-red-50 text-red-650 rounded-lg transition-all cursor-pointer"
                      title="Xóa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
            onClick={() => !isDeleting && setDeleteTargetId(null)}
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-6 z-10 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-50 text-red-650 rounded-xl border border-red-100 shrink-0">
                <AlertTriangle className="h-6 w-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Xác nhận Xóa Địa điểm?</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Bạn có chắc chắn muốn xóa địa điểm này khỏi hệ thống? Các nhân viên thuộc địa điểm này sẽ không có địa điểm hợp lệ để điểm danh cho đến khi được phân công lại.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTargetId(null)}
                className="py-2 px-4 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-80"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Đang xóa...
                  </>
                ) : (
                  'Đồng ý xóa'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
            onClick={() => !importing && setIsImportModalOpen(false)}
          />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Import danh sách Địa điểm</h3>
                  <p className="text-xs text-slate-400">Nhập hàng loạt địa điểm chấm công từ Excel, Sheets hoặc văn bản tự do</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-650 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 overflow-y-auto flex-1 pr-1">
              {/* Instructions */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 space-y-2">
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">Hướng dẫn Định dạng dữ liệu:</h4>
                <p className="text-[11px] text-slate-650 leading-relaxed">
                  Tải lên tệp Excel <code className="bg-slate-200 px-1 py-0.5 rounded font-mono font-semibold text-slate-800">.xlsx, .xls</code> hoặc <code className="bg-slate-200 px-1 py-0.5 rounded font-mono font-semibold text-slate-800">.csv</code>. Các ca làm việc sẽ tự động phát sinh theo danh sách thời gian khai báo.
                </p>
                <div className="bg-white border border-slate-200 rounded-lg p-2.5 font-mono text-[10px] text-slate-600 space-y-1">
                  <div className="text-slate-400 font-sans font-bold uppercase text-[8px] tracking-wider mb-1">Cấu trúc các cột Excel:</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span><strong>Cột A (1):</strong> Mã địa điểm</span>
                    <span><strong>Cột B (2):</strong> Tên địa điểm</span>
                    <span><strong>Cột C (3):</strong> Vĩ độ (Latitude)</span>
                    <span><strong>Cột D (4):</strong> Kinh độ (Longitude)</span>
                    <span><strong>Cột E (5):</strong> Bán kính (mét)</span>
                    <span><strong>Cột F (6):</strong> Danh sách ca (Ví dụ: <strong className="text-indigo-600">08:00, 13:30</strong>)</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mt-2 pt-2 border-t border-slate-150">
                  <span className="text-[10px] text-slate-400 font-medium">Bạn chưa có file Excel theo đúng định dạng chuẩn?</span>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="py-1 px-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-indigo-600 font-extrabold text-[10px] rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                  >
                    <FileDown className="h-3 w-3 text-indigo-500" />
                    <span>Tải file Excel mẫu (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Chọn hoặc Kéo thả tệp Excel/CSV
                </label>
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-5 text-center transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${
                    dragActive 
                      ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]' 
                      : 'border-slate-250 bg-slate-50/50 hover:bg-slate-100/50 hover:border-slate-350'
                  }`}
                  onClick={() => document.getElementById('location-excel-file-input')?.click()}
                >
                  <input
                    id="location-excel-file-input"
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <div className="p-2.5 bg-white shadow-sm border border-slate-150 rounded-xl text-indigo-600">
                    <FileSpreadsheet className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-slate-700">Kéo thả tệp Excel hoặc CSV vào đây</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">hoặc nhấp chuột để chọn tệp từ máy tính</p>
                  </div>
                </div>
              </div>

              {/* Text Input */}
              <div className="space-y-1">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Dữ liệu xem trước / Nhập tay trực tiếp *
                  </label>
                  {importText && (
                    <button 
                      type="button" 
                      onClick={() => { setImportText(''); setImportSuccessMsg(null); setExcelParsedMsg(null); }}
                      className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer"
                    >
                      Xóa dữ liệu xem trước
                    </button>
                  )}
                </div>
                <textarea
                  rows={5}
                  placeholder="Mã, Tên, Vĩ độ, Kinh độ, Bán kính, Các ca&#10;Ví dụ: HN-HQ, Văn phòng Hà Nội, 21.0285, 105.8542, 100, 08:00; 13:30"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs leading-relaxed"
                />
              </div>

              {/* Feedback States */}
              {excelParsedMsg && (
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-start gap-2 text-indigo-800">
                  <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-extrabold">{excelParsedMsg}</p>
                    <p className="text-[10px] text-indigo-600">Hãy rà soát kỹ các thông tin xem trước ở khung trên và nhấn nút <strong className="font-extrabold text-indigo-800">"Nhập danh sách"</strong> ở dưới cùng bên phải để hoàn tất lưu vào cơ sở dữ liệu.</p>
                  </div>
                </div>
              )}

              {importError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-red-800 font-extrabold uppercase tracking-wide">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span>Lỗi định dạng hoặc dữ liệu:</span>
                  </div>
                  <pre className="text-[10px] text-red-700 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto pl-5">
                    {importError}
                  </pre>
                </div>
              )}

              {importSuccessMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-2 text-emerald-800">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-extrabold">{importSuccessMsg}</p>
                    <p className="text-[10px] text-emerald-600">Các địa điểm mới đã được lưu thành công vào cơ sở dữ liệu. Nhân viên hiện có thể được phân bổ vào các địa điểm này.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                disabled={importing}
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportError(null);
                  setImportSuccessMsg(null);
                  setExcelParsedMsg(null);
                  setImportText('');
                }}
                className="py-2 px-4 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                {importSuccessMsg ? 'Đóng' : 'Hủy bỏ'}
              </button>
              
              {!importSuccessMsg && (
                <button
                  type="button"
                  disabled={importing}
                  onClick={handleImport}
                  className="py-2 px-5 bg-indigo-600 hover:bg-indigo-550 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-80"
                >
                  {importing ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Nhập danh sách
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
