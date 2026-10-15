import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';

const config: Config = {
  title: 'react-native-codepad',
  tagline:
    'A native code editor for React Native with its own engine on each platform and tree-sitter highlighting.',
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
  themeConfig: {
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
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
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
