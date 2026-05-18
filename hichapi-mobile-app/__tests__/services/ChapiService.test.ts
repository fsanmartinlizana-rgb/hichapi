/**
 * Unit tests for ChapiService.parseMenuRecommendations
 */

import { ChapiService } from '../../services/chapi/ChapiService';

const chapiService = new ChapiService();

describe('ChapiService.parseMenuRecommendations()', () => {
  it('returns empty array for response with no JSON blocks', () => {
    const result = chapiService.parseMenuRecommendations('Te recomiendo la empanada.');
    expect(result).toEqual([]);
  });

  it('parses a single menu item from a JSON block', () => {
    const response = `Te recomiendo:\n\`\`\`json\n[{"id":"1","name":"Empanada","price":2500,"category":"Entradas","tags":[],"available":true,"restaurant_id":"r1","description":""}]\n\`\`\``;
    const result = chapiService.parseMenuRecommendations(response);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Empanada');
  });

  it('parses multiple menu items from a JSON block', () => {
    const items = [
      { id: '1', name: 'Empanada', price: 2500, category: 'Entradas', tags: [], available: true, restaurant_id: 'r1', description: '' },
      { id: '2', name: 'Bebida', price: 1500, category: 'Bebidas', tags: [], available: true, restaurant_id: 'r1', description: '' },
    ];
    const response = `\`\`\`json\n${JSON.stringify(items)}\n\`\`\``;
    const result = chapiService.parseMenuRecommendations(response);
    expect(result).toHaveLength(2);
  });

  it('returns empty array for invalid JSON block', () => {
    const response = '```json\n{invalid json}\n```';
    const result = chapiService.parseMenuRecommendations(response);
    expect(result).toEqual([]);
  });

  it('returns empty array when JSON block contains non-array', () => {
    const response = '```json\n{"name": "Empanada"}\n```';
    const result = chapiService.parseMenuRecommendations(response);
    expect(result).toEqual([]);
  });

  it('skips items without id or name', () => {
    const response = '```json\n[{"price": 2500}, {"id": "1", "name": "Empanada", "price": 2500, "category": "Entradas", "tags": [], "available": true, "restaurant_id": "r1", "description": ""}]\n```';
    const result = chapiService.parseMenuRecommendations(response);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Empanada');
  });
});
