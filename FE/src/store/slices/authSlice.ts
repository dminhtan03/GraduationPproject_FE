import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { User } from "../../types";
import { getCurrentUser, restoreSession } from "../../services/authService";

interface AuthSliceState {
  user: User | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
}

const initialUser = getCurrentUser();

const initialState: AuthSliceState = {
  user: initialUser,
  isAuthenticated: Boolean(initialUser),
  isInitializing: !initialUser,
};

export const initializeAuthSession = createAsyncThunk(
  "auth/initializeAuthSession",
  async (): Promise<User | null> => {
    const user = getCurrentUser();
    if (user) {
      return user;
    }

    return restoreSession();
  },
);

export const syncAuthState = createAsyncThunk(
  "auth/syncAuthState",
  async (): Promise<User | null> => {
    return getCurrentUser();
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuthenticatedUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      state.isAuthenticated = Boolean(action.payload);
      state.isInitializing = false;
    },
    clearAuthenticatedUser: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.isInitializing = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initializeAuthSession.pending, (state) => {
        state.isInitializing = true;
      })
      .addCase(initializeAuthSession.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = Boolean(action.payload);
        state.isInitializing = false;
      })
      .addCase(initializeAuthSession.rejected, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.isInitializing = false;
      })
      .addCase(syncAuthState.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = Boolean(action.payload);
        state.isInitializing = false;
      })
      .addCase(syncAuthState.rejected, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.isInitializing = false;
      });
  },
});

export const { setAuthenticatedUser, clearAuthenticatedUser } =
  authSlice.actions;

export default authSlice.reducer;
