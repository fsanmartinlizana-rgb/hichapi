/**
 * ClientChatScreen — AI chat interface for restaurant clients.
 * Matches web version logic, streaming, and look.
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../config/supabase';
import { apiClient } from '../../services/api/APIClient';
import { chapiService } from '../../services/chapi/ChapiService';
import { useCart } from '../../contexts/CartContext';
import { formatCLP } from '../../utils/formatters';
import type { ChatMessage } from '../../types/ui';
import type { MenuItem } from '../../types/models';
import type { ClientChatScreenProps } from '../../types/navigation';

const INITIAL_CHIPS = [
  '⭐ ¿Qué recomiendas?',
  '📋 Ver la carta',
  '🌱 ¿Tienen algo sin gluten?',
  '🍽️ Algo para compartir',
];

// ── Internal MenuPreview Component ───────────────────────────────────────────

interface MenuPreviewProps {
  items: MenuItem[];
  onAdd: (item: MenuItem) => void;
}

function MenuPreview({ items, onAdd }: MenuPreviewProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Group by category
  const groups = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const it of items) {
      const cat = it.category || 'Otros';
      const existing = map.get(cat) ?? [];
      map.set(cat, [...existing, it]);
    }
    return Array.from(map.entries());
  }, [items]);

  // Set first category as expanded by default on first load
  useEffect(() => {
    if (groups.length > 0 && Object.keys(expanded).length === 0) {
      setExpanded({ [groups[0][0]]: true });
    }
  }, [groups]);

  const toggle = (cat: string) => {
    setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  return (
    <View style={styles.menuPreview}>
      {groups.map(([category, categoryItems]) => {
        const isExpanded = !!expanded[category];
        return (
          <View key={category} style={styles.menuSection}>
            <TouchableOpacity 
              style={styles.menuSectionHeader} 
              onPress={() => toggle(category)}
              activeOpacity={0.7}
            >
              <Text style={styles.menuSectionTitle}>{category.toUpperCase()}</Text>
              <Text style={styles.menuSectionChevron}>{isExpanded ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            
            {isExpanded && categoryItems.map((item) => (
              <View key={item.id} style={styles.menuItemCard}>
                <View style={styles.menuItemInfo}>
                  <Text style={styles.menuItemName}>{item.name}</Text>
                  <Text style={styles.menuItemPrice}>{formatCLP(item.price)}</Text>
                </View>
                <TouchableOpacity style={styles.menuAddBtn} onPress={() => onAdd(item)}>
                  <Text style={styles.menuAddBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

// ── Internal BillPreview Component ───────────────────────────────────────────

interface ServerOrder {
  id: string;
  status: string;
  total: number;
  order_items: Array<{
    id: string;
    name: string;
    quantity: number;
    unit_price: number;
  }>;
}

interface BillPreviewProps {
  tableId: string;
  onRequestBill: () => void;
}

function BillPreview({ tableId, onRequestBill }: BillPreviewProps) {
  const [orders, setOrders] = useState<ServerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    apiClient.get<{ orders: ServerOrder[] }>('/api/orders', { table_id: tableId })
      .then((res) => {
        if (res.orders) setOrders(res.orders);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tableId]);

  const items = useMemo(() => {
    return orders.flatMap(o => o.order_items || []);
  }, [orders]);

  const total = useMemo(() => {
    return orders.reduce((s, o) => s + (o.total || 0), 0);
  }, [orders]);

  if (loading) return <ActivityIndicator size="small" color="#FF6B35" style={{ margin: 20 }} />;

  if (items.length === 0) {
    return (
      <View style={styles.billContainer}>
        <Text style={styles.billEmptyText}>No hay pedidos registrados todavía.</Text>
      </View>
    );
  }

  const handleRequest = () => {
    setRequested(true);
    onRequestBill();
  };

  return (
    <View style={styles.billContainer}>
      <View style={styles.billHeader}>
        <Text style={styles.billTitle}>🧾 Tu cuenta</Text>
      </View>
      <View style={styles.billItems}>
        {items.map((it, idx) => (
          <View key={idx} style={styles.billItem}>
            <Text style={styles.billItemText}>{it.quantity}× {it.name}</Text>
            <Text style={styles.billItemPrice}>{formatCLP(it.unit_price * it.quantity)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.billTotalRow}>
        <Text style={styles.billTotalLabel}>Total</Text>
        <Text style={styles.billTotalValue}>{formatCLP(total)}</Text>
      </View>
      
      {requested ? (
        <View style={styles.billSuccess}>
          <Text style={styles.billSuccessText}>🔔 Garzón notificado</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.billButton} onPress={handleRequest}>
          <Text style={styles.billButtonText}>Pedir la cuenta al garzón</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function ClientChatScreen({ route, navigation }: ClientChatScreenProps) {
  const { restaurantId, tableId, slug } = route.params;
  const { cart, addItem, total, itemCount } = useCart();

  const [restaurantName, setRestaurantName] = useState<string>('');
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [messages, setMessages] = useState<(ChatMessage & { menuItems?: MenuItem[], showBill?: boolean })[]>([]);
  const [chips, setChips] = useState<string[]>(INITIAL_CHIPS);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const initialized = useRef(false);

  // Fetch restaurant details + menu
  useEffect(() => {
    // 1. Fetch Name
    supabase
      .from('restaurants')
      .select('name')
      .eq('id', restaurantId)
      .single()
      .then(({ data }) => {
        if (data) setRestaurantName(data.name);
      });

    // 2. Fetch Menu
    supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('available', true)
      .order('category')
      .then(({ data }) => {
        if (data) setMenu(data as MenuItem[]);
      });

    // 3. Initialize Cart Info
    import('../../services/cart/CartService').then(({ cartService }) => {
      cartService.setTableInfo(restaurantId, tableId, slug);
    });
  }, [restaurantId, tableId, slug]);

  // Initial greeting + Order check
  useEffect(() => {
    if (restaurantName && !initialized.current) {
      initialized.current = true;
      
      // 1. Show greeting immediately
      const greetingId = `assistant-greeting-${Date.now()}`;
      setMessages([
        {
          id: greetingId,
          role: 'assistant',
          content: `¡Hola! Soy Chapi 🍽️ ¿Qué te apetece hoy? Puedes tocar 📋 Carta arriba para ver todo, pedirme una recomendación ⭐ o decirme qué quieres y lo agrego al pedido 🙌`,
          timestamp: new Date().toISOString(),
        },
      ]);

      // 2. Check for active orders in background
      async function checkActiveOrders() {
        try {
          const res = await apiClient.get<{ orders: any[] }>('/api/orders', { table_id: tableId });
          
          if (res.orders && res.orders.length > 0) {
            setMessages(prev => [
              ...prev,
              {
                id: `active-order-${Date.now()}`,
                role: 'assistant',
                content: `¡Hola! Ya hay un pedido abierto en esta mesa 🍽️ Puedes agregar más cosas o pedir la cuenta cuando quieras.`,
                timestamp: new Date().toISOString(),
              },
            ]);
            setChips([
              '➕ Agregar algo más',
              '🧾 La cuenta, por favor',
              '✂️ Dividir la cuenta',
              '🍰 ¿Qué tienen de postre?',
            ]);
          }
        } catch (err) {
          console.error('Error checking active orders:', err);
        }
      }

      checkActiveOrders();
    }
  }, [restaurantName, tableId]);

  const showMenu = useCallback(() => {
    setMessages((prev) => [
      ...prev,
      {
        id: `menu-${Date.now()}`,
        role: 'assistant',
        content: '¡Aquí tienes la carta! 📋 Toca el + para agregar al pedido:',
        timestamp: new Date().toISOString(),
        menuItems: menu,
      },
    ]);
  }, [menu]);

  const showBill = useCallback(() => {
    setMessages((prev) => [
      ...prev,
      {
        id: `bill-${Date.now()}`,
        role: 'assistant',
        content: 'Aquí tienes el detalle de tu consumo hasta ahora:',
        timestamp: new Date().toISOString(),
        showBill: true,
      },
    ]);
  }, []);

  const handleRequestBill = useCallback(async () => {
    try {
      const { data: latestOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('table_id', tableId)
        .not('status', 'in', '("paid","cancelled")')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestOrder) {
        await apiClient.patch('/api/orders', {
          order_id: latestOrder.id,
          status: 'paying',
        });
      }
    } catch (err) {
      console.error('Error requesting bill:', err);
    }
  }, [tableId]);

  const handleSend = useCallback(async (textOverride?: string) => {
    const text = (textOverride || input).trim();
    if (!text || isTyping) return;

    // Local Intercept for "Ver carta" and "La cuenta"
    const normalized = text.toLowerCase().replace(/[📋⭐🌱🍽️➕🧾✂️🍰,.]/g, '').trim();
    if (normalized === 'ver la carta' || normalized === 'ver carta' || normalized === 'menu' || normalized === 'menú') {
      setMessages(prev => [...prev, { id: `user-${Date.now()}`, role: 'user', content: text, timestamp: new Date().toISOString() }]);
      setInput('');
      showMenu();
      return;
    }

    if (normalized.includes('la cuenta') || normalized === 'cuenta') {
      setMessages(prev => [...prev, { id: `user-${Date.now()}`, role: 'user', content: text, timestamp: new Date().toISOString() }]);
      setInput('');
      showBill();
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    const assistantId = `assistant-${Date.now()}`;
    
    try {
      await chapiService.streamChat(
        text,
        {
          restaurantId,
          slug,
          tableId,
          cart,
          conversationHistory: messages.map(m => ({ 
            role: m.role === 'assistant' ? 'assistant' : 'user', 
            content: m.content 
          })),
        },
        (event, data) => {
          if (event === 'token') {
            setIsTyping(false);
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.id === assistantId) {
                return [...prev.slice(0, -1), { ...last, content: data.text }];
              }
              return [
                ...prev,
                {
                  id: assistantId,
                  role: 'assistant',
                  content: data.text,
                  timestamp: new Date().toISOString(),
                },
              ];
            });
          } else if (event === 'done') {
            setIsTyping(false);
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.id === assistantId) {
                return [...prev.slice(0, -1), { 
                  ...last, 
                  content: data.message,
                  menuItems: data.action === 'show_menu' ? menu : undefined,
                  showBill: data.action === 'request_bill' ? true : undefined,
                }];
              }
              return prev;
            });

            if (data.action === 'add_items' && data.items_to_add?.length > 0) {
               data.items_to_add.forEach((itemToAdd: any) => {
                 const menuItem = menu.find(m => m.id === itemToAdd.menu_item_id);
                 if (menuItem) {
                   addItem(menuItem, itemToAdd.quantity || 1, itemToAdd.note);
                 }
               });
            }
          }
        },
        () => {
          setIsTyping(false);
        },
        (error) => {
          console.error('[ClientChat] Error streaming:', error);
          setIsTyping(false);
          setMessages((prev) => [
            ...prev,
            {
              id: `error-${Date.now()}`,
              role: 'assistant',
              content: 'Lo siento, tuve un problema al procesar tu solicitud. ¿Podrías intentar nuevamente?',
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      );
    } catch (error) {
      console.error('[ClientChat] Error starting stream:', error);
      setIsTyping(false);
    }
  }, [input, isTyping, messages, restaurantId, slug, tableId, cart, menu, showMenu]);

  const renderMessage = useCallback(({ item }: { item: ChatMessage & { menuItems?: MenuItem[] } }) => (
    <View style={styles.messageGroup}>
      <View style={[styles.messageRow, item.role === 'user' ? styles.userRow : styles.assistantRow]}>
        {item.role === 'assistant' && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>C</Text>
          </View>
        )}
        <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
          <Text style={[styles.bubbleText, item.role === 'user' ? styles.userText : styles.assistantText]}>
            {item.content}
          </Text>
        </View>
      </View>
      {item.menuItems && item.menuItems.length > 0 && (
        <View style={styles.menuPreviewContainer}>
          <MenuPreview items={item.menuItems} onAdd={(it) => addItem(it, 1)} />
        </View>
      )}
      {item.showBill && (
        <View style={styles.menuPreviewContainer}>
          <BillPreview tableId={tableId} onRequestBill={handleRequestBill} />
        </View>
      )}
    </View>
  ), [addItem, tableId, handleRequestBill]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity 
              onPress={() => {
                navigation.navigate('Customer');
              }}
              style={{ marginRight: 12, paddingVertical: 4, paddingRight: 8 }}
            >
              <Text style={{ color: '#fff', fontSize: 28, lineHeight: 30 }}>‹</Text>
            </TouchableOpacity>
            <View style={styles.headerAvatar}>
               <Text style={styles.headerAvatarText}>{(restaurantName || 'H').charAt(0)}</Text>
            </View>
            <View>
              <Text style={styles.headerTitle}>{restaurantName || 'Cargando...'}</Text>
              <Text style={styles.headerSubtitle}>Chapi · Tu asistente</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={showMenu}
          >
            <Text style={styles.menuButtonText}>📋 Carta</Text>
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Quick Chips */}
        {!isTyping && (
          <View style={styles.chipsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
              {chips.map((chip) => (
                <TouchableOpacity
                  key={chip}
                  style={styles.chip}
                  onPress={() => handleSend(chip)}
                >
                  <Text style={styles.chipText}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Typing indicator */}
        {isTyping && (
          <View style={styles.typingIndicator}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>C</Text>
            </View>
            <View style={styles.typingBubble}>
              <ActivityIndicator size="small" color="#FF6B35" />
            </View>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputRow}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Dile a Chapi qué quieres pedir..."
              placeholderTextColor="rgba(255,255,255,0.2)"
              returnKeyType="send"
              onSubmitEditing={() => handleSend()}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!input.trim() || isTyping) && styles.sendButtonDisabled]}
              onPress={() => handleSend()}
              disabled={!input.trim() || isTyping}
            >
              <Text style={styles.sendButtonText}>→</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cart Bar */}
        {itemCount > 0 && (
          <TouchableOpacity 
            style={styles.cartBar}
            onPress={() => navigation.navigate('Cart')}
            activeOpacity={0.9}
          >
            <View style={styles.cartInfo}>
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{itemCount}</Text>
              </View>
              <Text style={styles.cartTotalText}>{formatCLP(total)}</Text>
            </View>
            <Text style={styles.cartViewBtn}>Ver pedido →</Text>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A14' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: '#0A0A14',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  headerTitle: { fontSize: 15, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 10, color: 'rgba(255,255,255,0.35)' },
  menuButton: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  menuButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  messageList: { padding: 16, gap: 16 },
  messageGroup: { gap: 12 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, width: '100%' },
  userRow: { justifyContent: 'flex-end' },
  assistantRow: { justifyContent: 'flex-start' },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  avatarText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  bubble: { maxWidth: '78%', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  userBubble: { backgroundColor: '#FF6B35', borderBottomRightRadius: 4 },
  assistantBubble: { backgroundColor: '#1C1C2E', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  userText: { color: '#fff' },
  assistantText: { color: 'rgba(255,255,255,0.85)' },
  
  // Menu Preview Styles
  menuPreviewContainer: { paddingLeft: 32 },
  menuPreview: {
    backgroundColor: '#0F0F1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  menuSection: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  menuSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  menuSectionTitle: { fontSize: 10, fontWeight: 'bold', color: 'rgba(255,255,255,0.4)' },
  menuSectionChevron: { fontSize: 10, color: 'rgba(255,255,255,0.2)' },
  menuItemCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 12 },
  menuItemInfo: { flex: 1 },
  menuItemName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  menuItemPrice: { color: '#FF6B35', fontSize: 12, fontWeight: 'bold', marginTop: 2 },
  menuAddBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FF6B35', alignItems: 'center', justifyContent: 'center' },
  menuAddBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  // Bill Styles
  billContainer: {
    backgroundColor: '#0F0F1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    gap: 12,
  },
  billHeader: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', paddingBottom: 8 },
  billTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  billItems: { gap: 6 },
  billItem: { flexDirection: 'row', justifyContent: 'space-between' },
  billItemText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  billItemPrice: { color: '#fff', fontSize: 13, fontWeight: '500', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  billTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 10,
    marginTop: 4,
  },
  billTotalLabel: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  billTotalValue: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  billButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  billButtonText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  billSuccess: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.2)',
    marginTop: 8,
  },
  billSuccessText: { color: '#4ADE80', fontSize: 13, fontWeight: 'bold' },
  billEmptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center' },

  chipsContainer: { paddingVertical: 8 },
  chipsScroll: { paddingHorizontal: 16, gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipText: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  typingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  typingBubble: { backgroundColor: '#1C1C2E', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderBottomLeftRadius: 4 },
  inputRow: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 8 : 16,
    paddingTop: 8,
    backgroundColor: '#0A0A14',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161622',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    height: 40,
    fontSize: 14,
    color: '#fff',
    paddingHorizontal: 8,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.3 },
  sendButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Cart Bar
  cartBar: {
    backgroundColor: '#FF6B35',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  cartInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cartBadge: {
    backgroundColor: '#fff',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: { color: '#FF6B35', fontSize: 12, fontWeight: 'bold' },
  cartTotalText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cartViewBtn: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
});
