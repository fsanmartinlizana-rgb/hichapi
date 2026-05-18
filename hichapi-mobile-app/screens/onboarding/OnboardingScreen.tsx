/**
 * OnboardingScreen — 4-slide introduction to HiChapi Mobile App.
 * Shows on first launch; can be replayed from ProfileScreen.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ListRenderItemInfo,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../utils/constants';

// ---------------------------------------------------------------------------
// Slide data
// ---------------------------------------------------------------------------

interface Slide {
  id: string;
  icon: string;
  title: string;
  description: string;
}

const SLIDES: Slide[] = [
  {
    id: '1',
    icon: '🍽️',
    title: 'Bienvenido a HiChapi',
    description:
      'La plataforma de gestión de restaurantes en tu bolsillo. Gestiona órdenes, mesas y cocina en tiempo real desde tu dispositivo móvil.',
  },
  {
    id: '2',
    icon: '📋',
    title: 'Panel Garzón',
    description:
      'Ve todas las órdenes activas organizadas por mesa. Avanza el estado de cada pedido con un toque y recibe alertas cuando los clientes quieren pagar.',
  },
  {
    id: '3',
    icon: '👨‍🍳',
    title: 'Panel Comandas',
    description:
      'Tablero Kanban para cocina. Las órdenes fluyen de Recibida → En Cocina → Lista → Entregada. Mantén el ritmo de la cocina sincronizado.',
  },
  {
    id: '4',
    icon: '🪑',
    title: 'Panel Mesas',
    description:
      'Vista de grilla con todas las mesas. Alertas en tiempo real cuando hay nuevas órdenes o clientes esperando pagar. Genera códigos QR para cada mesa.',
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OnboardingScreenProps {
  onComplete: () => void;
  isTutorial?: boolean; // true when replayed from ProfileScreen
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OnboardingScreen({
  onComplete,
  isTutorial = false,
}: OnboardingScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<Slide>>(null);

  const handleNext = useCallback(() => {
    if (currentIndex < SLIDES.length - 1) {
      const nextIndex = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    }
  }, [currentIndex]);

  const handleFinish = useCallback(async () => {
    if (!isTutorial) {
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');
    }
    onComplete();
  }, [isTutorial, onComplete]);

  const handleSkip = useCallback(async () => {
    if (!isTutorial) {
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');
    }
    onComplete();
  }, [isTutorial, onComplete]);

  const renderSlide = useCallback(
    ({ item }: ListRenderItemInfo<Slide>) => (
      <View style={styles.slide}>
        <Text style={styles.slideIcon}>{item.icon}</Text>
        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.slideDescription}>{item.description}</Text>
      </View>
    ),
    []
  );

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      {/* Skip button */}
      {!isLastSlide && (
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          accessibilityLabel="Omitir tutorial"
          accessibilityRole="button"
        >
          <Text style={styles.skipText}>Omitir</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        style={styles.flatList}
      />

      {/* Dot indicators */}
      <View style={styles.dotsContainer}>
        {SLIDES.map((_, index) => (
          <View
            key={index}
            style={[styles.dot, index === currentIndex && styles.dotActive]}
          />
        ))}
      </View>

      {/* Action button */}
      <TouchableOpacity
        style={styles.actionButton}
        onPress={isLastSlide ? handleFinish : handleNext}
        accessibilityLabel={isLastSlide ? (isTutorial ? 'Cerrar tutorial' : 'Comenzar a usar HiChapi') : 'Siguiente slide'}
        accessibilityRole="button"
      >
        <Text style={styles.actionButtonText}>
          {isLastSlide ? (isTutorial ? 'Cerrar' : 'Comenzar') : 'Siguiente'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  skipButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginTop: 8,
  },
  skipText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  flatList: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  slideIcon: {
    fontSize: 72,
    marginBottom: 32,
  },
  slideTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  slideDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    backgroundColor: '#FF6B35',
    width: 24,
  },
  actionButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
    marginBottom: 48,
    minWidth: 200,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
