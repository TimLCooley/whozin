'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { AvatarImg } from '@/components/ui/avatar-img'
import { getPlatform } from '@/lib/capacitor'

interface QRModalProps {
  open: boolean
  onClose: () => void
  userId: string
  userName: string
  /** If provided, pre-select this group in the dropdown */
  groupId?: string
  groupName?: string
}

interface GroupOption {
  id: string
  name: string
}

interface ScanResult {
  id: string
  name: string
  avatar_url: string | null
  /** Group the scanned QR is inviting to (if any) */
  invitedGroup: { id: string; name: string } | null
}

type Tab = 'my-qr' | 'scan'

export function QRModal({ open, onClose, userId, userName, groupId, groupName }: QRModalProps) {
  const [tab, setTab] = useState<Tab>('my-qr')
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [scanError, setScanError] = useState('')
  const [adding, setAdding] = useState(false)
  const [successName, setSuccessName] = useState('')
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState(groupId || '')
  const scannerRef = useRef<HTMLDivElement>(null)
  const html5QrRef = useRef<unknown>(null)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://whozin.io'
  const qrUrl = groupId
    ? `${baseUrl}/u/${userId}?group=${groupId}`
    : `${baseUrl}/u/${userId}`

  const stopScanner = useCallback(() => {
    const scanner = html5QrRef.current as { stop?: () => Promise<void>; isScanning?: boolean } | null
    if (scanner?.isScanning) {
      scanner.stop?.().catch(() => {})
    }
    html5QrRef.current = null
    setScanning(false)
  }, [])

  // Load user's groups for the dropdown
  useEffect(() => {
    if (!open) return
    fetch('/api/groups')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setGroups(data.filter((g: GroupOption & { is_owner: boolean }) => g.is_owner))
        }
      })
      .catch(() => {})
  }, [open])

  // Cleanup scanner on close or tab switch
  useEffect(() => {
    if (!open || tab !== 'scan') {
      stopScanner()
    }
    if (!open) {
      setScanResult(null)
      setScanError('')
      setSuccessName('')
      setSelectedGroupId(groupId || '')
      setTab('my-qr')
    }
  }, [open, tab, stopScanner, groupId])

  // Android uses the native ML Kit scanner (a full-screen native UI launched
  // from a button) because its WebView getUserMedia is unreliable. iOS keeps
  // the embedded web scanner — WKWebView handles camera natively once
  // NSCameraUsageDescription is set. Web obviously uses the web scanner too.
  const useNativeScanner = getPlatform() === 'android'

  // Auto-start the embedded web scanner when switching to the scan tab
  // (everywhere except Android, which waits for the button tap).
  useEffect(() => {
    if (useNativeScanner) return
    if (open && tab === 'scan' && !scanResult && !scanError && !scanning) {
      const t = setTimeout(() => startScanner(), 150)
      return () => clearTimeout(t)
    }
  }, [open, tab, scanResult, scanError]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Native QR scan via ML Kit. Opens a full-screen native camera UI that
   * handles its own permission prompt — no WebView getUserMedia involved. */
  async function scanNative() {
    setScanError('')
    setScanResult(null)
    setSuccessName('')
    try {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning')

      // Native permission flow (not the WebView's).
      const perm = await BarcodeScanner.checkPermissions()
      if (perm.camera !== 'granted' && perm.camera !== 'limited') {
        const req = await BarcodeScanner.requestPermissions()
        if (req.camera !== 'granted' && req.camera !== 'limited') {
          setScanError('Camera access was denied. Enable it in Settings → Apps → Whozin → Permissions → Camera.')
          return
        }
      }

      setScanning(true)
      let result
      try {
        result = await BarcodeScanner.scan()
      } catch (err) {
        // On Android the ML Kit module may need a one-time download.
        const msg = (err as { message?: string })?.message ?? ''
        if (/module/i.test(msg) && typeof BarcodeScanner.installGoogleBarcodeScannerModule === 'function') {
          await BarcodeScanner.installGoogleBarcodeScannerModule()
          result = await BarcodeScanner.scan()
        } else {
          throw err
        }
      } finally {
        setScanning(false)
      }

      const raw = result?.barcodes?.[0]?.rawValue
      if (raw) {
        handleScanSuccess(raw)
      } else {
        setScanError('No QR code detected. Try again.')
      }
    } catch (err) {
      setScanning(false)
      const msg = (err as { message?: string })?.message ?? String(err)
      // The user cancelling the native scanner shows up as an error too —
      // treat a cancel as a no-op rather than a scary message.
      if (/cancel/i.test(msg)) {
        setScanError('')
        return
      }
      setScanError(`Could not scan (${msg})`)
    }
  }

  function describeMediaError(err: unknown): string {
    const e = err as { name?: string; message?: string } | null
    const name = e?.name ?? ''
    const message = e?.message ?? ''
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return 'Camera permission was blocked. Open Settings → Apps → Whozin → Permissions and enable Camera.'
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return 'No camera was found on this device.'
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return 'Another app is using the camera. Close it and try again.'
    }
    if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
      return 'This camera does not support the requested mode.'
    }
    if (name === 'AbortError') {
      return 'Camera start was aborted. Try again.'
    }
    if (name === 'SecurityError') {
      return 'Camera access blocked by browser security. Make sure the site is loaded over HTTPS.'
    }
    return `Could not access camera (${name || 'unknown error'}${message ? `: ${message}` : ''})`
  }

  /** Try a sequence of constraints. Some Android WebViews reject specific
   * facingMode constraints but accept a plain `video: true`. */
  async function tryGetMediaStream(): Promise<MediaStream> {
    const attempts: MediaStreamConstraints[] = [
      { video: { facingMode: { exact: 'environment' } } },
      { video: { facingMode: 'environment' } },
      { video: true },
    ]
    let lastErr: unknown = null
    for (const constraints of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints)
      } catch (err) {
        lastErr = err
        // Only the OverconstrainedError is worth retrying — others (Permission, etc.) won't change.
        const name = (err as { name?: string })?.name ?? ''
        if (name !== 'OverconstrainedError' && name !== 'ConstraintNotSatisfiedError') {
          throw err
        }
      }
    }
    throw lastErr
  }

  async function startScanner() {
    if (scanning) return
    setScanError('')
    setScanResult(null)
    setSuccessName('')

    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('qr-reader')
      html5QrRef.current = scanner

      // Probe permission with a plain getUserMedia first so we can surface
      // a precise error if it fails. Stop the probe stream immediately —
      // html5-qrcode will open its own stream below.
      const probe = await tryGetMediaStream()
      probe.getTracks().forEach((t) => t.stop())

      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            handleScanSuccess(decodedText)
            scanner.stop().catch(() => {})
            setScanning(false)
          },
          () => {}
        )
      } catch (startErr) {
        // Fallback: some Android WebViews reject facingMode constraints — try the default camera.
        const name = (startErr as { name?: string })?.name ?? ''
        if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
          await scanner.start(
            { facingMode: 'user' },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
              handleScanSuccess(decodedText)
              scanner.stop().catch(() => {})
              setScanning(false)
            },
            () => {}
          )
        } else {
          throw startErr
        }
      }
      setScanning(true)
    } catch (err) {
      setScanError(describeMediaError(err))
    }
  }

  async function requestCameraPermission() {
    setScanError('')
    try {
      const stream = await tryGetMediaStream()
      stream.getTracks().forEach((t) => t.stop())
      startScanner()
    } catch (err) {
      // On Android WebView the first getUserMedia call fires the OS prompt
      // asynchronously and the original promise rejects with NotAllowedError
      // before the user finishes choosing. Wait briefly and retry once — by
      // then, if they granted, the WebView's cached permission will let the
      // call succeed.
      const name = (err as { name?: string })?.name ?? ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        await new Promise((resolve) => setTimeout(resolve, 800))
        try {
          const stream = await tryGetMediaStream()
          stream.getTracks().forEach((t) => t.stop())
          startScanner()
          return
        } catch (retryErr) {
          err = retryErr
        }
      }
      setScanError(describeMediaError(err))
    }
  }

  function handleClose() {
    stopScanner()
    onClose()
  }

  async function handleScanSuccess(url: string) {
    const match = url.match(/\/u\/([a-f0-9-]{36})/)
    if (!match) {
      setScanError('Not a valid Whozin QR code')
      return
    }

    const scannedId = match[1]
    if (scannedId === userId) {
      setScanError("That's your own QR code!")
      return
    }

    // The QR may also encode ?group=<id> — meaning the QR holder wants the
    // scanner added to that specific group.
    let invitedGroupId: string | null = null
    try {
      const parsed = new URL(url)
      invitedGroupId = parsed.searchParams.get('group')
    } catch {
      // url-encoded form / malformed — ignore, treat as friend-only QR
    }

    try {
      const qs = invitedGroupId
        ? `id=${scannedId}&group=${invitedGroupId}`
        : `id=${scannedId}`
      const res = await fetch(`/api/user/public?${qs}`)
      if (!res.ok) {
        setScanError('User not found')
        return
      }
      const profile = await res.json()
      const name = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
      setScanResult({
        name: name || 'Whozin User',
        id: profile.id,
        avatar_url: profile.avatar_url,
        invitedGroup: profile.group ?? null,
      })
    } catch {
      setScanError('Failed to look up user')
    }
  }

  async function handleAdd(opts: { groupId?: string; groupName?: string }) {
    if (!scanResult || adding) return
    setAdding(true)
    try {
      const body: Record<string, string> = { friend_id: scanResult.id }
      if (opts.groupId) body.group_id = opts.groupId
      const res = await fetch('/api/friends/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setSuccessName(scanResult.name + (opts.groupName ? ` → ${opts.groupName}` : ''))
        setScanResult(null)
        setTimeout(() => {
          setSuccessName('')
          // On Android, don't auto-relaunch the full-screen scanner; the user
          // taps "Scan QR Code" again. Elsewhere, restart the embedded preview.
          if (!useNativeScanner) startScanner()
        }, 1500)
      } else {
        const data = await res.json()
        setScanError(data.error || 'Failed to add friend')
        setScanResult(null)
      }
    } catch {
      setScanError('Network error')
      setScanResult(null)
    } finally {
      setAdding(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-card rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card rounded-t-2xl z-10 px-5 pt-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white">QR Code</h2>
            <button
              onClick={handleClose}
              className="p-1.5 -m-1.5 text-muted hover:text-foreground transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-surface rounded-xl p-1">
            {(['my-qr', 'scan'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all ${
                  tab === t
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                {t === 'my-qr' ? 'My QR' : 'Scan'}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-5 pb-6 pt-3">
          {tab === 'my-qr' && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-[13px] text-white/70 text-center">
                Show this code to add friends instantly
              </p>
              <div className="bg-white p-4 rounded-2xl shadow-md">
                <QRCodeSVG
                  value={qrUrl}
                  size={220}
                  level="M"
                  includeMargin={false}
                  bgColor="#ffffff"
                  fgColor="#1a1a2e"
                />
              </div>
              <div className="text-center">
                <p className="text-[15px] font-bold text-white">{userName}</p>
                <p className="text-[12px] text-white/50 mt-0.5 break-all">{qrUrl}</p>
              </div>
            </div>
          )}

          {tab === 'scan' && (
            <div className="flex flex-col items-center gap-4">
              {/* Success toast */}
              {successName && (
                <div className="w-full py-3 px-4 rounded-xl bg-[#34c759]/10 border border-[#34c759]/20 flex items-center gap-2 animate-enter">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span className="text-[14px] font-semibold text-[#34c759]">
                    {successName} added!
                  </span>
                </div>
              )}

              {!scanResult && !scanError && (
                useNativeScanner ? (
                  <div className="flex flex-col items-center gap-4 py-6">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
                        <rect x="7" y="7" width="10" height="10" rx="1" />
                      </svg>
                    </div>
                    <p className="text-[13px] text-muted text-center">
                      Scan a friend&apos;s QR code to add them
                    </p>
                    <button
                      onClick={scanNative}
                      disabled={scanning}
                      className="px-6 py-3 rounded-xl bg-primary text-white font-semibold text-[14px] disabled:opacity-60"
                    >
                      {scanning ? 'Opening camera…' : 'Scan QR Code'}
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-[13px] text-muted text-center">
                      Scan a friend&apos;s QR code to add them
                    </p>
                    <div
                      ref={scannerRef}
                      id="qr-reader"
                      className="w-full rounded-xl overflow-hidden bg-black min-h-[280px]"
                    />
                  </>
                )
              )}

              {scanError && (
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-3">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M15 9l-6 6M9 9l6 6" />
                    </svg>
                  </div>
                  <p className="text-[14px] text-white font-medium">{scanError}</p>
                  <button
                    onClick={() => { setScanError(''); if (useNativeScanner) scanNative(); else requestCameraPermission() }}
                    className="mt-3 px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-[13px]"
                  >
                    {useNativeScanner ? 'Try Again' : 'Allow Permissions'}
                  </button>
                </div>
              )}

              {scanResult && (
                <div className="text-center py-4 w-full">
                  {/* Avatar */}
                  <div className="flex justify-center mb-3">
                    <AvatarImg size="xl" src={scanResult.avatar_url} />
                  </div>

                  <p className="text-[16px] font-bold text-white">{scanResult.name}</p>

                  {scanResult.invitedGroup ? (
                    <>
                      <p className="text-[13px] text-white/70 mt-1">
                        wants to add you to{' '}
                        <span className="font-semibold text-white">
                          {scanResult.invitedGroup.name}
                        </span>
                      </p>
                      <div className="flex gap-3 mt-4">
                        <button
                          onClick={() => handleAdd({})}
                          disabled={adding}
                          className="flex-1 py-3 rounded-xl border border-primary text-primary font-semibold text-[14px] disabled:opacity-60"
                        >
                          {adding ? 'Adding...' : 'Friend Only'}
                        </button>
                        <button
                          onClick={() => handleAdd({
                            groupId: scanResult.invitedGroup!.id,
                            groupName: scanResult.invitedGroup!.name,
                          })}
                          disabled={adding}
                          className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold text-[14px] disabled:opacity-60"
                        >
                          {adding ? 'Adding...' : `Join ${scanResult.invitedGroup.name}`}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Group dropdown — only if scanner owns groups */}
                      {groups.length > 0 && (
                        <div className="mt-3 mb-1">
                          <select
                            value={selectedGroupId}
                            onChange={(e) => setSelectedGroupId(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-foreground text-[13px] font-medium"
                          >
                            <option value="">No group (friend only)</option>
                            {groups.map((g) => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="flex gap-3 mt-4">
                        {groups.length > 0 ? (
                          <>
                            <button
                              onClick={() => handleAdd({})}
                              disabled={adding}
                              className="flex-1 py-3 rounded-xl border border-primary text-primary font-semibold text-[14px] disabled:opacity-60"
                            >
                              {adding ? 'Adding...' : 'Add Friend'}
                            </button>
                            <button
                              onClick={() => handleAdd({
                                groupId: selectedGroupId,
                                groupName: groups.find(g => g.id === selectedGroupId)?.name,
                              })}
                              disabled={adding || !selectedGroupId}
                              className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold text-[14px] disabled:opacity-60"
                            >
                              {adding ? 'Adding...' : 'Add to Group'}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleAdd({})}
                            disabled={adding}
                            className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold text-[14px] disabled:opacity-60"
                          >
                            {adding ? 'Adding...' : 'Add Friend'}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
