import type { PokerApi } from './index'

declare global {
  interface Window {
    api: PokerApi
  }
}
