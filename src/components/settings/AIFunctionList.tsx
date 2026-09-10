import { useState } from 'react'
import { CloudUpload, CloudDownload, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAIFunctionsStore } from '@/stores/aiFunctionsStore'
import { githubService } from '@/services/github'
import type { AppConfig } from '@/types/settings'
import { AIFunctionCard } from './AIFunctionCard'
import { RECOMMENDED_MODELS } from '@/stores/recommendedModels'
import { AI_PROVIDERS } from '@/stores/aiModels'
import { toast } from 'sonner'

export function AIFunctionList() {
  const functions = useAIFunctionsStore((s) => s.functions)
  const presets = useAIFunctionsStore((s) => s.presets)
  const syncFromRemote = useAIFunctionsStore((s) => s.syncFromRemote)
  const updateFunctionConfig = useAIFunctionsStore((s) => s.updateFunctionConfig)
  const [syncState, setSyncState] = useState<'idle' | 'uploading' | 'downloading' | 'done' | 'fail'>('idle')

  const handleUpload = async () => {
    setSyncState('uploading')
    try {
      const ai_functions = {} as AppConfig['ai_functions']
      for (const fn of functions) {
        ai_functions[fn.id] = { provider: fn.provider, model: fn.model, prompt: fn.prompt }
      }
      const config: AppConfig = {
        version: 2,
        ai_functions,
        translation_presets: presets,
        defaults: { target_language: 'zh-TW', source_language: 'ru', default_author: 'Олег Ганченко' },
      }
      await githubService.saveConfig(config)
      setSyncState('done')
      setTimeout(() => setSyncState('idle'), 2000)
    } catch {
      setSyncState('fail')
    }
  }

  const handleDownload = async () => {
    setSyncState('downloading')
    try {
      const config = await githubService.loadConfig()
      if (config) {
        syncFromRemote(config.ai_functions, config.translation_presets)
      }
      setSyncState('done')
      setTimeout(() => setSyncState('idle'), 2000)
    } catch {
      setSyncState('fail')
    }
  }


  // Saved settings in localStorage take precedence over DEFAULT_FUNCTIONS, so
  // changing the recommendation in code does nothing for an existing install.
  // This applies it explicitly. Prompts are left alone — only provider/model.
  const handleApplyRecommended = () => {
    const changes = functions.filter(
      (fn) =>
        fn.provider !== RECOMMENDED_MODELS[fn.id].provider ||
        fn.model !== RECOMMENDED_MODELS[fn.id].model
    )
    if (changes.length === 0) {
      toast.info('目前的模型配置已經與建議一致')
      return
    }

    const nameOf = (provider: string, model: string) =>
      AI_PROVIDERS[provider as keyof typeof AI_PROVIDERS]?.models.find((m) => m.id === model)?.name ??
      model
    const preview = changes
      .map((fn) => `・${fn.name}：${nameOf(fn.provider, fn.model)} → ${nameOf(RECOMMENDED_MODELS[fn.id].provider, RECOMMENDED_MODELS[fn.id].model)}`)
      .join('\n')

    if (!confirm(`將變更 ${changes.length} 項功能的模型（prompt 不受影響）：\n\n${preview}\n\n確定套用？`)) return

    for (const fn of changes) {
      updateFunctionConfig(fn.id, RECOMMENDED_MODELS[fn.id])
    }
    toast.success(`已套用建議配置（${changes.length} 項）`)
  }

  const loading = syncState === 'uploading' || syncState === 'downloading'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">AI 功能管理</h3>
        <div className="flex items-center gap-2">
          {syncState === 'done' && <span className="text-xs text-green-600">同步完成</span>}
          {syncState === 'fail' && <span className="text-xs text-red-600">同步失敗</span>}
          <Button variant="outline" size="sm" disabled={loading} onClick={handleApplyRecommended}>
            <Sparkles className="mr-1 h-3 w-3" />
            套用建議配置
          </Button>
          <Button variant="outline" size="sm" disabled={loading} onClick={handleDownload}>
            {syncState === 'downloading' ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CloudDownload className="mr-1 h-3 w-3" />}
            從 GitHub 載入
          </Button>
          <Button variant="outline" size="sm" disabled={loading} onClick={handleUpload}>
            {syncState === 'uploading' ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CloudUpload className="mr-1 h-3 w-3" />}
            同步到 GitHub
          </Button>
        </div>
      </div>
      {functions.map((fn) => (
        <AIFunctionCard key={fn.id} config={fn} />
      ))}
    </div>
  )
}
