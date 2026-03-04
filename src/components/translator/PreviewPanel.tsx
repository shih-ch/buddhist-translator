import { useState, useCallback } from 'react';
import { Download, Copy, Github, FileText, FileCode, Check, Loader2, FileType, FileSpreadsheet, Columns2, BookCheck, GitCompare, Bookmark, History, Sparkles, BookMarked } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslatorStore } from '@/stores/translatorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { generateSlug, parseMarkdown, splitFrontmatter } from '@/services/markdownUtils';
import { githubService } from '@/services/github';
import { MarkdownPreview } from './MarkdownPreview';
import { MarkdownEditor } from './MarkdownEditor';
import { ParallelView } from './ParallelView';
import { ConsistencyReport } from './ConsistencyReport';
import { VersionCompare } from './VersionCompare';
import { VersionManager } from './VersionManager';
import { ImageUploader } from './ImageUploader';
import { useAIFunctionsStore } from '@/stores/aiFunctionsStore';
import { useGlossaryStore } from '@/stores/glossaryStore';
import { trackedCallFunction } from '@/services/ai/trackedCall';
import { annotateGlossaryTerms, removeAnnotations } from '@/services/glossaryAnnotator';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { exportPDF, exportDOCX } from '@/services/exportFormats';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AnnotationMode } from '@/services/glossaryAnnotator';

export function PreviewPanel() {
  const previewContent = useTranslatorStore((s) => s.previewContent);
  const previewMode = useTranslatorStore((s) => s.previewMode);
  const setPreviewMode = useTranslatorStore((s) => s.setPreviewMode);
  const setPreviewContent = useTranslatorStore((s) => s.setPreviewContent);
  const metadata = useTranslatorStore((s) => s.metadata);

  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showParallel, setShowParallel] = useState(false);
  const [showConsistency, setShowConsistency] = useState(false);
  const [showVersionCompare, setShowVersionCompare] = useState(false);
  const [showVersionManager, setShowVersionManager] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const githubToken = useSettingsStore((s) => s.githubToken);
  const editingArticle = useTranslatorStore((s) => s.editingArticle);
  const originalText = useTranslatorStore((s) => s.originalText);
  const articleImages = useTranslatorStore((s) => s.articleImages);
  const saveVersion = useTranslatorStore((s) => s.saveVersion);
  const savedVersions = useTranslatorStore((s) => s.savedVersions);

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

  const handleAnnotateTerms = useCallback((mode: AnnotationMode) => {
    if (!previewContent) return;
    const terms = useGlossaryStore.getState().glossary?.terms;
    if (!terms || terms.length === 0) {
      toast.error('術語表為空，請先載入術語表');
      return;
    }
    const { frontmatter, body } = splitFrontmatter(previewContent);

    const { text, count } = annotateGlossaryTerms(body, terms, mode);
    const result = frontmatter
      ? frontmatter + '\n\n' + text
      : text;
    setPreviewContent(result);
    toast.success(`已標注 ${count} 個術語`);
  }, [previewContent, setPreviewContent]);

  const handleAIFormat = useCallback(async () => {
    if (!previewContent) return;
    const fnConfig = useAIFunctionsStore.getState().getFunctionConfig('translation_formatting');
    const apiKeys = useSettingsStore.getState().apiKeys;
    if (!apiKeys[fnConfig.provider]) {
      toast.error('請先在設定中填入 API Key');
      return;
    }
    setFormatting(true);
    try {
      const { frontmatter, body } = splitFrontmatter(previewContent);

      const messages = [
        { role: 'system' as const, content: fnConfig.prompt },
        { role: 'user' as const, content: body },
      ];
      const response = await trackedCallFunction(fnConfig, apiKeys, messages, undefined, 'translation_formatting');
      const result = frontmatter
        ? frontmatter + '\n\n' + response.content.trim() + '\n'
        : response.content.trim() + '\n';
      setPreviewContent(result);
      toast.success('AI 排版完成');
    } catch (err) {
      toast.error(`排版失敗：${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setFormatting(false);
    }
  }, [previewContent, setPreviewContent]);

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
      // Update editingArticle so subsequent saves use the correct path & SHA
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
          <div className="flex gap-1">
            {previewContent && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={handleAIFormat}
                disabled={formatting}
                title="AI 排版"
              >
                {formatting ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
              </Button>
            )}
            {previewContent && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    title="術語標注"
                  >
                    <BookMarked className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleAnnotateTerms('abbr')}>
                    {'<abbr>'} 標注
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAnnotateTerms('link')}>
                    [連結] 標注
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => {
                    if (!previewContent) return;
                    const { frontmatter, body } = splitFrontmatter(previewContent);
                    const cleaned = removeAnnotations(body);
                    if (cleaned === body) {
                      toast.info('沒有找到標注');
                      return;
                    }
                    const result = frontmatter
                      ? frontmatter + '\n\n' + cleaned
                      : cleaned;
                    setPreviewContent(result);
                    toast.success('已移除所有標注');
                  }}>
                    移除標注
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {originalText && previewContent && (
              <Button
                variant={showParallel ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => setShowParallel(!showParallel)}
                title="雙欄對照"
              >
                <Columns2 className="size-3 mr-1" />
                對照
              </Button>
            )}
            {previewContent && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => setShowConsistency(true)}
                title="術語一致性檢查"
              >
                <BookCheck className="size-3" />
              </Button>
            )}
            {editingArticle?.sha && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => setShowVersionCompare(true)}
                title="版本比較"
              >
                <GitCompare className="size-3" />
              </Button>
            )}
            {previewContent && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => saveVersion()}
                title="儲存版本"
              >
                <Bookmark className="size-3" />
              </Button>
            )}
            <Button
              variant={showVersionManager ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => setShowVersionManager(true)}
              title="版本管理"
            >
              <History className="size-3" />
              {savedVersions.length > 0 && (
                <span className="ml-0.5 text-[10px]">{savedVersions.length}</span>
              )}
            </Button>
          </div>
        </div>

        {showParallel ? (
          <div className="flex-1 overflow-hidden">
            <ParallelView
              originalText={originalText}
              translatedContent={previewContent}
            />
          </div>
        ) : (
          <>
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
          </>
        )}
      </Tabs>

      {/* Export buttons — always visible */}
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

      {/* Dialogs */}
      <ConsistencyReport
        open={showConsistency}
        onClose={() => setShowConsistency(false)}
      />
      <VersionCompare
        open={showVersionCompare}
        onClose={() => setShowVersionCompare(false)}
      />
      <VersionManager
        open={showVersionManager}
        onClose={() => setShowVersionManager(false)}
      />
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
