/**
 * Debug logging utility for tracking critical lifecycle events
 * Logs to both console and localStorage for later analysis
 */

const DEBUG_KEY = 'app_debug_logs';
const MAX_LOG_ENTRIES = 500;

export interface DebugLog {
  timestamp: string;
  type: 'lifecycle' | 'auth' | 'subscription' | 'storage' | 'navigation' | 'error';
  message: string;
  data?: any;
}

class DebugLogger {
  private enabled: boolean;

  constructor() {
    this.enabled = this.isDebugEnabled();
  }

  private isDebugEnabled(): boolean {
    try {
      return localStorage.getItem('debug_mode') === 'true';
    } catch {
      return false;
    }
  }

  enableDebug() {
    try {
      localStorage.setItem('debug_mode', 'true');
      this.enabled = true;
    } catch (e) {
      console.warn('Failed to enable debug mode:', e);
    }
  }

  disableDebug() {
    try {
      localStorage.setItem('debug_mode', 'false');
      this.enabled = false;
    } catch (e) {
      console.warn('Failed to disable debug mode:', e);
    }
  }

  log(type: DebugLog['type'], message: string, data?: any) {
    if (!this.enabled) return;

    const logEntry: DebugLog = {
      timestamp: new Date().toISOString(),
      type,
      message,
      data
    };

    // Log to console
    console.log(`[${type.toUpperCase()}] ${message}`, data || '');

    // Save to localStorage
    try {
      const existingLogs = this.getLogs();
      existingLogs.push(logEntry);

      // Keep only the most recent logs
      const trimmedLogs = existingLogs.slice(-MAX_LOG_ENTRIES);
      localStorage.setItem(DEBUG_KEY, JSON.stringify(trimmedLogs));
    } catch (e) {
      console.warn('Failed to save debug log:', e);
    }
  }

  getLogs(): DebugLog[] {
    try {
      const logs = localStorage.getItem(DEBUG_KEY);
      return logs ? JSON.parse(logs) : [];
    } catch {
      return [];
    }
  }

  clearLogs() {
    try {
      localStorage.removeItem(DEBUG_KEY);
    } catch (e) {
      console.warn('Failed to clear debug logs:', e);
    }
  }

  exportLogs(): string {
    const logs = this.getLogs();
    return JSON.stringify(logs, null, 2);
  }
}

export const debugLogger = new DebugLogger();
