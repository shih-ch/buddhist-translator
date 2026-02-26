import { Textarea } from '@/components/ui/textarea';

interface MarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
}

export function MarkdownEditor({ content, onChange }: MarkdownEditorProps) {
  return (
    <Textarea
      value={content}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Markdown 原始碼..."
      className="flex-1 min-h-0 h-full resize-none rounded-none border-0 font-mono text-xs leading-relaxed focus-visible:ring-0"
    />
  );
}
