import { useState } from 'react';
import { useTranslatorStore, type SavedVersion } from '@/stores/translatorStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Trash2, Download, GitCompare, Save } from 'lucide-react';
import { computeDiff, type DiffLine } from '@/utils/simpleDiff';

interface VersionManagerProps {
  open: boolean;
  onClose: () => void;
}

export function VersionManager({ open, onClose }: VersionManagerProps) {
  const savedVersions = useTranslatorStore((s) => s.savedVersions);
  const previewContent = useTranslatorStore((s) => s.previewContent);
  const saveVersion = useTranslatorStore((s) => s.saveVersion);
  const loadVersion = useTranslatorStore((s) => s.loadVersion);
  const deleteVersion = useTranslatorStore((s) => s.deleteVersion);
  const [newName, setNewName] = useState('');
  const [diffPair, setDiffPair] = useState<[number, number] | null>(null);
  const [diffLines, setDiffLines] = useState<DiffLine[]>([]);

  const handleSave = () => {
    saveVersion(newName.trim() || undefined);
    setNewName('');
  };

  const handleCompare = (idxA: number, idxB: number) => {
    const a = savedVersions[idxA]?.content ?? '';
    const b = savedVersions[idxB]?.content ?? '';
    setDiffLines(computeDiff(a, b));
    setDiffPair([idxA, idxB]);
  };

  const handleCompareCurrent = (idx: number) => {
    const a = savedVersions[idx]?.content ?? '';
    setDiffLines(computeDiff(a, previewContent));
    setDiffPair([idx, -1]);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const charCount = (content: string) => {
    return content.replace(/\s/g, '').length;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>翻譯版本管理</DialogTitle>
        </DialogHeader>

        {/* Save current version */}
        {previewContent && (
          <div className="flex gap-2 items-center">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="版本名稱（可留空自動命名）"
              className="flex-1"
              autoComplete="off"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <Button onClick={handleSave} size="sm">
              <Save className="size-3 mr-1" />
              儲存當前版本
            </Button>
          </div>
        )}

        {/* Version list */}
        <ScrollArea className="flex-1 min-h-0">
          {savedVersions.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              尚無儲存的版本
            </div>
          ) : (
            <div className="space-y-2">
              {savedVersions.map((v: SavedVersion, idx: number) => (
                <div
                  key={v.id}
                  className="flex items-center gap-2 rounded border p-2 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{v.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {v.model} · {formatTime(v.timestamp)} · {charCount(v.content).toLocaleString()} 字
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => { loadVersion(idx); onClose(); }}
                    title="載入此版本"
                  >
                    <Download className="size-3" />
                  </Button>
                  {previewContent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => handleCompareCurrent(idx)}
                      title="與當前版本比較"
                    >
                      <GitCompare className="size-3" />
                    </Button>
                  )}
                  {idx > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => handleCompare(idx - 1, idx)}
                      title="與上一版本比較"
                    >
                      <GitCompare className="size-3 text-blue-500" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2 text-destructive"
                    onClick={() => deleteVersion(idx)}
                    title="刪除"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Diff view */}
        {diffPair && diffLines.length > 0 && (
          <div className="border-t pt-2">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium">
                比較：{savedVersions[diffPair[0]]?.name ?? '?'} ↔{' '}
                {diffPair[1] === -1 ? '當前版本' : savedVersions[diffPair[1]]?.name ?? '?'}
              </div>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setDiffPair(null)}>
                關閉
              </Button>
            </div>
            <ScrollArea className="max-h-60">
              <pre className="text-xs font-mono whitespace-pre-wrap">
                {diffLines.map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.type === 'add'
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : line.type === 'remove'
                          ? 'bg-red-100 dark:bg-red-900/30'
                          : ''
                    }
                  >
                    {line.type === 'add' ? '+ ' : line.type === 'remove' ? '- ' : '  '}
                    {line.content}
                  </div>
                ))}
              </pre>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
