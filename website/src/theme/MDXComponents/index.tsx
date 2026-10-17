import MDXComponents from '@theme-original/MDXComponents';
import type { ComponentProps } from 'react';

// A table scrolls inside a focusable container on narrow screens instead of widening the page.
function Table(props: ComponentProps<'table'>) {
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard (axe scrollable-region-focusable)
    <div className="table-scroll" tabIndex={0}>
      <table {...props} />
    </div>
  );
}

export default { ...MDXComponents, table: Table };
