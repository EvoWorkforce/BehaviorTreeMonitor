import { describe, expect, it } from 'vitest'
import { shortTypeName, typeLabel, visibleEntries } from '@/lib/format'

describe('__type handling', () => {
  it('drops __type from entries', () => {
    const obj = { __type: 'a::B_<std::allocator<void> >', x: 1, nested: { __type: 'a::C', y: 2 } }
    expect(visibleEntries(obj).map(([k]) => k)).toEqual(['x', 'nested'])
    expect(visibleEntries(obj.nested).map(([k]) => k)).toEqual(['y'])
  })
  it('shortens a C++ type name', () => {
    expect(shortTypeName('geometry_msgs::msg::Pose_<std::allocator<void> >')).toBe('Pose')
    expect(shortTypeName('Waypoint')).toBe('Waypoint')
  })
  it('gives no label without __type', () => {
    expect(typeLabel({ x: 1 })).toBe('')
    expect(typeLabel([1])).toBe('')
    expect(typeLabel({ __type: 'a::msg::Pose_<std::allocator<void> >' })).toBe('Pose')
  })
})
