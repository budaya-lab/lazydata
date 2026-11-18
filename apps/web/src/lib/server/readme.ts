import { createHash } from 'node:crypto';
import MarkdownIt, { type Token } from 'markdown-it';
import { readmeTags, type ReadmeNode } from '../readme.ts';
import { DatasetNotFoundError, DatasetTextError, readDatasetText } from './dataset-text.ts';
import { templateReadmes } from './template-readmes.ts';

const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false, maxNesting: 20 });

function safeLink(value: string | number | null): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch (cause) {
    if (!(cause instanceof TypeError)) throw cause;
    return false;
  }
}

function readmeNodes(tokens: Token[]): ReadmeNode[] {
  const root: ReadmeNode[] = [];
  const stack = [root];
  for (const token of tokens) {
    const children = stack[stack.length - 1];
    if (token.type === 'inline') {
      if (token.children) {
        for (const node of readmeNodes(token.children)) children.push(node);
      }
    } else if (['text', 'html_inline', 'html_block', 'image'].includes(token.type)) {
      children.push({ tag: 'text', text: token.content });
    } else if (token.type === 'softbreak') {
      children.push({ tag: 'text', text: '\n' });
    } else if (['fence', 'code_block', 'code_inline'].includes(token.type)) {
      const code: ReadmeNode = { tag: 'code', children: [{ tag: 'text', text: token.content }] };
      children.push(token.type === 'code_inline' ? code : { tag: 'pre', children: [code] });
    } else if (token.nesting === -1) {
      if (stack.length === 1) throw new Error('Unpaired README closing token.');
      stack.pop();
    } else {
      let tag = token.tag;
      if (token.type === 'heading_open') tag = `h${Math.min(Number(tag.slice(1)) + 1, 6)}`;
      const href = token.type === 'link_open' ? token.attrGet('href') : null;
      if (token.type === 'link_open' && !safeLink(href)) tag = 'span';
      const allowed = readmeTags.find((value) => value === tag);
      if (!allowed) throw new Error('Unsupported README element.');
      const node: ReadmeNode = { tag: allowed, children: [] };
      if (allowed === 'a' && safeLink(href)) node.href = href;
      if (allowed === 'ol' && token.attrGet('start') !== null) {
        const start = Number(token.attrGet('start'));
        if (!Number.isSafeInteger(start) || start < 0) throw new Error('Invalid README list start.');
        node.start = start;
      }
      children.push(node);
      if (token.nesting === 1) stack.push(node.children);
    }
  }
  if (stack.length !== 1) throw new Error('Unclosed README token.');
  return root;
}

export function renderReadme(text: string): { nodes: ReadmeNode[]; template: boolean; empty: boolean } {
  const digest = createHash('sha256').update(text, 'utf8').digest('hex');
  return {
    nodes: readmeNodes(markdown.parse(text, {})),
    template: templateReadmes.some(({ sha256 }) => sha256 === digest),
    empty: !text.trim(),
  };
}

type ReadmeResult =
  | ({ status: 'available' } & ReturnType<typeof renderReadme>)
  | { status: 'unavailable'; message: string };

export async function readReadme(root: string | undefined, name: string): Promise<ReadmeResult> {
  let text: string;
  try {
    text = await readDatasetText(root, name, 'README.md');
  } catch (cause) {
    if (cause instanceof DatasetNotFoundError || !(cause instanceof DatasetTextError)) throw cause;
    console.error(cause);
    return { status: 'unavailable', message: cause.message };
  }
  return { status: 'available', ...renderReadme(text) };
}
