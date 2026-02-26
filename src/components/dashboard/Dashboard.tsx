import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Upload, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useArticlesStore } from '@/stores/articlesStore'
import { useGlossaryStore } from '@/stores/glossaryStore'
import { StatsCards } from './StatsCards'
import { MonthlyChart } from './MonthlyChart'
import { RecentArticles } from './RecentArticles'

export function Dashboard() {
  const navigate = useNavigate()
  const { articles, isLoading: articlesLoading, fetchArticles } = useArticlesStore()
  const { glossary, isLoading: glossaryLoading, fetchGlossary } = useGlossaryStore()

  useEffect(() => {
    fetchArticles()
    fetchGlossary()
  }, [fetchArticles, fetchGlossary])

  const isLoading = articlesLoading || glossaryLoading
  const termCount = glossary?.terms.length ?? 0

  if (isLoading && articles.length === 0) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <StatsCards articles={articles} termCount={termCount} />

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => navigate('/translator')}>
          <Plus className="mr-2 h-4 w-4" />
          新增翻譯
        </Button>
        <Button variant="outline" onClick={() => navigate('/translator?mode=import')}>
          <Upload className="mr-2 h-4 w-4" />
          匯入成品
        </Button>
        <Button variant="outline" onClick={() => navigate('/glossary')}>
          <BookOpen className="mr-2 h-4 w-4" />
          管理術語表
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <MonthlyChart articles={articles} />
        <RecentArticles articles={articles} />
      </div>
    </div>
  )
}
