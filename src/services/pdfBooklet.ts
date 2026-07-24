import type { ArticleFrontmatter } from '@/types/article';

/** One article, already converted to HTML, ready to place in the booklet. */
export interface BookletArticle {
  frontmatter: ArticleFrontmatter;
  contentHtml: string;
  /** Rendered original-text HTML (only used when includeOriginal is on). */
  originalHtml?: string;
  /** Inline SVG QR code (links to the source URL), shown in the article header. */
  qrSvg?: string;
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
  /**
   * Embed a web font (Noto Serif/Sans TC) so the PDF renders identically on any
   * machine, regardless of installed fonts. Needs network at generation time;
   * falls back to system fonts if the web font can't load.
   */
  embedFont?: boolean;
  /**
   * Add a running footer (article title + page number) via Paged.js. The HTML
   * carries the @page CSS; the print flow must run the polyfill (see
   * printBookletHtml `paged`) for it to take effect.
   */
  pageFooter?: boolean;
}

/** Google Fonts <link> tags injected into the print/preview <head> when embedding. */
const FONT_LINKS = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@500;700&family=Noto+Serif+TC:wght@400;600;700&display=swap" rel="stylesheet">`;

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
function bookletStyles(layout: BookletLayout, embedFont = false, pageFooter = false): string {
  const fs = layout.fontSizePt;
  // Running footer (article title, left) + page number (right), rendered by
  // Paged.js. Chrome ignores @page margin boxes on its own, so this only takes
  // effect when the print flow runs the Paged.js polyfill. Suppressed on the
  // very first page (cover / opening page).
  const pagedCss = pageFooter ? `
    @page {
      @bottom-left { content: string(runningtitle); font-size: 8pt; color: #888; }
      @bottom-center { content: counter(page); font-size: 8pt; color: #888; }
    }
    /* Cover / TOC get no footer; article pages (default page) always do —
       including the first, so a single-article export still shows it. */
    @page blank {
      @bottom-left { content: none; }
      @bottom-center { content: none; }
    }
    .cover, .toc { page: blank; }
    .article-title { string-set: runningtitle content(text); }
  ` : '';
  // Heading levels are set explicitly (independently tunable); secondary
  // body-relative sizes still derive from the body size.
  const h1 = layout.h1SizePt;
  const h2 = layout.h2SizePt;
  const h3 = layout.h3SizePt;
  const titleFs = layout.titleSizePt;
  const metaFs = Math.max(8, fs - 2.5);
  const tableFs = Math.max(8, fs - 1.5);
  const origFs = Math.max(8, fs - 1);
  // When embedding, put the web font first so it's used (and baked into the PDF).
  const serif = `${embedFont ? '"Noto Serif TC", ' : ''}"Noto Serif CJK TC", "Source Han Serif TC", "Songti TC", "PMingLiU", "MingLiU", serif`;
  const sans = `${embedFont ? '"Noto Sans TC", ' : ''}"Noto Sans CJK TC", "PingFang TC", "Microsoft JhengHei", sans-serif`;
  return `
    @page {
      size: B5 portrait;
      margin: ${layout.marginMm}mm;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: ${serif};
      font-size: ${fs}pt;
      line-height: ${layout.lineHeight};
      color: #1a1a1a;
      text-align: justify;
      text-justify: inter-ideograph;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      /* Break long unbreakable tokens so content never exceeds the page width,
         which would make the browser shrink-to-fit the whole document (and thus
         change apparent font size / margins depending on the articles). */
      overflow-wrap: break-word;
      word-break: break-word;
    }
    h1, h2, h3, h4 {
      font-family: ${sans};
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
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 6mm;
      border-bottom: 1pt solid #999;
      margin-bottom: 7mm;
      padding-bottom: 3mm;
    }
    .article-header .head-text { flex: 1 1 auto; min-width: 0; }
    .article-qr { flex: 0 0 auto; width: 22mm; text-align: center; }
    .article-qr svg { display: block; width: 22mm; height: 22mm; }
    .article-qr .qr-caption { font-size: 7pt; color: #888; margin-top: 0.5mm; }
    .article-qr .qr-placeholder {
      width: 22mm; height: 22mm; border: 1pt dashed #bbb;
      display: flex; align-items: center; justify-content: center;
      font-size: 7pt; color: #bbb;
    }
    .article-title { font-size: ${titleFs}pt; margin: 0 0 2mm; line-height: 1.3; }
    .article-meta { font-size: ${metaFs}pt; color: #666; line-height: 1.6; }
    .article-meta span + span::before { content: " · "; }

    table {
      border-collapse: collapse;
      width: 100%;
      /* Fixed layout + wrapping cells guarantee a table can never widen past
         the page and trigger the browser's shrink-to-fit scaling. */
      table-layout: fixed;
      margin: 4mm 0;
      font-size: ${tableFs}pt;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    th, td {
      border: 0.5pt solid #999;
      padding: 1.8mm 2.5mm;
      text-align: left;
      vertical-align: top;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
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
    img { max-width: 100%; height: auto; break-inside: avoid; }
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
    ${pagedCss}
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
  const embedFont = opts.embedFont ?? false;
  const pageFooter = opts.pageFooter ?? false;
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
      const qr = a.qrSvg
        ? `<div class="article-qr">${a.qrSvg}<div class="qr-caption">掃描看原文</div></div>`
        : '';
      return `<article class="article">
          <header class="article-header">
            <div class="head-text">
              <h1 class="article-title">${escapeHtml(a.frontmatter.title || '未命名')}</h1>
              <div class="article-meta">${articleMeta(a.frontmatter)}</div>
            </div>
            ${qr}
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
<title>${escapeHtml(docTitle)}</title>${embedFont ? FONT_LINKS : ''}
<style>${bookletStyles(layout, embedFont, pageFooter)}</style>
</head>
<body>
${cover}
${toc}
${body}
</body>
</html>`;
}

const PREVIEW_CONTENT = `
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
  </table>`;

/**
 * Self-contained on-screen preview of a single B5 sheet, using the EXACT same
 * stylesheet as the printed output so what you tune is what you get. Meant to
 * be dropped into an <iframe srcDoc> and scaled down. The QR (when on) is shown
 * as a placeholder box since real codes are generated per-article at export.
 */
export function buildPreviewHtml(
  layout: BookletLayout,
  embedFont = false,
  showQr = false,
  showFooter = false
): string {
  const qr = showQr
    ? `<div class="article-qr"><div class="qr-placeholder">QR</div><div class="qr-caption">掃描看原文</div></div>`
    : '';
  const footer = showFooter
    ? `<div class="preview-footer"><span class="pf-title">預覽：文章標題</span><span class="pf-num">1</span></div>`
    : '';
  const frame = `
    html, body { background: #e5e5e5; }
    .sheet {
      position: relative;
      width: 176mm;
      min-height: 250mm;
      margin: 0 auto;
      padding: ${layout.marginMm}mm;
      background: #fff;
      box-sizing: border-box;
    }
    .preview-footer {
      position: absolute; left: 0; right: 0; bottom: 0;
      padding: 2.5mm ${layout.marginMm}mm;
      font-size: 8pt; color: #888;
    }
    .preview-footer .pf-num {
      position: absolute; left: 50%; transform: translateX(-50%);
    }`;
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8" />${embedFont ? FONT_LINKS : ''}
<style>${bookletStyles(layout, embedFont)}${frame}</style>
</head>
<body><div class="sheet">
  <article class="article">
    <header class="article-header">
      <div class="head-text">
        <h1 class="article-title">預覽：文章標題</h1>
        <div class="article-meta"><span>作者</span><span>2026-01-01</span><span>俄文</span></div>
      </div>
      ${qr}
    </header>
    <div class="article-body">${PREVIEW_CONTENT}</div>
  </article>
  ${footer}
</div></body>
</html>`;
}

/**
 * Render the booklet HTML in a hidden iframe and open the print dialog.
 * Waits for layout + fonts before printing so CJK glyphs are measured correctly.
 * The iframe is removed after the dialog closes (afterprint / fallback timeout).
 */
interface PagedWindow extends Window {
  PagedConfig?: { auto: boolean };
  PagedPolyfill?: { preview: () => Promise<unknown> };
}

export async function printBookletHtml(html: string, opts: { paged?: boolean } = {}): Promise<void> {
  let finalHtml = html;
  if (opts.paged) {
    // Load Paged.js as an EXTERNAL script (auto:false — we trigger pagination
    // ourselves once fonts/images are ready). Inlining the ~500KB polyfill via
    // document.write proved unreliable: Chrome sometimes printed with its own
    // native header/footer instead of the Paged.js margin boxes (running title
    // + page number). An external <script src> matches the flow that prints
    // correctly. Absolute URL so the about:blank print iframe can resolve it.
    const { default: pagedUrl } = await import('../../node_modules/pagedjs/dist/paged.polyfill.min.js?url');
    const src = new URL(pagedUrl, window.location.href).href;
    finalHtml = html.replace(
      '</body>',
      `<script>window.PagedConfig={auto:false};</script>\n<script src="${src}"></script>\n</body>`
    );
  }

  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    // A real (B5-ish) size positioned off-screen gives the print layout a sane
    // viewport; a 0×0 iframe can measure percentage/table widths at zero.
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '190mm';
    iframe.style.height = '260mm';
    iframe.style.border = '0';

    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      // Delay removal so the print job can spool from the iframe first.
      setTimeout(() => iframe.remove(), 1000);
    };

    iframe.onload = async () => {
      const win = iframe.contentWindow as PagedWindow | null;
      const doc = iframe.contentDocument;
      if (!win || !doc) {
        cleanup();
        reject(new Error('無法建立列印文件'));
        return;
      }
      try {
        // Ensure fonts are loaded so CJK line-breaking is measured correctly.
        if (doc.fonts?.ready) await doc.fonts.ready;
        // Wait for images (e.g. remote GitHub images) to finish, or they print
        // blank. Cap the wait so one slow/broken image can't block forever.
        const imgs = Array.from(doc.images);
        if (imgs.length > 0) {
          await Promise.race([
            Promise.all(
              imgs.map((img) =>
                img.complete
                  ? Promise.resolve()
                  : new Promise<void>((res) => {
                      img.addEventListener('load', () => res(), { once: true });
                      img.addEventListener('error', () => res(), { once: true });
                    })
              )
            ),
            new Promise<void>((res) => setTimeout(res, 8000)),
          ]);
        }
        // Paginate with Paged.js (footer + page numbers) before printing.
        if (opts.paged) {
          // The external polyfill should be loaded by onload; guard anyway.
          let tries = 0;
          while (!win.PagedPolyfill && tries++ < 150) {
            await new Promise<void>((r) => setTimeout(r, 20));
          }
          if (win.PagedPolyfill) await win.PagedPolyfill.preview();
        }
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
    doc.write(finalHtml);
    doc.close();
  });
}
