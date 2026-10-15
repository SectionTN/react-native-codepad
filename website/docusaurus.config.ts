import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';
import { githubDark } from '../src/themes/githubDark';
import { githubLight } from '../src/themes/githubLight';
import { prismThemeFrom } from './src/prism/fromEditorTheme';

const config: Config = {
  title: 'react-native-codepad',
  tagline:
    'A native code editor for React Native: Kotlin and Swift engines, tree-sitter highlighting, a Nitro binding and no WebView.',
  favicon: 'img/favicon.svg',
  url: 'https://sectiontn.github.io',
  baseUrl: '/react-native-codepad/',
  trailingSlash: true,
  organizationName: 'SectionTN',
  projectName: 'react-native-codepad',
  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  presets: [
    [
      'classic',
      {
        docs: {
          path: 'docs',
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/SectionTN/react-native-codepad/edit/main/website/',
          showLastUpdateTime: true,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],
  plugins: [
    [
      'docusaurus-plugin-llms',
      {
        generateLLMsFullTxt: true,
        docsDir: 'docs',
        title: 'react-native-codepad',
        description:
          'A native code editor for React Native: Kotlin and Swift engines, tree-sitter highlighting, a Nitro binding and no WebView.',
      },
    ],
  ],
  themes: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        indexBlog: false,
        docsRouteBasePath: '/',
        highlightSearchTermsOnTargetPage: false,
      },
    ],
  ],
  themeConfig: {
    image: 'img/og.png',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    prism: {
      theme: prismThemeFrom(githubLight),
      darkTheme: prismThemeFrom(githubDark),
      additionalLanguages: ['bash', 'json', 'kotlin', 'swift', 'groovy', 'ruby', 'diff'],
      magicComments: [
        {
          className: 'theme-code-block-highlighted-line',
          line: 'highlight-next-line',
          block: { start: 'highlight-start', end: 'highlight-end' },
        },
        {
          className: 'code-block-diff-add',
          line: 'diff-add',
          block: { start: 'diff-add-start', end: 'diff-add-end' },
        },
        {
          className: 'code-block-diff-remove',
          line: 'diff-remove',
          block: { start: 'diff-remove-start', end: 'diff-remove-end' },
        },
      ],
    },
    navbar: {
      title: 'react-native-codepad',
      logo: {
        alt: 'react-native-codepad',
        src: 'img/logo.svg',
      },
      items: [
        { type: 'docSidebar', sidebarId: 'docs', label: 'Docs', position: 'left' },
        { type: 'doc', docId: 'guides/themes', label: 'Guides', position: 'left' },
        { type: 'doc', docId: 'reference/props', label: 'Reference', position: 'left' },
        {
          href: 'https://github.com/SectionTN/react-native-codepad',
          position: 'right',
          className: 'header-github-link',
          'aria-label': 'GitHub repository',
        },
      ],
    },
    footer: {
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Getting started', to: '/start/introduction/' },
            { label: 'Guides', to: '/guides/languages/' },
            { label: 'Reference', to: '/reference/props/' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'GitHub', href: 'https://github.com/SectionTN/react-native-codepad' },
            { label: 'Issues', href: 'https://github.com/SectionTN/react-native-codepad/issues' },
            { label: 'Contributing', to: '/internals/contributing/' },
          ],
        },
        {
          title: 'More',
          items: [
            { label: 'Roadmap', to: '/internals/roadmap/' },
            {
              label: 'Releases',
              href: 'https://github.com/SectionTN/react-native-codepad/releases',
            },
          ],
        },
      ],
      copyright: 'Made by <a href="https://github.com/SectionTN">SectionTN</a>',
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
