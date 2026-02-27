import { useState } from 'react';
import { Download, Copy, Github, FileText, FileCode, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslatorStore } from '@/stores/translatorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { generateSlug, parseMarkdown } from '@/services/markdownUtils';
import { githubService } from '@/services/github';
import { MarkdownPreview } from './MarkdownPreview';
import { MarkdownEditor } from './MarkdownEditor';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { renderToString } from 'react-dom/server';
import React from 'react';

export function PreviewPanel() {
  const previewContent = useTranslatorStore((s) => s.previewContent);
  const previewMode = useTranslatorStore((s) => s.previewMode);
  const setPreviewMode = useTranslatorStore((s) => s.setPreviewMode);
  const setPreviewContent = useTranslatorStore((s) => s.setPreviewContent);
  const metadata = useTranslatorStore((s) => s.metadata);

  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const githubToken = useSettingsStore((s) => s.githubToken);
  const editingArticle = useTranslatorStore((s) => s.editingArticle);
  const originalText = useTranslatorStore((s) => s.originalText);

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
    details { border: 1px solid #ddd; border-radius: 4px; padding: 1rem; margin: 1rem 0; }
    summary { cursor: pointer; font-weight: bold; }
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

  const handleCopy = async () => {
    if (!previewContent) return;
    await navigator.clipboard.writeText(previewContent);
    setCopied(true);
    toast.success('已複製到剪貼簿');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToGithub = async () => {
    console.log('[Save] previewContent length:', previewContent.length, 'githubToken:', !!githubToken);
    if (!previewContent || !githubToken) {
      toast.error(githubToken ? '沒有可儲存的內容' : '請先在設定中填入 GitHub Token');
      return;
    }
    setSaving(true);
    try {
      const parsed = parseMarkdown(previewContent);
      await githubService.saveTranslation({
        path: editingArticle?.path ?? '',
        frontmatter: { ...metadata, ...parsed.frontmatter },
        content: parsed.content,
        originalText: parsed.originalText ?? originalText,
        sha: editingArticle?.sha,
      });
      toast.success('已儲存到 GitHub');
    } catch (err) {
      toast.error(`儲存失敗：${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Tabs
        value={previewMode}
        onValueChange={(v) => setPreviewMode(v as 'rendered' | 'source')}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex items-center justify-between px-3 py-1.5 border-b">
          <TabsList className="h-7">
            <TabsTrigger value="rendered" className="text-xs px-2 h-6">
              <FileText className="size-3 mr-1" />
              預覽
            </TabsTrigger>
            <TabsTrigger value="source" className="text-xs px-2 h-6">
              <FileCode className="size-3 mr-1" />
              原始碼
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="rendered" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <MarkdownPreview content={previewContent} />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="source" className="flex-1 overflow-hidden mt-0">
          <MarkdownEditor
            content={previewContent}
            onChange={setPreviewContent}
          />
        </TabsContent>
      </Tabs>

      {/* Export buttons */}
      <div className="flex flex-wrap gap-1.5 border-t p-2">
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
          onClick={handleCopy}
          disabled={!previewContent}
        >
          {copied ? <Check className="size-3 mr-1" /> : <Copy className="size-3 mr-1" />}
          {copied ? '已複製' : '複製'}
        </Button>
      </div>
    </div>
  );
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
