'use client'

import { useEffect, useState } from 'react'

interface Country {
  code: string
  name: string
  dial: string
  flag: string
}

const ALL_COUNTRIES: Country[] = [
  { code: 'US', name: 'United States', dial: '+1', flag: '\u{1F1FA}\u{1F1F8}' },
  { code: 'XK', name: 'Kosovo', dial: '+383', flag: '\u{1F1FD}\u{1F1F0}' },
  { code: 'AF', name: 'Afghanistan', dial: '+93', flag: '\u{1F1E6}\u{1F1EB}' },
  { code: 'AL', name: 'Albania', dial: '+355', flag: '\u{1F1E6}\u{1F1F1}' },
  { code: 'DZ', name: 'Algeria', dial: '+213', flag: '\u{1F1E9}\u{1F1FF}' },
  { code: 'AR', name: 'Argentina', dial: '+54', flag: '\u{1F1E6}\u{1F1F7}' },
  { code: 'AM', name: 'Armenia', dial: '+374', flag: '\u{1F1E6}\u{1F1F2}' },
  { code: 'AU', name: 'Australia', dial: '+61', flag: '\u{1F1E6}\u{1F1FA}' },
  { code: 'AT', name: 'Austria', dial: '+43', flag: '\u{1F1E6}\u{1F1F9}' },
  { code: 'AZ', name: 'Azerbaijan', dial: '+994', flag: '\u{1F1E6}\u{1F1FF}' },
  { code: 'BH', name: 'Bahrain', dial: '+973', flag: '\u{1F1E7}\u{1F1ED}' },
  { code: 'BD', name: 'Bangladesh', dial: '+880', flag: '\u{1F1E7}\u{1F1E9}' },
  { code: 'BY', name: 'Belarus', dial: '+375', flag: '\u{1F1E7}\u{1F1FE}' },
  { code: 'BE', name: 'Belgium', dial: '+32', flag: '\u{1F1E7}\u{1F1EA}' },
  { code: 'BA', name: 'Bosnia and Herzegovina', dial: '+387', flag: '\u{1F1E7}\u{1F1E6}' },
  { code: 'BR', name: 'Brazil', dial: '+55', flag: '\u{1F1E7}\u{1F1F7}' },
  { code: 'BG', name: 'Bulgaria', dial: '+359', flag: '\u{1F1E7}\u{1F1EC}' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '\u{1F1E8}\u{1F1E6}' },
  { code: 'CL', name: 'Chile', dial: '+56', flag: '\u{1F1E8}\u{1F1F1}' },
  { code: 'CN', name: 'China', dial: '+86', flag: '\u{1F1E8}\u{1F1F3}' },
  { code: 'CO', name: 'Colombia', dial: '+57', flag: '\u{1F1E8}\u{1F1F4}' },
  { code: 'CR', name: 'Costa Rica', dial: '+506', flag: '\u{1F1E8}\u{1F1F7}' },
  { code: 'HR', name: 'Croatia', dial: '+385', flag: '\u{1F1ED}\u{1F1F7}' },
  { code: 'CY', name: 'Cyprus', dial: '+357', flag: '\u{1F1E8}\u{1F1FE}' },
  { code: 'CZ', name: 'Czech Republic', dial: '+420', flag: '\u{1F1E8}\u{1F1FF}' },
  { code: 'DK', name: 'Denmark', dial: '+45', flag: '\u{1F1E9}\u{1F1F0}' },
  { code: 'DO', name: 'Dominican Republic', dial: '+1', flag: '\u{1F1E9}\u{1F1F4}' },
  { code: 'EC', name: 'Ecuador', dial: '+593', flag: '\u{1F1EA}\u{1F1E8}' },
  { code: 'EG', name: 'Egypt', dial: '+20', flag: '\u{1F1EA}\u{1F1EC}' },
  { code: 'SV', name: 'El Salvador', dial: '+503', flag: '\u{1F1F8}\u{1F1FB}' },
  { code: 'EE', name: 'Estonia', dial: '+372', flag: '\u{1F1EA}\u{1F1EA}' },
  { code: 'FI', name: 'Finland', dial: '+358', flag: '\u{1F1EB}\u{1F1EE}' },
  { code: 'FR', name: 'France', dial: '+33', flag: '\u{1F1EB}\u{1F1F7}' },
  { code: 'GE', name: 'Georgia', dial: '+995', flag: '\u{1F1EC}\u{1F1EA}' },
  { code: 'DE', name: 'Germany', dial: '+49', flag: '\u{1F1E9}\u{1F1EA}' },
  { code: 'GH', name: 'Ghana', dial: '+233', flag: '\u{1F1EC}\u{1F1ED}' },
  { code: 'GR', name: 'Greece', dial: '+30', flag: '\u{1F1EC}\u{1F1F7}' },
  { code: 'GT', name: 'Guatemala', dial: '+502', flag: '\u{1F1EC}\u{1F1F9}' },
  { code: 'HN', name: 'Honduras', dial: '+504', flag: '\u{1F1ED}\u{1F1F3}' },
  { code: 'HK', name: 'Hong Kong', dial: '+852', flag: '\u{1F1ED}\u{1F1F0}' },
  { code: 'HU', name: 'Hungary', dial: '+36', flag: '\u{1F1ED}\u{1F1FA}' },
  { code: 'IS', name: 'Iceland', dial: '+354', flag: '\u{1F1EE}\u{1F1F8}' },
  { code: 'IN', name: 'India', dial: '+91', flag: '\u{1F1EE}\u{1F1F3}' },
  { code: 'ID', name: 'Indonesia', dial: '+62', flag: '\u{1F1EE}\u{1F1E9}' },
  { code: 'IQ', name: 'Iraq', dial: '+964', flag: '\u{1F1EE}\u{1F1F6}' },
  { code: 'IE', name: 'Ireland', dial: '+353', flag: '\u{1F1EE}\u{1F1EA}' },
  { code: 'IL', name: 'Israel', dial: '+972', flag: '\u{1F1EE}\u{1F1F1}' },
  { code: 'IT', name: 'Italy', dial: '+39', flag: '\u{1F1EE}\u{1F1F9}' },
  { code: 'JM', name: 'Jamaica', dial: '+1', flag: '\u{1F1EF}\u{1F1F2}' },
  { code: 'JP', name: 'Japan', dial: '+81', flag: '\u{1F1EF}\u{1F1F5}' },
  { code: 'JO', name: 'Jordan', dial: '+962', flag: '\u{1F1EF}\u{1F1F4}' },
  { code: 'KZ', name: 'Kazakhstan', dial: '+7', flag: '\u{1F1F0}\u{1F1FF}' },
  { code: 'KE', name: 'Kenya', dial: '+254', flag: '\u{1F1F0}\u{1F1EA}' },
  { code: 'KR', name: 'South Korea', dial: '+82', flag: '\u{1F1F0}\u{1F1F7}' },
  { code: 'KW', name: 'Kuwait', dial: '+965', flag: '\u{1F1F0}\u{1F1FC}' },
  { code: 'LV', name: 'Latvia', dial: '+371', flag: '\u{1F1F1}\u{1F1FB}' },
  { code: 'LB', name: 'Lebanon', dial: '+961', flag: '\u{1F1F1}\u{1F1E7}' },
  { code: 'LT', name: 'Lithuania', dial: '+370', flag: '\u{1F1F1}\u{1F1F9}' },
  { code: 'LU', name: 'Luxembourg', dial: '+352', flag: '\u{1F1F1}\u{1F1FA}' },
  { code: 'MK', name: 'North Macedonia', dial: '+389', flag: '\u{1F1F2}\u{1F1F0}' },
  { code: 'MY', name: 'Malaysia', dial: '+60', flag: '\u{1F1F2}\u{1F1FE}' },
  { code: 'MX', name: 'Mexico', dial: '+52', flag: '\u{1F1F2}\u{1F1FD}' },
  { code: 'MD', name: 'Moldova', dial: '+373', flag: '\u{1F1F2}\u{1F1E9}' },
  { code: 'ME', name: 'Montenegro', dial: '+382', flag: '\u{1F1F2}\u{1F1EA}' },
  { code: 'MA', name: 'Morocco', dial: '+212', flag: '\u{1F1F2}\u{1F1E6}' },
  { code: 'NL', name: 'Netherlands', dial: '+31', flag: '\u{1F1F3}\u{1F1F1}' },
  { code: 'NZ', name: 'New Zealand', dial: '+64', flag: '\u{1F1F3}\u{1F1FF}' },
  { code: 'NG', name: 'Nigeria', dial: '+234', flag: '\u{1F1F3}\u{1F1EC}' },
  { code: 'NO', name: 'Norway', dial: '+47', flag: '\u{1F1F3}\u{1F1F4}' },
  { code: 'PK', name: 'Pakistan', dial: '+92', flag: '\u{1F1F5}\u{1F1F0}' },
  { code: 'PA', name: 'Panama', dial: '+507', flag: '\u{1F1F5}\u{1F1E6}' },
  { code: 'PY', name: 'Paraguay', dial: '+595', flag: '\u{1F1F5}\u{1F1FE}' },
  { code: 'PE', name: 'Peru', dial: '+51', flag: '\u{1F1F5}\u{1F1EA}' },
  { code: 'PH', name: 'Philippines', dial: '+63', flag: '\u{1F1F5}\u{1F1ED}' },
  { code: 'PL', name: 'Poland', dial: '+48', flag: '\u{1F1F5}\u{1F1F1}' },
  { code: 'PT', name: 'Portugal', dial: '+351', flag: '\u{1F1F5}\u{1F1F9}' },
  { code: 'PR', name: 'Puerto Rico', dial: '+1', flag: '\u{1F1F5}\u{1F1F7}' },
  { code: 'QA', name: 'Qatar', dial: '+974', flag: '\u{1F1F6}\u{1F1E6}' },
  { code: 'RO', name: 'Romania', dial: '+40', flag: '\u{1F1F7}\u{1F1F4}' },
  { code: 'RU', name: 'Russia', dial: '+7', flag: '\u{1F1F7}\u{1F1FA}' },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966', flag: '\u{1F1F8}\u{1F1E6}' },
  { code: 'RS', name: 'Serbia', dial: '+381', flag: '\u{1F1F7}\u{1F1F8}' },
  { code: 'SG', name: 'Singapore', dial: '+65', flag: '\u{1F1F8}\u{1F1EC}' },
  { code: 'SK', name: 'Slovakia', dial: '+421', flag: '\u{1F1F8}\u{1F1F0}' },
  { code: 'SI', name: 'Slovenia', dial: '+386', flag: '\u{1F1F8}\u{1F1EE}' },
  { code: 'ZA', name: 'South Africa', dial: '+27', flag: '\u{1F1FF}\u{1F1E6}' },
  { code: 'ES', name: 'Spain', dial: '+34', flag: '\u{1F1EA}\u{1F1F8}' },
  { code: 'SE', name: 'Sweden', dial: '+46', flag: '\u{1F1F8}\u{1F1EA}' },
  { code: 'CH', name: 'Switzerland', dial: '+41', flag: '\u{1F1E8}\u{1F1ED}' },
  { code: 'TW', name: 'Taiwan', dial: '+886', flag: '\u{1F1F9}\u{1F1FC}' },
  { code: 'TH', name: 'Thailand', dial: '+66', flag: '\u{1F1F9}\u{1F1ED}' },
  { code: 'TR', name: 'Turkey', dial: '+90', flag: '\u{1F1F9}\u{1F1F7}' },
  { code: 'UA', name: 'Ukraine', dial: '+380', flag: '\u{1F1FA}\u{1F1E6}' },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971', flag: '\u{1F1E6}\u{1F1EA}' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'UY', name: 'Uruguay', dial: '+598', flag: '\u{1F1FA}\u{1F1FE}' },
  { code: 'VE', name: 'Venezuela', dial: '+58', flag: '\u{1F1FB}\u{1F1EA}' },
  { code: 'VN', name: 'Vietnam', dial: '+84', flag: '\u{1F1FB}\u{1F1F3}' },
]

