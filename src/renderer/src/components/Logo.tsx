interface Props {
  size?: number
  className?: string
}

/**
 * Brand mark: a poker chip (notched ring) holding a spade with a rising
 * profit line and arrow. Hand-built SVG (transparent, scales crisply,
 * theme-aware) reinterpreting the provided logo for a dark UI.
 */
export function Logo({ size = 40, className }: Props): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role="img"
      aria-label="Proker"
    >
      {/* Chip outer notched ring */}
      <circle cx="24" cy="24" r="22" stroke="#3a3a40" strokeWidth="2.4" />
      <circle
        cx="24"
        cy="24"
        r="22"
        stroke="#e9e9ec"
        strokeWidth="2.4"
        strokeDasharray="3 14.3"
        strokeLinecap="butt"
        transform="rotate(11.25 24 24)"
      />
      {/* Inner disc + ring */}
      <circle cx="24" cy="24" r="16.5" fill="#0f0f10" stroke="#2c2c31" strokeWidth="1.4" />
      {/* Spade */}
      <path
        transform="translate(3.6 4.62) scale(1.7)"
        d="M12 3c2.5 3 7 5.5 7 9.2A3.8 3.8 0 0 1 13 15c.2 2 .8 3.4 2 4.8H9c1.2-1.4 1.8-2.8 2-4.8a3.8 3.8 0 0 1-6-2.8C5 8.5 9.5 6 12 3Z"
        fill="#3f3f46"
      />
      {/* Rising profit line + arrow */}
      <polyline
        points="14,31 20,24.5 26,27 33,18.5"
        stroke="#34d399"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M28.8 18.5 H33 V22.7" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="14" cy="31" r="1.7" fill="#34d399" />
      <circle cx="20" cy="24.5" r="1.7" fill="#34d399" />
      <circle cx="26" cy="27" r="1.7" fill="#34d399" />
    </svg>
  )
}
