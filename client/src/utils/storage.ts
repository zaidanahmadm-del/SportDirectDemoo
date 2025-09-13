/**
 * Local storage utilities for Sports Direct microsite
 */

export interface UserData {
  fullName: string;
  email: string;
  phone: string;
  registrationDate?: string;
}

export interface VoucherData {
  won: boolean;
  code: string;
  time: string;
}

const STORAGE_KEYS = {
  USER: 'sd_user',
  VOUCHER: 'sd_voucher',
  REGISTRATIONS: 'sd_registrations', // For admin export
} as const;

/**
 * Save user registration data
 */
export function setUserData(userData: UserData): void {
  try {
    const dataWithDate = {
      ...userData,
      registrationDate: new Date().toISOString(),
    };
    
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(dataWithDate));
    
    // Also add to registrations list for admin export
    const registrations = getRegistrations();
    registrations.push(dataWithDate);
    localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify(registrations));
  } catch (error) {
    console.error('Failed to save user data:', error);
  }
}

/**
 * Get user registration data
 */
export function getUserData(): UserData | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.USER);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to get user data:', error);
    return null;
  }
}

/**
 * Save voucher data
 */
export function setVoucherData(voucherData: VoucherData): void {
  try {
    localStorage.setItem(STORAGE_KEYS.VOUCHER, JSON.stringify(voucherData));
  } catch (error) {
    console.error('Failed to save voucher data:', error);
  }
}

/**
 * Get voucher data
 */
export function getVoucherData(): VoucherData | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.VOUCHER);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to get voucher data:', error);
    return null;
  }
}

/**
 * Get all registrations (for admin export)
 */
export function getRegistrations(): UserData[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.REGISTRATIONS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to get registrations:', error);
    return [];
  }
}

/**
 * Clear all stored data
 */
export function clearAllData(): void {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.error('Failed to clear data:', error);
  }
}

/**
 * Get/Set JSON data with error handling
 */
export function getStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Failed to get storage item ${key}:`, error);
    return defaultValue;
  }
}

export function setStorageItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to set storage item ${key}:`, error);
  }
}
