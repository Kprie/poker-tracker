import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Section label shown with an accent marker. */
  title?: ReactNode
  /** Small note rendered to the right of the title. */
  aside?: ReactNode
  /** Extra classes on the inner glass core. */
  bodyClassName?: string
  className?: string
}

/**
 * Double-bezel container: a machined outer shell wrapping a glass core.
 * Optional header row with an accent marker title.
 */
export function Panel({ children, title, aside, bodyClassName, className }: Props): JSX.Element {
  return (
    <div className={`bezel ${className ?? ''}`}>
      <div className={`glass ${bodyClassName ?? 'p-5'}`}>
        {(title || aside) && (
          <div className="mb-4 flex items-center justify-between gap-3">
            {title && (
              <h2 className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-text">
                <span className="h-3.5 w-1 rounded-full bg-accent" />
                {title}
              </h2>
            )}
            {aside && <div className="text-xs text-muted">{aside}</div>}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
