import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslatorStore } from '@/stores/translatorStore';
import { useGlossaryStore } from '@/stores/glossaryStore';
import { useAIFunctionsStore } from '@/stores/aiFunctionsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { trackedCallFunction } from '@/services/ai/trackedCall';
import { buildTermExtractionMessages } from '@/services/ai/promptBuilder';
import type { GlossaryTerm } from '@/types/glossary';
import { toast } from 'sonner';

interface ExtractedTerm {
  original: string;
  translation: string;
  sanskrit: string;
  category: string;
  notes: string;
  selected: boolean;
}

const CATEGORIES = [
  { value: 'concept', label: '概念' },
  { value: 'person', label: '人名' },
  { value: 'place', label: '地名' },
  { value: 'practice', label: '修法' },
  { value: 'text', label: '經典' },
  { value: 'deity', label: '本尊/護法' },
  { value: 'mantra', label: '咒語' },
];

interface TermExtractorProps {
  open: boolean;
  onClose: () => void;
  messageId: string | null;
}

export function TermExtractor({ open, onClose, messageId }: TermExtractorProps) {
  const [loading, setLoading] = useState(false);
  const [terms, setTerms] = useState<ExtractedTerm[]>([]);
  const messages = useTranslatorStore((s) => s.messages);
  const originalText = useTranslatorStore((s) => s.originalText);

  useEffect(() => {
    if (!open || !messageId) return;

    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;

    setLoading(true);
    setTerms([]);

    const fnConfig = useAIFunctionsStore.getState().getFunctionConfig('term_extraction');
    const apiKeys = useSettingsStore.getState().apiKeys;
    if (!apiKeys[fnConfig.provider]) {
      toast.error('請先在設定中填入 API Key 以使用術語提取');
      setLoading(false);
      return;
    }
    const aiMessages = buildTermExtractionMessages(fnConfig.prompt, originalText, msg.content);

    trackedCallFunction(fnConfig, apiKeys, aiMessages, undefined, 'term_extraction')
      .then((response) => {
        try {
          // Try to parse JSON from the response (may be wrapped in markdown code block)
          let jsonStr = response.content.trim();
          const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();

          const extracted = JSON.parse(jsonStr) as Array<{
            original: string;
            translation: string;
            sanskrit: string;
            category: string;
            notes: string;
          }>;
          setTerms(extracted.map((t) => ({ ...t, selected: true })));
        } catch {
          toast.error('術語提取結果解析失敗');
          setTerms([]);
        }
      })
      .catch((err) => {
        toast.error(`術語提取失敗：${err instanceof Error ? err.message : 'Unknown error'}`);
        setTerms([]);
      })
      .finally(() => setLoading(false));
  }, [open, messageId, messages, originalText]);

  const toggleTerm = (index: number) => {
    setTerms((prev) =>
      prev.map((t, i) => (i === index ? { ...t, selected: !t.selected } : t))
    );
  };

  const updateTerm = (index: number, field: keyof ExtractedTerm, value: string) => {
    setTerms((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    );
  };

  const handleConfirm = async () => {
    const selected = terms.filter((t) => t.selected);
    if (selected.length === 0) {
      onClose();
      return;
    }

    const metadata = useTranslatorStore.getState().metadata;
    const glossaryTerms: GlossaryTerm[] = selected.map((t) => ({
      id: crypto.randomUUID(),
      original: t.original,
      translation: t.translation,
      sanskrit: t.sanskrit || '',
      language: 'sanskrit' as const,
      category: t.category as GlossaryTerm['category'],
      notes: t.notes || '',
      added_at: new Date().toISOString(),
      source_article: metadata.title || '',
    }));

    try {
      await useGlossaryStore.getState().addTermsBatch(glossaryTerms);
      toast.success(`已加入 ${selected.length} 個術語`);
    } catch (err) {
      toast.error(`術語加入失敗：${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>術語提取</DialogTitle>
          <DialogDescription>
            以下為自動提取的佛學術語，請確認後加入術語表。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">正在提取術語...</span>
            </div>
          ) : terms.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              未提取到新術語
            </div>
          ) : (
            <div className="space-y-2">
              {terms.map((term, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 rounded-md border p-2 text-sm ${
                    !term.selected ? 'opacity-50' : ''
                  }`}
                >
                  <Checkbox
                    checked={term.selected}
                    onCheckedChange={() => toggleTerm(i)}
                    className="mt-1"
                  />
                  <div className="flex-1 grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                    <Input
                      value={term.original}
                      onChange={(e) => updateTerm(i, 'original', e.target.value)}
                      className="h-7 text-xs"
                      placeholder="原文"
                    />
                    <Input
                      value={term.translation}
                      onChange={(e) => updateTerm(i, 'translation', e.target.value)}
                      className="h-7 text-xs"
                      placeholder="中文"
                    />
                    <Input
                      value={term.sanskrit}
                      onChange={(e) => updateTerm(i, 'sanskrit', e.target.value)}
                      className="h-7 text-xs"
                      placeholder="梵文"
                    />
                    <Select
                      value={term.category}
                      onValueChange={(v) => updateTerm(i, 'category', v)}
                    >
                      <SelectTrigger size="sm" className="h-7 text-xs w-[80px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            跳過
          </Button>
          <Button onClick={handleConfirm} disabled={loading || terms.filter((t) => t.selected).length === 0}>
            確認加入 ({terms.filter((t) => t.selected).length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
