import { useState } from 'react'
import { CloudUpload, CloudDownload, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAIFunctionsStore } from '@/stores/aiFunctionsStore'
import { githubService } from '@/services/github'
import type { AppConfig } from '@/types/settings'
import { AIFunctionCard } from './AIFunctionCard'

export function AIFunctionList() {
  const { functions, presets, syncFromRemote } = useAIFunctionsStore()
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

  const loading = syncState === 'uploading' || syncState === 'downloading'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">AI 功能管理</h3>
        <div className="flex items-center gap-2">
          {syncState === 'done' && <span className="text-xs text-green-600">同步完成</span>}
          {syncState === 'fail' && <span className="text-xs text-red-600">同步失敗</span>}
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
