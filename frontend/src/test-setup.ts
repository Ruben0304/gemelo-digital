import '@testing-library/jest-dom'

// jsdom en este entorno no implementa localStorage — proveemos un mock funcional
const _store: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string) => _store[key] ?? null,
  setItem: (key: string, value: string) => { _store[key] = value },
  removeItem: (key: string) => { delete _store[key] },
  clear: () => { for (const k in _store) delete _store[k] },
  get length() { return Object.keys(_store).length },
  key: (index: number) => Object.keys(_store)[index] ?? null,
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true })
