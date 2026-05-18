import { apiClient } from '../api/APIClient';

export interface Split {
  index: number;
  amount: number;
  paid: boolean;
  items?: Array<{ name: string; quantity: number; unit_price: number }>;
}

export type SplitType = 'full' | 'equal' | 'by_items' | 'custom';

export interface DteSelection {
  document_type: 39 | 33;
  rut_receptor?: string;
  razon_receptor?: string;
  giro_receptor?: string;
  direccion_receptor?: string;
  comuna_receptor?: string;
  fma_pago?: 1 | 2 | 3;
  email_receptor?: string;
}

export const billSplitService = {
  createSplit: async (params: {
    restaurant_id: string;
    table_id: string;
    order_ids: string[];
    split_type: SplitType;
    total_amount: number;
    num_splits: number;
    split_config?: any;
  }) => {
    return apiClient.post('/api/bills/split', params);
  },

  paySplit: async (
    splitId: string,
    params: {
      split_index: number;
      amount: number;
      tip_amount: number;
      payment_method: 'cash' | 'digital' | 'mixed';
      cash_amount: number;
      digital_amount: number;
      dte: DteSelection;
    }
  ) => {
    return apiClient.post(`/api/bills/split/${splitId}/pay`, params);
  },

  getReceptores: async (restaurantId: string, rut?: string) => {
    const query = rut ? `?restaurant_id=${restaurantId}&rut=${rut}` : `?restaurant_id=${restaurantId}`;
    return apiClient.get(`/api/dte/receptores${query}`);
  }
};
