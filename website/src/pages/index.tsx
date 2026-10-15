import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

// Placeholder until the landing page lands; keeps the root route resolvable.
export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <main className="container margin-vert--xl">
        <h1>{siteConfig.title}</h1>
        <p>{siteConfig.tagline}</p>
        <Link className="button button--primary" to="/start/installation/">
          Get started
        </Link>
      </main>
    </Layout>
  );
}
