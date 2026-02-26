import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslatorStore } from '@/stores/translatorStore';

export function MetadataForm() {
  const { metadata, updateMetadata } = useTranslatorStore();

  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-2 p-3">
      <div className="col-span-2">
        <Label className="text-xs text-muted-foreground">標題</Label>
        <Input
          value={metadata.title}
          onChange={(e) => updateMetadata({ title: e.target.value })}
          placeholder="文章標題"
          className="h-8 text-sm"
        />
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
        <Input
          value={metadata.source}
          onChange={(e) => updateMetadata({ source: e.target.value })}
          placeholder="https://..."
          className="h-8 text-sm"
        />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">原文語言</Label>
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
            <SelectItem value="other">其他</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
