import { useAIFunctionsStore } from '@/stores/aiFunctionsStore'
import { AIFunctionCard } from './AIFunctionCard'

export function AIFunctionList() {
  const { functions } = useAIFunctionsStore()

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">AI 功能管理</h3>
      {functions.map((fn) => (
        <AIFunctionCard key={fn.id} config={fn} />
      ))}
    </div>
  )
}
