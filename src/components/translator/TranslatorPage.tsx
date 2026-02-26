import { SourceInput } from './SourceInput';
import { TranslationParams } from './TranslationParams';
import { ChatPanel } from './ChatPanel';
import { PreviewPanel } from './PreviewPanel';

export function TranslatorPage() {
  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-cols-[1fr_1.6fr_1.4fr] gap-0">
      {/* Left: Source Input */}
      <div className="flex flex-col overflow-hidden border-r">
        <SourceInput />
      </div>

      {/* Center: Params + Chat */}
      <div className="flex flex-col overflow-hidden border-r">
        <TranslationParams />
        <ChatPanel />
      </div>

      {/* Right: Preview & Export */}
      <div className="flex flex-col overflow-hidden">
        <PreviewPanel />
      </div>
    </div>
  );
}
