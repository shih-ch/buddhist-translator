import { useRef, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Minus,
  Table,
  Undo2,
  Redo2,
  Sparkles,
  ArrowRightLeft,
  Loader2,
} from 'lucide-react';
import { useAIFunctionsStore } from '@/stores/aiFunctionsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTranslatorStore } from '@/stores/translatorStore';
import { trackedCallFunction } from '@/services/ai/trackedCall';
import { toast } from 'sonner';

interface MarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
}

type InsertAction = {
  type: 'wrap';
  before: string;
  after: string;
} | {
  type: 'line-prefix';
  prefix: string;
} | {
  type: 'insert';
  text: string;
};

const TOOLBAR_ITEMS: { icon: React.ElementType; label: string; action: InsertAction }[] = [
  { icon: Bold, label: '粗體', action: { type: 'wrap', before: '**', after: '**' } },
  { icon: Italic, label: '斜體', action: { type: 'wrap', before: '*', after: '*' } },
  { icon: Heading1, label: 'H1', action: { type: 'line-prefix', prefix: '# ' } },
  { icon: Heading2, label: 'H2', action: { type: 'line-prefix', prefix: '## ' } },
  { icon: Heading3, label: 'H3', action: { type: 'line-prefix', prefix: '### ' } },
  { icon: List, label: '無序列表', action: { type: 'line-prefix', prefix: '- ' } },
  { icon: ListOrdered, label: '有序列表', action: { type: 'line-prefix', prefix: '1. ' } },
  { icon: Quote, label: '引用', action: { type: 'line-prefix', prefix: '> ' } },
  { icon: Code, label: '程式碼', action: { type: 'wrap', before: '`', after: '`' } },
  { icon: Minus, label: '分隔線', action: { type: 'insert', text: '\n---\n' } },
  {
    icon: Table,
    label: '表格',
    action: {
      type: 'insert',
      text: '\n| 欄位1 | 欄位2 | 欄位3 |\n| --- | --- | --- |\n| | | |\n',
    },
  },
];

