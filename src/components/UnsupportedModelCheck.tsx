import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAIFunctionsStore } from '@/stores/aiFunctionsStore'
import { useTranslatorStore } from '@/stores/translatorStore'
import { isModelSupported } from '@/stores/aiModels'

/**
 * Mounts once at app startup. Scans the user's currently selected models
 * (translatorStore.currentModel + every AI Function config) against the
 * supported list. Surfaces a single toast per unsupported model with a
 * shortcut to Settings so the user can fix it before hitting an API error.
 */
export function UnsupportedModelCheck() {
  const navigate = useNavigate()

  useEffect(() => {
    const reported = new Set<string>()

    const check = (label: string, provider: string, model: string) => {
      const key = `${provider}::${model}`
      if (reported.has(key)) return
      if (isModelSupported(provider as Parameters<typeof isModelSupported>[0], model)) return
      reported.add(key)
      toast.warning(
        `${label}：${provider} / ${model} 已不在支援清單`,
        {
          description: '請至設定頁切換到目前可用的模型',
          duration: 12000,
          action: {
            label: '前往設定',
            onClick: () => navigate('/settings'),
          },
        }
      )
    }

    // Translator main model
    const cur = useTranslatorStore.getState().currentModel
    if (cur?.provider && cur?.model) {
      check('翻譯主模型', cur.provider, cur.model)
    }

    // Each AI Function config
    const fns = useAIFunctionsStore.getState().functions
    for (const fn of fns) {
      check(`AI 功能「${fn.name}」`, fn.provider, fn.model)
    }
  }, [navigate])

  return null
}
