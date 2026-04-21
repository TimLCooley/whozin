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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`
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
  placeId: string
  primary: string
  secondary: string
}

type AutocompleteService = {
  getPlacePredictions(
    req: { input: string; sessionToken?: unknown },
    cb: (predictions: PlacePrediction[] | null, status: string) => void
  ): void
}

type PlacesService = {
  getDetails(
    req: { placeId: string; fields: string[]; sessionToken?: unknown },
    cb: (place: PlaceDetails | null, status: string) => void
  ): void
}

interface PlacePrediction {
  place_id: string
  description: string
  structured_formatting?: { main_text?: string; secondary_text?: string }
}

interface PlaceDetails {
  name?: string
  formatted_address?: string
}

export function PlacesAutocomplete({ value, onChange, placeholder = 'Search for a location...', className }: PlacesAutocompleteProps) {
  const [ready, setReady] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const serviceRef = useRef<AutocompleteService | null>(null)
  const detailsRef = useRef<PlacesService | null>(null)
  const sessionTokenRef = useRef<unknown>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        const places = window.google?.maps?.places
        if (!places) return
        serviceRef.current = new places.AutocompleteService() as unknown as AutocompleteService
        // PlacesService needs a DOM node for attribution
        detailsRef.current = new places.PlacesService(document.createElement('div')) as unknown as PlacesService
        sessionTokenRef.current = new places.AutocompleteSessionToken()
        setReady(true)
      })
      .catch(() => {})
  }, [])

  // Close dropdown on outside click
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

  const fetchSuggestions = useCallback((text: string) => {
    if (!serviceRef.current || !text.trim()) {
      setSuggestions([])
      setOpen(false)
      return
    }
    setLoading(true)
    serviceRef.current.getPlacePredictions(
      { input: text, sessionToken: sessionTokenRef.current },
      (predictions, status) => {
        setLoading(false)
        if (status !== 'OK' || !predictions) {
          setSuggestions([])
          setOpen(false)
          return
        }
        setSuggestions(
          predictions.slice(0, 5).map((p) => ({
            placeId: p.place_id,
            primary: p.structured_formatting?.main_text || p.description,
            secondary: p.structured_formatting?.secondary_text || '',
          }))
        )
        setOpen(true)
      }
    )
  }, [])

  function handleChange(text: string) {
    onChange(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!ready) return
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 250)
  }

  function handleSelect(s: Suggestion) {
    if (!detailsRef.current) {
      onChange(s.secondary ? `${s.primary}, ${s.secondary}` : s.primary)
      setOpen(false)
      return
    }
    detailsRef.current.getDetails(
      { placeId: s.placeId, fields: ['name', 'formatted_address'], sessionToken: sessionTokenRef.current },
      (place, status) => {
        const name = (status === 'OK' ? place?.name : '') || s.primary
        const addr = (status === 'OK' ? place?.formatted_address : '') || s.secondary
        const display = addr && !addr.startsWith(name) ? `${name}, ${addr}` : addr || name
        onChange(display)
        // New session after a selection
        const places = window.google?.maps?.places
        if (places) sessionTokenRef.current = new places.AutocompleteSessionToken()
      }
    )
    setOpen(false)
    setSuggestions([])
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
          {suggestions.map((s) => (
            <button
              key={s.placeId}
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
