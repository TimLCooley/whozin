import { isSuperAdmin, phoneToEmail, emailToPhone, isPhoneNumber, normalizePhone } from '@/lib/auth'

describe('isSuperAdmin', () => {
  test('returns true for known admin emails', () => {
    expect(isSuperAdmin('timlcooley@gmail.com')).toBe(true)
    expect(isSuperAdmin('timlcooley@icloud.com')).toBe(true)
    expect(isSuperAdmin('+16193019180@whozin.io')).toBe(true)
  })

  test('returns false for non-admin emails', () => {
    expect(isSuperAdmin('random@gmail.com')).toBe(false)
    expect(isSuperAdmin('someone@whozin.io')).toBe(false)
  })

  test('returns false for null/undefined', () => {
    expect(isSuperAdmin(null)).toBe(false)
    expect(isSuperAdmin(undefined)).toBe(false)
    expect(isSuperAdmin('')).toBe(false)
  })
})

describe('phoneToEmail', () => {
  test('converts phone number to synthetic email', () => {
    expect(phoneToEmail('+16193019180')).toBe('+16193019180@whozin.io')
  })
})

describe('emailToPhone', () => {
  test('extracts phone from whozin.io email', () => {
    expect(emailToPhone('+16193019180@whozin.io')).toBe('+16193019180')
  })

  test('returns null for non-whozin emails', () => {
    expect(emailToPhone('user@gmail.com')).toBeNull()
    expect(emailToPhone('user@whozin.com')).toBeNull()
  })
})

describe('isPhoneNumber', () => {
  test('recognizes valid phone numbers', () => {
    expect(isPhoneNumber('6193019180')).toBe(true)
    expect(isPhoneNumber('+16193019180')).toBe(true)
    expect(isPhoneNumber('619-301-9180')).toBe(true)
    expect(isPhoneNumber('(619) 301-9180')).toBe(true)
  })

  test('rejects emails and short strings', () => {
    expect(isPhoneNumber('user@gmail.com')).toBe(false)
    expect(isPhoneNumber('12345')).toBe(false)
    expect(isPhoneNumber('')).toBe(false)
  })
})

describe('normalizePhone', () => {
  test('normalizes to E.164 with country code', () => {
    expect(normalizePhone('6193019180', '1')).toBe('+16193019180')
    expect(normalizePhone('(619) 301-9180', '1')).toBe('+16193019180')
  })

  test('works with other country codes', () => {
    expect(normalizePhone('7911123456', '44')).toBe('+447911123456')
  })
})
