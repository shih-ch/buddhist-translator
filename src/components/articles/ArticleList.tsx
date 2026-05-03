import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, FileText, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { githubService } from '@/services/github'
import { MantraEditor } from '@/components/translator/MantraEditor'
import { assembleMarkdown, splitFrontmatter } from '@/services/markdownUtils'
import { toast } from 'sonner'
import type { Article } from '@/types/article'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { ArticleSummary } from '@/types/article'

const LANG_LABELS: Record<string, string> = {
  ru: '俄文',
  en: '英文',
  bo: '藏文',
  zh: '中文',
}

interface ArticleListProps {
  articles: ArticleSummary[]
  onDelete?: (path: string, sha: string) => void
}

export function ArticleList({ articles, onDelete }: ArticleListProps) {
  const navigate = useNavigate()
  const [deleteTarget, setDeleteTarget] = useState<ArticleSummary | null>(null)
  const [mantraTarget, setMantraTarget] = useState<{
    article: Article
    fullMd: string
  } | null>(null)
  const [loadingPath, setLoadingPath] = useState<string | null>(null)
  const [savingMantra, setSavingMantra] = useState(false)

  const openMantraEditor = async (path: string) => {
    setLoadingPath(path)
    try {
      const article = await githubService.loadTranslation(path)
      const fullMd = assembleMarkdown(
        article.frontmatter,
        article.content,
        article.originalText
      )
      setMantraTarget({ article, fullMd })
    } catch (err) {
      toast.error(`載入失敗：${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoadingPath(null)
    }
  }

  const handleMantraApply = async (newFullMd: string) => {
    if (!mantraTarget) return
    setSavingMantra(true)
    try {
      // Strip frontmatter and original-text <details> back into Article shape
      const { body } = splitFrontmatter(newFullMd)
      const detailsMatch = body.match(
        /\n---\s*\n+<details>\s*\n<summary>原文\s*\(Original\)<\/summary>\s*\n([\s\S]*?)\n<\/details>/
      )
      const newContent = detailsMatch ? body.slice(0, detailsMatch.index!).trim() : body.trim()
      const newOriginalText = detailsMatch ? detailsMatch[1].trim() : mantraTarget.article.originalText

      await githubService.saveTranslation({
        ...mantraTarget.article,
        content: newContent,
        originalText: newOriginalText,
      })
      toast.success('已寫回 GitHub')
      setMantraTarget(null)
    } catch (err) {
      toast.error(`儲存失敗：${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setSavingMantra(false)
    }
  }

  if (articles.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">無符合條件的文章</p>
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>標題</TableHead>
            <TableHead className="w-40">作者</TableHead>
            <TableHead className="w-28">日期</TableHead>
            <TableHead className="w-24">原文語言</TableHead>
            <TableHead className="w-12" />
            {onDelete && <TableHead className="w-12" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {articles.map((a) => (
            <TableRow
              key={a.path}
              className="cursor-pointer"
              onClick={() => navigate(`/translator?edit=${encodeURIComponent(a.path)}`)}
            >
              <TableCell className="font-medium">{a.title}</TableCell>
              <TableCell>{a.author}</TableCell>
              <TableCell className="text-muted-foreground">{a.date}</TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {LANG_LABELS[a.original_language] ?? a.original_language}
                </Badge>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation()
                    openMantraEditor(a.path)
                  }}
                  disabled={loadingPath === a.path}
                  title="整理真言"
                >
                  {loadingPath === a.path
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <FileText className="h-3.5 w-3.5" />}
                </Button>
              </TableCell>
              {onDelete && (
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteTarget(a)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {mantraTarget && (
        <MantraEditor
          open={true}
          onClose={() => !savingMantra && setMantraTarget(null)}
          currentMarkdown={mantraTarget.fullMd}
          onApply={handleMantraApply}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定刪除文章？</AlertDialogTitle>
            <AlertDialogDescription>
              刪除後將無法復原，文章「{deleteTarget?.title}」將從 GitHub 移除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  onDelete?.(deleteTarget.path, deleteTarget.sha)
                  setDeleteTarget(null)
                }
              }}
            >
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
