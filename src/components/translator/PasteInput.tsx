import { useCallback, useEffect, useState } from 'react';
import { Eraser, Loader2, Sparkles } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslatorStore } from '@/stores/translatorStore';
import { useAIFunctionsStore } from '@/stores/aiFunctionsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { trackedCallFunction } from '@/services/ai/trackedCall';
import { detectLanguage, getLanguageName } from '@/services/languageDetect';
import { toast } from 'sonner';

/**
 * Clean common noise from pasted Buddhist text sources:
 * - `+++` section/page separators (CBETA, 84000, etc.)
 * - `---` horizontal rules (when on a line by itself)
 * - `===` separators
 * - `***` separators
 * - `_ _ _` separators
 * - Page/folio markers like [p.123], [123a], {T01n0001_p0001a01}
 * - Multiple consecutive blank lines → max 2
 */
function cleanPastedText(text: string): { cleaned: string; removedCount: number } {
  let removedCount = 0

  const cleaned = text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      // Lines that are only +, -, =, *, _ separators (3+ chars)
      if (/^[+]{3,}$/.test(trimmed) ||
          /^[-]{3,}$/.test(trimmed) ||
          /^[=]{3,}$/.test(trimmed) ||
          /^[*]{3,}$/.test(trimmed) ||
          /^[_ ]{3,}$/.test(trimmed)) {
        removedCount++
        return ''
      }
      return line
    })
    .join('\n')
    // Collapse 3+ consecutive blank lines into 2
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { cleaned, removedCount }
}

export function PasteInput() {
  const { originalText, setOriginalText, updateMetadata } = useTranslatorStore();
  const [detectedLang, setDetectedLang] = useState('');
  const [formatting, setFormatting] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setOriginalText(e.target.value);
    },
    [setOriginalText]
  );

  // Auto-clean on paste
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pasted = e.clipboardData.getData('text');
      if (!pasted) return;

      const { cleaned, removedCount } = cleanPastedText(pasted);
      if (removedCount > 0) {
        e.preventDefault();
        setOriginalText(cleaned);
        toast.success(`已自動清除 ${removedCount} 處分隔線`);
      }
    },
    [setOriginalText]
  );

  // Manual clean button
  const handleClean = useCallback(() => {
    const { cleaned, removedCount } = cleanPastedText(originalText);
    if (removedCount > 0) {
      setOriginalText(cleaned);
      toast.success(`已清除 ${removedCount} 處分隔線`);
    } else {
      toast.info('沒有需要清理的內容');
    }
  }, [originalText, setOriginalText]);

  const handleAIFormat = useCallback(async () => {
    if (!originalText.trim()) return;
    const fnConfig = useAIFunctionsStore.getState().getFunctionConfig('source_formatting');
    const apiKeys = useSettingsStore.getState().apiKeys;
    if (!apiKeys[fnConfig.provider]) {
      toast.error('請先在設定中填入 API Key');
      return;
    }
    setFormatting(true);
    try {
      const messages = [
        { role: 'system' as const, content: fnConfig.prompt },
        { role: 'user' as const, content: originalText },
      ];
      const response = await trackedCallFunction(fnConfig, apiKeys, messages, undefined, 'source_formatting');
      setOriginalText(response.content.trim());
      toast.success('原文排版完成');
    } catch (err) {
      toast.error(`排版失敗：${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setFormatting(false);
    }
  }, [originalText, setOriginalText]);

  useEffect(() => {
    if (originalText.trim().length > 20) {
      const lang = detectLanguage(originalText);
      setDetectedLang(lang);
      updateMetadata({ original_language: lang });
    } else {
      setDetectedLang('');
    }
  }, [originalText, updateMetadata]);

  const charCount = originalText.length;
  const hasNoise = /^[+]{3,}$/m.test(originalText) ||
                   /^[-]{3,}$/m.test(originalText) ||
                   /^[=]{3,}$/m.test(originalText);

  return (
    <div className="flex h-full flex-col p-3">
      <Textarea
        value={originalText}
        onChange={handleChange}
        onPaste={handlePaste}
        placeholder="貼上原文..."
        className="min-h-0 flex-1 resize-none font-mono text-sm"
      />
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>{charCount} 字</span>
          {hasNoise && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-[10px] px-1.5 text-orange-600 hover:text-orange-700"
              onClick={handleClean}
            >
              <Eraser className="h-3 w-3 mr-0.5" />
              清除分隔線
            </Button>
          )}
          {charCount > 20 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-[10px] px-1.5"
              onClick={handleAIFormat}
              disabled={formatting}
            >
              {formatting ? (
                <Loader2 className="h-3 w-3 mr-0.5 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3 mr-0.5" />
              )}
              AI 排版
            </Button>
          )}
        </div>
        {detectedLang && (
          <Badge variant="secondary" className="text-xs">
            偵測：{getLanguageName(detectedLang)}
          </Badge>
        )}
      </div>
    </div>
  );
}
