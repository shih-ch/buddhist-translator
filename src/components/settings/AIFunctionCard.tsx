import { useState, useRef } from 'react'
import { RotateCcw, ChevronDown, ChevronUp, Sparkles, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAIFunctionsStore } from '@/stores/aiFunctionsStore'
import { usePromptHistoryStore } from '@/stores/promptHistoryStore'
import { AI_PROVIDERS } from '@/stores/aiModels'
import { PromptHistoryDialog } from './PromptHistoryDialog'
import { PromptOptimizerDialog } from './PromptOptimizerDialog'
import type { AIFunctionConfig, AIProviderId } from '@/types/settings'

interface AIFunctionCardProps {
  config: AIFunctionConfig
}

export function AIFunctionCard({ config }: AIFunctionCardProps) {
  const { updateFunctionConfig, resetFunctionPrompt } = useAIFunctionsStore()
  const [promptExpanded, setPromptExpanded] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [optimizerOpen, setOptimizerOpen] = useState(false)
  const promptRef = useRef(config.prompt)
  const historyCount = usePromptHistoryStore((s) => s.entries.filter((e) => e.functionId === config.id).length)

  const providerModels = AI_PROVIDERS[config.provider]?.models ?? []

  const handleProviderChange = (provider: AIProviderId) => {
    const firstModel = AI_PROVIDERS[provider]?.models[0]?.id ?? ''
    updateFunctionConfig(config.id, { provider, model: firstModel })
  }

  // Record prompt on blur (batch edit instead of per-keystroke)
  const handlePromptBlur = () => {
    if (promptRef.current !== config.prompt) {
      promptRef.current = config.prompt
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{config.name}</CardTitle>
        <CardDescription>{config.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Provider</Label>
            <Select value={config.provider} onValueChange={(v) => handleProviderChange(v as AIProviderId)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AI_PROVIDERS).map(([id, p]) => (
                  <SelectItem key={id} value={id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Model</Label>
            <Select value={config.model} onValueChange={(v) => updateFunctionConfig(config.id, { model: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providerModels.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label>Prompt</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setPromptExpanded(!promptExpanded)}
            >
              {promptExpanded ? (
                <><ChevronUp className="mr-1 h-3 w-3" />收合</>
              ) : (
                <><ChevronDown className="mr-1 h-3 w-3" />展開</>
              )}
            </Button>
          </div>
          {promptExpanded && (
            <Textarea
              rows={15}
              className="min-h-[240px] font-mono text-xs"
              style={{ fieldSizing: 'fixed' } as React.CSSProperties}
              value={config.prompt}
              onChange={(e) => updateFunctionConfig(config.id, { prompt: e.target.value })}
              onBlur={handlePromptBlur}
            />
          )}
          {!promptExpanded && (
            <p className="truncate text-xs text-muted-foreground">
              {config.prompt.slice(0, 100)}...
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetFunctionPrompt(config.id)}
            disabled={config.prompt === config.defaultPrompt}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            恢復預設
          </Button>
          <Button variant="outline" size="sm" onClick={() => setOptimizerOpen(true)}>
            <Sparkles className="mr-1 h-3 w-3" />
            根據使用紀錄優化
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHistoryOpen(true)}
            disabled={historyCount === 0}
          >
            <Clock className="mr-1 h-3 w-3" />
            歷史 {historyCount > 0 && `(${historyCount})`}
          </Button>
        </div>

        <PromptHistoryDialog
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          functionId={config.id}
        />
        <PromptOptimizerDialog
          open={optimizerOpen}
          onClose={() => setOptimizerOpen(false)}
          functionId={config.id}
        />
      </CardContent>
    </Card>
  )
}
