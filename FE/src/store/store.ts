// ===== REDUX STORE CONFIGURATION =====

import { configureStore } from "@reduxjs/toolkit";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import dataReducer from "./slices/dataSlice";
import appReducer from "./slices/appSlice";

// Cấu hình store
export const store = configureStore({
  reducer: {
    data: dataReducer,
    app: appReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["persist/PERSIST", "persist/REHYDRATE"],
      },
    }),
  devTools: process.env.NODE_ENV !== "production",
});

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// ===== TYPED HOOKS =====
// Thay vì sử dụng plain `useDispatch` và `useSelector`
// Sử dụng typed versions để có type safety

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// ===== SELECTORS =====
// Các selectors để lấy data từ store

// Data selectors
export const selectPosts = (state: RootState) => state.data.posts;
export const selectLiveData = (state: RootState) => state.data.liveData;
export const selectCounter = (state: RootState) => state.data.counter;

// App selectors
export const selectTheme = (state: RootState) => state.app.theme;
export const selectLayout = (state: RootState) => state.app.layout;
export const selectNotifications = (state: RootState) =>
  state.app.notifications;
export const selectLanguage = (state: RootState) => state.app.language;
export const selectGlobalLoading = (state: RootState) => state.app.loading;

// Combined selectors
export const selectAppConfig = (state: RootState) => ({
  theme: state.app.theme,
  language: state.app.language,
  layout: state.app.layout,
});

export const selectDataStates = (state: RootState) => ({
  posts: state.data.posts,
  liveData: state.data.liveData,
  counter: state.data.counter,
});
