import { useRef, useState } from 'react';
import { ImagePlus, Trash2, Copy, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslatorStore, type ArticleImage } from '@/stores/translatorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { githubService } from '@/services/github';
import { toast } from 'sonner';

export function ImageUploader() {
  const articleImages = useTranslatorStore((s) => s.articleImages);
  const addArticleImage = useTranslatorStore((s) => s.addArticleImage);
  const removeArticleImage = useTranslatorStore((s) => s.removeArticleImage);
  const githubToken = useSettingsStore((s) => s.githubToken);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!githubToken) {
      toast.error('請先在設定中填入 GitHub Token');
      return;
    }

    setUploading(true);
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    let successCount = 0;
    for (const file of Array.from(files)) {
      try {
        // Sanitize filename: keep extension, replace spaces
        const safeName = file.name.replace(/\s+/g, '_');
        const filePath = `images/${year}/${month}/${safeName}`;

        toast.loading(`上傳中：${file.name}`, { id: `upload-${file.name}` });

        const result = await githubService.uploadImage(filePath, file);

        const img: ArticleImage = {
          name: file.name,
          url: result.url,
          path: result.path,
          sha: result.sha,
        };
        addArticleImage(img);
        successCount++;
        toast.success(`已上傳：${file.name}`, { id: `upload-${file.name}` });
      } catch (err) {
        toast.error(
          `上傳失敗：${file.name} — ${err instanceof Error ? err.message : 'Unknown error'}`,
          { id: `upload-${file.name}` }
        );
      }
    }

    if (successCount > 0) {
      toast.success(`已上傳 ${successCount} 張圖片`);
    }

    setUploading(false);
    // Reset file input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCopyMarkdown = async (img: ArticleImage) => {
    const md = `![${img.name}](${img.url})`;
    await navigator.clipboard.writeText(md);
    setCopiedPath(img.path);
    toast.success('已複製 Markdown 語法');
    setTimeout(() => setCopiedPath(null), 2000);
  };

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        className="text-xs"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || !githubToken}
      >
        {uploading ? (
          <Loader2 className="size-3 mr-1 animate-spin" />
        ) : (
          <ImagePlus className="size-3 mr-1" />
        )}
        {uploading ? '上傳中...' : '圖片'}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleFileSelect}
      />

      {articleImages.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {articleImages.map((img) => (
            <div
              key={img.path}
              className="flex items-center gap-2 rounded border p-1.5 text-xs"
            >
              <img
                src={img.url}
                alt={img.name}
                className="size-8 rounded object-cover shrink-0"
              />
              <span className="truncate flex-1" title={img.name}>
                {img.name}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 shrink-0"
                onClick={() => handleCopyMarkdown(img)}
                title="複製 Markdown"
              >
                {copiedPath === img.path ? (
                  <Check className="size-3" />
                ) : (
                  <Copy className="size-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 shrink-0 text-destructive"
                onClick={() => removeArticleImage(img.path)}
                title="移除"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
