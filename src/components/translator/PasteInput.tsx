import { useCallback, useEffect, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useTranslatorStore } from '@/stores/translatorStore';
import { detectLanguage, getLanguageName } from '@/services/languageDetect';

export function PasteInput() {
  const { originalText, setOriginalText, updateMetadata } = useTranslatorStore();
  const [detectedLang, setDetectedLang] = useState('');

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setOriginalText(e.target.value);
    },
    [setOriginalText]
  );

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

  return (
    <div className="flex h-full flex-col p-3">
      <Textarea
        value={originalText}
        onChange={handleChange}
        placeholder="貼上原文..."
        className="min-h-0 flex-1 resize-none font-mono text-sm"
      />
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{charCount} 字</span>
        {detectedLang && (
          <Badge variant="secondary" className="text-xs">
            偵測：{getLanguageName(detectedLang)}
          </Badge>
        )}
      </div>
    </div>
  );
}
