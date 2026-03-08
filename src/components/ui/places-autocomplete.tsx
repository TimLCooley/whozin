'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

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

export function PlacesAutocomplete({ value, onChange, placeholder = 'Search for a location...', className }: PlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    loadGoogleMaps()
      .then(() => setReady(true))
      .catch(() => {})
  }, [])

  const initAutocomplete = useCallback(() => {
    if (!ready || !inputRef.current || autocompleteRef.current) return
    if (!window.google?.maps?.places) return

    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['establishment', 'geocode'],
      fields: ['formatted_address', 'name', 'geometry'],
    })

    ac.addListener('place_changed', () => {
      const place = ac.getPlace()
      if (place) {
        // Use name + address for establishments, or just address for geocode
        const display = place.name && place.formatted_address && !place.formatted_address.startsWith(place.name)
          ? `${place.name}, ${place.formatted_address}`
          : place.formatted_address || place.name || ''
        onChange(display)
      }
    })

    autocompleteRef.current = ac
  }, [ready, onChange])

  useEffect(() => {
    initAutocomplete()
  }, [initAutocomplete])

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className || 'input-field'}
    />
  )
}
