/**
 * Navigation parameter types for all stacks and tabs in HiChapi Mobile App.
 * Uses React Navigation typed navigation for type-safe screen navigation.
 */

import type { StackNavigationProp, StackScreenProps } from '@react-navigation/stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

// ---------------------------------------------------------------------------
// Auth Stack
// ---------------------------------------------------------------------------

/**
 * Parameter list for the authentication stack navigator.
 * Screens that don't require params use `undefined`.
 */
export type AuthStackParamList = {
  /** Login screen — no params required */
  Login: undefined;
  /** Registration screen — no params required */
  Register: undefined;
  /** Password recovery screen — no params required */
  PasswordRecovery: undefined;
};

/** Navigation prop type for screens within the Auth stack */
export type AuthStackNavigationProp = StackNavigationProp<AuthStackParamList>;

/** Screen props type for the Login screen */
export type LoginScreenProps = StackScreenProps<AuthStackParamList, 'Login'>;

/** Screen props type for the Register screen */
export type RegisterScreenProps = StackScreenProps<AuthStackParamList, 'Register'>;

/** Screen props type for the PasswordRecovery screen */
export type PasswordRecoveryScreenProps = StackScreenProps<AuthStackParamList, 'PasswordRecovery'>;

// ---------------------------------------------------------------------------
// Garzón Stack
// ---------------------------------------------------------------------------

/**
 * Parameter list for the Garzón (waiter) stack navigator.
 */
export type GarzonStackParamList = {
  /** Main garzón order list screen — no params required */
  GarzonList: undefined;
  /** Order detail screen — requires the order ID */
  OrderDetail: { orderId: string };
};

/** Navigation prop type for screens within the Garzón stack */
export type GarzonStackNavigationProp = StackNavigationProp<GarzonStackParamList>;

/** Screen props type for the GarzonList screen */
export type GarzonListScreenProps = StackScreenProps<GarzonStackParamList, 'GarzonList'>;

/** Screen props type for the OrderDetail screen */
export type OrderDetailScreenProps = StackScreenProps<GarzonStackParamList, 'OrderDetail'>;

// ---------------------------------------------------------------------------
// Comandas Stack
// ---------------------------------------------------------------------------

/**
 * Parameter list for the Comandas (kitchen board) stack navigator.
 */
export type ComandasStackParamList = {
  /** Kanban board showing all active orders — no params required */
  ComandasBoard: undefined;
  /** Detail view for a specific order item */
  ItemDetail: { itemId: string };
};

/** Navigation prop type for screens within the Comandas stack */
export type ComandasStackNavigationProp = StackNavigationProp<ComandasStackParamList>;

/** Screen props type for the ComandasBoard screen */
export type ComandasBoardScreenProps = StackScreenProps<ComandasStackParamList, 'ComandasBoard'>;

/** Screen props type for the ItemDetail screen */
export type ItemDetailScreenProps = StackScreenProps<ComandasStackParamList, 'ItemDetail'>;

// ---------------------------------------------------------------------------
// Mesas Stack
// ---------------------------------------------------------------------------

/**
 * Parameter list for the Mesas (tables) stack navigator.
 */
export type MesasStackParamList = {
  /** Grid view of all tables — no params required */
  MesasGrid: undefined;
  /** Detail view for a specific table */
  TableDetail: { tableId: string };
  /** QR code generator for a specific table */
  QRGenerator: {
    /** ID of the table */
    tableId: string;
    /** Human-readable label of the table */
    tableLabel: string;
    /** QR token to encode in the QR code */
    qrToken: string;
  };
};

/** Navigation prop type for screens within the Mesas stack */
export type MesasStackNavigationProp = StackNavigationProp<MesasStackParamList>;

/** Screen props type for the MesasGrid screen */
export type MesasGridScreenProps = StackScreenProps<MesasStackParamList, 'MesasGrid'>;

/** Screen props type for the TableDetail screen */
export type TableDetailScreenProps = StackScreenProps<MesasStackParamList, 'TableDetail'>;

/** Screen props type for the QRGenerator screen */
export type QRGeneratorScreenProps = StackScreenProps<MesasStackParamList, 'QRGenerator'>;

// ---------------------------------------------------------------------------
// Client Stack
// ---------------------------------------------------------------------------

/**
 * Parameter list for the client-facing stack navigator.
 * Used by customers scanning QR codes to place orders.
 */
export type ClientStackParamList = {
  /** QR code scanner screen — no params required */
  QRScanner: undefined;
  /** Menu browsing screen for a specific restaurant and table */
  ClientMenu: {
    /** ID of the restaurant */
    restaurantId: string;
    /** ID of the table the customer is seated at */
    tableId: string;
    /** Restaurant slug for API calls */
    slug: string;
  };
  /** Chat interface with Chapi AI for ordering */
  ClientChat: {
    /** ID of the restaurant */
    restaurantId: string;
    /** ID of the table the customer is seated at */
    tableId: string;
    /** Restaurant slug for API calls */
    slug: string;
  };
  /** Shopping cart screen — no params required */
  Cart: undefined;
  /** Split payment screen for dividing the bill */
  SplitPayment: {
    /** ID of the order to split */
    orderId: string;
    /** Total amount in CLP to be split */
    total: number;
  };
};

/** Navigation prop type for screens within the Client stack */
export type ClientStackNavigationProp = StackNavigationProp<ClientStackParamList>;

/** Screen props type for the QRScanner screen */
export type QRScannerScreenProps = StackScreenProps<ClientStackParamList, 'QRScanner'>;

/** Screen props type for the ClientMenu screen */
export type ClientMenuScreenProps = StackScreenProps<ClientStackParamList, 'ClientMenu'>;

/** Screen props type for the Cart screen */
export type CartScreenProps = StackScreenProps<ClientStackParamList, 'Cart'>;

/** Screen props type for the SplitPayment screen */
export type SplitPaymentScreenProps = StackScreenProps<ClientStackParamList, 'SplitPayment'>;

/** Screen props type for the ClientChat screen */
export type ClientChatScreenProps = StackScreenProps<ClientStackParamList, 'ClientChat'>;

// ---------------------------------------------------------------------------
// Main Bottom Tabs
// ---------------------------------------------------------------------------

/**
 * Parameter list for the main bottom tab navigator.
 * All tabs are top-level and don't require params.
 */
export type MainTabParamList = {
  /** Garzón tab — hosts the GarzonStackNavigator */
  Garzon: undefined;
  /** Comandas tab — hosts the ComandasStackNavigator */
  Comandas: undefined;
  /** Mesas tab — hosts the MesasStackNavigator */
  Mesas: undefined;
  /** Profile tab — single screen */
  Profile: undefined;
};

/** Navigation prop type for the main bottom tab navigator */
export type MainTabNavigationProp = BottomTabNavigationProp<MainTabParamList>;

// ---------------------------------------------------------------------------
// Root Stack
// ---------------------------------------------------------------------------

/**
 * Parameter list for the root stack navigator.
 * Controls top-level navigation between auth, main app, and onboarding.
 */
export type RootStackParamList = {
  /** Authentication flow — hosts the AuthStackNavigator */
  Auth: undefined;
  /** Main app — hosts the MainTabNavigator */
  Main: undefined;
  /** Client flow — hosts the ClientStackNavigator */
  Client: undefined;
  /** Rider flow — hosts the RiderNavigator */
  Rider: undefined;
  /** Onboarding flow shown on first launch */
  Onboarding: undefined;
};

/** Navigation prop type for the root stack navigator */
export type RootStackNavigationProp = StackNavigationProp<RootStackParamList>;
