import { defaultSchema } from 'rehype-sanitize';

/**
 * Shared sanitize schema for article Markdown.
 *
 * `rehype-raw` re-parses raw HTML inside the Markdown — the app depends on it for
 * the `<details>` original-text block (markdownUtils) and the `<abbr>` glossary
 * annotations (glossaryAnnotator). It also lets through whatever the AI, an
 * imported page or a GitHub article happens to contain, including `<script>`.
 * That is not merely cosmetic: the rendered HTML is re-injected into a same-origin
 * print iframe with `document.write` (pdfBooklet.printBookletHtml), where a script
 * would execute with access to every API key and token kept in localStorage.
 *
 * So: keep raw HTML, but only the tags we actually use. Everything else is dropped.
 * The base is GitHub's schema, which already covers tables, `<details>/<summary>`,
 * `<br>`, `<img>` (http/https only) and restricts `href` to safe protocols.
 */
const EXTRA_TAG_NAMES = [
  'abbr', // glossary annotations: <abbr title="...">
  'u',
  'mark',
  'small',
  'figure',
  'figcaption',
  'caption',
  'cite',
  'dfn',
  'time',
  'bdo',
  'wbr',
];

export const markdownSanitizeSchema = {
  ...defaultSchema,
  tagNames: [...new Set([...(defaultSchema.tagNames ?? []), ...EXTRA_TAG_NAMES])],
};
