import axios, { AxiosError } from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

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
  const { refreshToken } = getStoredTokens();
  localStorage.setItem(
    "authTokens",
    JSON.stringify({
      accessToken,
      refreshToken
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

    if (status === 401 && !originalRequest._retry && !isAuthRefreshCall) {
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
        return Promise.reject(error);
      }

      try {
        const refreshResponse = await api.post<{ accessToken: string }>("/auth/refresh", {
          refreshToken
        });
        const token = refreshResponse.data.accessToken;
        persistAccessToken(token);
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
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

