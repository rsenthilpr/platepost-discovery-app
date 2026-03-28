// PlatePost Logo Component — use this everywhere for consistent branding
// Usage: <PlatePostLogo size="sm" | "md" | "lg" color="white" | "dark" />

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  color?: 'white' | 'dark'
  showText?: boolean
}

export function PlatePostLogo({ size = 'md', color = 'white', showText = true }: LogoProps) {
  const sizes = { sm: 16, md: 20, lg: 28 }
  const fontSizes = { sm: 13, md: 17, lg: 24 }
  const iconSize = sizes[size]
  const fontSize = fontSizes[size]

  const textColor = color === 'white' ? '#FFFFFF' : '#071126'
  const triangleColor = color === 'white' ? '#4ECFFF' : '#4576EF' // blue triangle like in logo

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: iconSize * 0.35 }}>
      {/* Play triangle — matches PlatePost brand */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        style={{ flexShrink: 0 }}
      >
        {/* Outer triangle — slightly rounded, matches logo style */}
        <path
          d="M5 3.5L20 12L5 20.5V3.5Z"
          fill={triangleColor}
          style={{ filter: `drop-shadow(0 0 ${iconSize * 0.15}px ${triangleColor}88)` }}
        />
      </svg>
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

// For the floating orb button — just the triangle, no text
export function PlatePostMark({ size = 22, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 3.5L20 12L5 20.5V3.5Z" fill={color} />
    </svg>
  )
}
