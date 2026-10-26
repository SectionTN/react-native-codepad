import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { LoadedContent } from '@docusaurus/plugin-content-docs';
import type { LoadContext, Plugin } from '@docusaurus/types';

export type IndexPage = { title: string; path: string; category: string };
export type IndexProp = {
  name: string;
  type: string;
  section: string;
  sectionId: string;
  text: string;
};
export type SiteIndex = { pages: IndexPage[]; props: IndexProp[]; propsPath: string };

const PROPS_DOC = 'reference/props';
const PROP_HEADER = '| Prop | Type | Default | Notes |';

const plain = (md: string) =>
  md.replace(/`([^`]+)`/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/ /g, '-');

// The rows of every Prop | Type | Default | Notes table in props.md, under their h2.
function propsOf(file: string): IndexProp[] {
  const props: IndexProp[] = [];
  let section = '';
  let inTable = false;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const heading = /^## (.+)$/.exec(line);
    if (heading) {
      section = heading[1];
      inTable = false;
    } else if (line.trim() === PROP_HEADER) {
      inTable = true;
    } else if (inTable && line.startsWith('| `')) {
      const [name, type, , notes] = line
        .slice(1, -1)
        .split(' | ')
        .map((cell) => cell.trim());
      props.push({
        name: plain(name),
        type: plain(type),
        section,
        sectionId: slug(section),
        text: plain(notes),
      });
    } else if (!line.startsWith('|')) {
      inTable = false;
    }
  }
  return props;
}

// Pages and props for the search palette and the props filter, as global data.
export default function siteIndex(context: LoadContext): Plugin {
  return {
    name: 'codepad-site-index',
    async allContentLoaded({ allContent, actions }) {
      const docs = allContent['docusaurus-plugin-content-docs']?.default as LoadedContent;
      const version = docs.loadedVersions[0];
      const byId = new Map(version.docs.map((doc) => [doc.id, doc]));
      const pages: IndexPage[] = [];
      for (const item of version.sidebars.docs ?? []) {
        if (item.type !== 'category') continue;
        for (const child of item.items) {
          const doc = child.type === 'doc' ? byId.get(child.id) : undefined;
          if (doc) pages.push({ title: doc.title, path: doc.permalink, category: item.label });
        }
      }
      const propsDoc = byId.get(PROPS_DOC);
      const index: SiteIndex = {
        pages,
        props: propsDoc
          ? propsOf(path.join(context.siteDir, propsDoc.source.replace('@site/', '')))
          : [],
        propsPath: propsDoc?.permalink ?? '/',
      };
      actions.setGlobalData(index);
    },
  };
}
