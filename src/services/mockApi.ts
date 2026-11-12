import { APP_CONFIG } from '@/config/app'

/**
 * Simulates an async API call against in-memory mock data.
 * In the integration phase each service function swaps this for a real fetch.
 * Mock changes live in memory only and reset on page reload.
 */
export function mockRequest<T>(produce: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // No connection: nothing is sent, so nothing is created. The form keeps its draft.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        reject(new ServiceError('offline', 'You are offline, so this was not sent. Your entries are saved on this device. Please try again when you are connected.'))
        return
      }
      try {
        resolve(structuredClone(produce()))
      } catch (err) {
        reject(err)
      }
    }, APP_CONFIG.mockLatencyMs)
  })
}

export class ServiceError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}
