import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Square, Languages, RotateCcw } from 'lucide-react';
import { useTranslatorStore } from '@/stores/translatorStore';
import { ModelSelector } from './ModelSelector';
import { ChatMessage } from './ChatMessage';
import { TermExtractor } from './TermExtractor';

export function ChatPanel() {
  const {
    messages,
    isLoading,
    originalText,
    importedText,
    inputMode,
    sendMessage,
    adoptVersion,
    stopGeneration,
    reset,
  } = useTranslatorStore();
  const [input, setInput] = useState('');
  const [showTermExtractor, setShowTermExtractor] = useState(false);
  const [adoptedMessageId, setAdoptedMessageId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (isLoading) return;
    const text = input.trim();
    if (!text) return;
    setInput('');
    sendMessage(text);
  };

  const handleTranslate = () => {
    const text = inputMode === 'import' ? importedText : originalText;
    if (!text.trim()) return;
    sendMessage(text).catch((err) => {
      console.error('[Translate] sendMessage error:', err);
    });
  };

  const handleAdopt = (messageId: string) => {
    adoptVersion(messageId);
    setAdoptedMessageId(messageId);
    setShowTermExtractor(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasSource = inputMode === 'import' ? importedText.trim() : originalText.trim();

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ModelSelector />

      {/* Messages area */}
      <ScrollArea className="min-h-0 flex-1" ref={scrollRef}>
        <div className="space-y-3 p-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
              <Languages className="mb-3 h-8 w-8" />
              <p>在左側輸入原文，然後點擊「翻譯」開始</p>
              <p className="text-xs">或在下方輸入修正指令</p>
            </div>
          )}

          {messages
            .filter((m) => m.role !== 'system')
            .map((msg, idx, arr) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onAdopt={msg.role === 'assistant' ? () => handleAdopt(msg.id) : undefined}
                isStreaming={isLoading && idx === arr.length - 1 && msg.role === 'assistant'}
              />
            ))}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t p-3">
        {messages.length === 0 && hasSource ? (
          <Button onClick={handleTranslate} className="w-full" disabled={isLoading}>
            <Languages className="mr-2 h-4 w-4" />
            翻譯
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="輸入修正指令... (Ctrl+Enter 發送)"
                className="min-h-[60px] resize-none text-sm"
                disabled={isLoading}
              />
              <div className="flex flex-col gap-1">
                {isLoading ? (
                  <Button variant="destructive" size="icon" onClick={stopGeneration}>
                    <Square className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={!input.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {hasSource && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={handleTranslate}
                  disabled={isLoading}
                >
                  <Languages className="mr-1 h-3 w-3" />
                  重新翻譯
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => { reset(); setInput(''); setAdoptedMessageId(null); }}
                disabled={isLoading}
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                清除對話
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Term Extractor Modal */}
      <TermExtractor
        open={showTermExtractor}
        onClose={() => setShowTermExtractor(false)}
        messageId={adoptedMessageId}
      />
    </div>
  );
}
