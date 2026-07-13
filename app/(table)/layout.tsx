export default function TableLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen bg-[var(--bg-canvas)] overflow-hidden"
         style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>
      {children}
    </div>
  )
}
