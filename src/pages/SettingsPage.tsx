import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApiKeySettings } from '@/components/settings/ApiKeySettings'
import { GitHubSettings } from '@/components/settings/GitHubSettings'
import { NotionSettings } from '@/components/settings/NotionSettings'
import { AIFunctionList } from '@/components/settings/AIFunctionList'
import { ParamPresetEditor } from '@/components/settings/ParamPresetEditor'
import { CorrectionShortcuts } from '@/components/settings/CorrectionShortcuts'
import { DataExportImport } from '@/components/settings/DataExportImport'
import { useSettingsStore } from '@/stores/settingsStore'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AnnotationMode } from '@/services/glossaryAnnotator'

export default function SettingsPage() {
  const annotationMode = useSettingsStore((s) => s.preferences.annotationMode ?? 'abbr')
  const setPreference = useSettingsStore((s) => s.setPreference)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="github">GitHub</TabsTrigger>
          <TabsTrigger value="notion">Notion</TabsTrigger>
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

        <TabsContent value="notion" className="mt-4">
          <NotionSettings />
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

      {/* Preferences */}
      <div className="rounded-lg border p-4 space-y-4">
        <h3 className="text-sm font-medium">偏好設定</h3>
        <div className="flex items-center gap-4">
          <Label htmlFor="annotation-mode" className="text-sm whitespace-nowrap">
            術語標注格式
          </Label>
          <Select
            value={annotationMode}
            onValueChange={(v: AnnotationMode) => setPreference('annotationMode', v)}
          >
            <SelectTrigger id="annotation-mode" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="abbr">{'<abbr>'} 標注</SelectItem>
              <SelectItem value="link">[連結] 標注</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataExportImport />
    </div>
  )
}
