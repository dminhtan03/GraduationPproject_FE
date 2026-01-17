// ===== REDUX SLICE CHO APP SETTINGS =====

import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Interface cho app state
interface AppState {
  // Theme settings
  theme: {
    mode: "light" | "dark";
    primaryColor: string;
  };

  // Layout settings
  layout: {
    sidebarCollapsed: boolean;
    headerVisible: boolean;
  };

  // Notification settings
  notifications: {
    enabled: boolean;
    sound: boolean;
    desktop: boolean;
  };

  // Language
  language: "vi" | "en";

  // Loading states
  loading: {
    global: boolean;
    message: string;
  };
}

// Initial state
const initialState: AppState = {
  theme: {
    mode: "light",
    primaryColor: "#1890ff",
  },
  layout: {
    sidebarCollapsed: false,
    headerVisible: true,
  },
  notifications: {
    enabled: true,
    sound: true,
    desktop: false,
  },
  language: "vi",
  loading: {
    global: false,
    message: "",
  },
};

// ===== SLICE =====
const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    // Theme actions
    setTheme: (state, action: PayloadAction<"light" | "dark">) => {
      state.theme.mode = action.payload;
    },
    setPrimaryColor: (state, action: PayloadAction<string>) => {
      state.theme.primaryColor = action.payload;
    },
    toggleTheme: (state) => {
      state.theme.mode = state.theme.mode === "light" ? "dark" : "light";
    },

    // Layout actions
    toggleSidebar: (state) => {
      state.layout.sidebarCollapsed = !state.layout.sidebarCollapsed;
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.layout.sidebarCollapsed = action.payload;
    },
    setHeaderVisible: (state, action: PayloadAction<boolean>) => {
      state.layout.headerVisible = action.payload;
    },

    // Notification actions
    setNotificationsEnabled: (state, action: PayloadAction<boolean>) => {
      state.notifications.enabled = action.payload;
    },
    setNotificationSound: (state, action: PayloadAction<boolean>) => {
      state.notifications.sound = action.payload;
    },
    setDesktopNotifications: (state, action: PayloadAction<boolean>) => {
      state.notifications.desktop = action.payload;
    },

    // Language actions
    setLanguage: (state, action: PayloadAction<"vi" | "en">) => {
      state.language = action.payload;
    },

    // Loading actions
    setGlobalLoading: (
      state,
      action: PayloadAction<{ loading: boolean; message?: string }>
    ) => {
      state.loading.global = action.payload.loading;
      state.loading.message = action.payload.message || "";
    },

    // Reset app settings
    resetAppSettings: (state) => {
      Object.assign(state, initialState);
    },
  },
});

// Export actions
export const {
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
} = appSlice.actions;

// Export reducer
export default appSlice.reducer;
