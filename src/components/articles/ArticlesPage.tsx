import { useEffect, useMemo, useState, useRef } from 'react'
import { ExternalLink, Upload, Loader2, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useArticlesStore } from '@/stores/articlesStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { githubService } from '@/services/github'
import { notionService } from '@/services/notion'
import { ArticleFilters } from './ArticleFilters'
import { ArticleList, type NotionBindStatus } from './ArticleList'
import { NotionBatchExport } from './NotionBatchExport'
import { toast } from 'sonner'

export function ArticlesPageContent() {
  const {
    articles,
    researchFiles,
    isLoading,
    fetchArticles,
    fetchResearchFiles,
    deleteArticle,
    getAuthors,
  } = useArticlesStore()

  const notionToken = useSettingsStore((s) => s.notionToken)
  const notionDatabaseId = useSettingsStore((s) => s.notionDatabaseId)

  const { getGitHubRepo, githubBranch } = useSettingsStore()

  const githubToken = useSettingsStore((s) => s.githubToken)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAuthor, setSelectedAuthor] = useState('__all__')
  const [selectedMonth, setSelectedMonth] = useState('__all__')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [notionStatus, setNotionStatus] = useState<Map<string, NotionBindStatus> | null>(null)
  const [checkingNotion, setCheckingNotion] = useState(false)

  const handleCheckNotion = async () => {
    setCheckingNotion(true)
    try {
      const pages = await notionService.listAllPages()
      const byTitle = new Map<string, typeof pages[0]>()
      for (const p of pages) if (!byTitle.has(p.title)) byTitle.set(p.title, p)

      const map = new Map<string, NotionBindStatus>()
      for (const a of articles) {
        const page = byTitle.get(a.title)
        if (!page) {
          map.set(a.path, { status: 'no_notion' })
        } else if (page.githubPath === a.path) {
          map.set(a.path, { status: 'synced', pageId: page.id, pageUrl: page.url })
        } else if (page.githubPath && page.githubPath !== a.path) {
          map.set(a.path, { status: 'mismatch', pageId: page.id, pageUrl: page.url, notionPath: page.githubPath })
        } else {
          map.set(a.path, { status: 'unbound', pageId: page.id, pageUrl: page.url })
        }
      }
      setNotionStatus(map)

      const counts = { synced: 0, unbound: 0, mismatch: 0, no_notion: 0 }
      for (const v of map.values()) counts[v.status]++
      toast.success(
        `Notion 掃描完成：${counts.synced} 已綁、${counts.unbound} 待綁、${counts.mismatch} 不一致、${counts.no_notion} 無對應`,
        { duration: 8000 }
      )
    } catch (err) {
      toast.error(`Notion 掃描失敗：${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setCheckingNotion(false)
    }
  }

  const updateNotionStatus = (path: string, next: NotionBindStatus) => {
    setNotionStatus((prev) => {
      if (!prev) return prev
      const m = new Map(prev)
      m.set(path, next)
      return m
    })
  }

  const handleUploadResearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    if (!githubToken) {
      toast.error('請先在設定中填入 GitHub Token')
      return
    }

    setUploading(true)
    let successCount = 0

    for (const file of Array.from(files)) {
      try {
        const safeName = file.name.replace(/\s+/g, '_')
        const filePath = `research/${safeName}`
        toast.loading(`上傳中：${file.name}`, { id: `upload-${file.name}` })
        await githubService.uploadImage(filePath, file)
        successCount++
        toast.success(`已上傳：${file.name}`, { id: `upload-${file.name}` })
      } catch (err) {
        toast.error(
          `上傳失敗：${file.name} — ${err instanceof Error ? err.message : 'Unknown error'}`,
          { id: `upload-${file.name}` }
        )
      }
    }

    if (successCount > 0) {
      toast.success(`已上傳 ${successCount} 個檔案到 research/`)
      fetchResearchFiles()
      // Update README to include new files
      githubService.updateReadme().catch(console.error)
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  useEffect(() => {
    fetchArticles()
    fetchResearchFiles()
  }, [fetchArticles, fetchResearchFiles])

  const authors = getAuthors()
  const months = useMemo(() => {
    const set = new Set<string>()
    for (const a of articles) {
      const m = a.date.slice(0, 7)
      if (m) set.add(m)
    }
    return [...set].sort().reverse()
  }, [articles])

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      if (searchQuery && !a.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (selectedAuthor !== '__all__' && a.author !== selectedAuthor) return false
      if (selectedMonth !== '__all__' && !a.date.startsWith(selectedMonth)) return false
      return true
    })
  }, [articles, searchQuery, selectedAuthor, selectedMonth])

  const { owner, repo } = getGitHubRepo()

  if (isLoading && articles.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Translations section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">翻譯文章</h3>
          <div className="flex items-center gap-2">
            {notionToken && notionDatabaseId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCheckNotion}
                disabled={checkingNotion || articles.length === 0}
                title="掃描 Notion DB，標出每篇文章的綁定狀態"
              >
                {checkingNotion
                  ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  : <RefreshCw className="mr-1 h-3 w-3" />}
                檢查 Notion 綁定
              </Button>
            )}
            {notionToken && notionDatabaseId && <NotionBatchExport />}
          </div>
        </div>
        <ArticleFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          authors={authors}
          selectedAuthor={selectedAuthor}
          onAuthorChange={setSelectedAuthor}
          months={months}
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
        />
        <Card>
          <CardContent className="p-0">
            <ArticleList
              articles={filtered}
              onDelete={deleteArticle}
              notionStatus={notionStatus ?? undefined}
              onStatusUpdate={updateNotionStatus}
            />
          </CardContent>
        </Card>
        {notionStatus && (
          <details className="text-xs text-muted-foreground border rounded p-2">
            <summary className="cursor-pointer font-medium">不同狀態的手動修復方式</summary>
            <div className="mt-2 space-y-2">
              <div>
                <strong className="text-green-600">已綁定（✓）</strong>：不用動。下次儲存會更新原 Notion 頁，URL 不變。
              </div>
              <div>
                <strong className="text-amber-600">待綁定（🔗 綁定 按鈕）</strong>：Notion 中有同標題的頁面但 GitHub Path 為空。<br />
                點該行的「綁定」按鈕一次自動補上。或進入該文章的編輯頁，用 ExportBar 的「綁定」按鈕貼 URL 手動綁定。
              </div>
              <div>
                <strong className="text-amber-600">不一致（⚠️）</strong>：Notion 頁面已有 GitHub Path 但跟現在的 path 不同（通常是過去 date bug 導致）。<br />
                點圖示開啟 Notion 頁面 → 屬性區的「GitHub Path」欄位 → 把值改成左方顯示的 path。<br />
                改完按右上「檢查 Notion 綁定」重新掃描確認。
              </div>
              <div>
                <strong className="text-muted-foreground">無對應（⊖）</strong>：Notion DB 沒有同標題的頁面。<br />
                有兩種選擇：<br />
                1. 從 GitHub 編輯該文 → 儲存到 GitHub + Notion → app 會建立新頁面<br />
                2. 如果 Notion 上其實有但標題不同（被改過或多了字），用編輯頁的「綁定」按鈕手動貼 Notion URL
              </div>
            </div>
          </details>
        )}
      </div>

      {/* Research files section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">研究資料</h3>
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !githubToken}
              >
                {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
                {uploading ? '上傳中...' : '上傳研究資料'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.pdf,.md,.txt,.csv,.json"
                multiple
                hidden
                onChange={handleUploadResearch}
              />
            </div>
          </div>
          {researchFiles.length > 0 && (
            <Card>
              <CardContent className="p-4">
                {(() => {
                  const grouped = new Map<string, typeof researchFiles>()
                  for (const f of researchFiles) {
                    if (!grouped.has(f.category)) grouped.set(f.category, [])
                    grouped.get(f.category)!.push(f)
                  }
                  const TITLES: Record<string, string> = {
                    hayagriva: '馬頭明王 (Hayagriva)',
                    atavaku: '阿吒婆拘經',
                    images: '圖片',
                    other: '其他',
                  }
                  return [...grouped.entries()].map(([cat, files]) => (
                    <div key={cat} className="mb-4 last:mb-0">
                      <h4 className="mb-2 text-sm font-semibold text-muted-foreground">
                        {TITLES[cat] ?? cat}
                      </h4>
                      <ul className="space-y-1">
                        {files.map((f) => {
                          const isHtml = f.name.endsWith('.html')
                          const href = isHtml
                            ? `https://${owner}.github.io/${repo}/${f.path}`
                            : `https://github.com/${owner}/${repo}/blob/${githubBranch}/${f.path}`
                          return (
                            <li key={f.path}>
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                              >
                                {f.name}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))
                })()}
              </CardContent>
            </Card>
          )}
        </div>
    </div>
  )
}
