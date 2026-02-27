import { useState, useCallback, useRef } from 'react';
import { Play, Square, Trash2, Check, AlertCircle, Loader2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useBatchStore, type BatchItem } from '@/stores/batchStore';
import { useTranslatorStore } from '@/stores/translatorStore';
import { useAIFunctionsStore } from '@/stores/aiFunctionsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useGlossaryStore } from '@/stores/glossaryStore';
import { callFunction } from '@/services/ai/router';
import { buildTranslationMessages } from '@/services/ai/promptBuilder';
import { useCostTrackingStore } from '@/stores/costTrackingStore';
import { AI_PROVIDERS } from '@/stores/aiModels';
import { toast } from 'sonner';

interface BatchPanelProps {
  open: boolean;
  onClose: () => void;
}

const STATUS_ICONS: Record<BatchItem['status'], React.ReactNode> = {
  pending: <div className="h-3 w-3 rounded-full border border-muted-foreground" />,
  translating: <Loader2 className="h-3 w-3 animate-spin text-blue-500" />,
  done: <Check className="h-3 w-3 text-green-500" />,
  error: <AlertCircle className="h-3 w-3 text-red-500" />,
};

export function BatchPanel({ open, onClose }: BatchPanelProps) {
  const [inputText, setInputText] = useState('');
  const { items, isRunning, setItems, updateItem, getNextPending, setRunning, clear } = useBatchStore();
  const abortRef = useRef(false);

  const handleParse = () => {
    const texts = inputText.split(/^===+$/m).map((t) => t.trim()).filter(Boolean);
    if (texts.length === 0) {
      toast.error('請輸入至少一段文字（多段用 === 分隔）');
      return;
    }
    setItems(texts);
    toast.success(`已解析 ${texts.length} 段文字`);
  };

  const translateItem = useCallback(async (item: BatchItem) => {
    const fnConfig = useAIFunctionsStore.getState().getFunctionConfig('translation');
    const apiKeys = useSettingsStore.getState().apiKeys;
    const glossaryTerms = useGlossaryStore.getState().glossary?.terms ?? [];
    const { currentModel, translationParams } = useTranslatorStore.getState();

    if (!apiKeys[currentModel.provider]) {
      throw new Error('未設定 API Key');
    }

    const messages = buildTranslationMessages(
      fnConfig.prompt,
      item.text,
      translationParams,
      glossaryTerms,
      []
    );

    const response = await callFunction(fnConfig, apiKeys, messages, {
      overrideProvider: currentModel.provider,
      overrideModel: currentModel.model,
    });

    // Track cost
    const providerModels = AI_PROVIDERS[currentModel.provider];
    const modelInfo = providerModels?.models.find((m) => m.id === currentModel.model);
    const inputPrice = modelInfo?.inputPrice ?? 2.5;
    const outputPrice = modelInfo?.outputPrice ?? 10;
    const cost = (response.usage.prompt_tokens * inputPrice +
      response.usage.completion_tokens * outputPrice) / 1_000_000;

    useCostTrackingStore.getState().addEntry({
      provider: currentModel.provider,
      model: currentModel.model,
      functionType: 'batch_translation',
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
      cost,
    });

    return response.content;
  }, []);

  const handleStart = useCallback(async () => {
    setRunning(true);
    abortRef.current = false;

    let next = getNextPending();
    while (next && !abortRef.current) {
      const current = next;
      updateItem(current.id, { status: 'translating' });

      try {
        const result = await translateItem(current);
        updateItem(current.id, { status: 'done', result });
      } catch (err) {
        updateItem(current.id, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }

      next = getNextPending();
    }

    setRunning(false);
    if (!abortRef.current) {
      toast.success('批次翻譯完成');
    }
  }, [getNextPending, updateItem, translateItem, setRunning]);

  const handleStop = () => {
    abortRef.current = true;
    setRunning(false);
  };

  const handleAdopt = (item: BatchItem) => {
    if (!item.result) return;
    const store = useTranslatorStore.getState();
    store.setOriginalText(item.text);
    // Set preview content directly
    store.setPreviewContent(item.result);
    toast.success('已採用翻譯結果');
    onClose();
  };

  const doneCount = items.filter((i) => i.status === 'done').length;
  const errorCount = items.filter((i) => i.status === 'error').length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !isRunning) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>批次翻譯</DialogTitle>
          <DialogDescription>
            貼入多段原文（用 <code className="rounded bg-muted px-1">===</code> 分隔），依序翻譯。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0 flex flex-col gap-3">
          {items.length === 0 ? (
            <>
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={'第一段原文\n===\n第二段原文\n===\n第三段原文'}
                className="flex-1 min-h-[200px] resize-none font-mono text-sm"
              />
              <Button onClick={handleParse} disabled={!inputText.trim()}>
                解析文字
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {items.length} 段 · {doneCount} 完成 · {errorCount} 錯誤
                </span>
                <div className="flex gap-2">
                  {!isRunning ? (
                    <>
                      <Button size="sm" onClick={handleStart} disabled={!getNextPending()}>
                        <Play className="mr-1 h-3 w-3" />
                        {doneCount > 0 ? '繼續' : '開始翻譯'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { clear(); setInputText(''); }}>
                        <Trash2 className="mr-1 h-3 w-3" />
                        清除
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="destructive" onClick={handleStop}>
                      <Square className="mr-1 h-3 w-3" />
                      停止
                    </Button>
                  )}
                </div>
              </div>

              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-2 pr-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-md border p-3 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        {STATUS_ICONS[item.status]}
                        <span className="text-xs font-mono truncate flex-1">
                          {item.text.slice(0, 80)}...
                        </span>
                        {item.status === 'done' && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => {
                                navigator.clipboard.writeText(item.result ?? '');
                                toast.success('已複製');
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => handleAdopt(item)}
                            >
                              採用
                            </Button>
                          </div>
                        )}
                      </div>
                      {item.status === 'done' && item.result && (
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto bg-muted/50 rounded p-2">
                          {item.result.slice(0, 500)}{item.result.length > 500 ? '...' : ''}
                        </pre>
                      )}
                      {item.status === 'error' && (
                        <div className="text-xs text-red-600">{item.error}</div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
