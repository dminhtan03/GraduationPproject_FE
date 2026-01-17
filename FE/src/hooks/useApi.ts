// ===== CUSTOM HOOK CHO API CALLS =====

import { useState, useEffect, useCallback } from "react";
import { ApiError } from "../types";
import { logError } from "../utils/errorHandlers";

// Generic interface cho API state
interface ApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: ApiError | null;
}

// Generic hook cho API calls với loading và error handling
export const useApi = <T>(
  apiFunction: () => Promise<{ data: T }>,
  dependencies: any[] = []
) => {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    isLoading: false,
    error: null,
  });

  // Function để gọi API
  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await apiFunction();
      setState({
        data: response.data,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      logError(error, "useApi Hook");
      setState({
        data: null,
        isLoading: false,
        error: error as ApiError,
      });
    }
  }, dependencies);

  // Gọi API khi component mount hoặc dependencies thay đổi
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Function để retry khi có lỗi
  const retry = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Function để reset state
  const reset = useCallback(() => {
    setState({
      data: null,
      isLoading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    refetch: fetchData,
    retry,
    reset,
  };
};

// Hook cho API calls với manual trigger (không tự động gọi)
export const useApiManual = <T, P extends any[]>(
  apiFunction: (...params: P) => Promise<{ data: T }>
) => {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    isLoading: false,
    error: null,
  });

  const execute = useCallback(
    async (...params: P) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await apiFunction(...params);
        setState({
          data: response.data,
          isLoading: false,
          error: null,
        });
        return response.data;
      } catch (error: any) {
        logError(error, "useApiManual Hook");
        setState({
          data: null,
          isLoading: false,
          error: error as ApiError,
        });
        throw error;
      }
    },
    [apiFunction]
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      isLoading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
};
