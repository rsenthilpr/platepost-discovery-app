// PlatePost Logo Component
// pp-logo.png    = icon + "PlatePost" wordmark → place in /public/
// pp-mark.png    = icon only (no text)         → place in /public/

// Full logo — icon + wordmark (used in top nav)
export function PlatePostLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const heights = { sm: 20, md: 26, lg: 36 }
  return (
    <img
      src="/pp-logo.png"
      alt="PlatePost"
      height={heights[size]}
      style={{ objectFit: 'contain', display: 'block' }}
    />
  )
}

// Mark only — icon with no text (used in small/tight contexts)
export function PlatePostMark({ size = 20 }: { size?: number }) {
  return (
    <img
      src="/pp-mark.png"
      alt="PlatePost"
      width={size}
      height={size}
      style={{ objectFit: 'contain', display: 'block' }}
    />
  )
}

// Orb mark — icon inside the Crave orb (forced white)
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
