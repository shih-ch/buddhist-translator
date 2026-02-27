import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const navigate = useNavigate();
  const loadArticleForEdit = useTranslatorStore((s) => s.loadArticleForEdit);
  const setInputMode = useTranslatorStore((s) => s.setInputMode);
  const reset = useTranslatorStore((s) => s.reset);
  const editingArticle = useTranslatorStore((s) => s.editingArticle);
  const hasContent = useTranslatorStore((s) => s.originalText || s.messages.length > 0 || s.previewContent);
  const githubToken = useSettingsStore((s) => s.githubToken);

  const handleNewTranslation = () => {
    reset();
    navigate('/translator', { replace: true });
  };

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
    <div className="grid h-full grid-cols-[1fr_1.6fr_1.4fr] gap-0">
      {/* Left: Source Input */}
      <div className="flex flex-col overflow-hidden border-r">
        {(editingArticle || hasContent) && (
          <div className="flex items-center justify-between border-b px-3 py-1.5">
            <span className="text-xs text-muted-foreground">
              {editingArticle ? `編輯：${editingArticle.frontmatter.title}` : ''}
            </span>
            <Button variant="outline" size="xs" onClick={handleNewTranslation}>
              <Plus className="mr-1 h-3 w-3" />新增翻譯
            </Button>
          </div>
        )}
        <SourceInput />
      </div>

      {/* Center: Params + Chat */}
      <div className="flex flex-col overflow-hidden border-r">
        <TranslationParams />
        <ChatPanel />
      </div>

      {/* Right: Preview & Export */}
      <div className="flex flex-col overflow-hidden">
        <PreviewPanel />
      </div>
    </div>
  );
}
