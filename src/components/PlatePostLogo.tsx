// PlatePost Logo Component
// pp-logo.png  = full logo (icon + "PlatePost" text) — dark colored, works on light bg
// pp-mark.png  = icon only — dark colored, works on light bg
//
// For DARK backgrounds: add filter to force white
// For LIGHT backgrounds: use as-is

export function PlatePostLogo({ size = 'md', white = false }: {
  size?: 'sm' | 'md' | 'lg'
  white?: boolean
}) {
  // Responsive: scales with screen width, clamped between min and max
  const heights = {
    sm: 'clamp(16px, 4vw, 20px)',
    md: 'clamp(20px, 5vw, 26px)',
    lg: 'clamp(26px, 7vw, 36px)',
  }
  return (
    <img
      src="/pp-logo.png"
      alt="PlatePost"
      style={{
        height: heights[size],
        width: 'auto',
        objectFit: 'contain',
        display: 'block',
        filter: white ? 'brightness(0) invert(1)' : 'none',
      }}
    />
  )
}

export function PlatePostMark({ size = 20, white = false }: {
  size?: number
  white?: boolean
}) {
  return (
    <img
      src="/pp-mark.png"
      alt="PlatePost"
      width={size}
      height={size}
      style={{
        objectFit: 'contain',
        display: 'block',
        filter: white ? 'brightness(0) invert(1)' : 'none',
      }}
    />
  )
}

// Orb mark — always white (inside blue orb)
export function PlatePostOrbMark({ size = 22 }: { size?: number }) {
  return (
    <img
      src="/pp-mark.png"
      alt="PlatePost"
      width={size}
      height={size}
      style={{ objectFit: 'contain', display: 'block', filter: 'brightness(0) invert(1)' }}
    />
  )
}
