export interface Restaurant {
  id: string
  name: string
  slug: string
  address: string
  neighborhood: string
  lat: number
  lng: number
  photo_url: string
  cuisine_type: string
  price_range: 'economico' | 'medio' | 'premium'
  rating: number
  review_count: number
  has_promotion?: boolean
  /** Rating importado de Google Maps. Solo se muestra cuando HiChapi aún no
   *  tiene reviews propias (review_count === 0). NUNCA presentarlo como
   *  rating propio — siempre con sufijo "Google". */
  google_rating?: number | null
  google_rating_count?: number | null
}

export interface MenuItem {
  id: string
  restaurant_id: string
  name: string
  description: string
  price: number
  category: string
  tags: string[]
  photo_url?: string
}

export interface ChapiIntent {
  budget_clp?: number
  zone?: string
  dietary_restrictions?: string[]
  cuisine_type?: string
  occasion?: string
  user_lat?: number
  user_lng?: number
}

export interface RestaurantResult {
  restaurant: Restaurant
  suggested_dish: MenuItem        // best match (backward compat)
  menu_items: MenuItem[]          // up to 3 dishes for the card
  distance_m?: number
  match_reason: string
}

export interface ChatResponse {
  message: string
  intent?: ChapiIntent
  results?: RestaurantResult[]
  ready_to_search: boolean
  needs_location: boolean
}

export interface RestaurantSubmission {
  name:           string
  address:        string
  neighborhood:   string
  cuisine_type:   string
  price_range:    'economico' | 'medio' | 'premium'
  owner_name:     string
  owner_email:    string
  owner_phone?:   string
  description?:   string
  instagram_url?: string
  business_type?: string
  slug?:          string
}
