import React, { useState, useEffect } from 'react';
import { Location } from '../types';
import { getAllLocations, saveLocation, deleteLocation } from '../lib/firebase';
import { MapPin, Plus, Trash2, Edit2, Check, X, Navigation, RefreshCw, AlertTriangle } from 'lucide-react';

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
  const [shiftsList, setShiftsList] = useState<string[]>(['08:00', '13:30']);
  const [newShiftTime, setNewShiftTime] = useState('08:00');
  const [error, setError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

    try {
      const updatedLoc: Location = {
        id: newId,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        latitude: latNum,
        longitude: lonNum,
        radius: radNum,
        shiftStartTimes: shiftsList
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black tracking-tight text-slate-900">Danh sách Địa điểm</h3>
            <button
              onClick={fetchLocations}
              className="p-1.5 bg-slate-50 border border-slate-200 hover:text-slate-850 rounded-lg text-slate-500 transition-colors cursor-pointer"
              title="Làm mới"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
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
    </div>
  );
}
