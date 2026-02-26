import { FileText, BookOpen, CalendarDays, Globe } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ArticleSummary } from '@/types/article'

interface StatsCardsProps {
  articles: ArticleSummary[]
  termCount: number
}

export function StatsCards({ articles, termCount }: StatsCardsProps) {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const thisMonthCount = articles.filter((a) => a.date.startsWith(currentMonth)).length

  // Find the most common original language
  const langCounts: Record<string, number> = {}
  for (const a of articles) {
    const lang = a.original_language || 'other'
    langCounts[lang] = (langCounts[lang] || 0) + 1
  }
  const topLang = Object.entries(langCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-'
  const langNames: Record<string, string> = { ru: '俄文', en: '英文', bo: '藏文', zh: '中文' }

  const stats = [
    { label: '翻譯文章', value: `${articles.length} 篇`, icon: FileText },
    { label: '術語詞條', value: `${termCount} 條`, icon: BookOpen },
    { label: '本月新增', value: `${thisMonthCount} 篇`, icon: CalendarDays },
    { label: '原文語言', value: langNames[topLang] ?? topLang, icon: Globe },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
            <s.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{s.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
