import React, { useState, useEffect } from 'react';
import { read, utils, writeFile } from 'xlsx';
import { Employee, Location } from '../types';
import { getAllEmployees, getAllLocations, saveEmployee, deleteEmployee } from '../lib/firebase';
import { Users, Plus, Trash2, Edit2, Check, X, Shield, ToggleLeft, ToggleRight, Search, RefreshCw, AlertTriangle, Upload, AlertCircle, CheckCircle2, FileSpreadsheet, FileUp, FileDown, Filter } from 'lucide-react';

interface EmployeeManagerProps {
  currentAdmin?: Employee;
}

export default function EmployeeManager({ currentAdmin }: EmployeeManagerProps) {
  const isSuperAdminLoggedIn = currentAdmin?.id.toUpperCase() === 'ADMIN';
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);

  // Form Fields
  const [id, setId] = useState('');
  const [fullName, setFullName] = useState('');
  const [locationId, setLocationId] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteBulkTargets, setDeleteBulkTargets] = useState<string[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [excelParsedMsg, setExcelParsedMsg] = useState<string | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processExcelFile(file);
  };

  const processExcelFile = (file: File) => {
    setImportError(null);
    setImportSuccessMsg(null);
    setExcelParsedMsg(null);
    
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    
    if (!validTypes.includes(file.type) && fileExt !== 'xlsx' && fileExt !== 'xls' && fileExt !== 'csv') {
      setImportError('Vui lòng chọn tệp Excel (.xlsx, .xls) hoặc tệp CSV (.csv).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) {
          setImportError('Không thể đọc dữ liệu từ tệp tin.');
          return;
        }
        
        const workbook = read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        const rows = utils.sheet_to_json<any[]>(sheet, { header: 1 });
        
        if (rows.length === 0) {
          setImportError('Tệp Excel trống hoặc không đúng cấu trúc.');
          return;
        }

        const textLines: string[] = [];
        let skippedHeader = false;
        
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          const col1 = String(row[0] || '').trim();
          const col2 = String(row[1] || '').trim();
          const col3 = String(row[2] || '').trim();
          
          if (!col1 && !col2) continue;
          
          if (!skippedHeader && i === 0 && (
            col1.toLowerCase().includes('họ tên') || 
            col1.toLowerCase().includes('name') || 
            col2.toLowerCase().includes('điện thoại') || 
            col2.toLowerCase().includes('phone') || 
            col2.toLowerCase().includes('sđt') || 
            col1.toLowerCase().includes('mã')
          )) {
            skippedHeader = true;
            continue;
          }
          
          textLines.push(`${col1}, ${col2}${col3 ? `, ${col3}` : ''}`);
        }
        
        if (textLines.length === 0) {
          setImportError('Không tìm thấy dữ liệu nhân sự hợp lệ nào trong tệp excel (hãy đảm bảo cột 1 là Họ Tên và cột 2 là Số Điện Thoại).');
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
    // Columns: Họ và tên, Số điện thoại, Mã cơ sở (tùy chọn)
    const headers = ['Họ và tên', 'Số điện thoại', 'Mã địa điểm làm việc (tùy chọn)'];
    const sampleRows = [
      ['Nguyễn Văn Hải', '0987654321', locations[0]?.code || 'VP-HN'],
      ['Lê Minh Châu', '0912345678', locations[0]?.code || 'VP-HN'],
      ['Phạm Quốc Bảo', '0905556667', locations[1]?.code || 'VP-HCM']
    ];

    // Create Worksheet from array of arrays
    const worksheet = utils.aoa_to_sheet([headers, ...sampleRows]);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'DS_Nhan_Su');

    // Trigger download
    writeFile(workbook, 'Mau_Import_Nhan_Su.xlsx');
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

  const handleImport = async () => {
    setImportError(null);
    setImportSuccessMsg(null);
    setExcelParsedMsg(null);
    if (!importText.trim()) {
      setImportError('Vui lòng nhập danh sách nhân viên để import.');
      return;
    }

    setImporting(true);
    try {
      const lines = importText.split('\n');
      const importedList: Employee[] = [];
      const errors: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Split by comma, semicolon or tab
        let parts: string[] = [];
        if (line.includes('\t')) {
          parts = line.split('\t');
        } else if (line.includes(';')) {
          parts = line.split(';');
        } else {
          parts = line.split(',');
        }

        if (parts.length < 2) {
          errors.push(`Dòng ${i + 1}: Sai định dạng (Cần tối thiểu Họ tên và Số điện thoại).`);
          continue;
        }

        const rawName = parts[0]?.trim();
        const rawPhone = parts[1]?.trim();
        const rawLocId = parts[2]?.trim() || '';

        if (!rawName || !rawPhone) {
          errors.push(`Dòng ${i + 1}: Họ tên hoặc Số điện thoại không được để trống.`);
          continue;
        }

        // Clean phone number: remove spaces, dots, dashes, parentheses
        const cleanPhone = rawPhone.replace(/[\s\.\-\(\)]/g, '').toUpperCase();
        if (cleanPhone.length < 3) {
          errors.push(`Dòng ${i + 1}: Số điện thoại "${rawPhone}" không hợp lệ.`);
          continue;
        }

        // Validate location
        let resolvedLocId = '';
        if (rawLocId) {
          const locMatch = locations.find(
            l => l.id.toLowerCase() === rawLocId.toLowerCase() || 
                 l.code.toLowerCase() === rawLocId.toLowerCase() ||
                 l.name.toLowerCase().includes(rawLocId.toLowerCase())
          );
          if (locMatch) {
            resolvedLocId = locMatch.id;
          }
        }

        // If not specified or not matched, fall back to the first available location
        if (!resolvedLocId) {
          if (locations.length > 0) {
            resolvedLocId = locations[0].id;
          } else {
            errors.push(`Dòng ${i + 1}: Chưa cấu hình địa điểm làm việc trên hệ thống.`);
            continue;
          }
        }

        // Check duplicates inside the imported list
        if (importedList.some(e => e.id === cleanPhone)) {
          errors.push(`Dòng ${i + 1}: Số điện thoại "${cleanPhone}" bị trùng lặp trong dữ liệu nhập vào.`);
          continue;
        }

        // Check duplicate with existing employees
        if (employees.some(e => e.id === cleanPhone)) {
          errors.push(`Dòng ${i + 1}: Số điện thoại "${cleanPhone}" đã tồn tại trên hệ thống.`);
          continue;
        }

        importedList.push({
          id: cleanPhone,
          fullName: rawName,
          locationId: resolvedLocId,
          status: 'active',
          isAdmin: false
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

      // Save all in batch-like loops
      for (const emp of importedList) {
        await saveEmployee(emp);
      }

      await fetchData();
      setImportSuccessMsg(`Import thành công ${importedList.length} nhân sự mới vào hệ thống!`);
      setImportText('');
    } catch (err: any) {
      setImportError('Lỗi hệ thống khi import: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empData, locData] = await Promise.all([
        getAllEmployees(),
        getAllLocations()
      ]);
      setEmployees(empData);
      setLocations(locData);
      
      const empIds = empData.map(e => e.id);
      setSelectedIds(prev => prev.filter(id => empIds.includes(id)));
      
      if (locData.length > 0 && !locationId) {
        setLocationId(locData[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (emp: Employee) => {
    setEditingEmp(emp);
    setId(emp.id);
    setFullName(emp.fullName);
    setLocationId(emp.locationId);
    setStatus(emp.status);
    setIsAdmin(emp.isAdmin);
    setError(null);
  };

  const handleCancel = () => {
    setEditingEmp(null);
    setId('');
    setFullName('');
    if (locations.length > 0) {
      setLocationId(locations[0].id);
    } else {
      setLocationId('');
    }
    setStatus('active');
    setIsAdmin(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!id.trim() || !fullName.trim() || !locationId) {
      setError('Vui lòng nhập đầy đủ Số điện thoại, Họ tên và chọn Địa điểm làm việc.');
      return;
    }

    const formattedId = id.trim().toUpperCase();

    // ID duplicate check if creating new employee
    if (!editingEmp) {
      const exists = employees.some(emp => emp.id === formattedId);
      if (exists) {
        setError(`Số điện thoại "${formattedId}" đã tồn tại trên hệ thống.`);
        return;
      }
    }

    try {
      const finalIsAdmin = formattedId === 'ADMIN' ? true : isAdmin;
      const finalStatus = formattedId === 'ADMIN' ? 'active' : status;

      const updatedEmp: Employee = {
        id: formattedId,
        fullName: fullName.trim(),
        locationId,
        status: finalStatus,
        isAdmin: finalIsAdmin
      };

      await saveEmployee(updatedEmp);
      await fetchData();
      handleCancel();
    } catch (err: any) {
      setError('Lỗi khi lưu thông tin nhân viên: ' + err.message);
    }
  };

  const handleDelete = (empId: string) => {
    setDeleteTargetId(empId);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await deleteEmployee(deleteTargetId);
      setSelectedIds(prev => prev.filter(id => id !== deleteTargetId));
      await fetchData();
      setDeleteTargetId(null);
    } catch (err: any) {
      setError('Lỗi khi xóa nhân sự: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDeleteBulk = async () => {
    if (!deleteBulkTargets || deleteBulkTargets.length === 0) return;
    setIsDeleting(true);
    try {
      await Promise.all(deleteBulkTargets.map(id => deleteEmployee(id)));
      await fetchData();
      setSelectedIds([]);
      setDeleteBulkTargets(null);
    } catch (err: any) {
      setError('Lỗi khi xóa hàng loạt nhân sự: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter list
  const filteredEmployees = employees.filter(emp => {
    // Search query
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      const matchSearch = emp.id.toLowerCase().includes(query) || emp.fullName.toLowerCase().includes(query);
      if (!matchSearch) return false;
    }

    // Location filter
    if (filterLocation !== 'all' && emp.locationId !== filterLocation) {
      return false;
    }

    // Status filter
    if (filterStatus !== 'all' && emp.status !== filterStatus) {
      return false;
    }

    // Role filter
    if (filterRole !== 'all') {
      const isEmpAdmin = !!emp.isAdmin;
      if (filterRole === 'admin' && !isEmpAdmin) return false;
      if (filterRole === 'staff' && isEmpAdmin) return false;
    }

    return true;
  });

  const getLocationName = (locId: string) => {
    const loc = locations.find(l => l.id === locId);
    return loc ? loc.name : 'Chưa phân công';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-6">
        
        {/* Employee Form */}
        <div className="w-full md:w-5/12 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm h-fit">
          <h3 className="text-lg font-black tracking-tight text-slate-900 mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            {editingEmp ? 'Sửa thông tin Nhân viên' : 'Thêm Nhân viên Mới'}
          </h3>

          {locations.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 text-xs leading-relaxed">
              Bạn cần khởi tạo ít nhất một <strong>Địa điểm làm việc</strong> trước khi thêm nhân sự.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Họ và tên *
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Nguyễn Văn Hải"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Số điện thoại *
                  </label>
                  <span className="text-[10px] text-indigo-600 font-semibold">(Dùng làm tài khoản đăng nhập)</span>
                </div>
                <input
                  type="text"
                  disabled={!!editingEmp}
                  placeholder="Ví dụ: 0912345678"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Địa điểm làm việc *
                </label>
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      [{loc.code}] {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Trạng thái
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setStatus('active')}
                      className={`flex-1 py-1.5 text-xs font-bold border rounded-lg transition-colors cursor-pointer ${
                        status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-250'
                          : 'bg-white text-slate-450 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Hoạt động
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus('inactive')}
                      className={`flex-1 py-1.5 text-xs font-bold border rounded-lg transition-colors cursor-pointer ${
                        status === 'inactive'
                          ? 'bg-rose-50 text-rose-700 border-rose-250'
                          : 'bg-white text-slate-450 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Dừng
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Vai trò admin
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAdmin(!isAdmin)}
                    className={`w-full py-1.5 text-xs font-bold border rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                      isAdmin
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-250'
                        : 'bg-white text-slate-450 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    {isAdmin ? 'Quản trị viên' : 'Nhân sự thường'}
                  </button>
                </div>
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
                  {editingEmp ? 'Lưu thay đổi' : 'Tạo Nhân viên'}
                </button>
                {editingEmp && (
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
          )}
        </div>

        {/* Employee List */}
        <div className="w-full md:w-7/12 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm h-fit">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900">Danh sách Nhân sự</h3>
              <p className="text-[10px] text-slate-400">Số ĐT là tài khoản để nhân viên đăng nhập</p>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Search Input */}
              <div className="relative flex-1 sm:flex-initial sm:w-48">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                />
              </div>

              {/* Import Button */}
              <button
                type="button"
                onClick={() => {
                  setImportError(null);
                  setImportSuccessMsg(null);
                  setExcelParsedMsg(null);
                  setImportText('');
                  setIsImportModalOpen(true);
                }}
                className="py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-600 font-bold text-xs rounded-xl flex items-center gap-1 transition-all cursor-pointer shrink-0"
                title="Nhập danh sách bằng Excel/CSV/Pasted-text"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Import</span>
              </button>
            </div>
          </div>

          {/* Filters Row */}
          <div className="grid grid-cols-3 gap-2.5 mb-4 bg-slate-50 p-2.5 rounded-xl border border-slate-150">
            <div>
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">Cơ sở / Văn phòng</label>
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 text-[10px] font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">Tất cả cơ sở</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>[{loc.code}] {loc.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">Trạng thái</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 text-[10px] font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">Tất cả</option>
                <option value="active">Hoạt động</option>
                <option value="inactive">Dừng hoạt động</option>
              </select>
            </div>

            <div>
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">Vai trò</label>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 text-[10px] font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">Tất cả</option>
                <option value="staff">Nhân sự thường</option>
                <option value="admin">Quản trị viên</option>
              </select>
            </div>
          </div>

          {/* Chọn tất cả & Thao tác hàng loạt */}
          {!loading && filteredEmployees.length > 0 && (
            <div className="flex items-center justify-between py-2 px-3 bg-slate-50 border border-slate-150 rounded-xl mb-3 text-xs gap-3 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-650">
                <input
                  type="checkbox"
                  checked={filteredEmployees.length > 0 && filteredEmployees.filter(e => e.id.toUpperCase() !== 'ADMIN').every(e => selectedIds.includes(e.id))}
                  onChange={(e) => {
                    const deletableEmployees = filteredEmployees.filter(emp => emp.id.toUpperCase() !== 'ADMIN');
                    if (e.target.checked) {
                      const allDeletableIds = deletableEmployees.map(emp => emp.id);
                      setSelectedIds(prev => Array.from(new Set([...prev, ...allDeletableIds])));
                    } else {
                      const deletableIds = deletableEmployees.map(emp => emp.id);
                      setSelectedIds(prev => prev.filter(id => !deletableIds.includes(id)));
                    }
                  }}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                />
                <span>Chọn tất cả ({filteredEmployees.filter(e => e.id.toUpperCase() !== 'ADMIN').length})</span>
              </label>

              {selectedIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-[11px] font-bold">
                    Đã chọn <strong className="text-indigo-600 font-extrabold">{selectedIds.length}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setDeleteBulkTargets(selectedIds)}
                    className="py-1 px-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-650 font-bold text-[10px] rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Xóa các mục đã chọn</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="py-1 px-2 bg-slate-200 hover:bg-slate-250 text-slate-650 font-bold text-[10px] rounded-lg transition-all cursor-pointer"
                  >
                    Bỏ chọn
                  </button>
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              Đang tải danh sách nhân sự...
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs italic bg-slate-50 rounded-xl border border-slate-150">
              Không tìm thấy nhân viên nào phù hợp.
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {filteredEmployees.map((emp) => {
                const isDeletable = emp.id.toUpperCase() !== 'ADMIN';
                const isSelected = selectedIds.includes(emp.id);
                return (
                  <div
                    key={emp.id}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                      isSelected ? 'border-indigo-300 bg-indigo-50/20' : 'bg-slate-50 border-slate-150 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {isDeletable && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(prev => [...prev, emp.id]);
                            } else {
                              setSelectedIds(prev => prev.filter(id => id !== emp.id));
                            }
                          }}
                          className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer shrink-0"
                        />
                      )}
                      {!isDeletable && (
                        <div className="w-4 h-4 mt-1 shrink-0" />
                      )}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-bold rounded-md">
                            {emp.id}
                          </span>
                          <h4 className="font-extrabold text-slate-800 text-sm">{emp.fullName}</h4>
                          {emp.isAdmin && (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[9px] font-bold rounded-md border border-amber-150">
                              <Shield className="h-2.5 w-2.5 animate-pulse" />
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-550">
                          Văn phòng: <span className="font-extrabold text-slate-750">{getLocationName(emp.locationId)}</span>
                        </p>
                        <div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase border ${
                            emp.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : 'bg-rose-50 text-rose-700 border-rose-100'
                          }`}>
                            {emp.status === 'active' ? 'Hoạt động' : 'Dừng hoạt động'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 ml-4 shrink-0">
                      {/* Only allow editing ADMIN if current logged-in user is Super Admin */}
                      {!(emp.id.toUpperCase() === 'ADMIN' && !isSuperAdminLoggedIn) && (
                        <button
                          onClick={() => handleEdit(emp)}
                          className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-all cursor-pointer"
                          title="Chỉnh sửa"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                      {/* No one can delete the Super Admin (ADMIN) */}
                      {isDeletable && (
                        <button
                          onClick={() => handleDelete(emp.id)}
                          className="p-1.5 hover:bg-red-50 text-red-650 rounded-lg transition-all cursor-pointer"
                          title="Xóa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
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
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Xác nhận Xóa Nhân viên?</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Bạn có chắc chắn muốn xóa nhân viên <strong className="text-slate-800">{deleteTargetId}</strong> khỏi hệ thống? Các nhật ký điểm danh liên quan vẫn sẽ tồn tại nhưng hồ sơ nhân sự này sẽ bị gỡ bỏ hoàn toàn.
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

      {/* Bulk Delete Confirmation Modal */}
      {deleteBulkTargets && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
            onClick={() => !isDeleting && setDeleteBulkTargets(null)}
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-6 z-10 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-50 text-red-650 rounded-xl border border-red-100 shrink-0">
                <AlertTriangle className="h-6 w-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Xác nhận Xóa Hàng loạt?</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Bạn có chắc chắn muốn xóa <strong className="text-slate-800">{deleteBulkTargets.length} nhân viên</strong> đã chọn khỏi hệ thống? Các nhật ký điểm danh liên quan vẫn sẽ tồn tại nhưng hồ sơ nhân sự của họ sẽ bị gỡ bỏ hoàn toàn.
                </p>
                <div className="mt-3 max-h-24 overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono text-[10px] text-slate-600">
                  {deleteBulkTargets.join(', ')}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteBulkTargets(null)}
                className="py-2 px-4 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteBulk}
                className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-80"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Đang xóa...
                  </>
                ) : (
                  `Đồng ý xóa (${deleteBulkTargets.length})`
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
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Import danh sách Nhân sự</h3>
                  <p className="text-xs text-slate-400">Nhập hàng loạt nhân viên từ Excel, Sheets hoặc văn bản tự do</p>
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
                  Tải lên tệp Excel <code className="bg-slate-200 px-1 py-0.5 rounded font-mono font-semibold text-slate-800">.xlsx, .xls</code> hoặc <code className="bg-slate-200 px-1 py-0.5 rounded font-mono font-semibold text-slate-800">.csv</code>. Hệ thống sẽ tự động chuyển đổi thành danh sách để bạn rà soát lại trước khi lưu.
                </p>
                <div className="bg-white border border-slate-200 rounded-lg p-2.5 font-mono text-[10px] text-slate-600 space-y-1">
                  <div className="text-slate-400 font-sans font-bold uppercase text-[8px] tracking-wider mb-1">Cấu trúc các cột Excel:</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span><strong>Cột A (1):</strong> Họ và tên</span>
                    <span><strong>Cột B (2):</strong> Số điện thoại</span>
                    <span><strong>Cột C (3):</strong> Mã văn phòng (tùy chọn)</span>
                  </div>
                </div>

                {locations.length > 0 && (
                  <div className="text-[10px] text-slate-500">
                    <span className="font-bold">Các Mã địa điểm hiện có: </span>
                    {locations.map(l => (
                      <code key={l.id} className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded mr-1 font-mono font-bold" title={l.name}>
                        {l.code}
                      </code>
                    ))}
                    <span className="italic">(Nếu bỏ trống hoặc sai, mặc định gán vào: <strong className="text-slate-700 font-bold">[{locations[0].code}]</strong>)</span>
                  </div>
                )}

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
                  onClick={() => document.getElementById('excel-file-input')?.click()}
                >
                  <input
                    id="excel-file-input"
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
                  placeholder="Họ tên, Số điện thoại, Mã địa điểm&#10;Ví dụ: Nguyễn Văn Hải, 0987654321, HN-HQ"
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
                    <p className="text-[10px] text-emerald-600">Nhân viên được thêm có trạng thái hoạt động và quyền nhân sự thường. Họ có thể lập tức đăng nhập bằng số điện thoại vừa khai báo.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                disabled={importing}
                onClick={() => setIsImportModalOpen(false)}
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
