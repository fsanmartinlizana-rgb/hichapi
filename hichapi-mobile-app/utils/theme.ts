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