export function MarkdownEditor({ content, onChange }: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<{ stack: string[]; index: number }>({
    stack: [content],
    index: 0,
  });
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number; text: string } | null>(null);
  const [formatting, setFormatting] = useState(false);

  const pushHistory = useCallback((newContent: string) => {
    const h = historyRef.current;
    // Trim future states if we're not at the end
    h.stack = h.stack.slice(0, h.index + 1);
    h.stack.push(newContent);
    h.index = h.stack.length - 1;
    // Keep history manageable
    if (h.stack.length > 100) {
      h.stack = h.stack.slice(-50);
      h.index = h.stack.length - 1;
    }
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      pushHistory(val);
      onChange(val);
    },
    [onChange, pushHistory]
  );

  const applyAction = useCallback(
    (action: InsertAction) => {
      const ta = textareaRef.current;
      if (!ta) return;

      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = content.slice(start, end);
      let newContent: string;
      let cursorPos: number;

      if (action.type === 'wrap') {
        const wrapped = `${action.before}${selected || '文字'}${action.after}`;
        newContent = content.slice(0, start) + wrapped + content.slice(end);
        cursorPos = start + action.before.length + (selected ? selected.length : 2);
      } else if (action.type === 'line-prefix') {
        // Find the start of the current line
        const lineStart = content.lastIndexOf('\n', start - 1) + 1;
        newContent = content.slice(0, lineStart) + action.prefix + content.slice(lineStart);
        cursorPos = start + action.prefix.length;
      } else {
        newContent = content.slice(0, start) + action.text + content.slice(end);
        cursorPos = start + action.text.length;
      }

      pushHistory(newContent);
      onChange(newContent);

      // Restore cursor position
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(cursorPos, cursorPos);
      });
    },
    [content, onChange, pushHistory]
  );

  const handleUndo = useCallback(() => {
    const h = historyRef.current;
    if (h.index > 0) {
      h.index--;
      onChange(h.stack[h.index]);
    }
  }, [onChange]);

  const handleRedo = useCallback(() => {
    const h = historyRef.current;
    if (h.index < h.stack.length - 1) {
      h.index++;
      onChange(h.stack[h.index]);
    }
  }, [onChange]);

  const handleSelect = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start !== end) {
      setSelectedRange({ start, end, text: content.slice(start, end) });
    } else {
      setSelectedRange(null);
    }
  }, [content]);

  const handleAIFormat = useCallback(async () => {
    if (!content) return;
    const fnConfig = useAIFunctionsStore.getState().getFunctionConfig('source_formatting');
    const apiKeys = useSettingsStore.getState().apiKeys;
    if (!apiKeys[fnConfig.provider]) {
      toast.error('請先在設定中填入 API Key');
      return;
    }
    setFormatting(true);
    try {
      const fmMatch = content.match(/^(---\n[\s\S]*?\n---)\n*/);
      const frontmatterBlock = fmMatch ? fmMatch[1] : '';
      const body = fmMatch ? content.slice(fmMatch[0].length) : content;

      const messages = [
        { role: 'system' as const, content: fnConfig.prompt },
        { role: 'user' as const, content: body },
      ];
      const response = await trackedCallFunction(fnConfig, apiKeys, messages, undefined, 'source_formatting');
      const result = frontmatterBlock
        ? frontmatterBlock + '\n\n' + response.content.trim() + '\n'
        : response.content.trim() + '\n';
      pushHistory(result);
      onChange(result);
      toast.success('AI 排版完成');
    } catch (err) {
      toast.error(`排版失敗：${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setFormatting(false);
    }
  }, [content, onChange, pushHistory]);

  const handleSendToTranslation = useCallback(() => {
    if (!selectedRange) return;
    const store = useTranslatorStore.getState();
    // Store the replacement range so adoptVersion can splice back
    store.setReplacementRange({
      start: selectedRange.start,
      end: selectedRange.end,
      originalPreview: content,
    });
    // Send selected text to translation area and clear messages
    store.setOriginalText(selectedRange.text);
    useTranslatorStore.setState({ messages: [] });
    setSelectedRange(null);
    toast.info('已將選取段落送至翻譯區，請輸入指令後翻譯');
  }, [content, selectedRange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl+Z / Ctrl+Shift+Z for undo/redo
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
        } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
          e.preventDefault();
          handleRedo();
        } else if (e.key === 'b') {
          e.preventDefault();
          applyAction({ type: 'wrap', before: '**', after: '**' });
        } else if (e.key === 'i') {
          e.preventDefault();
          applyAction({ type: 'wrap', before: '*', after: '*' });
        }
      }
      // Tab inserts spaces instead of changing focus
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const newContent = content.slice(0, start) + '  ' + content.slice(end);
        pushHistory(newContent);
        onChange(newContent);
        requestAnimationFrame(() => {
          ta.setSelectionRange(start + 2, start + 2);
        });
      }
    },
    [content, onChange, pushHistory, handleUndo, handleRedo, applyAction]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1">
        {TOOLBAR_ITEMS.map((item) => (
          <Button
            key={item.label}
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title={item.label}
            onClick={() => applyAction(item.action)}
          >
            <item.icon className="h-3.5 w-3.5" />
          </Button>
        ))}
        <div className="mx-1 h-4 w-px bg-border" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="復原 (Ctrl+Z)"
          onClick={handleUndo}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="重做 (Ctrl+Y)"
          onClick={handleRedo}
        >
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
        <div className="mx-1 h-4 w-px bg-border" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="AI 排版"
          onClick={handleAIFormat}
          disabled={formatting || !content}
        >
          {formatting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="選取段落送往翻譯區"
          onClick={handleSendToTranslation}
          disabled={!selectedRange}
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Editor */}
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onSelect={handleSelect}
        placeholder="Markdown 原始碼..."
        className="min-h-0 flex-1 resize-none rounded-none border-0 font-mono text-xs leading-relaxed focus-visible:ring-0"
      />
    </div>
  );
}
