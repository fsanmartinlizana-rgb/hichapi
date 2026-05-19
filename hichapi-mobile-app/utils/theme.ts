/**
 * HiChapi brand theme — matches the web app colors exactly.
 */

export const COLORS = {
  // Brand
  primary: '#FF6B35',       // HiChapi orange
  primaryLight: '#FF6B3520',
  primaryBorder: '#FF6B3540',

  // Backgrounds
  bgApp: '#F9FAFB',         // light gray for mobile (web uses dark, mobile uses light)
  bgCard: '#FFFFFF',
  bgDark: '#0A0A14',
  bgSidebar: '#0F0F1C',

  // Text
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textWhite: '#FFFFFF',

  // Borders
  border: '#F3F4F6',
  borderMedium: '#E5E7EB',

  // Status
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Tab bar
  tabActive: '#FF6B35',
  tabInactive: '#6B7280',
} as const;

export const LOGO_TEXT = 'hi';
export const APP_NAME = 'HiChapi';

export const DARK_MAP_STYLE = [
  {
    "elementType": "geometry",
    "stylers": [{ "color": "#181824" }]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#8a8a9e" }]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#181824" }]
  },
  {
    "featureType": "administrative",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#2c2c3e" }]
  },
  {
    "featureType": "landscape.man_made",
    "elementType": "geometry.fill",
    "stylers": [{ "color": "#1f1f2e" }]
  },
  {
    "featureType": "landscape.natural",
    "elementType": "geometry.fill",
    "stylers": [{ "color": "#181824" }]
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [{ "color": "#232334" }]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#75758d" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{ "color": "#2c2c3e" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#181824" }]
  },
  {
    "featureType": "road",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#8a8a9e" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [{ "color": "#3b3b54" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#181824" }]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#0d0d16" }]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#4e4e66" }]
  }
];
