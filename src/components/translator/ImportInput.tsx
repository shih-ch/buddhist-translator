import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles } from 'lucide-react';
import { useTranslatorStore } from '@/stores/translatorStore';
import { useAIFunctionsStore } from '@/stores/aiFunctionsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { trackedCallFunction } from '@/services/ai/trackedCall';
import { buildFormattingMessages } from '@/services/ai/promptBuilder';
import { parseMarkdown, assembleMarkdown } from '@/services/markdownUtils';
import { toast } from 'sonner';

export function ImportInput() {
  const { importedText, setImportedText, setOriginalText, updateMetadata, setPreviewContent, metadata } =
    useTranslatorStore();
  const [originalForImport, setOriginalForImport] = useState('');
  const [formatting, setFormatting] = useState(false);

  const handleTranslatedChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setImportedText(text);

    // Auto-detect frontmatter
    if (text.trimStart().startsWith('---')) {
      try {
        const parsed = parseMarkdown(text);
        if (parsed.frontmatter.title) {
          updateMetadata(parsed.frontmatter);
        }
        if (parsed.originalText) {
          setOriginalForImport(parsed.originalText);
          setOriginalText(parsed.originalText);
        }
      } catch {
        // Not valid frontmatter, ignore
      }
    }
  };

  const handleOriginalChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setOriginalForImport(e.target.value);
    setOriginalText(e.target.value);
  };

  const handleFormat = async () => {
    if (!importedText.trim()) return;
    const fnConfig = useAIFunctionsStore.getState().getFunctionConfig('formatting');
    const apiKeys = useSettingsStore.getState().apiKeys;
    if (!apiKeys[fnConfig.provider]) {
      toast.error('請先在設定中填入 API Key');
      return;
    }
    setFormatting(true);
    try {
      const messages = buildFormattingMessages(fnConfig.prompt, importedText, originalForImport || undefined);
      const response = await trackedCallFunction(fnConfig, apiKeys, messages, undefined, 'formatting');

      // Parse AI response as JSON
      let jsonStr = response.content.trim();
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();

      const result = JSON.parse(jsonStr) as {
        title: string;
        tags: string[];
        formatted_content: string;
      };

      if (result.title && !metadata.title) {
        updateMetadata({ title: result.title, tags: result.tags });
      }
      const md = assembleMarkdown(
        { ...metadata, title: result.title || metadata.title, tags: result.tags || metadata.tags },
        result.formatted_content,
        originalForImport || undefined
      );
      setPreviewContent(md);
    } catch (err) {
      toast.error(`格式整理失敗：${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setFormatting(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="flex flex-1 flex-col gap-1">
        <Label className="text-xs text-muted-foreground">已翻譯的中文內容</Label>
        <Textarea
          value={importedText}
          onChange={handleTranslatedChange}
          placeholder="貼上已翻譯的中文內容..."
          className="min-h-0 flex-1 resize-none font-mono text-sm"
        />
      </div>

      <div className="flex flex-col gap-1" style={{ flex: '0.4' }}>
        <Label className="text-xs text-muted-foreground">原文（選填）</Label>
        <Textarea
          value={originalForImport}
          onChange={handleOriginalChange}
          placeholder="貼上原文..."
          className="min-h-0 flex-1 resize-none font-mono text-sm"
        />
      </div>

      <Button onClick={handleFormat} disabled={formatting || !importedText.trim()} className="w-full">
        {formatting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" />
        )}
        整理格式
      </Button>
    </div>
  );
}
