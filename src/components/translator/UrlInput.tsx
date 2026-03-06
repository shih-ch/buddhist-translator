import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Globe } from 'lucide-react';
import { useTranslatorStore } from '@/stores/translatorStore';
import { fetchWebPage, parseHtmlContent } from '@/services/contentParser';
import { toast } from 'sonner';

export function UrlInput() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchedText, setFetchedText] = useState('');
  const setOriginalText = useTranslatorStore((s) => s.setOriginalText);
  const updateMetadata = useTranslatorStore((s) => s.updateMetadata);

  const handleFetch = async () => {
    if (!url.trim()) return;
    setLoading(true);

    try {
      const html = await fetchWebPage(url);
      const { title, text, metadata } = parseHtmlContent(html);

      setFetchedText(text);
      setOriginalText(text);

      const metadataUpdates: Record<string, string> = { source: url };
      if (title) metadataUpdates.title = title;
      if (metadata.author) metadataUpdates.author = metadata.author;
      if (metadata.date) metadataUpdates.date = metadata.date;
      if (metadata.language) metadataUpdates.original_language = metadata.language;
      updateMetadata(metadataUpdates);
    } catch (err) {
      toast.error(`擷取失敗：${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFetchedText(e.target.value);
    setOriginalText(e.target.value);
  };

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Globe className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="pl-8"
          />
        </div>
        <Button onClick={handleFetch} disabled={loading || !url.trim()} size="sm">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '擷取'}
        </Button>
      </div>

      {fetchedText && (
        <Textarea
          value={fetchedText}
          onChange={handleTextChange}
          className="min-h-0 flex-1 resize-none font-mono text-sm"
          placeholder="擷取的內容會顯示在這裡..."
        />
      )}

      {!fetchedText && (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          輸入網址後點擊「擷取」
        </div>
      )}
    </div>
  );
}
