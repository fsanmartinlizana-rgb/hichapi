import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { apiClient } from '../../services/api/APIClient';
import { customerStyles } from '../../components/customer/customerStyles';
import { CustomerChatBox } from '../../components/customer/CustomerChatBox';

import { StackNavigationProp } from '@react-navigation/stack';
import { CustomerSearchStackParamList } from '../../types/navigation';

type NavigationProp = StackNavigationProp<CustomerSearchStackParamList, 'CustomerSearch'>;

export default function CustomerSearchScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [userZone, setUserZone] = useState<string>('Santiago');
  const [fetchingLocation, setFetchingLocation] = useState(true);

  const handleChatResults = (newResults: any[], query: string, searchEventId: string | null) => {
    setSearched(true);
    if (newResults && newResults.length > 0) {
      const mappedResults = newResults.map((r: any) => ({
        id: r.restaurant?.id || r.id,
        name: r.restaurant?.name || r.name,
        cuisine_type: r.restaurant?.cuisine_type || r.cuisine_type || 'Internacional',
        neighborhood: r.restaurant?.neighborhood || r.neighborhood || userZone,
        rating: r.restaurant?.rating || r.restaurant?.google_rating || r.rating || 0,
        menu_items: r.menu_items || [],
      }));
      setResults(mappedResults);
    } else {
      setResults([]);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        let detectedZone = 'Santiago';
        
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const geocode = await Location.reverseGeocodeAsync({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
          
          if (geocode.length > 0 && geocode[0].city) {
            detectedZone = geocode[0].city;
          } else if (geocode.length > 0 && geocode[0].region) {
            detectedZone = geocode[0].region;
          }
        }
        
        setUserZone(detectedZone);
        
        // Ya no ejecutamos una búsqueda inicial vacía, dejamos que el usuario
        // interactúe con el ChatBox, pero le pasamos la zona por defecto.
      } catch (error) {
        console.warn('Error fetching location:', error);
      } finally {
        setFetchingLocation(false);
      }
    })();
  }, []);

  return (
    <View style={[customerStyles.screen, { backgroundColor: '#FAFAF8', paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Dile a Chapi{'\n'}
          <Text style={{ color: '#FF6B35' }}>qué quieres comer</Text>
        </Text>
        <Text style={styles.subtitle}>
          {fetchingLocation 
            ? 'Ubicándote...' 
            : `Como un amigo que sabe todos los restaurantes de ${userZone}.`}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        {!fetchingLocation && (
          <CustomerChatBox
            defaultZone={userZone}
            onResults={handleChatResults}
          />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.resultsContainer}>
        {searched && results.length === 0 && (
          <Text style={styles.noResults}>No se encontraron restaurantes.</Text>
        )}

        {results.map((r, i) => (
          <TouchableOpacity 
            key={i} 
            style={styles.card}
            onPress={() => navigation.navigate('CustomerRestaurantMenu', { 
              restaurant: { name: r.name, neighborhood: r.neighborhood, cuisine_type: r.cuisine_type, rating: r.rating },
              menu_items: r.menu_items
            })}
          >
            <Text style={styles.cardTitle}>{r.name}</Text>
            <Text style={styles.cardSubtitle}>{r.neighborhood} · {r.cuisine_type}</Text>
            <Text style={styles.cardRating}>★ {r.rating}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 24,
    paddingTop: 60,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    color: '#1A1A2E',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  resultsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 10,
  },
  noResults: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 20,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  cardRating: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '600',
    marginTop: 8,
  },
});
