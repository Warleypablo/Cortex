import '@testing-library/jest-dom';

// Recharts ResponsiveContainer usa ResizeObserver — polyfill pra jsdom
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub as any;
}
