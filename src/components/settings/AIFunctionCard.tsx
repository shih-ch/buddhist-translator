import { useState } from 'react'
import { RotateCcw, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
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
import { AI_PROVIDERS } from '@/stores/aiModels'
import type { AIFunctionConfig, AIProviderId } from '@/types/settings'

interface AIFunctionCardProps {
  config: AIFunctionConfig
}

export function AIFunctionCard({ config }: AIFunctionCardProps) {
  const { updateFunctionConfig, resetFunctionPrompt } = useAIFunctionsStore()
  const [promptExpanded, setPromptExpanded] = useState(true)

  const providerModels = AI_PROVIDERS[config.provider]?.models ?? []

  const handleProviderChange = (provider: AIProviderId) => {
    const firstModel = AI_PROVIDERS[provider]?.models[0]?.id ?? ''
    updateFunctionConfig(config.id, { provider, model: firstModel })
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
          <Button variant="outline" size="sm" disabled>
            <Sparkles className="mr-1 h-3 w-3" />
            根據使用紀錄優化
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
