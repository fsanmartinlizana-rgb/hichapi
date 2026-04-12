export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0A14] flex flex-col items-center justify-center px-4 py-12"
         style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>

      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#FF6B35]/6 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {children}
      </div>
    </div>
  )
}
