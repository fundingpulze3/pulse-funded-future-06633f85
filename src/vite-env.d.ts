/// <reference types="vite/client" />

interface Window {
  fbq?: (...args: any[]) => void;
  twq?: (...args: any[]) => void;
}
