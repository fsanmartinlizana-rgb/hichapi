/**
 * Chapi AI chat service for HiChapi Mobile App.
 */

import { sseClient } from './SSEClient';
import { API_BASE_URL } from '../../config/api';
import type { MenuItem } from '../../types/models';

import type { Cart } from '../../types/ui';

export interface ChatContext {
  restaurantId: string;
  slug: string;
  tableId?: string;
  cart?: Cart;
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
}

export class ChapiService {
  /**
   * Streams a chat response from Chapi via SSE.
   */
  async streamChat(
    message: string,
    context: ChatContext,
    onEvent: (event: string, data: any) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    await sseClient.stream(
      `${API_BASE_URL}/api/chat/table`,
      {
        message,
        restaurant_slug: context.slug,
        table_id: context.tableId,
        cart: context.cart?.items.map(item => ({
          menu_item_id: item.menu_item.id,
          name: item.menu_item.name,
          quantity: item.quantity,
          unit_price: item.menu_item.price,
          note: item.notes || null,
        })) ?? [],
        history: context.conversationHistory ?? [],
      },
      onEvent,
      onComplete,
      onError
    );
  }

  /**
   * Parses menu item recommendations from a Chapi response string.
   * Looks for JSON blocks containing menu item arrays.
   *
   * @example
   * parseMenuRecommendations('Te recomiendo: ```json\n[{"id":"1","name":"Empanada"}]\n```')
   * // → [{ id: '1', name: 'Empanada', ... }]
   */
  parseMenuRecommendations(response: string): MenuItem[] {
    const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/g;
    const results: MenuItem[] = [];

    let match: RegExpExecArray | null;
    while ((match = jsonBlockRegex.exec(response)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && typeof item === 'object' && 'id' in item && 'name' in item) {
              results.push(item as MenuItem);
            }
          }
        }
      } catch {
        // Invalid JSON block — skip
      }
    }

    return results;
  }

  /**
   * Builds a system prompt for Chapi including the restaurant menu.
   */
  buildSystemPrompt(menu: MenuItem[]): string {
    const menuText = menu
      .filter((i) => i.available)
      .map((i) => `- ${i.name} (${i.category}): $${i.price} CLP`)
      .join('\n');

    return `Eres Chapi, el asistente de pedidos de HiChapi. Ayuda a los clientes a ordenar de forma conversacional.

Menú disponible:
${menuText}

Cuando recomiendes platos, incluye un bloque JSON con los ítems recomendados:
\`\`\`json
[{"id": "...", "name": "...", "price": 0}]
\`\`\``;
  }
}

export const chapiService = new ChapiService();
