import { useState, useCallback } from 'react';
import { Loader2, Sparkles, BookMarked, Columns2, BookCheck, GitCompare, Bookmark, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslatorStore } from '@/stores/translatorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAIFunctionsStore } from '@/stores/aiFunctionsStore';
import { useGlossaryStore } from '@/stores/glossaryStore';
import { splitFrontmatter } from '@/services/markdownUtils';
import { trackedCallFunction } from '@/services/ai/trackedCall';
import { annotateGlossaryTerms, removeAnnotations } from '@/services/glossaryAnnotator';
import { toast } from 'sonner';
import type { AnnotationMode } from '@/services/glossaryAnnotator';

interface PreviewToolbarProps {
  showParallel: boolean;
  onToggleParallel: () => void;
  onShowConsistency: () => void;
  onShowVersionCompare: () => void;
  onShowVersionManager: () => void;
}

export function PreviewToolbar({
  showParallel,
  onToggleParallel,
  onShowConsistency,
  onShowVersionCompare,
  onShowVersionManager,
}: PreviewToolbarProps) {
  const previewContent = useTranslatorStore((s) => s.previewContent);
  const setPreviewContent = useTranslatorStore((s) => s.setPreviewContent);
  const originalText = useTranslatorStore((s) => s.originalText);
  const editingArticle = useTranslatorStore((s) => s.editingArticle);
  const saveVersion = useTranslatorStore((s) => s.saveVersion);
  const savedVersions = useTranslatorStore((s) => s.savedVersions);

  const [formatting, setFormatting] = useState(false);

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

  return (
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
          onClick={onToggleParallel}
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
          onClick={onShowConsistency}
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
          onClick={onShowVersionCompare}
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
        variant="ghost"
        size="sm"
        className="h-6 text-xs px-2"
        onClick={onShowVersionManager}
        title="版本管理"
      >
        <History className="size-3" />
        {savedVersions.length > 0 && (
          <span className="ml-0.5 text-[10px]">{savedVersions.length}</span>
        )}
      </Button>
    </div>
  );
}