export default function LocationsPage() {
  const [activeCodes, setActiveCodes] = useState<string[]>(['US', 'XK'])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.allowed_country_codes) {
          try {
            const parsed = JSON.parse(data.allowed_country_codes)
            if (Array.isArray(parsed)) setActiveCodes(parsed)
          } catch {
            // keep defaults
          }
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowed_country_codes: JSON.stringify(activeCodes) }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function toggle(code: string) {
    setActiveCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
    setSaved(false)
  }

  const q = search.toLowerCase()
  const filtered = ALL_COUNTRIES.filter((c) =>
    !q || c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q)
  )

  // Sort: active first, then alphabetically
  const sorted = [...filtered].sort((a, b) => {
    const aActive = activeCodes.includes(a.code) ? 0 : 1
    const bActive = activeCodes.includes(b.code) ? 0 : 1
    if (aActive !== bActive) return aActive - bActive
    return a.name.localeCompare(b.name)
  })

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Locations</h2>
          <p className="text-[13px] text-muted">
            Select which countries can use the app. Only these country codes will appear in phone inputs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-success font-medium">Saved!</span>}
          <button onClick={handleSave} disabled={saving} className="btn-primary px-5 py-2.5">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Active count */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[13px] font-semibold text-foreground">
          {activeCodes.length} active
        </span>
        <span className="text-[11px] text-muted">
          ({activeCodes.map((c) => ALL_COUNTRIES.find((cc) => cc.code === c)?.name || c).join(', ')})
        </span>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search countries..."
          className="input-field pl-10"
          autoFocus
        />
      </div>

      {/* Country list */}
      <div className="bg-background border border-border/50 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {sorted.map((country, i) => {
          const isActive = activeCodes.includes(country.code)
          return (
            <button
              key={country.code}
              onClick={() => toggle(country.code)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:bg-surface ${
                i > 0 ? 'border-t border-border/30' : ''
              } ${isActive ? 'bg-primary/5' : ''}`}
            >
              <span className="text-xl flex-shrink-0">{country.flag}</span>
              <div className="flex-1 min-w-0">
                <span className="text-[14px] font-medium text-foreground">{country.name}</span>
                <span className="text-[12px] text-muted ml-2">{country.dial}</span>
              </div>
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                isActive ? 'bg-primary border-primary' : 'border-border'
              }`}>
                {isActive && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </div>
            </button>
          )
        })}
        {sorted.length === 0 && (
          <div className="px-4 py-8 text-center text-[13px] text-muted">No countries match your search.</div>
        )}
      </div>
    </div>
  )
}
