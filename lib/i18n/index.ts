// ── Lightweight i18n for HiChapi ─────────────────────────────────────────────
// Supports es (Spanish - default), en (English), pt (Portuguese)

export type Locale = 'es' | 'en' | 'pt'

export const SUPPORTED_LOCALES: Locale[] = ['es', 'en', 'pt']
export const DEFAULT_LOCALE: Locale = 'es'

export const LOCALE_NAMES: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
  pt: 'Português',
}

export const LOCALE_FLAGS: Record<Locale, string> = {
  es: '🇨🇱',
  en: '🇺🇸',
  pt: '🇧🇷',
}

// ── Currency formatting ─────────────────────────────────────────────────────

export interface CurrencyConfig {
  code: string
  symbol: string
  locale: string
  decimals: number
}

export const CURRENCIES: Record<string, CurrencyConfig> = {
  CLP: { code: 'CLP', symbol: '$', locale: 'es-CL', decimals: 0 },
  USD: { code: 'USD', symbol: 'US$', locale: 'en-US', decimals: 2 },
  BRL: { code: 'BRL', symbol: 'R$', locale: 'pt-BR', decimals: 2 },
  MXN: { code: 'MXN', symbol: 'MX$', locale: 'es-MX', decimals: 2 },
  COP: { code: 'COP', symbol: 'COL$', locale: 'es-CO', decimals: 0 },
  PEN: { code: 'PEN', symbol: 'S/', locale: 'es-PE', decimals: 2 },
  ARS: { code: 'ARS', symbol: 'AR$', locale: 'es-AR', decimals: 0 },
}

export function formatCurrency(amount: number, currencyCode: string = 'CLP'): string {
  const config = CURRENCIES[currencyCode] || CURRENCIES.CLP
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.code,
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  }).format(amount)
}

export function formatCompactCurrency(amount: number, currencyCode: string = 'CLP'): string {
  const config = CURRENCIES[currencyCode] || CURRENCIES.CLP
  if (amount >= 1_000_000) return `${config.symbol}${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `${config.symbol}${Math.round(amount / 1_000)}K`
  return `${config.symbol}${amount}`
}

// ── Translation strings ─────────────────────────────────────────────────────

type TranslationKey = keyof typeof translations.es

const translations = {
  es: {
    // General
    'app.name': 'HiChapi',
    'app.tagline': 'Descubre dónde comer en Santiago',
    'common.loading': 'Cargando...',
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.add': 'Agregar',
    'common.search': 'Buscar',
    'common.back': 'Volver',
    'common.next': 'Siguiente',
    'common.confirm': 'Confirmar',
    'common.close': 'Cerrar',
    'common.retry': 'Reintentar',
    'common.error': 'Error',
    'common.success': 'Éxito',

    // Dashboard
    'dashboard.title': 'Resumen del día',
    'dashboard.sales_today': 'Ventas hoy',
    'dashboard.avg_ticket': 'Ticket promedio',
    'dashboard.active_orders': 'Pedidos activos',
    'dashboard.tables': 'Mesas',

    // Menu
    'menu.title': 'Carta digital',
    'menu.add_item': 'Agregar plato',
    'menu.empty': 'Tu carta está vacía',
    'menu.search': 'Buscar plato...',

    // Orders
    'orders.pending': 'Pendiente',
    'orders.preparing': 'Preparando',
    'orders.ready': 'Listo',
    'orders.paying': 'Pagando',
    'orders.paid': 'Pagado',

    // Support
    'support.title': 'Reportar problema',
    'support.submit': 'Enviar reporte',
    'support.severity.low': 'Bajo',
    'support.severity.medium': 'Medio',
    'support.severity.critical': 'Crítico',

    // NPS
    'nps.title_admin': '¿Qué tal HiChapi para tu negocio?',
    'nps.title_customer': '¿Qué tal tu experiencia con HiChapi?',
    'nps.submit': 'Enviar',
    'nps.thanks': '¡Gracias por tu feedback!',
  },

  en: {
    'app.name': 'HiChapi',
    'app.tagline': 'Discover where to eat in Santiago',
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.add': 'Add',
    'common.search': 'Search',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.confirm': 'Confirm',
    'common.close': 'Close',
    'common.retry': 'Retry',
    'common.error': 'Error',
    'common.success': 'Success',

    'dashboard.title': 'Daily Summary',
    'dashboard.sales_today': 'Sales today',
    'dashboard.avg_ticket': 'Average ticket',
    'dashboard.active_orders': 'Active orders',
    'dashboard.tables': 'Tables',

    'menu.title': 'Digital Menu',
    'menu.add_item': 'Add item',
    'menu.empty': 'Your menu is empty',
    'menu.search': 'Search item...',

    'orders.pending': 'Pending',
    'orders.preparing': 'Preparing',
    'orders.ready': 'Ready',
    'orders.paying': 'Paying',
    'orders.paid': 'Paid',

    'support.title': 'Report issue',
    'support.submit': 'Submit report',
    'support.severity.low': 'Low',
    'support.severity.medium': 'Medium',
    'support.severity.critical': 'Critical',

    'nps.title_admin': 'How is HiChapi for your business?',
    'nps.title_customer': 'How was your experience with HiChapi?',
    'nps.submit': 'Submit',
    'nps.thanks': 'Thanks for your feedback!',
  },

  pt: {
    'app.name': 'HiChapi',
    'app.tagline': 'Descubra onde comer em Santiago',
    'common.loading': 'Carregando...',
    'common.save': 'Salvar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Excluir',
    'common.edit': 'Editar',
    'common.add': 'Adicionar',
    'common.search': 'Pesquisar',
    'common.back': 'Voltar',
    'common.next': 'Próximo',
    'common.confirm': 'Confirmar',
    'common.close': 'Fechar',
    'common.retry': 'Tentar novamente',
    'common.error': 'Erro',
    'common.success': 'Sucesso',

    'dashboard.title': 'Resumo do dia',
    'dashboard.sales_today': 'Vendas hoje',
    'dashboard.avg_ticket': 'Ticket médio',
    'dashboard.active_orders': 'Pedidos ativos',
    'dashboard.tables': 'Mesas',

    'menu.title': 'Cardápio digital',
    'menu.add_item': 'Adicionar prato',
    'menu.empty': 'Seu cardápio está vazio',
    'menu.search': 'Pesquisar prato...',

    'orders.pending': 'Pendente',
    'orders.preparing': 'Preparando',
    'orders.ready': 'Pronto',
    'orders.paying': 'Pagando',
    'orders.paid': 'Pago',

    'support.title': 'Reportar problema',
    'support.submit': 'Enviar relatório',
    'support.severity.low': 'Baixo',
    'support.severity.medium': 'Médio',
    'support.severity.critical': 'Crítico',

    'nps.title_admin': 'Como está o HiChapi para o seu negócio?',
    'nps.title_customer': 'Como foi sua experiência com o HiChapi?',
    'nps.submit': 'Enviar',
    'nps.thanks': 'Obrigado pelo seu feedback!',
  },
} as const

export function t(key: TranslationKey, locale: Locale = 'es'): string {
  return translations[locale]?.[key] || translations.es[key] || key
}

export function getLocaleFromHeader(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE
  const preferred = acceptLanguage.split(',')[0]?.split('-')[0]?.toLowerCase()
  if (SUPPORTED_LOCALES.includes(preferred as Locale)) return preferred as Locale
  return DEFAULT_LOCALE
}
