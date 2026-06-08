import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { CompositeNavigationProp } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { CustomerTabParamList, CustomerSearchStackParamList } from '../../types/navigation'
import { Ionicons } from '@expo/vector-icons'

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<CustomerTabParamList, 'Home'>,
  StackNavigationProp<CustomerSearchStackParamList>
>

export default function CustomerHomeScreen() {
  const navigation = useNavigation<Nav>()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hola 👋</Text>
        <Text style={styles.subtitle}>¿Qué tienes en mente hoy?</Text>
      </View>

      <View style={styles.actionsContainer}>
        {/* Acción 1: Escanear QR */}
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: '#FF6B35' }]}
          onPress={() => (navigation.getParent() as any)?.navigate('Client', { screen: 'QRScanner' })}
          activeOpacity={0.85}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="qr-code-outline" size={36} color="#FF6B35" />
          </View>
          <View style={styles.cardTextContainer}>
            <Text style={styles.cardTitleLight}>Estoy en un local</Text>
            <Text style={styles.cardSubtitleLight}>Escanear el QR de tu mesa</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        {/* Acción 2: Hablar con Chapi */}
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOpacity: 0.05 }]}
          onPress={() => navigation.navigate('Buscar', { screen: 'CustomerSearch' })}
          activeOpacity={0.85}
        >
          <View style={[styles.iconContainer, { backgroundColor: '#FFF5F2' }]}>
            <Ionicons name="chatbubbles-outline" size={36} color="#FF6B35" />
          </View>
          <View style={styles.cardTextContainer}>
            <Text style={styles.cardTitleDark}>Quiero vitrinear</Text>
            <Text style={styles.cardSubtitleDark}>Busca opciones con Chapi</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#D1D5DB" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const { width } = Dimensions.get('window')

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    marginTop: 60,
    marginBottom: 40,
    paddingHorizontal: 28,
  },
  greeting: {
    fontSize: 36,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: '500',
  },
  actionsContainer: {
    paddingHorizontal: 20,
    gap: 24,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    padding: 24,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitleLight: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  cardSubtitleLight: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    lineHeight: 20,
  },
  cardTitleDark: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  cardSubtitleDark: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
    lineHeight: 20,
  },
})
