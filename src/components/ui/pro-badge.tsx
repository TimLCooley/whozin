export default function ProBadge({ small }: { small?: boolean }) {
  return (
    <span className={`inline-flex items-center font-bold tracking-wide uppercase bg-primary/10 text-primary rounded-full ${
      small ? 'text-[8px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'
    }`}>
      PRO
    </span>
  )
}
