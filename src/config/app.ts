import { BARANGAY } from './barangay'

/**
 * App-wide settings. Values marked ASSUMPTION are placeholders awaiting
 * approval and should be confirmed before the backend phase.
 */
export const APP_CONFIG = {
  barangayName: BARANGAY.name,
  barangayFullName: BARANGAY.fullName,
  systemName: BARANGAY.systemName,

  /** ASSUMPTION: failed attempts before lockout (spec says "repeated"). */
  lockoutThreshold: 5,
  /** ASSUMPTION: idle session length in minutes. */
  sessionMinutes: 30,

  /**
   * Development-only prototype preview (/preview and the in-app account switcher).
   * Only in `npm run dev`; compiled out of production builds. Never linked from public pages.
   */
  devPreview: import.meta.env.DEV,

  /** Simulated network delay for the mock service layer (ms). */
  mockLatencyMs: 180,
} as const
