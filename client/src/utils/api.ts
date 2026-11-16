import axios, { AxiosError } from "axios";
import { resolveApiBaseUrl } from "./apiBase";

const baseURL = resolveApiBaseUrl();

export const SESSION_EXPIRED_EVENT = "auth:session-expired";
export const TOKEN_REFRESHED_EVENT = "auth:token-refreshed";
export const EMAIL_NOT_VERIFIED_EVENT = "auth:email-not-verified";

interface StoredTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

export const api = axios.create({
  baseURL,
  withCredentials: true
});

function getStoredTokens(): StoredTokens {
  try {
    const raw = localStorage.getItem("authTokens");
    if (!raw) {
      return { accessToken: null, refreshToken: null };
    }
    const parsed = JSON.parse(raw) as { accessToken?: unknown; refreshToken?: unknown };
    const accessToken =
      typeof parsed?.accessToken === "string" && parsed.accessToken.length > 0
        ? parsed.accessToken
        : null;
    const refreshToken =
      typeof parsed?.refreshToken === "string" && parsed.refreshToken.length > 0
        ? parsed.refreshToken
        : null;
    return { accessToken, refreshToken };
  } catch {
    return { accessToken: null, refreshToken: null };
  }
}

function persistAccessToken(accessToken: string): void {
  let issuedAt: number | undefined;
  try {
    const raw = localStorage.getItem("authTokens");
    if (raw) {
      const parsed = JSON.parse(raw) as { issuedAt?: number };
      issuedAt = parsed.issuedAt;
    }
  } catch {
    issuedAt = undefined;
  }
  const { refreshToken } = getStoredTokens();
  localStorage.setItem(
    "authTokens",
    JSON.stringify({
      accessToken,
      refreshToken,
      issuedAt: issuedAt ?? Date.now()
    })
  );
}

function clearStoredTokens(): void {
  try {
    localStorage.removeItem("authTokens");
  } catch {
    return;
  }
}

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.request.use(
  async (config) => {
    const { accessToken: token } = getStoredTokens();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };
    const status = error.response?.status;
    const requestUrl = originalRequest?.url || "";
    const isAuthRefreshCall = requestUrl.includes("/auth/refresh");
    // Login/register rejections mean bad credentials, not an expired session,
    // so they must never trigger the refresh flow.
    const isCredentialCall =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/register") ||
      requestUrl.includes("/auth/forgot-password") ||
      requestUrl.includes("/auth/reset-password");

    // A protected route rejected the request because the account's email is
    // not verified. Drop the (unusable) session and send the user to the
    // verification screen. Login itself is excluded: the login page inspects
    // this code directly to offer a resend action.
    const isEmailNotVerified =
      status === 403 &&
      (error.response?.data as { code?: string } | undefined)?.code === "EMAIL_NOT_VERIFIED";
    if (isEmailNotVerified && !isCredentialCall) {
      clearStoredTokens();
      notifyEmailNotVerified();
      return Promise.reject(error);
    }

    if (status === 401 && !originalRequest._retry && !isAuthRefreshCall && !isCredentialCall) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers && token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const { refreshToken } = getStoredTokens();
      if (!refreshToken) {
        isRefreshing = false;
        processQueue(error, null);
        clearStoredTokens();
        notifySessionExpired();
        return Promise.reject(error);
      }

      try {
        const refreshResponse = await api.post<{ accessToken: string }>("/auth/refresh", {
          refreshToken
        });
        const token = refreshResponse.data.accessToken;
        persistAccessToken(token);
        notifyTokenRefreshed(token);
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
        }
        isRefreshing = false;
        processQueue(null, token);
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError as AxiosError, null);
        clearStoredTokens();
        notifySessionExpired();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

function notifySessionExpired(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
}

function notifyTokenRefreshed(accessToken: string): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(TOKEN_REFRESHED_EVENT, { detail: { accessToken } })
    );
  }
}

function notifyEmailNotVerified(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EMAIL_NOT_VERIFIED_EVENT));
  }
}

