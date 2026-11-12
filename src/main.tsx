import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/manrope/800.css'
import './index.css'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import { AnalyticsProvider } from './analytics/AnalyticsContext'
import { applyTextSize, readTextSize } from './components/layout/TextSizeControl'
import { seedDemoData } from './demo/seedDemo'

applyTextSize(readTextSize())

// Demo data first (synthetic, connected records for every role), then the app.
seedDemoData().catch(() => undefined).finally(() => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
      <AuthProvider>
        <AnalyticsProvider>
          <App />
        </AnalyticsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
))
