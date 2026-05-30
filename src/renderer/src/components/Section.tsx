import type { ReactNode } from 'react'

interface Props {
  title: ReactNode
  aside?: ReactNode
  children: ReactNode
}

/** A titled section: heading row + content. No surface of its own, so the
 *  children (cards) form a single, non-nested layer. */
export function Section({ title, aside, children }: Props): JSX.Element {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3 px-0.5">
        <h2 className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-text">
          <span className="h-3.5 w-1 rounded-full bg-accent" />
          {title}
        </h2>
        {aside && <div className="text-xs text-muted">{aside}</div>}
      </div>
      {children}
    </section>
  )
}
