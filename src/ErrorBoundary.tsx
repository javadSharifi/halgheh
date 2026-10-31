import { Component, type ReactNode } from 'react';
import { tx } from './i18n';

/** Last line of defence: an unexpected error shows a message and a reload button instead of a blank screen. Data is untouched. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error(error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main style={{ textAlign: 'center', paddingTop: '30vh' }}>
        <h1>{tx('مشکلی پیش آمد')}</h1>
        <p className="hint">{tx('داده‌های شما سالم است. برنامه را دوباره باز کنید.')}</p>
        <button className="primary" onClick={() => location.reload()}>{tx('بارگذاری دوباره')}</button>
      </main>
    );
  }
}
