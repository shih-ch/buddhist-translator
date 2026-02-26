import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ArticleSummary } from '@/types/article'

const LANG_LABELS: Record<string, string> = {
  ru: '俄文',
  en: '英文',
  bo: '藏文',
  zh: '中文',
}

interface ArticleListProps {
  articles: ArticleSummary[]
}

export function ArticleList({ articles }: ArticleListProps) {
  const navigate = useNavigate()

  if (articles.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">無符合條件的文章</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>標題</TableHead>
          <TableHead className="w-40">作者</TableHead>
          <TableHead className="w-28">日期</TableHead>
          <TableHead className="w-24">原文語言</TableHead>
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
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
