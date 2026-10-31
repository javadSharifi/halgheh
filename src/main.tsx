import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/600.css';
import '@fontsource/vazirmatn/700.css';
import '@fontsource/vazirmatn/800.css';
import './style.css';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { ensureRuleCategories, ensureSelf } from './db';
import { repairBrokenCounts } from './ruleData';
import { ErrorBoundary } from './ErrorBoundary';
import { isNative } from './native';

if (!isNative) registerSW({ immediate: true }); // the APK already bundles the assets; a service worker would only serve stale copies after an update
navigator.storage?.persist?.(); // ask the browser not to evict our data
void ensureSelf().catch(console.error);
// the rulebook's default categories: Dexie does not run a version upgrade on a brand-new database, so first run seeds here
void ensureRuleCategories().catch(console.error);
// a break row can arrive from another device by sync; the count is derived from those rows, so bring the cache back in step
void repairBrokenCounts().catch(console.error);
createRoot(document.getElementById('root')!).render(<ErrorBoundary><App /></ErrorBoundary>);
