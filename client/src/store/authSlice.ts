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
  /** True once the initial session restoration attempt has settled. */
  initialized: boolean;
  /**
   * True when the session check could not reach the API (network error or
   * timeout) while tokens were still present. The stored session may be valid,
   * so the app must not treat the user as logged out.
   */
  sessionUnreachable: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  loading: false,
  initialized: false,
  sessionUnreachable: false,
  error: null
};

interface AuthResponse {
  user: UserInfo;
  accessToken: string;
  refreshToken: string;
}

interface StoredTokenPair {
  accessToken: string | null;
  refreshToken: string | null;
}

function readStoredTokens(): StoredTokenPair {
  try {
    const raw = localStorage.getItem("authTokens");
    if (!raw) {
      return { accessToken: null, refreshToken: null };
    }
    const parsed = JSON.parse(raw) as { accessToken?: unknown; refreshToken?: unknown };
    return {
      accessToken:
        typeof parsed?.accessToken === "string" && parsed.accessToken.length > 0
          ? parsed.accessToken
          : null,
      refreshToken:
        typeof parsed?.refreshToken === "string" && parsed.refreshToken.length > 0
          ? parsed.refreshToken
          : null
    };
  } catch {
    return { accessToken: null, refreshToken: null };
  }
}

interface RestoreSessionResult {
  user: UserInfo | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** Set when the check failed for network reasons and stored tokens were kept. */
  unreachable: boolean;
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

async function performRestoreSession(): Promise<RestoreSessionResult> {
  const stored = readStoredTokens();

  if (!stored.accessToken && !stored.refreshToken) {
    return { user: null, accessToken: null, refreshToken: null, unreachable: false };
  }

  try {
    const response = await api.get<{ user: UserInfo }>("/auth/me", { timeout: 15_000 });
    const fresh = readStoredTokens();
    return {
      user: response.data.user,
      accessToken: fresh.accessToken ?? stored.accessToken,
      refreshToken: fresh.refreshToken ?? stored.refreshToken,
      unreachable: false
    };
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 401 || status === 403 || status === 404) {
      localStorage.removeItem("authTokens");
      return { user: null, accessToken: null, refreshToken: null, unreachable: false };
    }
    // Network / timeout: the API could not be reached (for example a sleeping
    // backend). Keep the stored tokens so the session is not wrongly dropped.
    return {
      user: null,
      accessToken: stored.accessToken,
      refreshToken: stored.refreshToken,
      unreachable: true
    };
  }
}

// Single-flight: a boot can mount the effect more than once (StrictMode, fast
// remounts) but only one session check should ever hit the network. A forced
// call (used by the retry action) bypasses the cache and re-runs the check.
let restorePromise: Promise<RestoreSessionResult> | null = null;

/**
 * Restores an existing session exactly once on application boot.
 *
 * Reads the persisted token pair, verifies it with `GET /auth/me` (which will
 * transparently refresh an expired access token through the axios interceptor)
 * and always settles — so routing can wait on a single, well-defined signal
 * instead of racing an unresolved promise.
 */
export const restoreSession = createAsyncThunk<
  RestoreSessionResult,
  { force?: boolean } | undefined,
  { rejectValue: string }
>("auth/restoreSession", async (arg) => {
  if (arg?.force === true || !restorePromise) {
    restorePromise = performRestoreSession();
  }
  return restorePromise;
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.sessionUnreachable = false;
      state.error = null;
      localStorage.removeItem("authTokens");
    },
    setAccessToken(state, action: PayloadAction<string>) {
      state.accessToken = action.payload;
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
          state.initialized = true;
          state.sessionUnreachable = false;
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
          state.initialized = true;
          state.sessionUnreachable = false;
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
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.loading = false;
        state.initialized = true;
        state.sessionUnreachable = action.payload.unreachable;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.error = null;
      })
      .addCase(restoreSession.rejected, (state) => {
        state.loading = false;
        state.initialized = true;
        state.sessionUnreachable = false;
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
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

export const { logout, setAccessToken } = authSlice.actions;

export default authSlice.reducer;

