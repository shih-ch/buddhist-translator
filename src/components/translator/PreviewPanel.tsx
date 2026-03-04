import { useState } from 'react';
import { FileText, FileCode } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslatorStore } from '@/stores/translatorStore';
import { MarkdownPreview } from './MarkdownPreview';
import { MarkdownEditor } from './MarkdownEditor';
import { ParallelView } from './ParallelView';
import { ConsistencyReport } from './ConsistencyReport';
import { VersionCompare } from './VersionCompare';
import { VersionManager } from './VersionManager';
import { PreviewToolbar } from './PreviewToolbar';
import { ExportBar } from './ExportBar';

export function PreviewPanel() {
  const previewContent = useTranslatorStore((s) => s.previewContent);
  const previewMode = useTranslatorStore((s) => s.previewMode);
  const setPreviewMode = useTranslatorStore((s) => s.setPreviewMode);
  const setPreviewContent = useTranslatorStore((s) => s.setPreviewContent);
  const originalText = useTranslatorStore((s) => s.originalText);

  const [showParallel, setShowParallel] = useState(false);
  const [showConsistency, setShowConsistency] = useState(false);
  const [showVersionCompare, setShowVersionCompare] = useState(false);
  const [showVersionManager, setShowVersionManager] = useState(false);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Tabs
        value={previewMode}
        onValueChange={(v) => setPreviewMode(v as 'rendered' | 'source')}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex items-center justify-between px-3 py-1.5 border-b">
          <TabsList className="h-7">
            <TabsTrigger value="rendered" className="text-xs px-2 h-6">
              <FileText className="size-3 mr-1" />
              預覽
            </TabsTrigger>
            <TabsTrigger value="source" className="text-xs px-2 h-6">
              <FileCode className="size-3 mr-1" />
              原始碼
            </TabsTrigger>
          </TabsList>
          <PreviewToolbar
            showParallel={showParallel}
            onToggleParallel={() => setShowParallel(!showParallel)}
            onShowConsistency={() => setShowConsistency(true)}
            onShowVersionCompare={() => setShowVersionCompare(true)}
            onShowVersionManager={() => setShowVersionManager(true)}
          />
        </div>

        {showParallel ? (
          <div className="flex-1 overflow-hidden">
            <ParallelView
              originalText={originalText}
              translatedContent={previewContent}
            />
          </div>
        ) : (
          <>
            <TabsContent value="rendered" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <MarkdownPreview content={previewContent} />
              </ScrollArea>
            </TabsContent>

            <TabsContent value="source" className="flex-1 overflow-hidden mt-0">
              <MarkdownEditor
                content={previewContent}
                onChange={setPreviewContent}
              />
            </TabsContent>
          </>
        )}
      </Tabs>

      <ExportBar />

      {/* Dialogs */}
      <ConsistencyReport
        open={showConsistency}
        onClose={() => setShowConsistency(false)}
      />
      <VersionCompare
        open={showVersionCompare}
        onClose={() => setShowVersionCompare(false)}
      />
      <VersionManager
        open={showVersionManager}
        onClose={() => setShowVersionManager(false)}
      />
    </div>
  );
}
