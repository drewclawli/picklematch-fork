/**
 * Safe localStorage wrapper with fallback to sessionStorage
 * Handles quota exceeded and other storage errors gracefully
 */

import { debugLogger } from './debug-logger';

class SafeStorage {
  private useSession = false;

  private getStorage(): Storage {
    return this.useSession ? sessionStorage : localStorage;
  }

  setItem(key: string, value: string): boolean {
    try {
      this.getStorage().setItem(key, value);
      debugLogger.log('storage', `Set item: ${key}`);
      return true;
    } catch (error) {
      debugLogger.log('error', `Failed to set localStorage item: ${key}`, error);
      
      // Try sessionStorage as fallback
      if (!this.useSession) {
        try {
          sessionStorage.setItem(key, value);
          this.useSession = true;
          debugLogger.log('storage', `Fallback to sessionStorage for: ${key}`);
          return true;
        } catch (sessionError) {
          debugLogger.log('error', 'sessionStorage also failed', sessionError);
        }
      }
      return false;
    }
  }

  getItem(key: string): string | null {
    try {
      const value = this.getStorage().getItem(key);
      debugLogger.log('storage', `Get item: ${key}`, { exists: !!value });
      return value;
    } catch (error) {
      debugLogger.log('error', `Failed to get storage item: ${key}`, error);
      
      // Try sessionStorage as fallback
      if (!this.useSession) {
        try {
          return sessionStorage.getItem(key);
        } catch (sessionError) {
          debugLogger.log('error', 'sessionStorage read also failed', sessionError);
        }
      }
      return null;
    }
  }

  removeItem(key: string): boolean {
    try {
      this.getStorage().removeItem(key);
      debugLogger.log('storage', `Removed item: ${key}`);
      return true;
    } catch (error) {
      debugLogger.log('error', `Failed to remove storage item: ${key}`, error);
      
      // Try sessionStorage as fallback
      if (!this.useSession) {
        try {
          sessionStorage.removeItem(key);
          return true;
        } catch (sessionError) {
          debugLogger.log('error', 'sessionStorage remove also failed', sessionError);
        }
      }
      return false;
    }
  }

  clear(): boolean {
    try {
      this.getStorage().clear();
      debugLogger.log('storage', 'Cleared storage');
      return true;
    } catch (error) {
      debugLogger.log('error', 'Failed to clear storage', error);
      return false;
    }
  }
}

export const safeStorage = new SafeStorage();
