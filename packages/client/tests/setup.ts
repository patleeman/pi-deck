import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi, beforeEach } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

beforeEach(() => {
  localStorageMock.clear();
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
  writable: true,
});

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock CodeMirrorEditor
vi.mock('../src/components/CodeMirrorEditor', () => {
  const React = require('react');
  return {
    CodeMirrorEditor: function CodeMirrorEditorMock({ value, onChange }: { value: string; onChange: (v: string) => void }) {
      return React.createElement('textarea', {
        value: value,
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value),
        'data-testid': 'codemirror-editor',
        'aria-label': 'editor',
      });
    },
    __esModule: true,
    default: function CodeMirrorEditorMock({ value, onChange }: { value: string; onChange: (v: string) => void }) {
      return React.createElement('textarea', {
        value: value,
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value),
        'data-testid': 'codemirror-editor',
        'aria-label': 'editor',
      });
    },
  };
});
