/// <reference types="vite/client" />

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    twq?: (...args: any[]) => void;
  }
}

export {};
