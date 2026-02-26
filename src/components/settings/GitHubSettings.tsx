import { useState } from 'react'
import { CheckCircle, XCircle, Loader2, FolderSync } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useSettingsStore } from '@/stores/settingsStore'
import { githubService } from '@/services/github'

export function GitHubSettings() {
  const {
    githubToken, setGitHubToken,
    githubRepo, setGitHubRepo,
    githubBranch, setGitHubBranch,
    testGitHubToken,
  } = useSettingsStore()

  const [testState, setTestState] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle')
  const [migrateState, setMigrateState] = useState<'idle' | 'loading' | 'done' | 'fail'>('idle')

  const handleTest = async () => {
    setTestState('loading')
    const ok = await testGitHubToken()
    setTestState(ok ? 'ok' : 'fail')
  }

  const handleRepoChange = (value: string) => {
    const parts = value.split('/')
    if (parts.length === 2) {
      setGitHubRepo(parts[0], parts[1])
    }
    // Also update for partial input so the field stays editable
    if (parts.length !== 2) {
      // Store raw value temporarily via the setter with split
      const owner = parts[0] ?? ''
      const repo = parts.slice(1).join('/') || ''
      setGitHubRepo(owner, repo)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>GitHub</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="gh-token">Personal Access Token</Label>
          <Input
            id="gh-token"
            type="password"
            placeholder="ghp_..."
            value={githubToken}
            onChange={(e) => setGitHubToken(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="gh-repo">Repository</Label>
            <Input
              id="gh-repo"
              placeholder="owner/repo"
              value={githubRepo}
              onChange={(e) => handleRepoChange(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gh-branch">Branch</Label>
            <Input
              id="gh-branch"
              placeholder="main"
              value={githubBranch}
              onChange={(e) => setGitHubBranch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={!githubToken || testState === 'loading'}
            onClick={handleTest}
          >
            {testState === 'loading' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            測試連線
          </Button>
          {testState === 'ok' && <CheckCircle className="h-5 w-5 text-green-500" />}
          {testState === 'fail' && <XCircle className="h-5 w-5 text-red-500" />}
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="text-sm font-medium">Repo 結構遷移</Label>
          <p className="text-xs text-muted-foreground">
            將 repo 根目錄的研究資料檔案自動搬移到 research/ 子目錄，並更新 README.md。
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={!githubToken || migrateState === 'loading'}
            onClick={async () => {
              setMigrateState('loading')
              try {
                await githubService.migrateRepoStructure()
                setMigrateState('done')
              } catch {
                setMigrateState('fail')
              }
            }}
          >
            {migrateState === 'loading' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            <FolderSync className="mr-1 h-3 w-3" />
            執行遷移
          </Button>
          {migrateState === 'done' && <span className="text-xs text-green-600">遷移完成</span>}
          {migrateState === 'fail' && <span className="text-xs text-red-600">遷移失敗</span>}
        </div>
      </CardContent>
    </Card>
  )
}
