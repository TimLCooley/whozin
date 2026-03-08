'use client'

import { useEffect, useState } from 'react'

interface Location {
  code: string
  dial: string
  name: string
  flag: string
}

// Module-level cache
let cachedLocations: Location[] | null = null
let locationsFetch: Promise<Location[]> | null = null

function getLocations(): Promise<Location[]> {
  if (cachedLocations) return Promise.resolve(cachedLocations)
  if (locationsFetch) return locationsFetch
  locationsFetch = fetch('/api/locations')
    .then((r) => r.json())
    .then((data) => {
      cachedLocations = Array.isArray(data) ? data : []
      return cachedLocations
    })
    .catch(() => [{ code: 'US', dial: '1', name: 'United States', flag: '\u{1F1FA}\u{1F1F8}' }])
  return locationsFetch
}

interface CountryCodeSelectProps {
  value: string
  onChange: (code: string) => void
}

export default function CountryCodeSelect({ value, onChange }: CountryCodeSelectProps) {
  const [locations, setLocations] = useState<Location[]>(cachedLocations || [])

  useEffect(() => {
    if (!cachedLocations) {
      getLocations().then(setLocations)
    }
  }, [])

  // If locations loaded and current value isn't in the list, select first
  useEffect(() => {
    if (locations.length > 0 && !locations.some((l) => l.dial === value)) {
      onChange(locations[0].dial)
    }
  }, [locations, value, onChange])

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-12 px-3 rounded-xl border border-border bg-background text-sm
                 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                 appearance-none min-w-[90px]"
    >
      {locations.map((l) => (
        <option key={l.code} value={l.dial}>
          {l.flag} +{l.dial}
        </option>
      ))}
    </select>
  )
}
