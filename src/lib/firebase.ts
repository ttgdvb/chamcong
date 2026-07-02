import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { Location, Employee, CheckinLog } from '../types';

// The configuration provided by the user
const firebaseConfig = {
  apiKey: "AIzaSyAEzUd42Kh6ISzvCu0byOOvHB8iI_LKTAY",
  authDomain: "chamcong-49621.firebaseapp.com",
  projectId: "chamcong-49621",
  storageBucket: "chamcong-49621.firebasestorage.app",
  messagingSenderId: "83341108241",
  appId: "1:83341108241:web:f06e5d1372d80d617cfdb0",
  measurementId: "G-K5FKD2CBBT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore (default database)
export const db = getFirestore(app);

// Collection References
export const LOCATIONS_COLLECTION = 'locations';
export const EMPLOYEES_COLLECTION = 'employees';
export const CHECKIN_LOGS_COLLECTION = 'checkin_logs';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Seed the database with default data if it's currently empty.
 * This ensures the user has a fully working system immediately.
 */
export async function seedDatabaseIfEmpty() {
  try {
    const locationsSnap = await getDocs(collection(db, LOCATIONS_COLLECTION));
    if (locationsSnap.empty) {
      console.log('Database is empty. Seeding default data...');
      
      const batch = writeBatch(db);

      // 1. Seed Default Locations
      const defaultLocations: Location[] = [
        {
          id: 'HN-HQ',
          code: 'HN-HQ',
          name: 'Trụ sở chính Hà Nội',
          latitude: 21.0285, // Hồ Hoàn Kiếm, Hà Nội
          longitude: 105.8542,
          radius: 100, // 100 meters
          shiftStartTimes: ['08:00', '13:30']
        },
        {
          id: 'HCM-OFFICE',
          code: 'HCM-OFFICE',
          name: 'Văn phòng TP. Hồ Chí Minh',
          latitude: 10.7769, // Chợ Bến Thành, Quận 1
          longitude: 106.7009,
          radius: 150, // 150 meters
          shiftStartTimes: ['08:00', '13:30']
        },
        {
          id: 'DYNAMIC-TEST',
          code: 'DYNAMIC-TEST',
          name: 'Văn phòng Thử nghiệm GPS',
          latitude: 21.0285, // Will be updated by the user/system to their current coordinate to test easily!
          longitude: 105.8542,
          radius: 500, // Generous radius for testing
          shiftStartTimes: ['08:30', '14:00']
        }
      ];

      for (const loc of defaultLocations) {
        const locRef = doc(db, LOCATIONS_COLLECTION, loc.id);
        batch.set(locRef, loc);
      }

      // 2. Seed Default Employees
      const defaultEmployees: Employee[] = [
        {
          id: 'ADMIN', // Admin
          fullName: 'Quản trị viên',
          locationId: 'HN-HQ',
          status: 'active',
          isAdmin: true
        }
      ];

      for (const emp of defaultEmployees) {
        const empRef = doc(db, EMPLOYEES_COLLECTION, emp.id);
        batch.set(empRef, emp);
      }

      await batch.commit();
      console.log('Database seeded successfully!');
    }

    // Always guarantee that the ADMIN account exists in the database
    try {
      const adminRef = doc(db, EMPLOYEES_COLLECTION, 'ADMIN');
      const adminSnap = await getDoc(adminRef);
      if (!adminSnap.exists()) {
        console.log('ADMIN employee not found. Re-creating ADMIN account...');
        await setDoc(adminRef, {
          id: 'ADMIN',
          fullName: 'Quản trị viên',
          locationId: 'HN-HQ',
          status: 'active',
          isAdmin: true
        });
      }
    } catch (adminErr) {
      console.warn('Could not check/create ADMIN account:', adminErr);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'seed_database');
  }
}

/**
 * Clear all data from locations, employees, and check-in logs,
 * and seed exactly one default location and one Admin account.
 */
export async function resetDatabase() {
  try {
    console.log('Resetting database. Cleaning all collections...');
    
    // 1. Delete all locations
    const locationsSnap = await getDocs(collection(db, LOCATIONS_COLLECTION));
    for (const d of locationsSnap.docs) {
      await deleteDoc(d.ref);
    }

    // 2. Delete all employees
    const employeesSnap = await getDocs(collection(db, EMPLOYEES_COLLECTION));
    for (const d of employeesSnap.docs) {
      await deleteDoc(d.ref);
    }

    // 3. Delete all check-in logs
    const logsSnap = await getDocs(collection(db, CHECKIN_LOGS_COLLECTION));
    for (const d of logsSnap.docs) {
      await deleteDoc(d.ref);
    }

    // 4. Seed exactly ONE default location
    const defaultLocation: Location = {
      id: 'HN-HQ',
      code: 'HN-HQ',
      name: 'Trụ sở chính Hà Nội',
      latitude: 21.0285, // Hoàn Kiếm, Hà Nội
      longitude: 105.8542,
      radius: 100, // 100m
      shiftStartTimes: ['08:00', '13:30']
    };
    await setDoc(doc(db, LOCATIONS_COLLECTION, defaultLocation.id), defaultLocation);

    // 5. Seed exactly ONE Admin employee
    const defaultAdmin: Employee = {
      id: 'ADMIN',
      fullName: 'Quản trị viên',
      locationId: 'HN-HQ',
      status: 'active',
      isAdmin: true
    };
    await setDoc(doc(db, EMPLOYEES_COLLECTION, defaultAdmin.id), defaultAdmin);

    console.log('Database reset successfully! Only 1 Admin account exists.');
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'reset_database');
  }
}

