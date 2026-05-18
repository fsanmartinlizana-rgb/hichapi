/**
 * services/rider/store.tsx
 *
 * Global state store for the rider app using React Context + SecureStore.
 * Holds riderProfile, activeOrders (array), and authToken.
 * Requirements: 8.5, 10.9
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import * as SecureStore from 'expo-secure-store'
import type { RiderProfile, DeliveryOrder } from '../../../lib/delivery/types'
import { getRiderProfile, getDeliveryOrders } from './api'

const TOKEN_KEY = 'rider_auth_token'

const ACTIVE_STATUSES = ['assigned', 'picked_up', 'in_transit'] as const

interface RiderStore {
  authToken:    string | null
  riderProfile: RiderProfile | null
  activeOrders: DeliveryOrder[]          // All in-progress orders
  loading:      boolean
  setAuthToken:    (token: string | null) => Promise<void>
  setRiderProfile: (profile: RiderProfile | null) => void
  addActiveOrder:    (order: DeliveryOrder) => void
  updateActiveOrder: (order: DeliveryOrder) => void
  removeActiveOrder: (orderId: string) => void
  refreshProfile:  () => Promise<void>
  logout:          () => Promise<void>
}

const RiderStoreContext = createContext<RiderStore | null>(null)

export function RiderStoreProvider({ children }: { children: React.ReactNode }) {
  const [authToken,    setAuthTokenState] = useState<string | null>(null)
  const [riderProfile, setRiderProfile]   = useState<RiderProfile | null>(null)
  const [activeOrders, setActiveOrders]   = useState<DeliveryOrder[]>([])
  const [loading,      setLoading]        = useState(true)

  // Load persisted token on mount
  useEffect(() => {
    SecureStore.getItemAsync(TOKEN_KEY)
      .then(token => {
        if (token) setAuthTokenState(token)
      })
      .finally(() => setLoading(false))
  }, [])

  // Auto-load profile and ALL active orders when token changes
  useEffect(() => {
    if (!authToken) {
      setRiderProfile(null)
      setActiveOrders([])
      return
    }
    getRiderProfile(authToken)
      .then(setRiderProfile)
      .catch(() => setRiderProfile(null))

    getDeliveryOrders(authToken)
      .then(orders => {
        const active = orders.filter(o => (ACTIVE_STATUSES as readonly string[]).includes(o.status))
        if (active.length > 0) setActiveOrders(active)
      })
      .catch(err => console.warn('Failed to load active orders:', err))
  }, [authToken])

  const setAuthToken = useCallback(async (token: string | null) => {
    if (token) {
      await SecureStore.setItemAsync(TOKEN_KEY, token)
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY)
    }
    setAuthTokenState(token)
  }, [])

  const addActiveOrder = useCallback((order: DeliveryOrder) => {
    setActiveOrders(prev => {
      // Avoid duplicates
      if (prev.find(o => o.id === order.id)) return prev
      return [...prev, order]
    })
  }, [])

  const updateActiveOrder = useCallback((order: DeliveryOrder) => {
    setActiveOrders(prev => prev.map(o => o.id === order.id ? order : o))
  }, [])

  const removeActiveOrder = useCallback((orderId: string) => {
    setActiveOrders(prev => prev.filter(o => o.id !== orderId))
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!authToken) return
    const profile = await getRiderProfile(authToken)
    setRiderProfile(profile)
  }, [authToken])

  const logout = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY)
    } catch (e) {
      console.warn('Failed to delete token from SecureStore', e)
    }
    setAuthTokenState(null)
    setRiderProfile(null)
    setActiveOrders([])
  }, [])

  return (
    <RiderStoreContext.Provider value={{
      authToken,
      riderProfile,
      activeOrders,
      loading,
      setAuthToken,
      setRiderProfile,
      addActiveOrder,
      updateActiveOrder,
      removeActiveOrder,
      refreshProfile,
      logout,
    }}>
      {children}
    </RiderStoreContext.Provider>
  )
}

export function useRiderStore(): RiderStore {
  const ctx = useContext(RiderStoreContext)
  if (!ctx) throw new Error('useRiderStore must be used within RiderStoreProvider')
  return ctx
}

