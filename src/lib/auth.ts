/** Admin emails/phones that can access the admin portal */
export const SUPER_ADMIN_EMAILS = [
  'timlcooley@gmail.com',
  '+16193019180@whozin.io', // phone login
]

/** Check if a user email is a super admin */
export function isSuperAdmin(email: string | undefined | null): boolean {
  if (!email) return false
  return SUPER_ADMIN_EMAILS.includes(email)
}

/** Convert a phone number to a synthetic Supabase auth email */
export function phoneToEmail(phone: string): string {
  return `${phone}@whozin.io`
}

/** Extract phone from a synthetic whozin.io email */
export function emailToPhone(email: string): string | null {
  const match = email.match(/^(.+)@whozin\.io$/)
  return match ? match[1] : null
}

/** Check if input looks like a phone number (vs email) */
export function isPhoneNumber(input: string): boolean {
  const cleaned = input.replace(/[\s\-().]/g, '')
  return /^\+?\d{7,15}$/.test(cleaned)
}

/** Normalize phone input to E.164 format */
export function normalizePhone(phone: string, countryCode: string): string {
  const digits = phone.replace(/\D/g, '')
  return `+${countryCode}${digits}`
}
