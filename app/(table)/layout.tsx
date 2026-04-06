export default function TableLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen bg-[#0A0A14] overflow-hidden"
         style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>
      {children}
    </div>
  )
}
