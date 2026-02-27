import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useTranslatorStore } from '@/stores/translatorStore';
import { PasteInput } from './PasteInput';
import { UrlInput } from './UrlInput';
import { ImportInput } from './ImportInput';
import { OCRInput } from './OCRInput';
import { MetadataForm } from './MetadataForm';

export function SourceInput() {
  const { inputMode, setInputMode, setOriginalText } = useTranslatorStore();
  const [activeTab, setActiveTab] = useState<string>(inputMode);

  const handleTabChange = (v: string) => {
    setActiveTab(v);
    if (v !== 'ocr') {
      setInputMode(v as 'paste' | 'url' | 'import');
    }
  };

  return (
    <div className="flex h-full flex-col">
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="border-b px-3 pt-2">
          <TabsList variant="line" className="w-full">
            <TabsTrigger value="paste" className="flex-1 text-xs">
              貼上文章
            </TabsTrigger>
            <TabsTrigger value="url" className="flex-1 text-xs">
              給網址
            </TabsTrigger>
            <TabsTrigger value="import" className="flex-1 text-xs">
              匯入成品
            </TabsTrigger>
            <TabsTrigger value="ocr" className="flex-1 text-xs">
              OCR
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <TabsContent value="paste" className="mt-0 h-full">
            <PasteInput />
          </TabsContent>
          <TabsContent value="url" className="mt-0 h-full">
            <UrlInput />
          </TabsContent>
          <TabsContent value="import" className="mt-0 h-full">
            <ImportInput />
          </TabsContent>
          <TabsContent value="ocr" className="mt-0 h-full overflow-auto">
            <OCRInput
              onTextExtracted={(text) => {
                setOriginalText(text);
                setInputMode('paste');
                setActiveTab('paste');
              }}
            />
          </TabsContent>
        </div>

        <div className="border-t">
          <MetadataForm />
        </div>
      </Tabs>
    </div>
  );
}
