'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface Restaurant {
  id: string
  name: string
  slug: string
  neighborhood?: string | null
  plan?: string
}

interface UserProfile {
  id: string
  email: string
  initials: string
  role: string
}

interface RestaurantContextValue {
  restaurant:    Restaurant | null
  restaurants:   Restaurant[]          // all (super_admin) or [single]
  profile:       UserProfile | null
  isSuperAdmin:  boolean
  loading:       boolean
  switchTo:      (id: string) => void
  logout:        () => Promise<void>
}

const RestaurantContext = createContext<RestaurantContextValue>({
  restaurant:   null,
  restaurants:  [],
  profile:      null,
  isSuperAdmin: false,
  loading:      true,
  switchTo:     () => {},
  logout:       async () => {},
})

export function useRestaurant() {
  return useContext(RestaurantContext)
}

const LS_KEY = 'hichapi_selected_restaurant'

export function RestaurantProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  const [restaurants,  setRestaurants]  = useState<Restaurant[]>([])
  const [restaurant,   setRestaurant]   = useState<Restaurant | null>(null)
  const [profile,      setProfile]      = useState<UserProfile | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loading,      setLoading]      = useState(true)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // Build profile
    const email    = user.email ?? ''
    const initials = email.slice(0, 2).toUpperCase()
    const base     = { id: user.id, email, initials, role: 'admin' }

    // Get team membership(s)
    const { data: memberships } = await supabase
      .from('team_members')
      .select('role, restaurant_id, restaurants(id, name, slug, neighborhood, plan)')
      .eq('user_id', user.id)
      .eq('active', true)

    if (!memberships || memberships.length === 0) {
      setProfile({ ...base, role: 'admin' })
      setLoading(false)
      return
    }

    const superAdmin = memberships.some((m) => m.role === 'super_admin')
    setIsSuperAdmin(superAdmin)

    let allRestaurants: Restaurant[] = []

    if (superAdmin) {
      // Super admin sees ALL restaurants
      const { data: all } = await supabase
        .from('restaurants')
        .select('id, name, slug, neighborhood, plan')
        .order('name')
      allRestaurants = (all ?? []) as Restaurant[]
    } else {
      allRestaurants = memberships
        .map((m) => m.restaurants as unknown as Restaurant)
        .filter(Boolean)
    }

    setRestaurants(allRestaurants)

    // Restore last selected restaurant from localStorage
    const saved = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null
    const saved_match = saved ? allRestaurants.find(r => r.id === saved) : null
    const current = saved_match ?? allRestaurants[0] ?? null
    setRestaurant(current)

    const role = superAdmin ? 'super_admin' : (memberships[0]?.role ?? 'admin')
    setProfile({ ...base, initials, role })
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()
    // Re-load on auth state change; unsubscribe on unmount (prevents memory leak)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') load()
      if (event === 'SIGNED_OUT') {
        setRestaurant(null)
        setRestaurants([])
        setProfile(null)
        setIsSuperAdmin(false)
        setLoading(false)
      }
    })
    return () => { subscription.unsubscribe() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  function switchTo(id: string) {
    const r = restaurants.find(r => r.id === id)
    if (!r) return
    setRestaurant(r)
    if (typeof window !== 'undefined') localStorage.setItem(LS_KEY, id)
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <RestaurantContext.Provider value={{ restaurant, restaurants, profile, isSuperAdmin, loading, switchTo, logout }}>
      {children}
    </RestaurantContext.Provider>
  )
}
