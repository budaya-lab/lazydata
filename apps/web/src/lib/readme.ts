export const readmeTags = ['p', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
  'blockquote', 'strong', 'em', 's', 'code', 'pre', 'a', 'span', 'table', 'thead',
  'tbody', 'tr', 'th', 'td', 'hr', 'br'] as const;

export type ReadmeTag = (typeof readmeTags)[number];

export type ReadmeNode =
  | { tag: 'text'; text: string }
  | { tag: ReadmeTag; children: ReadmeNode[]; href?: string; start?: number };
