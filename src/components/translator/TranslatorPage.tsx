import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SourceInput } from './SourceInput';
import { TranslationParams } from './TranslationParams';
import { ChatPanel } from './ChatPanel';
import { PreviewPanel } from './PreviewPanel';
import { useTranslatorStore } from '@/stores/translatorStore';
import { githubService } from '@/services/github';
import { useSettingsStore } from '@/stores/settingsStore';
import { toast } from 'sonner';

export function TranslatorPage() {
  const [searchParams] = useSearchParams();
  const loadArticleForEdit = useTranslatorStore((s) => s.loadArticleForEdit);
  const setInputMode = useTranslatorStore((s) => s.setInputMode);
  const editingArticle = useTranslatorStore((s) => s.editingArticle);
  const githubToken = useSettingsStore((s) => s.githubToken);

  useEffect(() => {
    const editPath = searchParams.get('edit');
    const mode = searchParams.get('mode');

    if (editPath && githubToken) {
      githubService.loadTranslation(editPath)
        .then((article) => loadArticleForEdit(article))
        .catch((err) => toast.error(`載入文章失敗：${err instanceof Error ? err.message : 'Unknown error'}`));
    } else if (mode === 'import') {
      setInputMode('import');
    }
  }, [searchParams, githubToken, loadArticleForEdit, setInputMode]);

  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-cols-[1fr_1.6fr_1.4fr] gap-0">
      {/* Left: Source Input */}
      <div className="flex flex-col overflow-hidden border-r">
        <SourceInput />
      </div>

      {/* Center: Params + Chat */}
      <div className="flex flex-col overflow-hidden border-r">
        <TranslationParams />
        <ChatPanel />
      </div>

      {/* Right: Preview & Export */}
      <div className="flex flex-col overflow-hidden">
        {editingArticle && (
          <div className="bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground border-b">
            編輯模式：{editingArticle.frontmatter.title}
          </div>
        )}
        <PreviewPanel />
      </div>
    </div>
  );
}
