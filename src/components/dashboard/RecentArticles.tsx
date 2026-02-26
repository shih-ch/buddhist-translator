import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ArticleSummary } from '@/types/article'

interface RecentArticlesProps {
  articles: ArticleSummary[]
}

export function RecentArticles({ articles }: RecentArticlesProps) {
  const navigate = useNavigate()
  const recent = articles.slice(0, 5)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">最近翻譯文章</CardTitle>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">尚無翻譯文章</p>
        ) : (
          <div className="space-y-3">
            {recent.map((a) => (
              <button
                key={a.path}
                className="flex w-full items-center justify-between gap-2 rounded-md p-2 text-left text-sm hover:bg-muted transition-colors"
                onClick={() => navigate(`/translator?edit=${encodeURIComponent(a.path)}`)}
              >
                <span className="flex-1 truncate font-medium">{a.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{a.author}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{a.date}</span>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
