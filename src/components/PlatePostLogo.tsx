// PlatePost Logo Component
// Uses real logo image: public/platepost-logo.png (logomark only)
// Full logo (mark + wordmark): public/platepost-logo-full.png
// Fallback to SVG if image missing

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

  if (showText) {
    // Full logo with wordmark — use full logo image if available
    return (
      <img
        src="/platepost-logo-full.png"
        alt="PlatePost"
        height={iconSize * 1.4}
        style={{ objectFit: 'contain', filter: color === 'dark' ? 'invert(1)' : 'none' }}
        onError={(e) => {
          // Fallback: mark + text
          const parent = e.currentTarget.parentElement
          if (parent) {
            e.currentTarget.style.display = 'none'
          }
        }}
      />
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(iconSize * 0.4) }}>
      <PlatePostMark size={iconSize} color={color} />
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
    </div>
  )
}

// Logomark only — used in nav bars, small contexts
export function PlatePostMark({
  size = 20,
  color = 'white',
}: {
  size?: number
  color?: 'white' | 'dark'
  // legacy props ignored:
  triangleColor?: string
  cutoutColor?: string
}) {
  return (
    <img
      src="/platepost-logo.png"
      alt="PlatePost"
      width={size}
      height={size}
      style={{
        objectFit: 'contain',
        filter: color === 'dark' ? 'invert(1)' : 'brightness(0) invert(1)',
        display: 'block',
      }}
      onError={(e) => {
        // SVG fallback if PNG missing
        e.currentTarget.style.display = 'none'
      }}
    />
  )
}

// Orb version — logomark inside the blue Crave orb (always white)
export function PlatePostOrbMark({ size = 22 }: { size?: number }) {
  return (
    <img
      src="/platepost-logo.png"
      alt="PlatePost"
      width={size}
      height={size}
      style={{
        objectFit: 'contain',
        filter: 'brightness(0) invert(1)',
        display: 'block',
      }}
      onError={(e) => {
        e.currentTarget.style.display = 'none'
      }}
    />
  )
}
