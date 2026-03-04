import { useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const BT_PREFIX = 'bt-';
const SENSITIVE_KEYS = ['bt-apikeys', 'bt-github-token'];

function collectData(includeSensitive: boolean): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(BT_PREFIX)) {
      if (!includeSensitive && SENSITIVE_KEYS.includes(key)) continue;
      result[key] = localStorage.getItem(key)!;
    }
  }
  return result;
}

export function DataExportImport() {
  const fileRef = useRef<HTMLInputElement>(null);

  const doExport = (includeSensitive: boolean) => {
    const data = collectData(includeSensitive);
    const count = Object.keys(data).length;
    if (count === 0) {
      toast.error('沒有找到任何設定資料');
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bt-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`已匯出 ${count} 筆設定${includeSensitive ? '（含 API Keys）' : ''}`);
  };

  const handleExport = () => doExport(false);
  const handleExportWithKeys = () => {
    if (confirm('匯出檔案將包含 API Keys 和 GitHub Token，請妥善保管。確定要包含？')) {
      doExport(true);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as Record<string, string>;
        let count = 0;
        for (const [key, val] of Object.entries(data)) {
          if (key.startsWith(BT_PREFIX) && typeof val === 'string') {
            localStorage.setItem(key, val);
            count++;
          }
        }
        toast.success(`已匯入 ${count} 筆設定，頁面將重新整理`);
        setTimeout(() => location.reload(), 800);
      } catch {
        toast.error('檔案格式錯誤');
      }
    };
    reader.readAsText(file);
    // Reset so same file can be selected again
    e.target.value = '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>設定匯出 / 匯入</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          匯出本地設定（AI 功能設定、翻譯預設等）為 JSON 檔案。預設不含 API Keys，可選擇包含。
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-3 w-3" />
            匯出設定
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportWithKeys}>
            <Download className="mr-1 h-3 w-3" />
            含 Keys
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1 h-3 w-3" />
            匯入設定
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </CardContent>
    </Card>
  );
}
