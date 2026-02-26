import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, ChevronDown, ChevronUp, User, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ChatMessage as ChatMessageType } from '@/types/chat';

interface ChatMessageProps {
  message: ChatMessageType;
  onAdopt?: () => void;
  isStreaming?: boolean;
}

const COLLAPSE_THRESHOLD = 600;

export function ChatMessage({ message, onAdopt, isStreaming }: ChatMessageProps) {
  const [expanded, setExpanded] = useState(true);
  const isUser = message.role === 'user';
  const isError = !isUser && message.content.startsWith('**Error:**');
  const isLong = message.content.length > COLLAPSE_THRESHOLD;
  const showCollapsed = isLong && !expanded;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[90%] space-y-1 ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Avatar + role label */}
        <div className={`flex items-center gap-1.5 text-xs text-muted-foreground ${isUser ? 'flex-row-reverse' : ''}`}>
          {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
          <span>{isUser ? '你' : 'AI'}</span>
          {message.model && (
            <Badge variant="outline" className="text-[10px] font-normal ml-1">
              {message.model}
            </Badge>
          )}
        </div>

        {/* Message bubble */}
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            isUser
              ? 'bg-primary text-primary-foreground'
              : isError
                ? 'bg-destructive/10 border border-destructive/30 text-destructive'
                : 'bg-muted'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className={showCollapsed ? 'max-h-32 overflow-hidden relative' : ''}>
              <div className="prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
              {showCollapsed && (
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-muted to-transparent" />
              )}
            </div>
          )}
          {isStreaming && <span className="inline-block w-1.5 h-4 bg-foreground/60 animate-pulse ml-0.5" />}
        </div>

        {/* Actions for assistant messages */}
        {!isUser && !isStreaming && message.content && (
          <div className="flex items-center gap-2">
            {onAdopt && (
              <Button variant="outline" size="xs" className="text-xs h-6" onClick={onAdopt}>
                <Check className="size-3 mr-1" />
                採用此版本
              </Button>
            )}
            {isLong && (
              <Button
                variant="ghost"
                size="xs"
                className="text-xs h-6"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <><ChevronUp className="size-3 mr-1" />收合</>
                ) : (
                  <><ChevronDown className="size-3 mr-1" />展開</>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
