// ===== CUSTOM HOOK CHO LOCAL STORAGE =====

import { useState, useEffect, useCallback } from "react";
import { logError } from "../utils/errorHandlers";

// Generic hook cho localStorage với TypeScript support
export const useLocalStorage = <T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, () => void] => {
  // State để lưu giá trị
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      // Lấy giá trị từ localStorage
      const item = window.localStorage.getItem(key);

      // Parse và return giá trị đã lưu hoặc initial value
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      logError(error, `useLocalStorage - Get ${key}`);
      return initialValue;
    }
  });

  // Function để set giá trị
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        // Cho phép value là function để update dựa trên previous value
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;

        // Save to state
        setStoredValue(valueToStore);

        // Save to localStorage
        if (valueToStore === undefined) {
          window.localStorage.removeItem(key);
        } else {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }

        console.log(`💾 LocalStorage Set: ${key}`, valueToStore);
      } catch (error) {
        logError(error, `useLocalStorage - Set ${key}`);
      }
    },
    [key, storedValue]
  );

  // Function để xóa giá trị
  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
      console.log(`🗑️ LocalStorage Remove: ${key}`);
    } catch (error) {
      logError(error, `useLocalStorage - Remove ${key}`);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
};

// Hook để sync localStorage giữa các tabs
export const useLocalStorageSync = <T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, () => void] => {
  const [storedValue, setValue, removeValue] = useLocalStorage(
    key,
    initialValue
  );

  // Listen for storage changes từ các tabs khác
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const newValue = JSON.parse(e.newValue);
          setValue(newValue);
          console.log(`🔄 LocalStorage Sync: ${key}`, newValue);
        } catch (error) {
          logError(error, `useLocalStorageSync - Sync ${key}`);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [key, setValue]);

  return [storedValue, setValue, removeValue];
};

// Hook cho session storage (tương tự localStorage nhưng chỉ tồn tại trong session)
export const useSessionStorage = <T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, () => void] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      logError(error, `useSessionStorage - Get ${key}`);
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);

        if (valueToStore === undefined) {
          window.sessionStorage.removeItem(key);
        } else {
          window.sessionStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        logError(error, `useSessionStorage - Set ${key}`);
      }
    },
    [key, storedValue]
  );

  const removeValue = useCallback(() => {
    try {
      window.sessionStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      logError(error, `useSessionStorage - Remove ${key}`);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
};
