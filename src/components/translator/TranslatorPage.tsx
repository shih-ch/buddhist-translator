import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, Layers, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SourceInput } from './SourceInput';
import { TranslationParams } from './TranslationParams';
import { ChatPanel } from './ChatPanel';
import { PreviewPanel } from './PreviewPanel';
import { BatchPanel } from './BatchPanel';
import { TMSuggestions } from './TMSuggestions';
import { DictionaryPanel } from './DictionaryPanel';
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
  const originalText = useTranslatorStore((s) => s.originalText);
  const githubToken = useSettingsStore((s) => s.githubToken);
  const [batchOpen, setBatchOpen] = useState(false);
  const [showDict, setShowDict] = useState(false);

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
            <div className="flex gap-1">
              <Button variant="outline" size="xs" onClick={() => setShowDict(!showDict)}>
                <BookOpen className="mr-1 h-3 w-3" />辭典
              </Button>
              <Button variant="outline" size="xs" onClick={() => setBatchOpen(true)}>
                <Layers className="mr-1 h-3 w-3" />批次
              </Button>
              <Button variant="outline" size="xs" onClick={handleNewTranslation}>
                <Plus className="mr-1 h-3 w-3" />新增翻譯
              </Button>
            </div>
          </div>
        )}
        <SourceInput />
        {/* TM Suggestions when original text is entered */}
        {originalText.length > 50 && (
          <TMSuggestions sourceText={originalText} />
        )}
      </div>

      {/* Center: Params + Chat */}
      <div className="flex flex-col overflow-hidden border-r">
        <TranslationParams />
        <ChatPanel />
      </div>

      {/* Right: Preview & Export + optional Dictionary */}
      <div className="flex flex-col overflow-hidden">
        {showDict ? (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-hidden border-b">
              <PreviewPanel />
            </div>
            <div className="h-[300px] overflow-hidden">
              <DictionaryPanel />
            </div>
          </div>
        ) : (
          <PreviewPanel />
        )}
      </div>

      <BatchPanel open={batchOpen} onClose={() => setBatchOpen(false)} />
    </div>
  );
}
