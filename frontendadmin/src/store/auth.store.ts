import { create } from "zustand";

interface AuthState {
  token: string | null;
  setToken: (token: string) => void;
  logout: () => void;
}

// Helper to set cookie safely
const setCookie = (name: string, value: string, days = 7) => {
  if (typeof window === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
};

// Helper to remove cookie
const removeCookie = (name: string) => {
  if (typeof window === "undefined") return;
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: typeof window !== "undefined" ? localStorage.getItem("token") : null,

  setToken: (token) => {
    localStorage.setItem("token", token);
    setCookie("token", token);
    set({ token });
  },

  logout: () => {
    localStorage.removeItem("token");
    removeCookie("token");
    set({ token: null });
    // Force reload/redirect could be handled here or in component
    window.location.href = "/";
  },
}));
