// PlatePost Logo Component
// The mark: play triangle pointing right, with spoon shape cut out
// Spoon: round bowl near top-center, thin handle angling down toward bottom-left

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
      <PlatePostMark size={iconSize} triangleColor={textColor} cutoutColor={color === 'white' ? '#071126' : '#ffffff'} />
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

// The spoon-cut play triangle mark
// triangleColor: the fill of the triangle (white on dark bg, dark on light bg)
// cutoutColor: the spoon cutout color (opposite of triangle, to create negative space)
export function PlatePostMark({
  size = 20,
  triangleColor = '#fff',
  cutoutColor = '#071126',
}: {
  size?: number
  triangleColor?: string
  cutoutColor?: string
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Play triangle — slightly rounded feel, pointing right */}
      <path d="M15 8 L90 50 L15 92 Z" fill={triangleColor} />
      {/* Spoon cutout — bowl (ellipse) near top center of triangle, handle angling down-left */}
      {/* Bowl of spoon */}
      <ellipse cx="52" cy="36" rx="10" ry="12" fill={cutoutColor} />
      {/* Handle — thin rect angled down toward bottom-left */}
      <rect
        x="44" y="46"
        width="7" height="22"
        rx="3.5"
        fill={cutoutColor}
        transform="rotate(15 47 57)"
      />
    </svg>
  )
}

// Orb version — for the floating Crave button (triangle on colored background)
export function PlatePostOrbMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <path d="M15 8 L90 50 L15 92 Z" fill="white" />
      <ellipse cx="52" cy="36" rx="10" ry="12" fill="#4576EF" />
      <rect x="44" y="46" width="7" height="22" rx="3.5" fill="#4576EF"
        transform="rotate(15 47 57)" />
    </svg>
  )
}
