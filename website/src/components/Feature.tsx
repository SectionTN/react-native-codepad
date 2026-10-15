import Link from '@docusaurus/Link';
import CodeBlock from '@theme/CodeBlock';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import styles from './Feature.module.css';

type Props = {
  title: string;
  href: string;
  code: string;
  flip?: boolean;
  children: ReactNode;
};

export function Feature({ title, href, code, flip, children }: Props) {
  return (
    <section className={clsx(styles.feature, flip && styles.flip)}>
      <div className={styles.copy}>
        <h2>{title}</h2>
        <p>{children}</p>
        <Link to={href}>Read the guide</Link>
      </div>
      <div className={styles.code}>
        <CodeBlock language="tsx">{code}</CodeBlock>
      </div>
    </section>
  );
}
