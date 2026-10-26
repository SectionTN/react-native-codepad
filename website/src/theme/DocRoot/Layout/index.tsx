import { useDocsSidebar } from '@docusaurus/plugin-content-docs/client';
import { useLocation } from '@docusaurus/router';
import type { Props } from '@theme/DocRoot/Layout';
import DocSidebar from '@theme/DocSidebar';
import styles from './styles.module.css';

// Sidebar, page and table of contents in one centered row; DocItem/Layout supplies the last two.
export default function DocRootLayout({ children }: Props) {
  const sidebar = useDocsSidebar();
  const { pathname } = useLocation();
  return (
    <div className={styles.root}>
      {sidebar && (
        <aside className={styles.aside}>
          <DocSidebar
            sidebar={sidebar.items}
            path={pathname}
            onCollapse={() => {}}
            isHidden={false}
          />
        </aside>
      )}
      {children}
    </div>
  );
}
