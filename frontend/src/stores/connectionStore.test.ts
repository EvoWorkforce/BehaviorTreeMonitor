import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useConnectionStore } from './connectionStore'

describe('connectionStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('defaults to localhost:1667, not connected', () => {
    const c = useConnectionStore()
    expect(c.host).toBe('localhost')
    expect(c.port).toBe(1667)
    expect(c.connected).toBe(false)
    expect(c.connecting).toBe(false)
  })
})
