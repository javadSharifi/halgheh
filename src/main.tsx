import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/600.css';
import '@fontsource/vazirmatn/700.css';
import '@fontsource/vazirmatn/800.css';
import './style.css';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { isNative } from './native';

if (!isNative) registerSW({ immediate: true }); // the APK already bundles the assets; a service worker would only serve stale copies after an update
navigator.storage?.persist?.(); // ask the browser not to evict our data
createRoot(document.getElementById('root')!).render(<ErrorBoundary><App /></ErrorBoundary>);
