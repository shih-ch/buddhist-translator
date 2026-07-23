import type { ArticleFrontmatter } from '@/types/article';

/** One article, already converted to HTML, ready to place in the booklet. */
export interface BookletArticle {
  frontmatter: ArticleFrontmatter;
  contentHtml: string;
  /** Rendered original-text HTML (only used when includeOriginal is on). */
  originalHtml?: string;
}

/**
 * User-tunable typography. Body-relative sizes (meta / table / original) derive
 * from fontSizePt; heading levels are set explicitly so each can be tuned.
 */
export interface BookletLayout {
  /** Body font size in points. */
  fontSizePt: number;
  /** Line-height multiplier. */
  lineHeight: number;
  /** Uniform page margin in millimetres. */
  marginMm: number;
  /** Article title (in each article header), points. */
  titleSizePt: number;
  /** Content heading level 1, points. */
  h1SizePt: number;
  /** Content heading level 2, points. */
  h2SizePt: number;
  /** Content heading level 3, points. */
  h3SizePt: number;
}

export const DEFAULT_LAYOUT: BookletLayout = {
  fontSizePt: 12,
  lineHeight: 1.7,
  marginMm: 12,
  titleSizePt: 19,
  h1SizePt: 16,
  h2SizePt: 14,
  h3SizePt: 12.5,
};

export interface BookletOptions {
  /** Append each article's source text after the translation. */
  includeOriginal: boolean;
  /** Prepend a table of contents (only meaningful for multiple articles). */
  includeToc: boolean;
  /** Booklet cover / document title. */
  title?: string;
  /** Typography; falls back to DEFAULT_LAYOUT when omitted. */
  layout?: BookletLayout;
}

