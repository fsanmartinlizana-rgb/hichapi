import { CuentaShell } from '@/components/cuenta/CuentaShell'

export default function CuentaLayout({ children }: { children: React.ReactNode }) {
  return <CuentaShell>{children}</CuentaShell>
}
