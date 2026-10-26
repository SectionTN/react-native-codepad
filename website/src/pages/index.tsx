import Head from '@docusaurus/Head';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import clsx from 'clsx';
import { useRef } from 'react';
import { AgentsTerminal } from '../components/home/AgentsTerminal';
import { EditingCards } from '../components/home/EditingCards';
import { SITE_THEME_CSS } from '../components/home/editorThemes';
import { FinalCta } from '../components/home/FinalCta';
import { FrameBudget } from '../components/home/FrameBudget';
import { Hero } from '../components/home/Hero';
import { useReveal } from '../components/home/hooks';
import { KeyboardFollow } from '../components/home/KeyboardFollow';
import { Marquee } from '../components/home/Marquee';
import { PlatformPhones } from '../components/home/PlatformPhones';
import { Playground } from '../components/home/Playground';
import { Roadmap } from '../components/home/Roadmap';
import { REPO } from '../data/site';
import styles from './index.module.css';

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  const root = useRef<HTMLElement>(null);
  useReveal(root);
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: siteConfig.title,
    description: siteConfig.tagline,
    url: `${siteConfig.url}/`,
    codeRepository: REPO,
    programmingLanguage: ['TypeScript', 'Kotlin', 'Swift'],
    runtimePlatform: ['React Native', 'Android', 'iOS'],
    license: 'https://opensource.org/licenses/MIT',
    author: { '@type': 'Person', name: 'Rayen Sbai', url: 'https://github.com/SectionTN' },
  };
  return (
    <Layout title="Native code editor for React Native" description={siteConfig.tagline}>
      <Head>
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Head>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: generated from the bundled editor themes */}
      <style dangerouslySetInnerHTML={{ __html: SITE_THEME_CSS }} />
      <main ref={root} className={clsx('cp-redesign', styles.page)}>
        <Hero />
        <Marquee />
        <FrameBudget />
        <Playground />
        <EditingCards />
        <KeyboardFollow />
        <PlatformPhones />
        <AgentsTerminal />
        <Roadmap />
        <FinalCta />
      </main>
    </Layout>
  );
}
