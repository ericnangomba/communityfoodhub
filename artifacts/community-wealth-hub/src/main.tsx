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
