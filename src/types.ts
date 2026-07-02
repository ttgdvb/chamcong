export interface Location {
  id: string; // Document ID (usually same as code or auto-id)
  code: string; // Unique code (e.g. HN01, HCM02)
  name: string; // Name of office/worksite
  latitude: number;
  longitude: number;
  radius: number; // in meters
  shiftStartTimes: string[]; // List of shifts, e.g. ["08:00", "13:30"]
}

export interface Employee {
  id: string; // Employee ID (Mã nhân viên, also the doc ID)
  fullName: string;
  locationId: string; // Associated Location ID
  status: 'active' | 'inactive';
  isAdmin: boolean;
}

export interface CheckinLog {
  id: string; // Doc ID
  employeeId: string;
  employeeName?: string; // Cache employee name for easier list rendering
  locationName?: string; // Cache location name for easier list rendering
  timestamp: number; // Epoc ms
  latitude: number;
  longitude: number;
  status: 'success' | 'error';
  type: 'checkin' | 'checkout';
  distance: number; // Distance in meters from location center
  isLate: boolean;
  lateReason?: string;
  shift?: string; // Selected shift name/time, e.g. "08:00"
}
