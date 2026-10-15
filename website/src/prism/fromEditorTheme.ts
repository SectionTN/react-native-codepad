import type { PrismTheme } from 'prism-react-renderer';
import type { Theme, TokenStyle } from '../../../src/types';

// Editor capture names and the Prism token types they color.
export const PRISM_CAPTURES: Record<string, string[]> = {
  comment: ['comment', 'prolog', 'doctype', 'cdata'],
  keyword: ['keyword', 'atrule', 'important'],
  string: ['string', 'char', 'template-string', 'attr-value', 'inserted'],
  'string.special': ['regex', 'url'],
  number: ['number'],
  boolean: ['boolean'],
  constant: ['constant', 'symbol'],
  function: ['function'],
  type: ['class-name', 'builtin'],
  'variable.member': ['property'],
  attribute: ['attr-name'],
  operator: ['operator'],
  punctuation: ['punctuation'],
  tag: ['tag', 'selector'],
  module: ['namespace'],
  variable: ['variable'],
};

function entry(token: TokenStyle): PrismTheme['styles'][number]['style'] {
  if (typeof token === 'string') return { color: token };
  return {
    color: token.color,
    ...(token.italic ? { fontStyle: 'italic' as const } : {}),
    ...(token.bold ? { fontWeight: 'bold' as const } : {}),
  };
}

export function prismThemeFrom(theme: Theme): PrismTheme {
  const styles: PrismTheme['styles'] = [];
  for (const [capture, types] of Object.entries(PRISM_CAPTURES)) {
    const token = theme.tokens[capture];
    if (token) styles.push({ types, style: entry(token) });
  }
  return { plain: { color: theme.foreground, backgroundColor: theme.background }, styles };
}
