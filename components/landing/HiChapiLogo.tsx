/**
 * HiChapi logo — llama (#FF6B35) con cola/notch y 3 tines de tenedor
 * (#1A1A2E). ViewBox 120x140. Component es server-safe (sin client hooks).
 */

interface HiChapiLogoProps {
  /** Tama\u00f1o renderizado en px. Default 32. */
  size?: number
  /** Override del color de la llama (default #FF6B35). */
  flameColor?: string
  /** Override del color del notch + tines (default #1A1A2E). */
  accentColor?: string
  className?: string
  title?: string
}

export default function HiChapiLogo({
  size = 32,
  flameColor = '#FF6B35',
  accentColor = '#1A1A2E',
  className,
  title = 'HiChapi',
}: HiChapiLogoProps) {
  return (
    <svg
      width={size}
      height={(size * 140) / 120}
      viewBox="0 0 120 140"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={title}
      role="img"
      className={className}
    >
      {/* Llama body */}
      <path
        d="M60 10 C 82 34, 102 52, 102 84 C 102 112, 82 130, 60 130 C 38 130, 18 112, 18 84 C 18 66, 28 54, 38 42 C 46 32, 54 22, 60 10 Z"
        fill={flameColor}
      />
      {/* Cola / notch oscuro */}
      <path
        d="M60 10 C 66 20, 72 30, 78 38 L 70 44 L 74 54 C 68 46, 62 36, 60 28 Z"
        fill={accentColor}
      />
      {/* Tines (3 dientes del tenedor) */}
      <rect x="42" y="70" width="6" height="36" rx="3" fill={accentColor} />
      <rect x="57" y="70" width="6" height="36" rx="3" fill={accentColor} />
      <rect x="72" y="70" width="6" height="36" rx="3" fill={accentColor} />
    </svg>
  )
}
