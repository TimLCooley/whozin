import { suggestEmoji, DEFAULT_ACTIVITY_PRESETS, ACTIVITY_CATEGORIES } from '@/lib/activity-presets'

describe('suggestEmoji', () => {
  test('exact matches return correct emoji', () => {
    expect(suggestEmoji('basketball')).toBe('🏀')
    expect(suggestEmoji('golf')).toBe('⛳')
    expect(suggestEmoji('yoga')).toBe('🧘')
    expect(suggestEmoji('pizza')).toBe('🍕')
  })

  test('case insensitive', () => {
    expect(suggestEmoji('Basketball')).toBe('🏀')
    expect(suggestEmoji('GOLF')).toBe('⛳')
    expect(suggestEmoji('Yoga')).toBe('🧘')
  })

  test('partial/includes matches work', () => {
    expect(suggestEmoji('Saturday Basketball Game')).toBe('🏀')
    expect(suggestEmoji('Morning Yoga Class')).toBe('🧘')
    expect(suggestEmoji('Friday Happy Hour')).toBe('🍺')
  })

  test('plural forms match', () => {
    expect(suggestEmoji('darts')).toBe('🎯')
    expect(suggestEmoji('cocktails')).toBe('🍸')
  })

  test('returns empty string for no match', () => {
    expect(suggestEmoji('')).toBe('')
    expect(suggestEmoji('xyzzy')).toBe('')
    expect(suggestEmoji('random thing')).toBe('')
  })

  test('trims whitespace', () => {
    expect(suggestEmoji('  golf  ')).toBe('⛳')
  })
})

describe('DEFAULT_ACTIVITY_PRESETS', () => {
  test('all presets have required fields', () => {
    for (const preset of DEFAULT_ACTIVITY_PRESETS) {
      expect(preset.id).toBeTruthy()
      expect(preset.name).toBeTruthy()
      expect(preset.icon).toBeTruthy()
      expect(preset.category).toBeTruthy()
      expect(typeof preset.enabled).toBe('boolean')
    }
  })

  test('all preset categories are valid', () => {
    for (const preset of DEFAULT_ACTIVITY_PRESETS) {
      expect(ACTIVITY_CATEGORIES).toContain(preset.category)
    }
  })

  test('preset IDs are unique', () => {
    const ids = DEFAULT_ACTIVITY_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
