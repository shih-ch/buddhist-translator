import { useState } from 'react';
import { Loader2, Sparkles, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAIFunctionsStore } from '@/stores/aiFunctionsStore';
import { usePromptHistoryStore } from '@/stores/promptHistoryStore';
import { optimizePrompt, type OptimizationResult } from '@/services/promptOptimizer';
import { computeDiff } from '@/utils/simpleDiff';
import type { AIFunctionId } from '@/types/settings';
import { toast } from 'sonner';

interface PromptOptimizerDialogProps {
  open: boolean;
  onClose: () => void;
  functionId: AIFunctionId;
}

export function PromptOptimizerDialog({ open, onClose, functionId }: PromptOptimizerDialogProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'analysis' | 'diff' | 'full'>('analysis');

  const updateFunctionConfig = useAIFunctionsStore((s) => s.updateFunctionConfig);
  const currentPrompt = useAIFunctionsStore((s) => s.functions.find((f) => f.id === functionId)?.prompt ?? '');

  const handleOptimize = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await optimizePrompt(functionId);
      setResult(r);
      setViewMode('analysis');
    } catch (err) {
      setError(err instanceof Error ? err.message : '優化失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    // Record current prompt before applying optimization
    usePromptHistoryStore.getState().addEntry(functionId, currentPrompt, 'optimize');
    updateFunctionConfig(functionId, { prompt: result.suggestedPrompt });
    toast.success('已套用優化後的 prompt');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setResult(null); setError(null); } }}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            根據使用紀錄優化 Prompt
          </DialogTitle>
          <DialogDescription>
            分析翻譯修正記錄，自動找出 prompt 可改善之處。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
          {!result && !loading && !error && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
              <p className="text-sm text-muted-foreground text-center">
                此功能會讀取 GitHub 上的翻譯修正記錄，<br />
                分析常見修正模式，並自動建議 prompt 改進。
              </p>
              <Button onClick={handleOptimize}>
                <Sparkles className="mr-2 h-4 w-4" />
                開始分析
              </Button>
            </div>
          )}

          {loading && (
            <div className="flex-1 flex items-center justify-center gap-2 py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm text-muted-foreground">正在分析修正記錄並優化 prompt...</span>
            </div>
          )}

          {error && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
              <p className="text-sm text-red-600">{error}</p>
              <Button variant="outline" onClick={handleOptimize}>重試</Button>
            </div>
          )}

          {result && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-muted-foreground">
                  分析了 {result.logCount} 次翻譯、{result.correctionCount} 次修正
                </span>
                <div className="flex-1" />
                <Button
                  variant={viewMode === 'analysis' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('analysis')}
                >
                  分析
                </Button>
                <Button
                  variant={viewMode === 'diff' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('diff')}
                >
                  差異
                </Button>
                <Button
                  variant={viewMode === 'full' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('full')}
                >
                  完整
                </Button>
              </div>
              <ScrollArea className="flex-1 rounded-md border">
                {viewMode === 'analysis' && (
                  <div className="p-3 text-sm whitespace-pre-wrap">{result.analysis}</div>
                )}
                {viewMode === 'diff' && (
                  <DiffView oldText={currentPrompt} newText={result.suggestedPrompt} />
                )}
                {viewMode === 'full' && (
                  <pre className="p-3 text-xs whitespace-pre-wrap font-mono">{result.suggestedPrompt}</pre>
                )}
              </ScrollArea>
            </>
          )}
        </div>

        {result && (
          <DialogFooter>
            <Button variant="outline" onClick={() => { onClose(); setResult(null); }}>取消</Button>
            <Button onClick={handleApply}>
              <Check className="mr-1 h-3 w-3" />
              套用優化
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DiffView({ oldText, newText }: { oldText: string; newText: string }) {
  const lines = computeDiff(oldText, newText);
  return (
    <pre className="p-3 text-xs font-mono">
      {lines.map((line, i) => (
        <div
          key={i}
          className={
            line.type === 'add'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
              : line.type === 'remove'
              ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
              : ''
          }
        >
          <span className="inline-block w-5 text-right mr-2 text-muted-foreground select-none">
            {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
          </span>
          {line.content}
        </div>
      ))}
    </pre>
  );
}
