import { useState } from 'react'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSettingsStore } from '@/stores/settingsStore'
import { notionService } from '@/services/notion'

export function NotionSettings() {
  const {
    notionToken, setNotionToken,
    notionDatabaseId, setNotionDatabaseId,
  } = useSettingsStore()

  const [testState, setTestState] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [initState, setInitState] = useState<'idle' | 'loading' | 'done' | 'fail'>('idle')
  const [initMsg, setInitMsg] = useState('')

  const handleTest = async () => {
    setTestState('loading')
    setErrorMsg('')
    try {
      const ok = await notionService.testConnection()
      setTestState(ok ? 'ok' : 'fail')
      if (!ok) setErrorMsg('連線失敗，請檢查 Token 和 Database ID')
    } catch (err) {
      setTestState('fail')
      setErrorMsg(err instanceof Error ? err.message : '未知錯誤')
    }
  }

  const handleInitDb = async () => {
    setInitState('loading')
    setInitMsg('')
    try {
      const created = await notionService.ensureDatabaseProperties()
      setInitState('done')
      if (created.length === 0) {
        setInitMsg('所有欄位已存在，無需建立')
      } else {
        setInitMsg(`已建立：${created.join('、')}`)
      }
    } catch (err) {
      setInitState('fail')
      setInitMsg(err instanceof Error ? err.message : '未知錯誤')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notion</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="notion-token">Integration Token</Label>
          <Input
            id="notion-token"
            type="password"
            placeholder="ntn_..."
            value={notionToken}
            onChange={(e) => setNotionToken(e.target.value)}
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            在{' '}
            <a
              href="https://www.notion.so/profile/integrations"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Notion Integrations
            </a>{' '}
            建立 Internal Integration，並將 Database 分享給該 Integration。
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="notion-db">Database ID</Label>
          <Input
            id="notion-db"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            value={notionDatabaseId}
            onChange={(e) => setNotionDatabaseId(e.target.value)}
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            開啟 Notion Database 頁面，複製 URL 中 database 後的 32 位 ID。
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={!notionToken || !notionDatabaseId || testState === 'loading'}
            onClick={handleTest}
          >
            {testState === 'loading' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            測試連線
          </Button>
          {testState === 'ok' && <CheckCircle className="h-5 w-5 text-green-500" />}
          {testState === 'fail' && (
            <span className="flex items-center gap-1">
              <XCircle className="h-5 w-5 text-red-500" />
              {errorMsg && <span className="text-xs text-red-500">{errorMsg}</span>}
            </span>
          )}
        </div>

        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!notionToken || !notionDatabaseId || initState === 'loading'}
            onClick={handleInitDb}
          >
            {initState === 'loading' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            初始化 Database 欄位
          </Button>
          <p className="text-xs text-muted-foreground">
            自動建立所需的 property（Author、Date、Tags 等），已存在的不會重複建立。
          </p>
          {initState === 'done' && (
            <p className="text-xs text-green-600">{initMsg}</p>
          )}
          {initState === 'fail' && (
            <p className="text-xs text-red-600">{initMsg}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
