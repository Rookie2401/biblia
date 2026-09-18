import type { ReactNode } from 'react';

/**
 * Height-animated disclosure (from the Classical Library). Content stays mounted so it can
 * animate both ways; `grid-template-rows: 0fr <-> 1fr` animates to and from auto height and
 * composes when nested. `inert` keeps a collapsed panel out of tab and assistive-technology
 * reach. Under prefers-reduced-motion the lift is removed and only the fade and height play.
 */
export function Collapsible({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className="collapsible" data-open={open ? 'true' : 'false'}>
      <div className="collapsible__inner" inert={!open}>
        {children}
      </div>
    </div>
  );
}
