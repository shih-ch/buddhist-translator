import { useRef, useState } from 'react';
import { Download, Upload, Archive, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  collectSettings,
  createFullBackup,
  downloadBackup,
  parseBackup,
  restoreSettings,
  type BackupFile,
  type BackupProgress,
} from '@/services/backup';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function describeBackup(backup: BackupFile): string {
  const parts = [`${Object.keys(backup.settings).length} 筆設定`];
  if (backup.articles.length) parts.push(`${backup.articles.length} 篇文章`);
  if (backup.glossary) parts.push(`${backup.glossary.terms.length} 個術語`);
  if (backup.files.length) parts.push(`${backup.files.length} 個其他檔案`);
  return parts.join('、');
}

export function DataExportImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [progress, setProgress] = useState<BackupProgress | null>(null);

  const runBackup = async (includeRepo: boolean) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({ done: 0, total: 0, label: '準備中…' });
    try {
      const backup = await createFullBackup({
        includeSensitive: includeSecrets,
        includeRepo,
        signal: controller.signal,
        onProgress: setProgress,
      });
      const name = includeRepo ? 'bt-backup' : 'bt-settings';
      downloadBackup(backup, `${name}-${today()}.json`);
      toast.success(
        `已備份：${describeBackup(backup)}${includeSecrets ? '（含 API Keys）' : ''}` +
          (backup.skipped.length ? `，略過 ${backup.skipped.length} 個檔案` : '')
      );
    } catch (err) {
      toast.error(`備份失敗：${err instanceof Error ? err.message : '未知錯誤'}`);
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset first so the same file can be picked again after a failed import.
    e.target.value = '';
    if (!file) return;

    try {
      const parsed = parseBackup(await file.text());
      const settings = parsed.kind === 'full' ? parsed.backup.settings : parsed.settings;
      const summary =
        parsed.kind === 'full'
          ? `此備份含 ${describeBackup(parsed.backup)}（建立於 ${parsed.backup.created_at.slice(0, 10)}）。\n\n` +
            '只有設定會寫回本機；文章與術語表僅供離線閱讀，不會推回 GitHub。\n\n'
          : `此檔案含 ${Object.keys(settings).length} 筆設定。\n\n`;

      if (!confirm(`${summary}確定要覆蓋目前的本機設定嗎？`)) return;

      const count = restoreSettings(settings);
      toast.success(`已還原 ${count} 筆設定，頁面將重新整理`);
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      toast.error(`匯入失敗：${err instanceof Error ? err.message : '檔案格式錯誤'}`);
    }
  };

  const busy = progress !== null;
  const settingsCount = Object.keys(collectSettings(includeSecrets)).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>備份 / 還原</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          「完整備份」會抓下 GitHub 上全部文章、術語表與設定檔，連同本機設定存成單一 JSON；
          即使 GitHub 儲存庫消失也留得住內容。「只備份設定」則不連線，僅存本機資料。
          還原時只會寫回本機設定，文章不會推回 GitHub。
        </p>

        <div className="flex items-center gap-2">
          <Checkbox
            id="backup-secrets"
            checked={includeSecrets}
            onCheckedChange={(v) => setIncludeSecrets(v === true)}
            disabled={busy}
          />
          <Label htmlFor="backup-secrets" className="text-xs font-normal">
            包含 API Keys 與 GitHub / Notion Token
          </Label>
          {includeSecrets && (
            <span className="text-xs text-destructive">備份檔會含明文金鑰，請妥善保管</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => runBackup(true)} disabled={busy}>
            <Archive className="mr-1 h-3 w-3" />
            完整備份
          </Button>
          <Button variant="outline" size="sm" onClick={() => runBackup(false)} disabled={busy}>
            <Download className="mr-1 h-3 w-3" />
            只備份設定（{settingsCount}）
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <Upload className="mr-1 h-3 w-3" />
            還原
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
        </div>

        {progress && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex-1 truncate">
                {progress.total > 0
                  ? `備份中 ${progress.done}/${progress.total}：${progress.label}`
                  : progress.label}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => abortRef.current?.abort()}
              >
                <X className="mr-1 h-3 w-3" />
                取消
              </Button>
            </div>
            <div className="h-1 w-full overflow-hidden rounded bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : '0%',
                }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
