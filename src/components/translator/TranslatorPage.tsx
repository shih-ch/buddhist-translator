import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, Layers, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
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
    <div className="h-full overflow-hidden">
      <ResizablePanelGroup orientation="horizontal" className="h-full">
        {/* Left: Source Input */}
        <ResizablePanel defaultSize={25} minSize={15}>
          <div className="flex flex-col min-h-0 h-full">
            <div className="shrink-0">
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
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <SourceInput />
            </div>
            {/* TM Suggestions when original text is entered */}
            {originalText.length > 50 && (
              <div className="shrink-0">
                <TMSuggestions sourceText={originalText} />
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Center: Params + Chat */}
        <ResizablePanel defaultSize={40} minSize={20}>
          <div className="flex flex-col min-h-0 h-full">
            <div className="shrink-0 max-h-[40%] overflow-auto">
              <TranslationParams />
            </div>
            <div className="flex-1 min-h-0">
              <ChatPanel />
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right: Preview & Export + optional Dictionary */}
        <ResizablePanel defaultSize={35} minSize={15}>
          <div className="flex flex-col min-h-0 h-full">
            {showDict ? (
              <div className="flex flex-col h-full min-h-0">
                <div className="flex-1 min-h-0 border-b">
                  <PreviewPanel />
                </div>
                <div className="h-[280px] shrink-0 overflow-auto">
                  <DictionaryPanel />
                </div>
              </div>
            ) : (
              <PreviewPanel />
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <BatchPanel open={batchOpen} onClose={() => setBatchOpen(false)} />
    </div>
  );
}
