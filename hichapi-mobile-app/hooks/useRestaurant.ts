/**
 * Hook to resolve the restaurant_id for the authenticated user.
 * Queries the team_members table in Supabase, same as the web app.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from './useAuth';

interface RestaurantInfo {
  restaurantId: string;
  role: string;
  restaurantName: string;
  address: string;
  neighborhood: string;
}

export function useRestaurant() {
  const { user, session } = useAuth();
  const [info, setInfo] = useState<RestaurantInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    supabase
      .from('team_members')
      .select('role, restaurant_id, restaurants(id, name, address, neighborhood)')
      .eq('user_id', user.id)
      .eq('active', true)
      .limit(1)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setLoading(false);
          return;
        }
        const restaurant = data.restaurants as { id: string; name: string; address: string; neighborhood: string } | null;
        setInfo({
          restaurantId: data.restaurant_id,
          role: data.role,
          restaurantName: restaurant?.name ?? '',
          address: restaurant?.address ?? '',
          neighborhood: restaurant?.neighborhood ?? '',
        });
        setLoading(false);
      });
  }, [user?.id]);

  return {
    restaurantId: info?.restaurantId ?? '',
    role: info?.role ?? '',
    restaurantName: info?.restaurantName ?? '',
    address: info?.address ?? '',
    neighborhood: info?.neighborhood ?? '',
    loading,
  };
}
