// PlatePost Logo Component — spoon-cut play triangle mark
// Matches the actual PlatePost brand icon exactly

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  color?: 'white' | 'dark'
  showText?: boolean
}

export function PlatePostLogo({ size = 'md', color = 'white', showText = true }: LogoProps) {
  const sizes = { sm: 16, md: 20, lg: 28 }
  const fontSizes = { sm: 13, md: 16, lg: 22 }
  const iconSize = sizes[size]
  const fontSize = fontSizes[size]
  const textColor = color === 'white' ? '#FFFFFF' : '#071126'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(iconSize * 0.4) }}>
      <PlatePostMark size={iconSize} color={textColor} />
      {showText && (
        <span style={{
          fontFamily: 'Manrope, sans-serif',
          fontWeight: 700,
          fontSize,
          color: textColor,
          letterSpacing: '-0.01em',
          lineHeight: 1,
        }}>
          PlatePost
        </span>
      )}
    </div>
  )
}

// The distinctive spoon-cut play triangle — use this as standalone mark
export function PlatePostMark({ size = 20, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Outer play triangle */}
      <path d="M5 3.5L20 12L5 20.5V3.5Z" fill={color} />
      {/* Spoon cutout — creates the distinctive PlatePost mark */}
      <ellipse cx="11" cy="9.5" rx="2.2" ry="2.8" fill="currentColor"
        style={{ color: color === '#fff' ? '#071126' : color === '#FFFFFF' ? '#071126' : '#fff' }} />
      <rect x="10.1" y="12" width="1.8" height="3.5" rx="0.9"
        fill="currentColor"
        style={{ color: color === '#fff' ? '#071126' : color === '#FFFFFF' ? '#071126' : '#fff' }} />
    </svg>
  )
}
