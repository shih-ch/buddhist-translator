import { useState, useMemo } from 'react';
import { Clock, RotateCcw, Eye, Diff, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePromptHistoryStore } from '@/stores/promptHistoryStore';
import { useAIFunctionsStore } from '@/stores/aiFunctionsStore';
import { computeDiff } from '@/utils/simpleDiff';
import type { AIFunctionId } from '@/types/settings';
import type { PromptHistoryEntry } from '@/types/promptHistory';
import { toast } from 'sonner';

interface PromptHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  functionId: AIFunctionId;
}

const SOURCE_LABELS: Record<PromptHistoryEntry['source'], string> = {
  edit: '手動編輯',
  reset: '恢復預設',
  optimize: 'AI 優化',
  sync: '遠端同步',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PromptHistoryDialog({ open, onClose, functionId }: PromptHistoryDialogProps) {
  const allEntries = usePromptHistoryStore((s) => s.entries);
  const clearEntries = usePromptHistoryStore((s) => s.clearEntries);
  const entries = useMemo(
    () => allEntries.filter((e) => e.functionId === functionId).sort((a, b) => b.timestamp - a.timestamp),
    [allEntries, functionId]
  );
  const updateFunctionConfig = useAIFunctionsStore((s) => s.updateFunctionConfig);
  const currentPrompt = useAIFunctionsStore((s) => s.functions.find((f) => f.id === functionId)?.prompt ?? '');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'view' | 'diff'>('view');

  const selected = entries.find((e) => e.id === selectedId);

  const handleRestore = (entry: PromptHistoryEntry) => {
    updateFunctionConfig(functionId, { prompt: entry.prompt });
    toast.success('已還原 prompt');
    onClose();
  };

  const handleClear = () => {
    clearEntries(functionId);
    setSelectedId(null);
    toast.success('已清除歷史記錄');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Prompt 變更歷史
          </DialogTitle>
          <DialogDescription>
            瀏覽過去的 prompt 版本，可還原或比較差異。
          </DialogDescription>
        </DialogHeader>

        {entries.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            尚無歷史記錄
          </div>
        ) : (
          <div className="flex-1 flex gap-3 overflow-hidden min-h-0">
            {/* Left: entry list */}
            <ScrollArea className="w-52 shrink-0">
              <div className="space-y-1 pr-2">
                {entries.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => { setSelectedId(entry.id); setViewMode('view'); }}
                    className={`w-full text-left rounded-md border p-2 text-xs transition-colors ${
                      selectedId === entry.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="font-medium">{formatTime(entry.timestamp)}</div>
                    <div className="text-muted-foreground mt-0.5">
                      {SOURCE_LABELS[entry.source]}
                      {entry.label ? ` · ${entry.label}` : ''}
                    </div>
                    <div className="mt-1 truncate text-muted-foreground/70">
                      {entry.prompt.slice(0, 60)}...
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>

            {/* Right: content view */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {selected ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <Button
                      variant={viewMode === 'view' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('view')}
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      檢視
                    </Button>
                    <Button
                      variant={viewMode === 'diff' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('diff')}
                    >
                      <Diff className="mr-1 h-3 w-3" />
                      與目前比較
                    </Button>
                    <div className="flex-1" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(selected)}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      還原此版本
                    </Button>
                  </div>
                  <ScrollArea className="flex-1 rounded-md border">
                    {viewMode === 'view' ? (
                      <pre className="p-3 text-xs whitespace-pre-wrap font-mono">
                        {selected.prompt}
                      </pre>
                    ) : (
                      <DiffView oldText={currentPrompt} newText={selected.prompt} />
                    )}
                  </ScrollArea>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                  選擇一個歷史版本以檢視
                </div>
              )}
            </div>
          </div>
        )}

        {entries.length > 0 && (
          <div className="flex justify-end pt-2 border-t">
            <Button variant="ghost" size="sm" onClick={handleClear}>
              <Trash2 className="mr-1 h-3 w-3" />
              清除所有歷史
            </Button>
          </div>
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
