import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { sseClient } from '../../services/chapi/SSEClient';
import { API_BASE_URL } from '../../config/api';

const QUICK_CHIPS = [
  'Sin gluten cerca de mí',
  'Vegano en Providencia',
  'Algo rico por menos de 15 lucas',
  'Japonés en Barrio Italia',
  'Para almorzar hoy',
];

const ZONE_CHIPS = [
  'Providencia',
  'Barrio Italia',
  'Bellavista',
  'Lastarria',
  'Las Condes',
  'Ñuñoa',
  'Santiago Centro',
  'Vitacura',
];

export interface ChapiIntent {
  budget_clp?: number | null;
  zone?: string | null;
  zones?: string[] | null;
  dietary_restrictions?: string[] | null;
  cuisine_type?: string | null;
  dish_keyword?: string | null;
  user_lat?: number | null;
  user_lng?: number | null;
}

interface CustomerChatBoxProps {
  onResults: (results: any[], query: string, searchEventId: string | null) => void;
  onLoadingChange?: (loading: boolean) => void;
  onNoResultsDetail?: (detail: any) => void;
  defaultZone?: string;
}

export function CustomerChatBox({
  onResults,
  onLoadingChange,
  onNoResultsDetail,
  defaultZone,
}: CustomerChatBoxProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [intent, setIntent] = useState<ChapiIntent>({ zone: defaultZone });
  const [needsLocation, setNeedsLocation] = useState(false);
  const [askingForZone, setAskingForZone] = useState(false);
  
  const lastQueryRef = useRef<string>('');

  useEffect(() => {
    if (defaultZone && !intent.zone) {
      setIntent((prev) => ({ ...prev, zone: defaultZone }));
    }
  }, [defaultZone]);

  const requestLocation = async (): Promise<{ user_lat: number; user_lng: number } | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { user_lat: loc.coords.latitude, user_lng: loc.coords.longitude };
    } catch (e) {
      return null;
    }
  };

  const sendMessage = async (message: string) => {
    if (!message.trim() || loading) return;

    lastQueryRef.current = message;
    setLoading(true);
    onLoadingChange?.(true);
    setInput('');
    setAskingForZone(false);

    let currentIntent = { ...intent };
    if (needsLocation && !currentIntent.user_lat) {
      const location = await requestLocation();
      if (location) {
        currentIntent = { ...currentIntent, ...location };
        setIntent(currentIntent);
      }
    }

    try {
      await sseClient.stream(
        `${API_BASE_URL}/api/chat`,
        {
          message,
          intent: currentIntent,
        },
        (event, data) => {
          if (event === 'token') {
            // Do nothing
          } else if (event === 'done') {
            if (data.intent) {
              setIntent((prev) => {
                const next = { ...prev };
                for (const key of Object.keys(data.intent) as Array<keyof ChapiIntent>) {
                  if (data.intent[key] !== undefined) {
                    (next as any)[key] = data.intent[key];
                  }
                }
                return next;
              });
            }
            setNeedsLocation(data.needs_location);
            setAskingForZone(!data.ready_to_search || (!data.intent?.zone && !data.needs_location));

            if (data.results?.length > 0) {
              onResults(data.results, message, null);
            } else if (data.failure_reason === 'no_dietary_match' || data.failure_reason === 'no_budget_match') {
              onNoResultsDetail?.({
                reason: data.failure_reason,
                zone: data.intent?.zone ?? data.resolved_zone ?? null,
                cuisine: data.intent?.cuisine_type ?? null,
                dietary_restrictions: data.intent?.dietary_restrictions ?? [],
                budget_clp: data.intent?.budget_clp ?? null,
                alternatives_count: data.alternatives_in_zone_count ?? 0,
              });
            } else if (data.searched_but_empty || data.no_results_in_zone) {
               // En móvil por ahora solo mostramos el banner de 0 resultados genérico si falla
               onResults([], message, null);
            }
          } else if (event === 'error') {
          }
        },
        () => {
          setLoading(false);
          onLoadingChange?.(false);
        },
        (error) => {
          setLoading(false);
          onLoadingChange?.(false);
          console.error('[CustomerChatBox] SSE Error:', error);
        }
      );
    } catch (err) {
      setLoading(false);
      onLoadingChange?.(false);
    }
  };

  return (
    <View style={styles.container}>

      {/* Input Box */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="¿Qué quieres comer hoy? Cuéntale a Chapi..."
          placeholderTextColor="#A0A0A0"
          multiline
          onSubmitEditing={() => sendMessage(input)}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => sendMessage(input)}
          disabled={!input.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={16} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {/* Quick Chips */}
      {askingForZone ? (
        <View style={styles.chipsContainer}>
          <Text style={styles.chipsHeader}>¿En qué barrio?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            {(!defaultZone ? ZONE_CHIPS : ['Cerca de mí', `Centro de ${defaultZone}`]).map((zone) => (
              <TouchableOpacity key={zone} style={styles.zoneChip} onPress={() => sendMessage(zone)} disabled={loading}>
                <Text style={styles.zoneChipText}>{zone}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.chipsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            {QUICK_CHIPS.map((chip) => (
              <TouchableOpacity key={chip} style={styles.quickChip} onPress={() => sendMessage(chip)} disabled={loading}>
                <Text style={styles.quickChipText}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Location Hint */}
      {needsLocation && (
        <TouchableOpacity style={styles.locationBtn} onPress={() => sendMessage('usa mi ubicación actual')}>
          <Ionicons name="location" size={14} color="#FF6B35" />
          <Text style={styles.locationBtnText}>Usar mi ubicación actual</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    fontSize: 15,
    color: '#1A1A2E',
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  sendBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
  chipsContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  chipsHeader: {
    fontSize: 11,
    color: '#A0A0A0',
    marginBottom: 8,
  },
  chipsScroll: {
    paddingHorizontal: 4,
    gap: 8,
  },
  zoneChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
  },
  zoneChipText: {
    color: '#FF6B35',
    fontSize: 12,
    fontWeight: '600',
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  quickChipText: {
    color: '#666',
    fontSize: 12,
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 4,
  },
  locationBtnText: {
    color: '#FF6B35',
    fontSize: 12,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});
