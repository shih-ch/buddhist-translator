import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ArticleSummary } from '@/types/article'

const MONTH_SHORT: Record<string, string> = {
  '01': '1月', '02': '2月', '03': '3月', '04': '4月',
  '05': '5月', '06': '6月', '07': '7月', '08': '8月',
  '09': '9月', '10': '10月', '11': '11月', '12': '12月',
}

interface MonthlyChartProps {
  articles: ArticleSummary[]
}

export function MonthlyChart({ articles }: MonthlyChartProps) {
  // Build last 6 months of data
  const now = new Date()
  const months: { key: string; label: string; count: number }[] = []

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const key = `${yyyy}-${mm}`
    const count = articles.filter((a) => a.date.startsWith(key)).length
    months.push({ key, label: `${MONTH_SHORT[mm]}`, count })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">每月文章統計</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={months}>
              <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} width={30} />
              <Tooltip
                formatter={(value) => [`${value} 篇`, '文章數']}
                contentStyle={{ borderRadius: '8px', fontSize: '13px' }}
              />
              <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
