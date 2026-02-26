import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage as ChatMessageType } from '@/types/chat';

interface ChatMessageProps {
  message: ChatMessageType;
  onAdopt?: () => void;
  isStreaming?: boolean;
}

export function ChatMessage({ message, onAdopt, isStreaming }: ChatMessageProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isLong = message.content.length > 500;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[90%] rounded-lg px-3 py-2 ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        }`}
      >
        {/* Content */}
        <div
          className={`prose prose-sm dark:prose-invert max-w-none text-sm ${
            collapsed ? 'line-clamp-3' : ''
          }`}
        >
          {isUser ? (
            <p className="m-0 whitespace-pre-wrap">{message.content}</p>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          )}
          {isStreaming && <span className="inline-block h-4 w-1 animate-pulse bg-current" />}
        </div>

        {/* Actions for assistant messages */}
        {!isUser && message.content && (
          <div className="mt-2 flex items-center gap-2 border-t pt-2">
            {onAdopt && !isStreaming && (
              <Button variant="outline" size="xs" onClick={onAdopt}>
                <Check className="mr-1 h-3 w-3" />
                採用此版本
              </Button>
            )}
            <Button variant="ghost" size="xs" onClick={handleCopy}>
              {copied ? (
                <Check className="mr-1 h-3 w-3" />
              ) : (
                <Copy className="mr-1 h-3 w-3" />
              )}
              {copied ? '已複製' : '複製'}
            </Button>
            {isLong && (
              <Button variant="ghost" size="xs" onClick={() => setCollapsed(!collapsed)}>
                {collapsed ? (
                  <ChevronDown className="mr-1 h-3 w-3" />
                ) : (
                  <ChevronUp className="mr-1 h-3 w-3" />
                )}
                {collapsed ? '展開' : '收合'}
              </Button>
            )}
            {message.model && (
              <Badge variant="secondary" className="ml-auto text-[10px]">
                {message.model}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
