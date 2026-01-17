// ===== REDUX SLICE CHO DATA FETCHING =====

import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { ApiError, DemoData } from "../../types";
import { demoApiService, liveDataService } from "../../services/demoApi";

// Interface cho data state
interface DataState {
  // Posts data
  posts: {
    items: any[];
    isLoading: boolean;
    error: ApiError | null;
  };

  // Live data
  liveData: {
    items: DemoData[];
    isLoading: boolean;
    error: ApiError | null;
    lastUpdated: string | null;
  };

  // Counter cho demo
  counter: {
    value: number;
  };
}

// Initial state
const initialState: DataState = {
  posts: {
    items: [],
    isLoading: false,
    error: null,
  },
  liveData: {
    items: [],
    isLoading: false,
    error: null,
    lastUpdated: null,
  },
  counter: {
    value: 0,
  },
};

// ===== ASYNC THUNKS =====

// Fetch posts từ API
export const fetchPosts = createAsyncThunk(
  "data/fetchPosts",
  async (limit: number = 10, { rejectWithValue }) => {
    try {
      const response = await demoApiService.getPosts(limit);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error);
    }
  }
);

// Fetch live data
export const fetchLiveData = createAsyncThunk(
  "data/fetchLiveData",
  async (_, { rejectWithValue }) => {
    try {
      const data = await liveDataService.getLiveData();
      return data;
    } catch (error: any) {
      return rejectWithValue(error);
    }
  }
);

// Create new post
export const createPost = createAsyncThunk(
  "data/createPost",
  async (
    postData: { title: string; body: string; userId: number },
    { rejectWithValue }
  ) => {
    try {
      const response = await demoApiService.createPost(postData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error);
    }
  }
);

// ===== SLICE =====
const dataSlice = createSlice({
  name: "data",
  initialState,
  reducers: {
    // Counter actions
    increment: (state) => {
      state.counter.value += 1;
    },
    decrement: (state) => {
      state.counter.value -= 1;
    },
    incrementByAmount: (state, action: PayloadAction<number>) => {
      state.counter.value += action.payload;
    },
    resetCounter: (state) => {
      state.counter.value = 0;
    },

    // Live data actions
    updateLiveData: (state, action: PayloadAction<DemoData[]>) => {
      state.liveData.items = action.payload;
      state.liveData.lastUpdated = new Date().toISOString();
    },

    // Clear errors
    clearPostsError: (state) => {
      state.posts.error = null;
    },
    clearLiveDataError: (state) => {
      state.liveData.error = null;
    },
  },
  extraReducers: (builder) => {
    // ===== FETCH POSTS =====
    builder
      .addCase(fetchPosts.pending, (state) => {
        state.posts.isLoading = true;
        state.posts.error = null;
      })
      .addCase(fetchPosts.fulfilled, (state, action) => {
        state.posts.isLoading = false;
        state.posts.items = action.payload;
        state.posts.error = null;
      })
      .addCase(fetchPosts.rejected, (state, action) => {
        state.posts.isLoading = false;
        state.posts.error = action.payload as ApiError;
      })

      // ===== FETCH LIVE DATA =====
      .addCase(fetchLiveData.pending, (state) => {
        state.liveData.isLoading = true;
        state.liveData.error = null;
      })
      .addCase(fetchLiveData.fulfilled, (state, action) => {
        state.liveData.isLoading = false;
        state.liveData.items = action.payload;
        state.liveData.error = null;
        state.liveData.lastUpdated = new Date().toISOString();
      })
      .addCase(fetchLiveData.rejected, (state, action) => {
        state.liveData.isLoading = false;
        state.liveData.error = action.payload as ApiError;
      })

      // ===== CREATE POST =====
      .addCase(createPost.pending, (state) => {
        state.posts.isLoading = true;
        state.posts.error = null;
      })
      .addCase(createPost.fulfilled, (state, action) => {
        state.posts.isLoading = false;
        state.posts.items.unshift(action.payload); // Thêm post mới vào đầu list
        state.posts.error = null;
      })
      .addCase(createPost.rejected, (state, action) => {
        state.posts.isLoading = false;
        state.posts.error = action.payload as ApiError;
      });
  },
});

// Export actions
export const {
  increment,
  decrement,
  incrementByAmount,
  resetCounter,
  updateLiveData,
  clearPostsError,
  clearLiveDataError,
} = dataSlice.actions;

// Export reducer
export default dataSlice.reducer;
