import '@testing-library/jest-dom/vitest'

// Node 25 ships a built-in `localStorage` global that shadows the jsdom one,
// leaving a bare object with no Storage methods. Install a working Storage
// when that happens. Harmless on Node 22, where jsdom's own Storage is intact.
if (typeof localStorage?.clear !== 'function') {
  class MemoryStorage implements Storage {
    #map = new Map<string, string>()
    get length() { return this.#map.size }
    key(i: number) { return [...this.#map.keys()][i] ?? null }
    getItem(k: string) { return this.#map.get(String(k)) ?? null }
    setItem(k: string, v: string) { this.#map.set(String(k), String(v)) }
    removeItem(k: string) { this.#map.delete(String(k)) }
    clear() { this.#map.clear() }
  }
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    const store = new MemoryStorage()
    Object.defineProperty(globalThis, name, { value: store, configurable: true, writable: true })
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, name, { value: store, configurable: true, writable: true })
    }
  }
}
