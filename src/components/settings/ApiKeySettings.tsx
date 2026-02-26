import { useState } from 'react'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSettingsStore } from '@/stores/settingsStore'
import type { AIProviderId } from '@/types/settings'

const providers: { id: AIProviderId; label: string }[] = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'google', label: 'Google Gemini' },
  { id: 'perplexity', label: 'Perplexity' },
]

export function ApiKeySettings() {
  const { apiKeys, setApiKey, testApiKey } = useSettingsStore()
  const [testStates, setTestStates] = useState<Record<string, 'idle' | 'loading' | 'ok' | 'fail'>>({})

  const handleTest = async (id: AIProviderId) => {
    setTestStates((s) => ({ ...s, [id]: 'loading' }))
    const ok = await testApiKey(id)
    setTestStates((s) => ({ ...s, [id]: ok ? 'ok' : 'fail' }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Keys</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {providers.map((p) => (
          <div key={p.id} className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor={`key-${p.id}`}>{p.label}</Label>
              <Input
                id={`key-${p.id}`}
                type="password"
                placeholder={`輸入 ${p.label} API Key`}
                value={apiKeys[p.id]}
                onChange={(e) => setApiKey(p.id, e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!apiKeys[p.id] || testStates[p.id] === 'loading'}
              onClick={() => handleTest(p.id)}
            >
              {testStates[p.id] === 'loading' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              測試
            </Button>
            {testStates[p.id] === 'ok' && <CheckCircle className="h-5 w-5 shrink-0 text-green-500" />}
            {testStates[p.id] === 'fail' && <XCircle className="h-5 w-5 shrink-0 text-red-500" />}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
