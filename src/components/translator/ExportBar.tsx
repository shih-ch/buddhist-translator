import { useState } from 'react';
import { Download, Copy, Github, Check, Loader2, FileType, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslatorStore } from '@/stores/translatorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { generateSlug, parseMarkdown } from '@/services/markdownUtils';
import { githubService } from '@/services/github';
import { ImageUploader } from './ImageUploader';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { exportPDF, exportDOCX } from '@/services/exportFormats';

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportBar() {
  const previewContent = useTranslatorStore((s) => s.previewContent);
  const metadata = useTranslatorStore((s) => s.metadata);
  const editingArticle = useTranslatorStore((s) => s.editingArticle);
  const originalText = useTranslatorStore((s) => s.originalText);
  const articleImages = useTranslatorStore((s) => s.articleImages);
  const githubToken = useSettingsStore((s) => s.githubToken);

  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleDownloadMd = () => {
    if (!previewContent) return;
    const slug = generateSlug(metadata.title || 'untitled');
    const filename = `${metadata.date}-${slug}.md`;
    downloadFile(previewContent, filename, 'text/markdown');
    toast.success(`已下載 ${filename}`);
  };

  const handleDownloadHtml = () => {
    if (!previewContent) return;
    const htmlContent = renderToString(
      React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, previewContent)
    );
    const fullHtml = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${metadata.title || '翻譯文章'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.7; color: #333; }
    h1, h2, h3 { margin-top: 1.5em; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    details { border: 1px solid #ddd; border-radius: 4px; padding: 1rem; margin: 1rem 0; background: #f9f9f9; }
    summary { cursor: pointer; font-weight: bold; margin-bottom: 0.5rem; }
    details p { line-height: 1.8; margin: 0.5em 0; }
    blockquote { border-left: 3px solid #ddd; padding-left: 1rem; color: #666; }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
    const slug = generateSlug(metadata.title || 'untitled');
    downloadFile(fullHtml, `${metadata.date}-${slug}.html`, 'text/html');
    toast.success('已下載 HTML');
  };

  const handleDownloadPdf = async () => {
    if (!previewContent) return;
    try {
      const htmlContent = renderToString(
        React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, previewContent)
      );
      const slug = generateSlug(metadata.title || 'untitled');
      await exportPDF(htmlContent, metadata, `${metadata.date}-${slug}.pdf`);
      toast.success('已下載 PDF');
    } catch (err) {
      toast.error(`PDF 匯出失敗：${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDownloadDocx = async () => {
    if (!previewContent) return;
    try {
      const slug = generateSlug(metadata.title || 'untitled');
      await exportDOCX(previewContent, metadata, `${metadata.date}-${slug}.docx`);
      toast.success('已下載 DOCX');
    } catch (err) {
      toast.error(`DOCX 匯出失敗：${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleCopy = async () => {
    if (!previewContent) return;
    await navigator.clipboard.writeText(previewContent);
    setCopied(true);
    toast.success('已複製到剪貼簿');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToGithub = async () => {
    if (!previewContent || !githubToken) {
      toast.error(githubToken ? '沒有可儲存的內容' : '請先在設定中填入 GitHub Token');
      return;
    }
    setSaving(true);
    try {
      const parsed = parseMarkdown(previewContent);
      const mergedFrontmatter = { ...metadata, ...parsed.frontmatter };
      const { path, sha } = await githubService.saveTranslation(
        {
          path: editingArticle?.path ?? '',
          frontmatter: mergedFrontmatter,
          content: parsed.content,
          originalText: parsed.originalText ?? originalText,
          sha: editingArticle?.sha,
        },
        articleImages.length > 0 ? articleImages : undefined
      );
      useTranslatorStore.setState({
        editingArticle: {
          path,
          sha,
          frontmatter: mergedFrontmatter,
          content: parsed.content,
          originalText: parsed.originalText ?? originalText,
        },
      });
      toast.success('已儲存到 GitHub');
    } catch (err) {
      toast.error(`儲存失敗：${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5 border-t p-2 shrink-0">
      <Button
        variant="default"
        size="sm"
        className="text-xs"
        onClick={handleSaveToGithub}
        disabled={!previewContent || saving}
      >
        {saving ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Github className="size-3 mr-1" />}
        {saving ? '儲存中...' : '儲存到 GitHub'}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-xs"
        onClick={handleDownloadMd}
        disabled={!previewContent}
      >
        <Download className="size-3 mr-1" />
        .md
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-xs"
        onClick={handleDownloadHtml}
        disabled={!previewContent}
      >
        <Download className="size-3 mr-1" />
        .html
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-xs"
        onClick={handleDownloadPdf}
        disabled={!previewContent}
      >
        <FileType className="size-3 mr-1" />
        .pdf
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-xs"
        onClick={handleDownloadDocx}
        disabled={!previewContent}
      >
        <FileSpreadsheet className="size-3 mr-1" />
        .docx
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-xs"
        onClick={handleCopy}
        disabled={!previewContent}
      >
        {copied ? <Check className="size-3 mr-1" /> : <Copy className="size-3 mr-1" />}
        {copied ? '已複製' : '複製'}
      </Button>
      <ImageUploader />
    </div>
  );
}
