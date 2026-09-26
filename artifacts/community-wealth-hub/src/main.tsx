import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { setBaseUrl } from '@workspace/api-client-react';

import './index.css';

console.log('Application initializing...');
console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);

// Set API base URL for deployed environment
if (import.meta.env.VITE_API_URL) {
  console.log('Setting API base URL to:', import.meta.env.VITE_API_URL);
  setBaseUrl(import.meta.env.VITE_API_URL);
} else {
  console.log('No API URL configured, using demo mode');
}

// Global error handler to catch any JavaScript errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    document.body.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: #f5f5f5; padding: 20px;">
        <div style="background: white; padding: 30px; border-radius: 12px; max-width: 500px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <h1 style="color: #333; margin-top: 0;">Application Error</h1>
          <p style="color: #666;">${event.error?.message || 'Unknown error'}</p>
          <pre style="background: #f0f0f0; padding: 12px; border-radius: 8px; overflow: auto; max-height: 200px;">${event.error?.stack || 'No stack trace'}</pre>
        </div>
      </div>
    `;
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    document.body.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: #f5f5f5; padding: 20px;">
        <div style="background: white; padding: 30px; border-radius: 12px; max-width: 500px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <h1 style="color: #333; margin-top: 0;">Promise Rejection</h1>
          <p style="color: #666;">${event.reason?.message || 'Unknown rejection'}</p>
        </div>
      </div>
    `;
  });
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('Service Worker registration failed: ', registrationError);
      });
  });
}

console.log('Creating React root...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('Root element not found!');
  document.body.innerHTML = '<div style="padding: 20px; color: red;">Error: Root element not found</div>';
} else {
  createRoot(rootElement, {
    // Keeps caught errors off reportError(), which would raise the dev overlay.
    onCaughtError: (error, errorInfo) => {
      console.error('React error:', error, errorInfo.componentStack);
    },
  }).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
  console.log('Application rendered');
}
