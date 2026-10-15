import useBaseUrl from '@docusaurus/useBaseUrl';
import clsx from 'clsx';
import styles from './PhoneFrame.module.css';

type Props = {
  platform: 'ios' | 'android';
  src?: string;
  alt?: string;
  className?: string;
};

// Without a source the frame shows a blank editor-colored screen.
export function PhoneFrame({ platform, src, alt = '', className }: Props) {
  const url = useBaseUrl(src ?? '');
  return (
    <div className={clsx(styles.frame, styles[platform], className)}>
      {src ? (
        <img className={styles.screen} src={url} alt={alt} loading="eager" />
      ) : (
        <div className={styles.screen} aria-hidden="true" />
      )}
    </div>
  );
}
