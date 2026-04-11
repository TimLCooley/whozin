'use client'

import { useEffect, useRef, useState } from 'react'

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
  const containerRef = useRef<HTMLDivElement>(null)
  const elementRef = useRef<HTMLElement | null>(null)
  const [ready, setReady] = useState(false)
  const [fallback, setFallback] = useState(false)
  const [manualMode, setManualMode] = useState(false)

  useEffect(() => {
    loadGoogleMaps()
      .then(() => setReady(true))
      .catch(() => setFallback(true))
  }, [])

  useEffect(() => {
    if (!ready || !containerRef.current || elementRef.current || manualMode) return
    if (!window.google?.maps?.places?.PlaceAutocompleteElement) {
      setFallback(true)
      return
    }

    // @ts-expect-error - options parameter optional in runtime but typed as required
    const el = new window.google.maps.places.PlaceAutocompleteElement()
    el.setAttribute('style', 'width:100%;')
    elementRef.current = el

    el.addEventListener('gmp-placeselect', async (e: Event) => {
      const event = e as CustomEvent
      const place = event.detail?.place
      if (place) {
        await place.fetchFields({ fields: ['displayName', 'formattedAddress'] })
        const name = place.displayName || ''
        const address = place.formattedAddress || ''
        const display = name && address && !address.startsWith(name)
          ? `${name}, ${address}`
          : address || name
        onChange(display)
      }
    })

    containerRef.current.appendChild(el)

    // Sync typed-but-not-selected text. The `input` event from the inner
    // <input> bubbles up through the custom element (even across shadow DOM),
    // so listening once on the host is enough.
    const onHostInput = (e: Event) => {
      const target = e.target as HTMLInputElement | null
      const composedPath = typeof (e as Event & { composedPath?: () => EventTarget[] }).composedPath === 'function'
        ? (e as Event & { composedPath: () => EventTarget[] }).composedPath()
        : []
      const realInput = (composedPath.find((n) => n instanceof HTMLInputElement) as HTMLInputElement | undefined) || target
      if (realInput && typeof realInput.value === 'string') {
        onChange(realInput.value)
      }
    }
    el.addEventListener('input', onHostInput)

    return () => {
      el.removeEventListener('input', onHostInput)
      if (el.parentNode) el.parentNode.removeChild(el)
      elementRef.current = null
    }
  }, [ready, onChange, manualMode])

  // Fallback or manual mode: plain text input
  if (fallback || manualMode || !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return (
      <div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={className || 'input-field'}
          autoFocus={manualMode}
        />
        {manualMode && !fallback && (
          <button
            type="button"
            onClick={() => { setManualMode(false); elementRef.current = null }}
            className="text-[11px] text-primary font-semibold mt-1.5"
          >
            Search with Google Maps
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Show current value / allow manual editing */}
      {value && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[13px] text-foreground flex-1 truncate">{value}</span>
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-[11px] text-primary font-semibold shrink-0"
          >
            Clear
          </button>
        </div>
      )}
      <div ref={containerRef} className="google-places-container" />
      <button
        type="button"
        onClick={() => setManualMode(true)}
        className="text-[11px] text-muted font-medium mt-1.5"
      >
        Or type location manually
      </button>
      <style jsx global>{`
        .google-places-container gmp-place-autocomplete {
          width: 100%;
        }
        .google-places-container gmp-place-autocomplete input {
          width: 100%;
          height: 44px;
          padding: 0 16px;
          border-radius: 12px;
          border: 1px solid var(--color-border, #e2e8f0);
          background: var(--color-background, #fff);
          font-size: 14px;
          color: var(--color-foreground, #1a1a2e);
          outline: none;
          font-family: inherit;
        }
        .google-places-container gmp-place-autocomplete input:focus {
          border-color: var(--color-primary, #4285F4);
          box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.15);
        }
        .google-places-container gmp-place-autocomplete input::placeholder {
          color: var(--color-muted, #94a3b8);
        }
      `}</style>
    </div>
  )
}
