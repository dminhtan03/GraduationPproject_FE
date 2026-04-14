import { STORAGE_KEYS } from "../constants";

const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";
const LEGACY_REFRESH_TOKEN_COOKIE_NAME = "refresh_token";
const REFRESH_TOKEN_FALLBACK_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const isBrowser =
  typeof window !== "undefined" && typeof document !== "undefined";

const getSecureFlag = () =>
  typeof window !== "undefined" && window.location.protocol === "https:"
    ? "; secure"
    : "";

const readCookie = (name: string): string | null => {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
};

const writeCookie = (name: string, value: string, maxAgeSeconds: number) => {
  if (!isBrowser) return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax${getSecureFlag()}`;
};

const clearCookie = (name: string) => {
  if (!isBrowser) return;
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax${getSecureFlag()}`;
};

export const getAccessToken = (): string | null => {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.USER_TOKEN);
};

export const setAccessToken = (accessToken: string) => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.USER_TOKEN, accessToken);
};

export const clearAccessToken = () => {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEYS.USER_TOKEN);
};

export const getRefreshToken = (): string | null => {
  if (typeof localStorage !== "undefined") {
    const storedRefreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (storedRefreshToken) {
      return storedRefreshToken;
    }
  }

  return (
    readCookie(REFRESH_TOKEN_COOKIE_NAME) ||
    readCookie(LEGACY_REFRESH_TOKEN_COOKIE_NAME)
  );
};

export const persistRefreshToken = (refreshToken: string) => {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  }

  // Keep a non-HttpOnly fallback cookie so FE can still pass refreshToken query param if needed.
  writeCookie(
    REFRESH_TOKEN_COOKIE_NAME,
    refreshToken,
    REFRESH_TOKEN_FALLBACK_MAX_AGE_SECONDS,
  );
};

export const clearRefreshToken = () => {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  }

  clearCookie(REFRESH_TOKEN_COOKIE_NAME);
  clearCookie(LEGACY_REFRESH_TOKEN_COOKIE_NAME);
};
