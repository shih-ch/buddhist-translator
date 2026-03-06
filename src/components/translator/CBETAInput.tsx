import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, BookOpen } from 'lucide-react';
import { useTranslatorStore } from '@/stores/translatorStore';
import {
  validateCBETAId,
  fetchWorkInfo,
  fetchJuanText,
  fetchJuanList,
  type CBETAWorkInfo,
} from '@/services/cbetaApi';
import { toast } from 'sonner';

export function CBETAInput() {
  const [workId, setWorkId] = useState('');
  const [loading, setLoading] = useState(false);
  const [workInfo, setWorkInfo] = useState<CBETAWorkInfo | null>(null);
  const [juanList, setJuanList] = useState<number[]>([]);
  const [selectedJuan, setSelectedJuan] = useState<string>('');
  const [fetchedText, setFetchedText] = useState('');
  const setOriginalText = useTranslatorStore((s) => s.setOriginalText);
  const updateMetadata = useTranslatorStore((s) => s.updateMetadata);

  const handleLookup = async () => {
    const id = workId.trim();
    if (!id) return;
    if (!validateCBETAId(id)) {
      toast.error('經號格式不正確，例如：T0001、X0001');
      return;
    }

    setLoading(true);
    setWorkInfo(null);
    setJuanList([]);
    setSelectedJuan('');
    setFetchedText('');

    try {
      const [info, juans] = await Promise.all([
        fetchWorkInfo(id),
        fetchJuanList(id).catch(() => {
          // fallback: generate from work_info.juan
          return [] as number[];
        }),
      ]);

      setWorkInfo(info);

      // Use toc juans, or fallback to 1..info.juan
      const list = juans.length > 0 ? juans : Array.from({ length: info.juan }, (_, i) => i + 1);
      setJuanList(list);
      setSelectedJuan(String(list[0]));

      // Auto-fill metadata
      updateMetadata({
        title: info.title,
        author: info.creators || info.byline,
        source: `CBETA ${info.work}`,
        original_language: 'chinese',
      });

      toast.success(`${info.title}（${info.juan} 卷）`);
    } catch (err) {
      toast.error(`查詢失敗：${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchJuan = async () => {
    if (!workInfo || !selectedJuan) return;
    setLoading(true);
    try {
      const text = await fetchJuanText(workInfo.work, Number(selectedJuan));
      setFetchedText(text);
      setOriginalText(text);
      toast.success(`已擷取 ${workInfo.title} 卷${selectedJuan}`);
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
      {/* Work ID input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <BookOpen className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={workId}
            onChange={(e) => setWorkId(e.target.value)}
            placeholder="輸入經號，如 T0001"
            className="pl-8"
            autoComplete="off"
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
          />
        </div>
        <Button onClick={handleLookup} disabled={loading || !workId.trim()} size="sm">
          {loading && !workInfo ? <Loader2 className="h-4 w-4 animate-spin" /> : '查詢'}
        </Button>
      </div>

      {/* Work info & juan selector */}
      {workInfo && (
        <div className="flex flex-col gap-2">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">{workInfo.title}</span>
            <span className="ml-2">{workInfo.byline}</span>
            <span className="ml-2">({workInfo.category})</span>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={selectedJuan} onValueChange={setSelectedJuan}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="選擇卷數" />
              </SelectTrigger>
              <SelectContent>
                {juanList.map((j) => (
                  <SelectItem key={j} value={String(j)}>
                    卷 {j}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleFetchJuan} disabled={loading} size="sm">
              {loading && workInfo ? <Loader2 className="h-4 w-4 animate-spin" /> : '擷取經文'}
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">
              共 {juanList.length} 卷 / {workInfo.cjk_chars.toLocaleString()} 字
            </span>
          </div>
        </div>
      )}

      {/* Fetched text */}
      {fetchedText ? (
        <Textarea
          value={fetchedText}
          onChange={handleTextChange}
          className="min-h-0 flex-1 resize-none font-mono text-sm"
          placeholder="經文內容..."
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {workInfo ? '選擇卷數後點擊「擷取經文」' : '輸入 CBETA 經號（如 T0001）後查詢'}
        </div>
      )}
    </div>
  );
}