const LANG_LABELS: Record<string, string> = {
  ru: '俄文',
  en: '英文',
  bo: '藏文',
  zh: '中文',
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Print stylesheet tuned for B5 Traditional-Chinese Buddhist texts:
 * serif body for readability, justified CJK, generous leading, and page-break
 * rules that keep headings/tables intact. Text stays vector (selectable, crisp).
 */
function bookletStyles(layout: BookletLayout): string {
  const fs = layout.fontSizePt;
  // Heading levels are set explicitly (independently tunable); secondary
  // body-relative sizes still derive from the body size.
  const h1 = layout.h1SizePt;
  const h2 = layout.h2SizePt;
  const h3 = layout.h3SizePt;
  const titleFs = layout.titleSizePt;
  const metaFs = Math.max(8, fs - 2.5);
  const tableFs = Math.max(8, fs - 1.5);
  const origFs = Math.max(8, fs - 1);
  return `
    @page {
      size: B5 portrait;
      margin: ${layout.marginMm}mm;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Noto Serif CJK TC", "Source Han Serif TC", "Songti TC",
                   "PMingLiU", "MingLiU", serif;
      font-size: ${fs}pt;
      line-height: ${layout.lineHeight};
      color: #1a1a1a;
      text-align: justify;
      text-justify: inter-ideograph;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    h1, h2, h3, h4 {
      font-family: "Noto Sans CJK TC", "PingFang TC", "Microsoft JhengHei",
                   sans-serif;
      line-height: 1.4;
      break-after: avoid;
      page-break-after: avoid;
      margin: 5mm 0 2.5mm;
    }
    h1 { font-size: ${h1}pt; }
    h2 { font-size: ${h2}pt; }
    h3 { font-size: ${h3}pt; }
    p { margin: 0 0 3mm; orphans: 2; widows: 2; }
    a { color: inherit; text-decoration: none; }

    /* Cover */
    .cover {
      break-after: page;
      page-break-after: always;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      text-align: center;
    }
    .cover h1 { font-size: 24pt; margin: 0 0 6mm; }
    .cover .subtitle { font-size: 11pt; color: #555; }

    /* Table of contents */
    .toc { break-after: page; page-break-after: always; }
    .toc h2 { font-size: 16pt; margin-bottom: 6mm; }
    .toc ol { padding-left: 8mm; }
    .toc li { margin-bottom: 2mm; line-height: 1.6; }
    .toc .toc-author { color: #777; font-size: 9pt; }

    /* Each article starts on a fresh page */
    .article { break-before: page; page-break-before: always; }
    .article:first-of-type { break-before: auto; page-break-before: auto; }

    .article-header {
      border-bottom: 1pt solid #999;
      margin-bottom: 7mm;
      padding-bottom: 3mm;
    }
    .article-title { font-size: ${titleFs}pt; margin: 0 0 2mm; line-height: 1.3; }
    .article-meta { font-size: ${metaFs}pt; color: #666; line-height: 1.6; }
    .article-meta span + span::before { content: " · "; }

    table {
      border-collapse: collapse;
      width: 100%;
      margin: 4mm 0;
      font-size: ${tableFs}pt;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    th, td { border: 0.5pt solid #999; padding: 1.8mm 2.5mm; text-align: left; vertical-align: top; }
    thead th { background: #f0f0f0; }

    blockquote {
      border-left: 2pt solid #ccc;
      margin: 3mm 0;
      padding: 0 0 0 4mm;
      color: #444;
    }
    ul, ol { padding-left: 7mm; margin: 0 0 3mm; }
    li { margin-bottom: 1mm; }
    hr { border: none; border-top: 0.5pt solid #ccc; margin: 5mm 0; }
    img { max-width: 100%; break-inside: avoid; }
    code {
      font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
      font-size: 9.5pt;
    }
    pre {
      background: #f6f6f6;
      padding: 3mm;
      border-radius: 2px;
      white-space: pre-wrap;
      word-break: break-word;
      break-inside: avoid;
    }

    /* Original-text appendix */
    .original {
      margin-top: 7mm;
      padding-top: 4mm;
      border-top: 1pt dashed #bbb;
      font-size: ${origFs}pt;
      color: #333;
    }
    .original-label { font-size: 9pt; color: #888; margin-bottom: 2mm; letter-spacing: 0.05em; }
  `;
}

function articleMeta(fm: ArticleFrontmatter): string {
  const parts: string[] = [];
  if (fm.author) parts.push(escapeHtml(fm.author));
  if (fm.date) parts.push(escapeHtml(fm.date));
  if (fm.original_language) parts.push(LANG_LABELS[fm.original_language] ?? escapeHtml(fm.original_language));
  if (fm.source) parts.push(escapeHtml(fm.source));
  return parts.map((p) => `<span>${p}</span>`).join('');
}

/** Assemble the full, self-contained HTML document for printing. */
export function buildBookletHtml(articles: BookletArticle[], opts: BookletOptions): string {
  const layout = opts.layout ?? DEFAULT_LAYOUT;
  const docTitle = opts.title || (articles.length === 1 ? articles[0].frontmatter.title : '翻譯文集');

  const cover =
    articles.length > 1
      ? `<section class="cover">
           <h1>${escapeHtml(docTitle)}</h1>
           <div class="subtitle">共 ${articles.length} 篇</div>
         </section>`
      : '';

  const toc =
    opts.includeToc && articles.length > 1
      ? `<section class="toc">
           <h2>目錄</h2>
           <ol>
             ${articles
               .map(
                 (a) =>
                   `<li>${escapeHtml(a.frontmatter.title || '未命名')}` +
                   (a.frontmatter.author ? ` <span class="toc-author">— ${escapeHtml(a.frontmatter.author)}</span>` : '') +
                   `</li>`
               )
               .join('\n')}
           </ol>
         </section>`
      : '';

  const body = articles
    .map((a) => {
      const original =
        opts.includeOriginal && a.originalHtml
          ? `<div class="original">
               <div class="original-label">原文 (Original)</div>
               ${a.originalHtml}
             </div>`
          : '';
      return `<article class="article">
          <header class="article-header">
            <h1 class="article-title">${escapeHtml(a.frontmatter.title || '未命名')}</h1>
            <div class="article-meta">${articleMeta(a.frontmatter)}</div>
          </header>
          <div class="article-body">${a.contentHtml}</div>
          ${original}
        </article>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(docTitle)}</title>
<style>${bookletStyles(layout)}</style>
</head>
<body>
${cover}
${toc}
${body}
</body>
</html>`;
}

const PREVIEW_BODY = `
  <article class="article">
    <header class="article-header">
      <h1 class="article-title">預覽：文章標題</h1>
      <div class="article-meta"><span>作者</span><span>2026-01-01</span><span>俄文</span></div>
    </header>
    <div class="article-body">
      <p>這是內文範例，用來即時預覽字級、行距與邊界的變化。願以此功德，莊嚴佛淨土，上報四重恩，下濟三途苦。</p>
      <h2>一、章節標題（標題 2）</h2>
      <p>次段內文。觀想本尊，身色赤紅，三面六臂，光明遍照，行者至誠頂禮，發菩提心，願度一切有情。</p>
      <h3>（一）小節標題（標題 3）</h3>
      <p>更細一層的內文，用來示範標題 3 的字級。</p>
      <table>
        <thead><tr><th>梵文</th><th>對音</th><th>字義</th></tr></thead>
        <tbody>
          <tr><td>oṃ</td><td>唵</td><td>皈命</td></tr>
          <tr><td>hūṃ phaṭ</td><td>吽泮吒</td><td>摧破</td></tr>
        </tbody>
      </table>
    </div>
  </article>`;

/**
 * Self-contained on-screen preview of a single B5 sheet, using the EXACT same
 * stylesheet as the printed output so what you tune is what you get. Meant to
 * be dropped into an <iframe srcDoc> and scaled down.
 */
export function buildPreviewHtml(layout: BookletLayout): string {
  const frame = `
    html, body { background: #e5e5e5; }
    .sheet {
      width: 176mm;
      min-height: 250mm;
      margin: 0 auto;
      padding: ${layout.marginMm}mm;
      background: #fff;
      box-sizing: border-box;
    }`;
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8" />
<style>${bookletStyles(layout)}${frame}</style>
</head>
<body><div class="sheet">${PREVIEW_BODY}</div></body>
</html>`;
}

/**
 * Render the booklet HTML in a hidden iframe and open the print dialog.
 * Waits for layout + fonts before printing so CJK glyphs are measured correctly.
 * The iframe is removed after the dialog closes (afterprint / fallback timeout).
 */
export function printBookletHtml(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';

    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      // Delay removal so the print job can spool from the iframe first.
      setTimeout(() => iframe.remove(), 1000);
    };

    iframe.onload = async () => {
      const win = iframe.contentWindow;
      const doc = iframe.contentDocument;
      if (!win || !doc) {
        cleanup();
        reject(new Error('無法建立列印文件'));
        return;
      }
      try {
        // Ensure fonts are loaded so CJK line-breaking is measured correctly.
        if (doc.fonts?.ready) await doc.fonts.ready;
        win.addEventListener('afterprint', cleanup, { once: true });
        win.focus();
        win.print();
        // Fallback cleanup in case afterprint never fires (some browsers).
        setTimeout(cleanup, 60000);
        resolve();
      } catch (err) {
        cleanup();
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };

    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (!doc) {
      iframe.remove();
      reject(new Error('無法建立列印文件'));
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
  });
}
