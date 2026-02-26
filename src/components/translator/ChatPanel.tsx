import { useRef, useEffect, useState } from 'react';
import { Send, Square, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslatorStore } from '@/stores/translatorStore';
import { ModelSelector } from './ModelSelector';
import { ChatMessage } from './ChatMessage';
import { TermExtractor } from './TermExtractor';
import { toast } from 'sonner';

export function ChatPanel() {
  const [input, setInput] = useState('');
  const [termExtractMsg, setTermExtractMsg] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = useTranslatorStore((s) => s.messages);
  const isLoading = useTranslatorStore((s) => s.isLoading);
  const originalText = useTranslatorStore((s) => s.originalText);
  const sendMessage = useTranslatorStore((s) => s.sendMessage);
  const adoptVersion = useTranslatorStore((s) => s.adoptVersion);
  const stopGeneration = useTranslatorStore((s) => s.stopGeneration);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    try {
      await sendMessage(text);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '傳送失敗');
    }
  };

  const handleTranslate = async () => {
    if (!originalText.trim()) return;
    try {
      await sendMessage(originalText);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '翻譯失敗');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAdopt = (messageId: string) => {
    adoptVersion(messageId);
    // Show term extraction dialog
    const msg = messages.find((m) => m.id === messageId);
    if (msg) {
      setTermExtractMsg(messageId);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ModelSelector />

      {/* Messages area */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="space-y-4 p-3">
          {!hasMessages && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm">
              <Languages className="size-10 mb-3 opacity-40" />
              <p>在左側輸入原文後點擊「翻譯」開始</p>
              <p className="text-xs mt-1">或直接在下方輸入訊息</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              isStreaming={isLoading && i === messages.length - 1 && msg.role === 'assistant'}
              onAdopt={msg.role === 'assistant' && msg.content ? () => handleAdopt(msg.id) : undefined}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t p-3 space-y-2">
        {!hasMessages && originalText.trim() && (
          <Button className="w-full" onClick={handleTranslate} disabled={isLoading}>
            <Languages className="size-4 mr-2" />
            翻譯
          </Button>
        )}

        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasMessages ? '輸入修正指令...' : '或直接輸入訊息...'}
            className="min-h-[2.5rem] max-h-24 resize-none text-sm"
            disabled={isLoading}
            rows={1}
          />
          {isLoading ? (
            <Button variant="destructive" size="icon" className="shrink-0" onClick={stopGeneration}>
              <Square className="size-4" />
            </Button>
          ) : (
            <Button size="icon" className="shrink-0" onClick={handleSend} disabled={!input.trim()}>
              <Send className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Term extraction dialog */}
      <TermExtractor
        open={termExtractMsg !== null}
        onClose={() => setTermExtractMsg(null)}
        messageId={termExtractMsg}
      />
    </div>
  );
}
