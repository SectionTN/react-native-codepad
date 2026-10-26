import type { PropSidebarItem } from '@docusaurus/plugin-content-docs';

export type SidebarLink = { label: string; href: string };
export type SidebarGroup = { label: string; links: SidebarLink[] };

function linksOf(items: readonly PropSidebarItem[]): SidebarLink[] {
  return items.flatMap((item) => {
    if (item.type === 'link') return [{ label: item.label, href: item.href }];
    if (item.type === 'category') return linksOf(item.items);
    return [];
  });
}

// The sidebar as one level of categories; nested categories fold into their parent.
export function groupsOf(items: readonly PropSidebarItem[]): SidebarGroup[] {
  const groups: SidebarGroup[] = [];
  const loose: SidebarLink[] = [];
  for (const item of items) {
    if (item.type === 'category') groups.push({ label: item.label, links: linksOf(item.items) });
    else loose.push(...linksOf([item]));
  }
  return loose.length ? [{ label: 'Docs', links: loose }, ...groups] : groups;
}

export const samePath = (a: string, b: string) => a.replace(/\/$/, '') === b.replace(/\/$/, '');
