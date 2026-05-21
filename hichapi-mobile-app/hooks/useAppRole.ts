import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { resolveAppRole, type AppRole } from '../services/customer/roleResolver'

export function useAppRole() {
  const { user, session } = useAuth()
  const [role, setRole] = useState<AppRole | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setRole(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const r = await resolveAppRole(user.id)
      setRole(r)
    } catch {
      setRole('none')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (!session) {
      setRole(null)
      setLoading(false)
      return
    }
    refresh()
  }, [session, refresh])

  return { role, loading, refresh }
}
