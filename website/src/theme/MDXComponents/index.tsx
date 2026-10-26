import Heading from '@theme/Heading';
import MDXComponents from '@theme-original/MDXComponents';
import clsx from 'clsx';
import {
  Children,
  type ComponentProps,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  matchesProp,
  PropFilterBar,
  sectionCount,
  usePropFilter,
} from '../../components/docs/propFilter';
import styles from './styles.module.css';

const PROP_HEADER = 'Prop|Type|Default|Notes';

type WithChildren = ReactElement<{ children?: ReactNode }>;

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf((node as WithChildren).props.children);
  return '';
}

const childrenOf = (node: ReactNode) =>
  isValidElement(node) ? Children.toArray((node as WithChildren).props.children) : [];

function partOf(table: ReactNode, tag: 'thead' | 'tbody') {
  return Children.toArray(table).find((child) => isValidElement(child) && child.type === tag);
}

type Row = { name: string; type: string; def: ReactNode; notes: ReactNode; text: string };

function PropRows({ rows }: { rows: Row[] }) {
  const filter = usePropFilter();
  const visible = rows.filter((row) => matchesProp(filter?.query ?? '', row));
  if (!visible.length) return null;
  return (
    <div className={styles.rows}>
      {visible.map((row) => (
        <div key={row.name} id={`prop-${row.name}`} className={styles.row}>
          <div className={styles.rowHead}>
            <a href={`#prop-${row.name}`} className={styles.name}>
              {row.name}
            </a>
            <span className={styles.type}>{row.type}</span>
            <span className={styles.spacer} />
            <span className={styles.default}>
              <span className={styles.defaultLabel}>default</span>
              <span>
                {textOf(row.def) === 'undefined' ? (
                  <span className={styles.undefined}>undefined</span>
                ) : (
                  row.def
                )}
              </span>
            </span>
          </div>
          <p className={styles.notes}>{row.notes}</p>
        </div>
      ))}
    </div>
  );
}

// A Prop | Type | Default | Notes table renders as prop rows; any other table scrolls in a focusable box.
function Table(props: ComponentProps<'table'>) {
  const head = childrenOf(childrenOf(partOf(props.children, 'thead'))[0]).map(textOf);
  if (head.join('|') === PROP_HEADER) {
    const rows = childrenOf(partOf(props.children, 'tbody')).map((tr) => {
      const [name, type, def, notes] = childrenOf(tr).map(
        (td) => (td as WithChildren).props.children,
      );
      return { name: textOf(name), type: textOf(type), def, notes, text: textOf(notes) };
    });
    return <PropRows rows={rows} />;
  }
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard (axe scrollable-region-focusable)
    <div className="table-scroll" tabIndex={0}>
      <table {...props} />
    </div>
  );
}

// On the props page each h2 carries its row count, and the first one brings the filter.
function H2(props: ComponentProps<'h2'>) {
  const filter = usePropFilter();
  if (!filter?.props.length || !props.id || !filter.props.some((p) => p.sectionId === props.id)) {
    return <Heading as="h2" {...props} />;
  }
  const { total, shown } = sectionCount(filter, props.id);
  return (
    <>
      {filter.props[0].sectionId === props.id && <PropFilterBar filter={filter} />}
      {shown > 0 && (
        <Heading as="h2" {...props} className={clsx(props.className, styles.propsH2)}>
          <span>{props.children}</span>
          <span className={styles.count}>{shown === total ? total : `${shown} of ${total}`}</span>
        </Heading>
      )}
    </>
  );
}

// Inline numbers and booleans take the number color, quoted strings the string color.
function Code(props: ComponentProps<'code'>) {
  const text = typeof props.children === 'string' ? props.children : '';
  const tone = /^(true|false|\d)/.test(text)
    ? 'cp-code-n'
    : /^'/.test(text)
      ? 'cp-code-s'
      : undefined;
  if (!tone || props.className || text.includes('\n')) return <MDXComponents.code {...props} />;
  return <MDXComponents.code {...props} className={tone} />;
}

export default { ...MDXComponents, table: Table, h2: H2, code: Code };
