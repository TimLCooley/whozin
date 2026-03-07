'use client'

import { useState } from 'react'
import { AppHeader } from '@/components/app/header'
import { BottomNav } from '@/components/app/bottom-nav'

export default function AppHome() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')

  return (
    <div className="min-h-dvh flex flex-col bg-surface">
      <AppHeader />

      {/* Tabs */}
      <div className="bg-background flex relative">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 py-3 text-[13px] font-semibold text-center transition-colors ${
            activeTab === 'upcoming' ? 'text-primary' : 'text-muted'
          }`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`flex-1 py-3 text-[13px] font-semibold text-center transition-colors ${
            activeTab === 'past' ? 'text-primary' : 'text-muted'
          }`}
        >
          Past
        </button>
        {/* Animated underline */}
        <div
          className="absolute bottom-0 h-[2.5px] bg-primary rounded-full transition-all duration-300 ease-out"
          style={{
            width: '50%',
            left: activeTab === 'upcoming' ? '0%' : '50%',
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-border" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-20">
        {activeTab === 'upcoming' ? (
          <div className="animate-enter px-5 pt-6">
            <p className="text-foreground/80 text-[15px] leading-relaxed">
              You do not have any activities coming up.
            </p>
            <div className="flex justify-center mt-10">
              <div className="relative">
                <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Calendar body */}
                  <rect x="10" y="16" width="52" height="46" rx="6" fill="#f0f2f8" stroke="#d4d8e8" strokeWidth="1.5" />
                  {/* Calendar header bar */}
                  <rect x="10" y="16" width="52" height="14" rx="6" fill="#e4e7f1" />
                  <rect x="10" y="24" width="52" height="6" fill="#e4e7f1" />
                  {/* Calendar pins */}
                  <rect x="22" y="11" width="3" height="10" rx="1.5" fill="#d4d8e8" />
                  <rect x="47" y="11" width="3" height="10" rx="1.5" fill="#d4d8e8" />
                  {/* Checkmark */}
                  <path d="M26 42l7 7 13-15" stroke="#c0c6d6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-enter px-5 pt-6">
            <p className="text-foreground/80 text-[15px] leading-relaxed">
              You do not have any past activities.
            </p>
            <div className="flex justify-center mt-10">
              <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="16" width="52" height="46" rx="6" fill="#f0f2f8" stroke="#d4d8e8" strokeWidth="1.5" />
                <rect x="10" y="16" width="52" height="14" rx="6" fill="#e4e7f1" />
                <rect x="10" y="24" width="52" height="6" fill="#e4e7f1" />
                <rect x="22" y="11" width="3" height="10" rx="1.5" fill="#d4d8e8" />
                <rect x="47" y="11" width="3" height="10" rx="1.5" fill="#d4d8e8" />
                <path d="M28 44l16-16M44 44L28 28" stroke="#c0c6d6" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        className="fixed bottom-[72px] right-4 w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-[0_4px_14px_rgba(66,133,244,0.35)] active:scale-95 transition-transform z-50"
        style={{ animation: 'fabPulse 3s ease-in-out infinite' }}
        aria-label="Create activity"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <BottomNav />
    </div>
  )
}
