'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { AvatarImg } from '@/components/ui/avatar-img'

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

  const qrUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/u/${userId}`
    : `https://whozin.io/u/${userId}`

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

  // Auto-start scanner when switching to scan tab
  useEffect(() => {
    if (open && tab === 'scan' && !scanResult && !scanError && !scanning) {
      const t = setTimeout(() => startScanner(), 150)
      return () => clearTimeout(t)
    }
  }, [open, tab, scanResult, scanError]) // eslint-disable-line react-hooks/exhaustive-deps

  async function startScanner() {
    if (scanning) return
    setScanError('')
    setScanResult(null)
    setSuccessName('')

    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('qr-reader')
      html5QrRef.current = scanner

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
      setScanning(true)
    } catch {
      setScanError('Could not access camera. Please allow camera permissions.')
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

    try {
      const res = await fetch(`/api/user/public?id=${scannedId}`)
      if (!res.ok) {
        setScanError('User not found')
        return
      }
      const profile = await res.json()
      const name = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
      setScanResult({ name: name || 'Whozin User', id: profile.id, avatar_url: profile.avatar_url })
    } catch {
      setScanError('Failed to look up user')
    }
  }

  async function handleAdd(addToGroup: boolean) {
    if (!scanResult || adding) return
    setAdding(true)
    try {
      const body: Record<string, string> = { friend_id: scanResult.id }
      if (addToGroup && selectedGroupId) body.group_id = selectedGroupId
      const res = await fetch('/api/friends/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const gName = addToGroup ? groups.find(g => g.id === selectedGroupId)?.name : null
        setSuccessName(scanResult.name + (gName ? ` → ${gName}` : ''))
        setScanResult(null)
        setTimeout(() => {
          setSuccessName('')
          startScanner()
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
                    onClick={() => { setScanError(''); startScanner() }}
                    className="mt-3 px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-[13px]"
                  >
                    Try Again
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

                  {/* Group dropdown — only if user has groups */}
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

                  {/* Action buttons */}
                  <div className="flex gap-3 mt-4">
                    {groups.length > 0 ? (
                      <>
                        <button
                          onClick={() => handleAdd(false)}
                          disabled={adding}
                          className="flex-1 py-3 rounded-xl border border-primary text-primary font-semibold text-[14px] disabled:opacity-60"
                        >
                          {adding ? 'Adding...' : 'Add Friend'}
                        </button>
                        <button
                          onClick={() => handleAdd(true)}
                          disabled={adding || !selectedGroupId}
                          className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold text-[14px] disabled:opacity-60"
                        >
                          {adding ? 'Adding...' : 'Add to Group'}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleAdd(false)}
                        disabled={adding}
                        className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold text-[14px] disabled:opacity-60"
                      >
                        {adding ? 'Adding...' : 'Add Friend'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
