import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { getLoyalty, redeemPoints } from '../../services/customer/api'
import { customerStyles, formatClp } from '../../components/customer/customerStyles'
import type { LoyaltyTransaction } from '../../types/customer'

export default function CustomerLoyaltyScreen() {
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([])
  const [points, setPoints] = useState('500')
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [redeeming, setRedeeming] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getLoyalty()
      setBalance(data.balance)
      setTransactions(data.transactions)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  async function redeem() {
    const n = parseInt(points, 10)
    if (n < 500) {
      setMessage('Mínimo 500 puntos')
      return
    }
    setRedeeming(true)
    setMessage(null)
    try {
      const res = await redeemPoints(n)
      setMessage(`Canje exitoso: ${formatClp(res.discount_clp)} de descuento`)
      await load()
    } catch {
      setMessage('No se pudo canjear')
    } finally {
      setRedeeming(false)
    }
  }

  return (
    <ScrollView
      style={customerStyles.screen}
      contentContainerStyle={customerStyles.scroll}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Text style={customerStyles.title}>Fidelidad</Text>
      <Text style={customerStyles.subtitle}>Puntos y movimientos</Text>

      {loading && balance === 0 ? (
        <ActivityIndicator style={{ marginTop: 24 }} color="#FF6B35" />
      ) : (
        <>
          <View style={customerStyles.pointsBadge}>
            <Text style={{ color: '#6B7280' }}>Balance actual</Text>
            <Text style={customerStyles.pointsValue}>{balance}</Text>
            <Text style={{ color: '#9CA3AF', fontSize: 12 }}>puntos</Text>
          </View>

          {balance >= 500 && (
            <View style={customerStyles.card}>
              <Text style={customerStyles.label}>Canjear puntos</Text>
              <Text style={{ color: '#6B7280', fontSize: 12, marginBottom: 8 }}>
                Mínimo 500. Cada 100 pts = $100 de descuento.
              </Text>
              <TextInput
                style={customerStyles.input}
                keyboardType="number-pad"
                value={points}
                onChangeText={setPoints}
              />
              <TouchableOpacity
                style={customerStyles.btn}
                onPress={redeem}
                disabled={redeeming}
              >
                <Text style={customerStyles.btnText}>
                  {redeeming ? 'Canjeando…' : 'Canjear'}
                </Text>
              </TouchableOpacity>
              {message && (
                <Text style={{ marginTop: 8, color: message.includes('exitoso') ? '#059669' : '#EF4444' }}>
                  {message}
                </Text>
              )}
            </View>
          )}

          <Text style={[customerStyles.label, { marginTop: 16 }]}>Historial</Text>
          {transactions.length === 0 ? (
            <Text style={{ color: '#9CA3AF' }}>Sin movimientos aún</Text>
          ) : (
            transactions.map((t) => (
              <View key={t.id} style={customerStyles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: '600', flex: 1 }}>{t.description}</Text>
                  <Text
                    style={{
                      fontWeight: '700',
                      color: t.points_delta >= 0 ? '#059669' : '#EF4444',
                    }}
                  >
                    {t.points_delta >= 0 ? '+' : ''}
                    {t.points_delta}
                  </Text>
                </View>
                <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 4 }}>
                  {new Date(t.created_at).toLocaleString('es-CL')} · saldo {t.balance_after}
                </Text>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  )
}
