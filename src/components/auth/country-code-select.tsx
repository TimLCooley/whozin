'use client'

const COUNTRY_CODES = [
  { code: '1', label: 'US +1', flag: '\u{1F1FA}\u{1F1F8}' },
  { code: '1', label: 'CA +1', flag: '\u{1F1E8}\u{1F1E6}' },
  { code: '44', label: 'UK +44', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: '61', label: 'AU +61', flag: '\u{1F1E6}\u{1F1FA}' },
  { code: '91', label: 'IN +91', flag: '\u{1F1EE}\u{1F1F3}' },
  { code: '52', label: 'MX +52', flag: '\u{1F1F2}\u{1F1FD}' },
  { code: '49', label: 'DE +49', flag: '\u{1F1E9}\u{1F1EA}' },
  { code: '33', label: 'FR +33', flag: '\u{1F1EB}\u{1F1F7}' },
  { code: '81', label: 'JP +81', flag: '\u{1F1EF}\u{1F1F5}' },
  { code: '55', label: 'BR +55', flag: '\u{1F1E7}\u{1F1F7}' },
]

interface CountryCodeSelectProps {
  value: string
  onChange: (code: string) => void
}

export default function CountryCodeSelect({ value, onChange }: CountryCodeSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-12 px-3 rounded-xl border border-border bg-background text-sm
                 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                 appearance-none min-w-[90px]"
    >
      {COUNTRY_CODES.map((c, i) => (
        <option key={`${c.code}-${i}`} value={c.code}>
          {c.flag} +{c.code}
        </option>
      ))}
    </select>
  )
}
