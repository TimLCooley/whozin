import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

// Public endpoint — returns allowed country codes
export async function GET() {
  const admin = getAdminClient()
  const { data } = await admin
    .from('whozin_settings')
    .select('value')
    .eq('key', 'allowed_country_codes')
    .single()

  let codes = ['US', 'XK'] // defaults
  if (data?.value) {
    try {
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value
      if (Array.isArray(parsed)) codes = parsed
    } catch {
      // keep defaults
    }
  }

  // Map codes to dial codes
  const DIAL_MAP: Record<string, { dial: string; name: string; flag: string }> = {
    US: { dial: '1', name: 'United States', flag: '\u{1F1FA}\u{1F1F8}' },
    XK: { dial: '383', name: 'Kosovo', flag: '\u{1F1FD}\u{1F1F0}' },
    CA: { dial: '1', name: 'Canada', flag: '\u{1F1E8}\u{1F1E6}' },
    GB: { dial: '44', name: 'United Kingdom', flag: '\u{1F1EC}\u{1F1E7}' },
    AU: { dial: '61', name: 'Australia', flag: '\u{1F1E6}\u{1F1FA}' },
    IN: { dial: '91', name: 'India', flag: '\u{1F1EE}\u{1F1F3}' },
    DE: { dial: '49', name: 'Germany', flag: '\u{1F1E9}\u{1F1EA}' },
    FR: { dial: '33', name: 'France', flag: '\u{1F1EB}\u{1F1F7}' },
    IT: { dial: '39', name: 'Italy', flag: '\u{1F1EE}\u{1F1F9}' },
    ES: { dial: '34', name: 'Spain', flag: '\u{1F1EA}\u{1F1F8}' },
    BR: { dial: '55', name: 'Brazil', flag: '\u{1F1E7}\u{1F1F7}' },
    MX: { dial: '52', name: 'Mexico', flag: '\u{1F1F2}\u{1F1FD}' },
    JP: { dial: '81', name: 'Japan', flag: '\u{1F1EF}\u{1F1F5}' },
    KR: { dial: '82', name: 'South Korea', flag: '\u{1F1F0}\u{1F1F7}' },
    CN: { dial: '86', name: 'China', flag: '\u{1F1E8}\u{1F1F3}' },
    RU: { dial: '7', name: 'Russia', flag: '\u{1F1F7}\u{1F1FA}' },
    SE: { dial: '46', name: 'Sweden', flag: '\u{1F1F8}\u{1F1EA}' },
    NO: { dial: '47', name: 'Norway', flag: '\u{1F1F3}\u{1F1F4}' },
    DK: { dial: '45', name: 'Denmark', flag: '\u{1F1E9}\u{1F1F0}' },
    FI: { dial: '358', name: 'Finland', flag: '\u{1F1EB}\u{1F1EE}' },
    NL: { dial: '31', name: 'Netherlands', flag: '\u{1F1F3}\u{1F1F1}' },
    BE: { dial: '32', name: 'Belgium', flag: '\u{1F1E7}\u{1F1EA}' },
    CH: { dial: '41', name: 'Switzerland', flag: '\u{1F1E8}\u{1F1ED}' },
    AT: { dial: '43', name: 'Austria', flag: '\u{1F1E6}\u{1F1F9}' },
    PL: { dial: '48', name: 'Poland', flag: '\u{1F1F5}\u{1F1F1}' },
    PT: { dial: '351', name: 'Portugal', flag: '\u{1F1F5}\u{1F1F9}' },
    IE: { dial: '353', name: 'Ireland', flag: '\u{1F1EE}\u{1F1EA}' },
    NZ: { dial: '64', name: 'New Zealand', flag: '\u{1F1F3}\u{1F1FF}' },
    ZA: { dial: '27', name: 'South Africa', flag: '\u{1F1FF}\u{1F1E6}' },
    IL: { dial: '972', name: 'Israel', flag: '\u{1F1EE}\u{1F1F1}' },
    AE: { dial: '971', name: 'United Arab Emirates', flag: '\u{1F1E6}\u{1F1EA}' },
    SG: { dial: '65', name: 'Singapore', flag: '\u{1F1F8}\u{1F1EC}' },
    PH: { dial: '63', name: 'Philippines', flag: '\u{1F1F5}\u{1F1ED}' },
    TH: { dial: '66', name: 'Thailand', flag: '\u{1F1F9}\u{1F1ED}' },
    MY: { dial: '60', name: 'Malaysia', flag: '\u{1F1F2}\u{1F1FE}' },
    ID: { dial: '62', name: 'Indonesia', flag: '\u{1F1EE}\u{1F1E9}' },
    VN: { dial: '84', name: 'Vietnam', flag: '\u{1F1FB}\u{1F1F3}' },
    TR: { dial: '90', name: 'Turkey', flag: '\u{1F1F9}\u{1F1F7}' },
    SA: { dial: '966', name: 'Saudi Arabia', flag: '\u{1F1F8}\u{1F1E6}' },
    EG: { dial: '20', name: 'Egypt', flag: '\u{1F1EA}\u{1F1EC}' },
    NG: { dial: '234', name: 'Nigeria', flag: '\u{1F1F3}\u{1F1EC}' },
    KE: { dial: '254', name: 'Kenya', flag: '\u{1F1F0}\u{1F1EA}' },
    GH: { dial: '233', name: 'Ghana', flag: '\u{1F1EC}\u{1F1ED}' },
    CO: { dial: '57', name: 'Colombia', flag: '\u{1F1E8}\u{1F1F4}' },
    AR: { dial: '54', name: 'Argentina', flag: '\u{1F1E6}\u{1F1F7}' },
    CL: { dial: '56', name: 'Chile', flag: '\u{1F1E8}\u{1F1F1}' },
    PE: { dial: '51', name: 'Peru', flag: '\u{1F1F5}\u{1F1EA}' },
    UA: { dial: '380', name: 'Ukraine', flag: '\u{1F1FA}\u{1F1E6}' },
    RO: { dial: '40', name: 'Romania', flag: '\u{1F1F7}\u{1F1F4}' },
    CZ: { dial: '420', name: 'Czech Republic', flag: '\u{1F1E8}\u{1F1FF}' },
    GR: { dial: '30', name: 'Greece', flag: '\u{1F1EC}\u{1F1F7}' },
    HU: { dial: '36', name: 'Hungary', flag: '\u{1F1ED}\u{1F1FA}' },
    HR: { dial: '385', name: 'Croatia', flag: '\u{1F1ED}\u{1F1F7}' },
    RS: { dial: '381', name: 'Serbia', flag: '\u{1F1F7}\u{1F1F8}' },
    BA: { dial: '387', name: 'Bosnia and Herzegovina', flag: '\u{1F1E7}\u{1F1E6}' },
    ME: { dial: '382', name: 'Montenegro', flag: '\u{1F1F2}\u{1F1EA}' },
    AL: { dial: '355', name: 'Albania', flag: '\u{1F1E6}\u{1F1F1}' },
    MK: { dial: '389', name: 'North Macedonia', flag: '\u{1F1F2}\u{1F1F0}' },
    BG: { dial: '359', name: 'Bulgaria', flag: '\u{1F1E7}\u{1F1EC}' },
    SI: { dial: '386', name: 'Slovenia', flag: '\u{1F1F8}\u{1F1EE}' },
    SK: { dial: '421', name: 'Slovakia', flag: '\u{1F1F8}\u{1F1F0}' },
    PK: { dial: '92', name: 'Pakistan', flag: '\u{1F1F5}\u{1F1F0}' },
    BD: { dial: '880', name: 'Bangladesh', flag: '\u{1F1E7}\u{1F1E9}' },
    HK: { dial: '852', name: 'Hong Kong', flag: '\u{1F1ED}\u{1F1F0}' },
    TW: { dial: '886', name: 'Taiwan', flag: '\u{1F1F9}\u{1F1FC}' },
    PR: { dial: '1', name: 'Puerto Rico', flag: '\u{1F1F5}\u{1F1F7}' },
    DO: { dial: '1', name: 'Dominican Republic', flag: '\u{1F1E9}\u{1F1F4}' },
    JM: { dial: '1', name: 'Jamaica', flag: '\u{1F1EF}\u{1F1F2}' },
    CR: { dial: '506', name: 'Costa Rica', flag: '\u{1F1E8}\u{1F1F7}' },
    PA: { dial: '507', name: 'Panama', flag: '\u{1F1F5}\u{1F1E6}' },
    GT: { dial: '502', name: 'Guatemala', flag: '\u{1F1EC}\u{1F1F9}' },
    HN: { dial: '504', name: 'Honduras', flag: '\u{1F1ED}\u{1F1F3}' },
    SV: { dial: '503', name: 'El Salvador', flag: '\u{1F1F8}\u{1F1FB}' },
    EC: { dial: '593', name: 'Ecuador', flag: '\u{1F1EA}\u{1F1E8}' },
    VE: { dial: '58', name: 'Venezuela', flag: '\u{1F1FB}\u{1F1EA}' },
    UY: { dial: '598', name: 'Uruguay', flag: '\u{1F1FA}\u{1F1FE}' },
    PY: { dial: '595', name: 'Paraguay', flag: '\u{1F1F5}\u{1F1FE}' },
  }

  const locations = codes
    .map((code) => {
      const info = DIAL_MAP[code]
      if (!info) return null
      return { code, ...info }
    })
    .filter(Boolean)

  return NextResponse.json(locations)
}
