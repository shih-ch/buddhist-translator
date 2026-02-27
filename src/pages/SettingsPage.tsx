import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApiKeySettings } from '@/components/settings/ApiKeySettings'
import { GitHubSettings } from '@/components/settings/GitHubSettings'
import { AIFunctionList } from '@/components/settings/AIFunctionList'
import { ParamPresetEditor } from '@/components/settings/ParamPresetEditor'
import { CorrectionShortcuts } from '@/components/settings/CorrectionShortcuts'
import { DataExportImport } from '@/components/settings/DataExportImport'

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="github">GitHub</TabsTrigger>
          <TabsTrigger value="ai">AI 功能</TabsTrigger>
          <TabsTrigger value="presets">翻譯預設</TabsTrigger>
          <TabsTrigger value="shortcuts">修正快捷</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="mt-4">
          <ApiKeySettings />
        </TabsContent>

        <TabsContent value="github" className="mt-4">
          <GitHubSettings />
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <AIFunctionList />
        </TabsContent>

        <TabsContent value="presets" className="mt-4">
          <ParamPresetEditor />
        </TabsContent>

        <TabsContent value="shortcuts" className="mt-4">
          <CorrectionShortcuts />
        </TabsContent>
      </Tabs>

      <DataExportImport />
    </div>
  )
}
