// ===== EXPORT STORE VÀ CÁC UTILITIES =====

// Export store và types
export { store } from "./store";
export type { RootState, AppDispatch } from "./store";

// Export hooks
export { useAppDispatch, useAppSelector } from "./store";

// Export selectors
export {
  selectPosts,
  selectLiveData,
  selectCounter,
  selectTheme,
  selectLayout,
  selectNotifications,
  selectLanguage,
  selectGlobalLoading,
  selectAppConfig,
  selectDataStates,
} from "./store";

// Export actions từ các slices
export {
  increment,
  decrement,
  incrementByAmount,
  resetCounter,
  updateLiveData,
  clearPostsError,
  clearLiveDataError,
  fetchPosts,
  fetchLiveData,
  createPost,
} from "./slices/dataSlice";

export {
  setTheme,
  setPrimaryColor,
  toggleTheme,
  toggleSidebar,
  setSidebarCollapsed,
  setHeaderVisible,
  setNotificationsEnabled,
  setNotificationSound,
  setDesktopNotifications,
  setLanguage,
  setGlobalLoading,
  resetAppSettings,
} from "./slices/appSlice";
