// Ultra-light line icons (stroke 1.25), hand-rolled to avoid generic icon sets.
import type { SVGProps } from 'react'

const base = (p: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> => ({
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.25,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  ...p
})

export function ArrowUpRight(p: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg {...base(p)}>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  )
}

export function Upload(p: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg {...base(p)}>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 19h14" />
    </svg>
  )
}

export function Scan(p: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg {...base(p)}>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8" />
      <path d="M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8" />
      <path d="M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16" />
      <path d="M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <path d="M7 12h10" />
    </svg>
  )
}

export function Folder(p: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg {...base(p)}>
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.2h7A1.5 1.5 0 0 1 19 9.7v7.8A1.5 1.5 0 0 1 17.5 19h-13A1.5 1.5 0 0 1 3 17.5z" />
    </svg>
  )
}

export function Settings(p: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M3 12h2.5M18.5 12H21M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </svg>
  )
}

export function Spade(p: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg {...base(p)}>
      <path d="M12 3c2.5 3 7 5.5 7 9.2A3.8 3.8 0 0 1 13 15c.2 2 .8 3.4 2 4.8H9c1.2-1.4 1.8-2.8 2-4.8a3.8 3.8 0 0 1-6-2.8C5 8.5 9.5 6 12 3Z" />
    </svg>
  )
}

export function ChevronDown(p: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg {...base(p)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function Close(p: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg {...base(p)}>
      <path d="M6 6 18 18M18 6 6 18" />
    </svg>
  )
}
