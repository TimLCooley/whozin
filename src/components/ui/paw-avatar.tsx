export function PawAvatar({ size = 'md', src }: { size?: 'sm' | 'md' | 'lg'; src?: string | null }) {
  const dims = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-12 h-12' : 'w-9 h-9'
  const pawSize = size === 'sm' ? 14 : size === 'lg' ? 22 : 16

  if (src) {
    return (
      <div className={`${dims} rounded-full overflow-hidden flex-shrink-0`}>
        <img src={src} alt="" className="w-full h-full object-cover" />
      </div>
    )
  }

  return (
    <div className={`${dims} rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0`}>
      <svg width={pawSize} height={pawSize} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="7.5" cy="6.5" rx="2.2" ry="2.5" fill="#4285F4" opacity="0.7" />
        <ellipse cx="16.5" cy="6.5" rx="2.2" ry="2.5" fill="#4285F4" opacity="0.7" />
        <circle cx="4" cy="13" r="1.8" fill="#4285F4" opacity="0.7" />
        <circle cx="20" cy="13" r="1.8" fill="#4285F4" opacity="0.7" />
        <ellipse cx="12" cy="16.5" rx="5.5" ry="4.2" fill="#4285F4" opacity="0.85" />
      </svg>
    </div>
  )
}
