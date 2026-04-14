// src/components/PlatePostLogo.tsx
// pp-logo.png  = full logo (icon + "PlatePost" text) — dark colored, works on light bg
// pp-mark.png  = icon only — dark colored, works on light bg

export function PlatePostLogo({ size = 'md', white = false }: {
  size?: 'sm' | 'md' | 'lg'
  white?: boolean
}) {
  // More aggressive responsive sizing — clearly readable on all devices
  const styles: Record<string, React.CSSProperties> = {
    sm: { height: 'clamp(18px, 5vw, 22px)', maxHeight: 22 },
    md: { height: 'clamp(24px, 6.5vw, 32px)', maxHeight: 32 },
    lg: { height: 'clamp(32px, 8vw, 44px)', maxHeight: 44 },
  }
  return (
    <img
      src="/pp-logo.png"
      alt="PlatePost"
      style={{
        ...styles[size],
        width: 'auto',
        maxWidth: '160px',
        objectFit: 'contain',
        objectPosition: 'left center',
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
