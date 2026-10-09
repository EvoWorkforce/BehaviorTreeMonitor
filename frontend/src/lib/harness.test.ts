import { describe, expect, it } from 'vitest'

describe('harness', () => {
  it('runs with a DOM', () => {
    expect(new DOMParser().parseFromString('<a/>', 'text/xml')).toBeTruthy()
  })
})
