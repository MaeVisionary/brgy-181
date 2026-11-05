/**
 * App-wide settings. Values marked ASSUMPTION are placeholders awaiting
 * approval and should be confirmed before the backend phase.
 */
export const APP_CONFIG = {
  barangayName: 'Barangay 181',
  barangayFullName: 'Barangay 181, Zone 16, District II, Manila',
  systemName: 'Information Management System',

  /** ASSUMPTION: failed attempts before lockout (spec says "repeated"). */
  lockoutThreshold: 5,
  /** ASSUMPTION: idle session length in minutes. */
  sessionMinutes: 30,

  /**
   * Shows the role switcher and demo banner. On in development, or when
   * VITE_DEMO_MODE=true for presentations. Never enable in production.
   */
  demoMode: import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true',

  /** Simulated network delay for the mock service layer (ms). */
  mockLatencyMs: 180,
} as const
