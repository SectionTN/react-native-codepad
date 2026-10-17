import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import type { Props } from '@theme/NotFound/Content';
import clsx from 'clsx';

// The 404 page in the site's own words; the theme's copy asked the reader to contact the site owner.
export default function NotFoundContent({ className }: Props) {
  return (
    <main className={clsx('container margin-vert--xl not-found', className)}>
      <div className="row">
        <div className="col col--6 col--offset-3">
          <Heading as="h1" className="hero__title">
            Page not found
          </Heading>
          <p>
            There is no page at this address. Start from the{' '}
            <Link to="/start/installation/">installation</Link> or search the site.
          </p>
        </div>
      </div>
    </main>
  );
}
