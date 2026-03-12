import { useEffect, useMemo, useState, useRef } from 'react'
import { ExternalLink, Upload, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useArticlesStore } from '@/stores/articlesStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { githubService } from '@/services/github'
import { ArticleFilters } from './ArticleFilters'
import { ArticleList } from './ArticleList'
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
          {notionToken && notionDatabaseId && <NotionBatchExport />}
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
            <ArticleList articles={filtered} onDelete={deleteArticle} />
          </CardContent>
        </Card>
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
