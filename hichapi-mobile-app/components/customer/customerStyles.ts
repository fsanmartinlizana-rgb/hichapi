import { StyleSheet } from 'react-native'
import { COLORS } from '../../utils/theme'

export const customerStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bgApp,
  },
  scroll: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.borderMedium,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.bgCard,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: {
    color: COLORS.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  btnOutline: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
  },
  btnOutlineText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  pointsBadge: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  pointsValue: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.primary,
  },
  error: {
    color: COLORS.error,
    fontSize: 13,
    marginBottom: 8,
  },
})

export function formatClp(n: number): string {
  return `$${n.toLocaleString('es-CL')}`
}
