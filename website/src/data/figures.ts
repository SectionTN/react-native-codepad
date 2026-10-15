export type Figure = {
  value: string;
  label: string;
  where: string;
};

// Numbers from docs/superpowers/HANDOFF.md; re-measured before each release.
export const FIGURES: Figure[] = [
  {
    value: '3 ms',
    label: 'of work per keystroke on a 10,000 line file',
    where: 'iPhone 18 Pro simulator, Debug build',
  },
  {
    value: '7 ms',
    label: 'to reparse a 2,000 line Markdown file with 2,239 injections',
    where: 'Pixel 9a emulator, debugOptimized build',
  },
  {
    value: '131 ms',
    label: 'to the first paint of a 100,000 line file',
    where: 'Pixel 9a emulator, debugOptimized build',
  },
];
