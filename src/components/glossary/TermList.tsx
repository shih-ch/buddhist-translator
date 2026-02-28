import { useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Pencil, Trash2, ExternalLink, Link as LinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { GlossaryTerm } from '@/types/glossary'
import { LANGUAGE_LABELS } from '@/types/glossary'
import { CATEGORY_LABELS } from './GlossaryStats'

type SortKey = 'original' | 'translation' | 'language' | 'category' | 'added_at'

interface TermListProps {
  terms: GlossaryTerm[]
  onEdit: (term: GlossaryTerm) => void
  onDelete: (id: string) => void
  onDeleteBatch?: (ids: string[]) => void
}

export function TermList({ terms, onEdit, onDelete, onDeleteBatch }: TermListProps) {
  const [sortKey, setSortKey] = useState<SortKey>('added_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)
  const parentRef = useRef<HTMLDivElement>(null)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const sorted = [...terms].sort((a, b) => {
    const av = (a[sortKey] as string) || ''
    const bv = (b[sortKey] as string) || ''
    const cmp = av.localeCompare(bv)
    return sortAsc ? cmp : -cmp
  })

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  })

  const virtualItems = virtualizer.getVirtualItems()
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0
  const paddingBottom =
    virtualItems.length > 0
      ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === sorted.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(sorted.map((t) => t.id)))
    }
  }

  const handleBatchDelete = () => {
    if (onDeleteBatch) {
      onDeleteBatch(Array.from(selected))
    } else {
      for (const id of selected) onDelete(id)
    }
    setSelected(new Set())
    setBatchDeleteOpen(false)
  }

  const isAllSelected = sorted.length > 0 && selected.size === sorted.length
  const isSomeSelected = selected.size > 0 && selected.size < sorted.length

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
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 border-b">
          <span className="text-sm text-muted-foreground">
            已選 {selected.size} 項
          </span>
          <Button
            variant="destructive"
            size="sm"
            className="h-7"
            onClick={() => setBatchDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            刪除選取
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={() => setSelected(new Set())}
          >
            取消選取
          </Button>
        </div>
      )}

      <TooltipProvider>
      <div ref={parentRef} className="overflow-auto" style={{ maxHeight: '70vh' }}>
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={isAllSelected}
                  {...(isSomeSelected ? { 'data-state': 'indeterminate' } : {})}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <SortableHeader label="原文" sortKeyValue="original" />
              <TableHead>藏文</TableHead>
              <SortableHeader label="語言" sortKeyValue="language" />
              <SortableHeader label="中文翻譯" sortKeyValue="translation" />
              <TableHead>梵文</TableHead>
              <SortableHeader label="分類" sortKeyValue="category" />
              <TableHead className="w-8">來源</TableHead>
              <TableHead className="w-8">🔗</TableHead>
              <SortableHeader label="日期" sortKeyValue="added_at" />
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paddingTop > 0 && (
              <tr><td style={{ height: paddingTop }} /></tr>
            )}
            {virtualItems.map((virtualRow) => {
              const t = sorted[virtualRow.index]
              return (
                <TableRow key={t.id} className={selected.has(t.id) ? 'bg-muted/30' : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(t.id)}
                      onCheckedChange={() => toggleSelect(t.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {t.definition ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help underline decoration-dotted">{t.original}</span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm text-xs">
                          {t.definition.length > 200 ? t.definition.slice(0, 200) + '…' : t.definition}
                        </TooltipContent>
                      </Tooltip>
                    ) : t.original}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.tibetan ? (
                      t.wylie ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">{t.tibetan}</span>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">{t.wylie}</TooltipContent>
                        </Tooltip>
                      ) : t.tibetan
                    ) : t.wylie ? (
                      <span className="text-xs italic">{t.wylie}</span>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    {t.language ? (
                      <Badge variant="outline" className="text-[10px]">
                        {LANGUAGE_LABELS[t.language] ?? t.language}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{t.translation}</TableCell>
                  <TableCell className="text-muted-foreground">{t.sanskrit || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {CATEGORY_LABELS[t.category] ?? t.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {t.source_article ? (
                      t.source_article.startsWith('http') ? (
                        <a href={t.source_article} target="_blank" rel="noopener noreferrer" title={t.source_article}>
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground inline" />
                        </a>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-muted-foreground cursor-help">📄</span>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">{t.source_article}</TooltipContent>
                        </Tooltip>
                      )
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {t.link && (
                      <a href={t.link} target="_blank" rel="noopener noreferrer" title={t.link}>
                        <LinkIcon className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      </a>
                    )}
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
              )
            })}
            {paddingBottom > 0 && (
              <tr><td style={{ height: paddingBottom }} /></tr>
            )}
          </TableBody>
        </Table>
      </div>
      </TooltipProvider>

      {/* Single delete dialog */}
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

      {/* Batch delete dialog */}
      <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定刪除 {selected.size} 個術語？</AlertDialogTitle>
            <AlertDialogDescription>
              批量刪除後將無法復原，這些術語將從 GitHub 上的 glossary.json 中移除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchDelete}>
              刪除 {selected.size} 項
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
