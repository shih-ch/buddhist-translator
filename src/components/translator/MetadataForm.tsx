import { useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExternalLink, Eraser } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslatorStore } from '@/stores/translatorStore';
import { detectLanguageAdvanced, getLanguageName } from '@/services/languageDetect';

export function MetadataForm() {
  const { metadata, updateMetadata } = useTranslatorStore();
  const originalText = useTranslatorStore((s) => s.originalText);

  const detection = useMemo(
    () => detectLanguageAdvanced(originalText),
    [originalText]
  );

  // Auto-fill original_language when text changes and detection is confident
  useEffect(() => {
    if (detection.language !== 'other' && detection.confidence > 40) {
      updateMetadata({ original_language: detection.language });
    }
  }, [detection.language, detection.confidence]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-2 p-3">
      <div className="col-span-2 flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">標題</Label>
        <Input
          value={metadata.title}
          onChange={(e) => updateMetadata({ title: e.target.value })}
          placeholder="文章標題"
          className="h-8 text-sm"
        />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs text-muted-foreground"
          title="清除所有欄位"
          onClick={() => updateMetadata({
            title: '',
            author: '',
            source: '',
            date: new Date().toISOString().split('T')[0],
            original_language: 'ru',
            translator_model: '',
            tags: [],
          })}
        >
          <Eraser className="mr-1 h-3 w-3" />
          清除
        </Button>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">作者</Label>
        <Input
          value={metadata.author}
          onChange={(e) => updateMetadata({ author: e.target.value })}
          placeholder="作者"
          className="h-8 text-sm"
        />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">日期</Label>
        <Input
          type="date"
          value={metadata.date}
          onChange={(e) => updateMetadata({ date: e.target.value })}
          className="h-8 text-sm"
        />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">來源 URL</Label>
        <div className="flex items-center gap-1">
          <Input
            value={metadata.source}
            onChange={(e) => updateMetadata({ source: e.target.value })}
            placeholder="https://..."
            className="h-8 text-sm"
          />
          {metadata.source && /^https?:\/\//.test(metadata.source) && (
            <a
              href={metadata.source}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 rounded p-1.5 text-muted-foreground hover:text-primary hover:bg-muted"
              title="開啟連結"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">
          原文語言
          {detection.language !== 'other' && originalText.length > 20 && (
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 py-0 font-normal">
              {getLanguageName(detection.language)} {detection.confidence}%
            </Badge>
          )}
        </Label>
        <Select
          value={metadata.original_language}
          onValueChange={(v) => updateMetadata({ original_language: v })}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ru">俄文 (ru)</SelectItem>
            <SelectItem value="en">英文 (en)</SelectItem>
            <SelectItem value="bo">藏文 (bo)</SelectItem>
            <SelectItem value="zh">中文 (zh)</SelectItem>
            <SelectItem value="sa">梵文 (sa)</SelectItem>
            <SelectItem value="pi">巴利文 (pi)</SelectItem>
            <SelectItem value="other">其他</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