// ==========================================
// LOCATION CRUD OPERATIONS
// ==========================================

export async function getAllLocations(): Promise<Location[]> {
  try {
    const querySnapshot = await getDocs(collection(db, LOCATIONS_COLLECTION));
    return querySnapshot.docs.map(doc => doc.data() as Location);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, LOCATIONS_COLLECTION);
  }
}

export async function saveLocation(location: Location): Promise<void> {
  try {
    const docRef = doc(db, LOCATIONS_COLLECTION, location.id);
    await setDoc(docRef, location);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${LOCATIONS_COLLECTION}/${location.id}`);
  }
}

export async function deleteLocation(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, LOCATIONS_COLLECTION, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${LOCATIONS_COLLECTION}/${id}`);
  }
}

// ==========================================
// EMPLOYEE CRUD OPERATIONS
// ==========================================

export async function getAllEmployees(): Promise<Employee[]> {
  try {
    const querySnapshot = await getDocs(collection(db, EMPLOYEES_COLLECTION));
    return querySnapshot.docs.map(doc => doc.data() as Employee);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, EMPLOYEES_COLLECTION);
  }
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  try {
    const docRef = doc(db, EMPLOYEES_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as Employee;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `${EMPLOYEES_COLLECTION}/${id}`);
  }
}

export async function saveEmployee(employee: Employee): Promise<void> {
  try {
    const docRef = doc(db, EMPLOYEES_COLLECTION, employee.id);
    await setDoc(docRef, employee);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${EMPLOYEES_COLLECTION}/${employee.id}`);
  }
}

export async function deleteEmployee(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, EMPLOYEES_COLLECTION, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${EMPLOYEES_COLLECTION}/${id}`);
  }
}

// ==========================================
// CHECK-IN LOG OPERATIONS
// ==========================================

export async function getLogsForEmployee(employeeId: string): Promise<CheckinLog[]> {
  try {
    const q = query(
      collection(db, CHECKIN_LOGS_COLLECTION),
      where('employeeId', '==', employeeId)
    );
    const querySnapshot = await getDocs(q);
    const logs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CheckinLog));
    // Sort in-memory to avoid needing a Firestore composite index
    return logs.sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, CHECKIN_LOGS_COLLECTION);
  }
}

export async function getAllLogs(): Promise<CheckinLog[]> {
  try {
    const q = query(
      collection(db, CHECKIN_LOGS_COLLECTION),
      orderBy('timestamp', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CheckinLog));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, CHECKIN_LOGS_COLLECTION);
  }
}

export async function addCheckinLog(log: Omit<CheckinLog, 'id'>): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, CHECKIN_LOGS_COLLECTION), log);
    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, CHECKIN_LOGS_COLLECTION);
  }
}
