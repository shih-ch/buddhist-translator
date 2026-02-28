import { useState, useMemo, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { parse84000Txt, toGlossaryTerms, type Raw84000Entry } from '@/services/parse84000'
import { useGlossaryStore } from '@/stores/glossaryStore'
import { toast } from 'sonner'

const TYPE_LABELS: Record<string, string> = {
  'eft:term': '術語',
  'eft:person': '人名',
  'eft:place': '地名',
  'eft:text': '經典',
}

interface Import84000DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function Import84000Dialog({ open, onOpenChange }: Import84000DialogProps) {
  const { glossary, addTermsBatch, updateTermsBatch } = useGlossaryStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [entries, setEntries] = useState<Raw84000Entry[]>([])
  const [fileName, setFileName] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    new Set(['eft:term', 'eft:person', 'eft:place', 'eft:text']),
  )
  const [onlyChinese, setOnlyChinese] = useState(false)
  const [onlyDefinition, setOnlyDefinition] = useState(false)
  const [importing, setImporting] = useState(false)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const text = await file.text()
    const parsed = parse84000Txt(text)
    setEntries(parsed)
    setFileName(file.name)
  }

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (!selectedTypes.has(e.type)) return false
      if (onlyChinese && !e.chinese) return false
      if (onlyDefinition && !e.definition) return false
      return true
    })
  }, [entries, selectedTypes, onlyChinese, onlyDefinition])

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of entries) {
      counts[e.type] = (counts[e.type] || 0) + 1
    }
    return counts
  }, [entries])

  const toggleType = (type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const existingTermMap = new Map(
        (glossary?.terms ?? []).map((t) => [t.original.toLowerCase(), t]),
      )
      const { terms, merged, skipped } = toGlossaryTerms(filtered, existingTermMap)
      if (terms.length > 0) {
        await addTermsBatch(terms)
      }
      if (merged.length > 0) {
        await updateTermsBatch(merged)
      }
      const parts: string[] = []
      if (terms.length > 0) parts.push(`新增 ${terms.length} 筆`)
      if (merged.length > 0) parts.push(`合併 ${merged.length} 筆`)
      if (skipped > 0) parts.push(`跳過 ${skipped} 筆重複`)
      toast.success(parts.join('，') || '無變更')
      onOpenChange(false)
      setEntries([])
      setFileName('')
    } catch (err) {
      toast.error(`匯入失敗：${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setImporting(false)
    }
  }

  const preview = filtered.slice(0, 50)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>匯入 84000 術語表</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File input */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              className="hidden"
              onChange={handleFile}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              選擇 .txt 檔案
            </Button>
            {fileName && <span className="ml-3 text-sm text-muted-foreground">{fileName}</span>}
          </div>

          {entries.length > 0 && (
            <>
              {/* Stats */}
              <p className="text-sm text-muted-foreground">
                共 {entries.length} 筆，篩選後 {filtered.length} 筆
              </p>

              {/* Filters */}
              <div className="flex flex-wrap gap-4">
                {Object.entries(TYPE_LABELS).map(([type, label]) => (
                  <div key={type} className="flex items-center gap-2">
                    <Checkbox
                      id={`type-${type}`}
                      checked={selectedTypes.has(type)}
                      onCheckedChange={() => toggleType(type)}
                    />
                    <Label htmlFor={`type-${type}`} className="text-sm">
                      {label} ({typeCounts[type] || 0})
                    </Label>
                  </div>
                ))}
              </div>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="only-chinese"
                    checked={onlyChinese}
                    onCheckedChange={(v) => setOnlyChinese(!!v)}
                  />
                  <Label htmlFor="only-chinese" className="text-sm">僅有中文翻譯</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="only-definition"
                    checked={onlyDefinition}
                    onCheckedChange={(v) => setOnlyDefinition(!!v)}
                  />
                  <Label htmlFor="only-definition" className="text-sm">僅有定義</Label>
                </div>
              </div>

              {/* Preview table */}
              <ScrollArea className="h-64 rounded border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b">
                      <th className="px-2 py-1 text-left">英文名</th>
                      <th className="px-2 py-1 text-left">梵文</th>
                      <th className="px-2 py-1 text-left">中文</th>
                      <th className="px-2 py-1 text-left">類型</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((e, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-2 py-1">{e.translated[0] || ''}</td>
                        <td className="px-2 py-1">{e.sanskrit[0] || ''}</td>
                        <td className="px-2 py-1">{e.chinese}</td>
                        <td className="px-2 py-1">{TYPE_LABELS[e.type] || e.type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length > 50 && (
                  <p className="p-2 text-xs text-muted-foreground text-center">
                    僅顯示前 50 筆...
                  </p>
                )}
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleImport} disabled={filtered.length === 0 || importing}>
            {importing ? '匯入中...' : `匯入 ${filtered.length} 筆`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
