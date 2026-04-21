'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Load Google Maps script once
let googleScriptPromise: Promise<void> | null = null

function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.google?.maps?.places) return Promise.resolve()
  if (googleScriptPromise) return googleScriptPromise

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!key) return Promise.resolve()

  googleScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&v=weekly`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(script)
  })

  return googleScriptPromise
}

interface PlacesAutocompleteProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

interface Suggestion {
  primary: string
  secondary: string
  prediction: google.maps.places.PlacePrediction
}

export function PlacesAutocomplete({ value, onChange, placeholder = 'Search for a location...', className }: PlacesAutocompleteProps) {
  const [ready, setReady] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const seqRef = useRef(0)

  useEffect(() => {
    loadGoogleMaps()
      .then(async () => {
        // importLibrary is safe to call on the sync loader too — resolves
        // immediately if places is already populated, and hydrates it otherwise.
        if (window.google?.maps?.importLibrary) {
          try { await window.google.maps.importLibrary('places') } catch (e) { console.error('importLibrary(places) failed', e) }
        }
        const places = window.google?.maps?.places
        if (!places?.AutocompleteSessionToken) {
          console.error('Google Places API not available', { places })
          return
        }
        sessionTokenRef.current = new places.AutocompleteSessionToken()
        setReady(true)
      })
      .catch((e) => console.error('Google Maps load failed', e))
  }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const fetchSuggestions = useCallback(async (text: string) => {
    const places = window.google?.maps?.places
    if (!places?.AutocompleteSuggestion || !text.trim()) {
      setSuggestions([])
      setOpen(false)
      return
    }
    const mySeq = ++seqRef.current
    setLoading(true)
    try {
      const { suggestions: results } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: text,
        sessionToken: sessionTokenRef.current ?? undefined,
      })
      if (mySeq !== seqRef.current) return

      const next: Suggestion[] = []
      for (const r of results ?? []) {
        const pred = r.placePrediction
        if (!pred) continue
        const primary = pred.mainText?.text || pred.text?.text || ''
        if (!primary) continue
        next.push({
          primary,
          secondary: pred.secondaryText?.text || '',
          prediction: pred,
        })
        if (next.length >= 5) break
      }

      setSuggestions(next)
      setOpen(next.length > 0)
    } catch (e) {
      console.error('fetchAutocompleteSuggestions failed', e)
      setSuggestions([])
      setOpen(false)
    } finally {
      if (mySeq === seqRef.current) setLoading(false)
    }
  }, [])

  function handleChange(text: string) {
    onChange(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 250)
  }

  async function handleSelect(s: Suggestion) {
    setOpen(false)
    setSuggestions([])
    try {
      const place = s.prediction.toPlace()
      await place.fetchFields({ fields: ['displayName', 'formattedAddress'] })
      const name = place.displayName || s.primary
      const addr = place.formattedAddress || s.secondary
      const display = addr && !addr.startsWith(name) ? `${name}, ${addr}` : addr || name
      onChange(display)
    } catch {
      onChange(s.secondary ? `${s.primary}, ${s.secondary}` : s.primary)
    }
    const places = window.google?.maps?.places
    if (places?.AutocompleteSessionToken) {
      sessionTokenRef.current = new places.AutocompleteSessionToken()
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
        placeholder={placeholder}
        className={className || 'input-field'}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-background border border-border/60 rounded-xl shadow-lg z-20 overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={`${s.primary}-${i}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(s)}
              className="w-full text-left px-4 py-2.5 hover:bg-surface active:bg-surface transition-colors border-b border-border/30 last:border-0"
            >
              <div className="text-[14px] font-medium text-foreground truncate">{s.primary}</div>
              {s.secondary && <div className="text-[12px] text-muted truncate">{s.secondary}</div>}
            </button>
          ))}
        </div>
      )}
      {loading && !open && value.trim() && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
          <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
        </div>
      )}
    </div>
  )
}
