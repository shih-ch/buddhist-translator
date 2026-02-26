import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import type { GlossaryTerm } from '@/types/glossary'
import { CATEGORY_LABELS } from './GlossaryStats'

type SortKey = 'original' | 'translation' | 'category' | 'added_at'

interface TermListProps {
  terms: GlossaryTerm[]
  onEdit: (term: GlossaryTerm) => void
  onDelete: (id: string) => void
}

export function TermList({ terms, onEdit, onDelete }: TermListProps) {
  const [sortKey, setSortKey] = useState<SortKey>('added_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const sorted = [...terms].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    const cmp = av.localeCompare(bv)
    return sortAsc ? cmp : -cmp
  })

  const SortableHeader = ({ label, sortKeyValue }: { label: string; sortKeyValue: SortKey }) => (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground"
      onClick={() => handleSort(sortKeyValue)}
    >
      {label}
      {sortKey === sortKeyValue && (sortAsc ? ' ↑' : ' ↓')}
    </TableHead>
  )

  if (terms.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">尚無術語</p>
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHeader label="原文" sortKeyValue="original" />
            <SortableHeader label="中文翻譯" sortKeyValue="translation" />
            <TableHead>梵文</TableHead>
            <SortableHeader label="分類" sortKeyValue="category" />
            <TableHead>來源文章</TableHead>
            <SortableHeader label="日期" sortKeyValue="added_at" />
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-medium">{t.original}</TableCell>
              <TableCell>{t.translation}</TableCell>
              <TableCell className="text-muted-foreground">{t.sanskrit || '-'}</TableCell>
              <TableCell>
                <Badge variant="outline">
                  {CATEGORY_LABELS[t.category] ?? t.category}
                </Badge>
              </TableCell>
              <TableCell className="max-w-40 truncate text-xs text-muted-foreground">
                {t.source_article || '-'}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {t.added_at.split('T')[0]}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(t.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定刪除？</AlertDialogTitle>
            <AlertDialogDescription>
              刪除後將無法復原，術語將從 GitHub 上的 glossary.json 中移除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) onDelete(deleteId)
                setDeleteId(null)
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
