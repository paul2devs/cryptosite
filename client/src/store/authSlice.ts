import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { api } from "../utils/api";
import { extractAuthErrorMessage } from "../utils/authErrors";

export interface UserInfo {
  user_id: string;
  name: string;
  email: string;
  level: number;
  xp: number;
  streak: number;
  pending_earnings: unknown;
  is_admin: boolean;
  referral_code?: string | null;
  referred_by?: string | null;
}

export interface AuthState {
  user: UserInfo | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  loading: false,
  error: null
};

interface AuthResponse {
  user: UserInfo;
  accessToken: string;
  refreshToken: string;
}

export const registerUser = createAsyncThunk<
  AuthResponse,
  {
    name: string;
    email: string;
    password: string;
    walletAddress?: string;
    referralCode?: string;
  },
  { rejectValue: string }
>("auth/register", async (payload, thunkApi) => {
  try {
    const response = await api.post<AuthResponse>("/auth/register", payload);
    return response.data;
  } catch (error: unknown) {
    return thunkApi.rejectWithValue(
      extractAuthErrorMessage(error, "Something went wrong, please try again.")
    );
  }
});

export const loginUser = createAsyncThunk<
  AuthResponse,
  { email: string; password: string },
  { rejectValue: string }
>("auth/login", async (payload, thunkApi) => {
  try {
    const response = await api.post<AuthResponse>("/auth/login", payload);
    return response.data;
  } catch (error: unknown) {
    return thunkApi.rejectWithValue(
      extractAuthErrorMessage(error, "Unable to log in. Please try again.")
    );
  }
});

export const fetchMe = createAsyncThunk<
  { user: UserInfo },
  void,
  { rejectValue: string }
>("auth/me", async (_, thunkApi) => {
  try {
    const response = await api.get<{ user: UserInfo }>("/auth/me");
    return response.data;
  } catch (error: unknown) {
    return thunkApi.rejectWithValue(
      extractAuthErrorMessage(error, "Your session has expired. Please log in again.")
    );
  }
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.error = null;
      localStorage.removeItem("authTokens");
    },
    loadStoredTokens(state) {
      const stored = localStorage.getItem("authTokens");
      if (stored) {
        const parsed = JSON.parse(stored) as {
          accessToken: string;
          refreshToken: string;
        };
        state.accessToken = parsed.accessToken;
        state.refreshToken = parsed.refreshToken;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        registerUser.fulfilled,
        (state, action: PayloadAction<AuthResponse>) => {
          state.loading = false;
          state.user = action.payload.user;
          state.accessToken = action.payload.accessToken;
          state.refreshToken = action.payload.refreshToken;
          localStorage.setItem(
            "authTokens",
            JSON.stringify({
              accessToken: action.payload.accessToken,
              refreshToken: action.payload.refreshToken,
              issuedAt: Date.now()
            })
          );
        }
      )
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Registration failed";
      })
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        loginUser.fulfilled,
        (state, action: PayloadAction<AuthResponse>) => {
          state.loading = false;
          state.user = action.payload.user;
          state.accessToken = action.payload.accessToken;
          state.refreshToken = action.payload.refreshToken;
          localStorage.setItem(
            "authTokens",
            JSON.stringify({
              accessToken: action.payload.accessToken,
              refreshToken: action.payload.refreshToken,
              issuedAt: Date.now()
            })
          );
        }
      )
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Login failed";
      })
      .addCase(fetchMe.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
      })
      .addCase(fetchMe.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to fetch user";
      });
  }
});

export const { logout, loadStoredTokens } = authSlice.actions;

export default authSlice.reducer;

