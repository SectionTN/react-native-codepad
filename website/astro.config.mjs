import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://sectiontn.github.io',
  base: '/react-native-codepad',
  integrations: [
    starlight({
      title: 'react-native-codepad',
      description: 'A native code editor component for React Native with tree-sitter highlighting.',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/SectionTN/react-native-codepad',
        },
      ],
      editLink: { baseUrl: 'https://github.com/SectionTN/react-native-codepad/edit/main/website/' },
      lastUpdated: true,
      sidebar: [
        { label: 'Start', items: [{ autogenerate: { directory: 'start' } }] },
        { label: 'Guides', items: [{ autogenerate: { directory: 'guides' } }] },
        { label: 'Reference', items: [{ autogenerate: { directory: 'reference' } }] },
        { label: 'Internals', items: [{ autogenerate: { directory: 'internals' } }] },
      ],
    }),
  ],
});
