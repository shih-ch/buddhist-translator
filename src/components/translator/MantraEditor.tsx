import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown, Sparkles, Wand2, SeparatorVertical } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import type { Mantra } from '@/types/mantra'
import type { AIProviderId } from '@/types/settings'
import {
  extractMantras,
  formatMantra,
  extractMantrasFromMarkdown,
  insertMantrasIntoMarkdown,
  findMantraSection,
  emptyMantra,
  parsePhoneticParens,
  isPhoneticAnnotationLabel,
  type ModelOverride,
} from '@/services/mantraFormatter'
import { AI_PROVIDERS } from '@/stores/aiModels'

const MODEL_STORAGE_KEY = 'bt-mantra-model-override'
const DEFAULT_MODEL_VALUE = '__default__'

function modelKey(override: ModelOverride | null): string {
  return override ? `${override.provider}::${override.model}` : DEFAULT_MODEL_VALUE
}

function parseModelKey(value: string): ModelOverride | null {
  if (value === DEFAULT_MODEL_VALUE) return null
  const [provider, model] = value.split('::')
  if (!provider || !model) return null
  return { provider: provider as AIProviderId, model }
}

function loadModelOverride(): ModelOverride | null {
  try {
    const raw = localStorage.getItem(MODEL_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ModelOverride
    if (parsed?.provider && parsed?.model) return parsed
    return null
  } catch {
    return null
  }
}

interface MantraEditorProps {
  open: boolean
  onClose: () => void
  currentMarkdown: string
  onApply: (newMarkdown: string) => void
}

const COMMON_ROW_LABELS = [
  '悉曇',
  '天城體',
  '藏文',
  'Wylie',
  'IAST',
  '中文音譯',
  '字義',
]

function PhoneticPreview({ text }: { text: string }) {
  if (!text || !/[()（）]/.test(text)) return null
  const parts = parsePhoneticParens(text)
  return (
    <div className="text-xs text-muted-foreground mt-0.5">
      → {parts.map((p, i) => p.kind === 'note'
        ? <sub key={i} className="text-[0.65em] mx-0.5">({p.text})</sub>
        : <span key={i}>{p.text}</span>
      )}
    </div>
  )
}

function MantraCard({
  mantra,
  index,
  total,
  modelOverride,
  onChange,
  onMove,
  onDelete,
}: {
  mantra: Mantra
  modelOverride: ModelOverride | null
  index: number
  total: number
  onChange: (m: Mantra) => void
  onMove: (dir: -1 | 1) => void
  onDelete: () => void
}) {
  const [formatting, setFormatting] = useState(false)

  const updateRow = (rowIdx: number, label: string) => {
    const oldLabel = mantra.rows[rowIdx].label
    if (oldLabel === label) return
    const newRows = mantra.rows.map((r, i) => i === rowIdx ? { label } : r)
    const newSegments = mantra.segments.map((seg) => {
      const ns: Record<string, string> = { ...seg }
      if (oldLabel in ns) {
        ns[label] = ns[oldLabel]
        delete ns[oldLabel]
      }
      return ns
    })
    onChange({ ...mantra, rows: newRows, segments: newSegments })
  }

  const moveRow = (rowIdx: number, dir: -1 | 1) => {
    const newIdx = rowIdx + dir
    if (newIdx < 0 || newIdx >= mantra.rows.length) return
    const newRows = [...mantra.rows]
    ;[newRows[rowIdx], newRows[newIdx]] = [newRows[newIdx], newRows[rowIdx]]
    onChange({ ...mantra, rows: newRows })
  }

  const deleteRow = (rowIdx: number) => {
    const label = mantra.rows[rowIdx].label
    const newRows = mantra.rows.filter((_, i) => i !== rowIdx)
    const newSegments = mantra.segments.map((seg) => {
      const ns = { ...seg }
      delete ns[label]
      return ns
    })
    onChange({ ...mantra, rows: newRows, segments: newSegments })
  }

  const addRow = () => {
    const used = new Set(mantra.rows.map((r) => r.label))
    const next = COMMON_ROW_LABELS.find((l) => !used.has(l)) ?? `欄位 ${mantra.rows.length + 1}`
    onChange({ ...mantra, rows: [...mantra.rows, { label: next }] })
  }

  const updateCell = (segIdx: number, rowLabel: string, value: string) => {
    const newSegments = mantra.segments.map((seg, i) =>
      i === segIdx ? { ...seg, [rowLabel]: value } : seg
    )
    onChange({ ...mantra, segments: newSegments })
  }

  const addSegment = () => {
    const empty: Record<string, string> = {}
    for (const r of mantra.rows) empty[r.label] = ''
    onChange({ ...mantra, segments: [...mantra.segments, empty] })
  }

  const deleteSegment = (segIdx: number) => {
    const segments = mantra.segments.filter((_, i) => i !== segIdx)
    // Re-index breaks: any break > segIdx shifts down by 1; break == segIdx is dropped
    const breaks = (mantra.breaks ?? [])
      .filter((b) => b !== segIdx)
      .map((b) => (b > segIdx ? b - 1 : b))
    onChange({ ...mantra, segments, breaks: breaks.length > 0 ? breaks : undefined })
  }

  const toggleBreakAt = (segIdx: number) => {
    if (segIdx <= 0) return  // can't break at the very first segment
    const current = mantra.breaks ?? []
    const next = current.includes(segIdx)
      ? current.filter((b) => b !== segIdx)
      : [...current, segIdx].sort((a, b) => a - b)
    onChange({ ...mantra, breaks: next.length > 0 ? next : undefined })
  }

  const breakSet = new Set(mantra.breaks ?? [])

  // Per-segment fill stats: how many of mantra.rows have a non-empty value
  // in this segment. Used to flag potentially misaligned segments.
  const segmentFillCounts = mantra.segments.map((seg) =>
    mantra.rows.reduce((acc, r) => acc + ((seg[r.label] ?? '').trim() ? 1 : 0), 0)
  )
  const totalRows = mantra.rows.length

  const handleAIFormat = async () => {
    setFormatting(true)
    try {
      const formatted = await formatMantra(mantra, modelOverride ?? undefined)
      onChange(formatted)
      toast.success('已重排此真言')
    } catch (err) {
      toast.error(`重排失敗：${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setFormatting(false)
    }
  }

  return (
    <Card className="relative">
      <CardHeader className="flex flex-row items-center justify-between gap-2 py-3">
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">真言 #{index + 1} 標題</Label>
          <Input
            value={mantra.title}
            onChange={(e) => onChange({ ...mantra, title: e.target.value })}
            placeholder="例：阿閦如來念誦供養法懺悔真言"
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Button size="icon" variant="ghost" onClick={() => onMove(-1)} disabled={index === 0} title="上移">
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onMove(1)} disabled={index === total - 1} title="下移">
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete} title="刪除">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Rows config */}
        <div>
          <Label className="text-xs text-muted-foreground">列（rows，由上而下顯示順序）</Label>
          <div className="space-y-1 mt-1">
            {mantra.rows.map((row, rIdx) => (
              <div key={rIdx} className="flex items-center gap-1">
                <Input
                  className="flex-1 h-8 text-sm"
                  value={row.label}
                  onChange={(e) => updateRow(rIdx, e.target.value)}
                  list="mantra-row-labels"
                  autoComplete="off"
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveRow(rIdx, -1)} disabled={rIdx === 0}>
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveRow(rIdx, 1)} disabled={rIdx === mantra.rows.length - 1}>
                  <ArrowDown className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteRow(rIdx)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={addRow}>
              <Plus className="h-3 w-3 mr-1" /> 新增列
            </Button>
          </div>
        </div>

        {/* Segments table */}
        <div>
          <Label className="text-xs text-muted-foreground">段落（每欄為一個音節）</Label>
          <div className="overflow-x-auto border rounded mt-1">
            <table className="text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-2 py-1 text-xs font-medium text-left whitespace-nowrap border-r">列 \ 段</th>
                  {mantra.segments.map((_, sIdx) => {
                    const hasBreak = breakSet.has(sIdx)
                    const filled = segmentFillCounts[sIdx]
                    const partial = filled > 0 && filled < totalRows
                    return (
                      <th
                        key={sIdx}
                        className={`px-2 py-1 text-xs font-medium text-center min-w-[140px] border-r ${
                          hasBreak ? 'border-l-4 border-l-primary' : ''
                        } ${partial ? 'bg-amber-50 dark:bg-amber-950/30' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <Button
                            size="icon"
                            variant={hasBreak ? 'secondary' : 'ghost'}
                            className="h-5 w-5"
                            onClick={() => toggleBreakAt(sIdx)}
                            disabled={sIdx === 0}
                            title={
                              sIdx === 0
                                ? '第一段不能設分節'
                                : hasBreak
                                ? '取消分節'
                                : '在此處分節（拆成下一個小表格）'
                            }
                          >
                            <SeparatorVertical
                              className={`h-3 w-3 ${hasBreak ? 'text-primary' : 'text-muted-foreground'}`}
                            />
                          </Button>
                          <span
                            className={partial ? 'text-amber-700 dark:text-amber-400' : ''}
                            title={partial ? `對齊未完整：${filled}/${totalRows} rows 有內容` : `對齊完整：${filled}/${totalRows}`}
                          >
                            S{sIdx + 1}{partial ? ' ⚠' : ''}
                          </span>
                          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => deleteSegment(sIdx)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </th>
                    )
                  })}
                  <th className="px-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={addSegment} title="新增段落">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {mantra.rows.map((row) => {
                  const phonetic = isPhoneticAnnotationLabel(row.label)
                  return (
                    <tr key={row.label}>
                      <td className="px-2 py-1 text-xs font-medium whitespace-nowrap border-r bg-muted/10">{row.label}</td>
                      {mantra.segments.map((seg, sIdx) => (
                        <td
                          key={sIdx}
                          className={`border-r p-1 align-top ${
                            breakSet.has(sIdx) ? 'border-l-4 border-l-primary' : ''
                          }`}
                        >
                          <Input
                            className="h-7 text-sm"
                            value={seg[row.label] ?? ''}
                            onChange={(e) => updateCell(sIdx, row.label, e.target.value)}
                            autoComplete="off"
                          />
                          {phonetic && <PhoneticPreview text={seg[row.label] ?? ''} />}
                        </td>
                      ))}
                      <td />
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
              {(mantra.breaks?.length ?? 0) > 0 && (
                <p>已分為 {(mantra.breaks?.length ?? 0) + 1} 個小表格（藍色豎線標示分節點）</p>
              )}
              {segmentFillCounts.some((c) => c > 0 && c < totalRows) && (
                <p className="text-amber-700 dark:text-amber-400">
                  ⚠ 有 {segmentFillCounts.filter((c) => c > 0 && c < totalRows).length} 個 segment 對齊未完整（標題列以黃底標示）。可手動補齊或按「AI 重排這個真言」自動修正對齊。
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div>
          <Label className="text-xs text-muted-foreground">整體意譯（summary）</Label>
          <Textarea
            className="text-sm min-h-[60px] mt-1"
            value={mantra.summary}
            onChange={(e) => onChange({ ...mantra, summary: e.target.value })}
            placeholder="例：唵！以金剛之威神，焚燒並摧毀一切罪業，成就圓滿。"
            autoComplete="off"
          />
        </div>

        {/* Notes */}
        <div>
          <Label className="text-xs text-muted-foreground">備註（notes，選填）</Label>
          <Input
            className="h-8 text-sm mt-1"
            value={mantra.notes ?? ''}
            onChange={(e) => onChange({ ...mantra, notes: e.target.value })}
            autoComplete="off"
          />
        </div>

        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={handleAIFormat} disabled={formatting}>
            {formatting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />}
            AI 重排這個真言
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function MantraEditor({ open, onClose, currentMarkdown, onApply }: MantraEditorProps) {
  const [mantras, setMantras] = useState<Mantra[]>([])
  const [sourceMode, setSourceMode] = useState<'whole' | 'selection' | 'manual'>('whole')
  const [selectionText, setSelectionText] = useState('')
  const [manualText, setManualText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [insertMode, setInsertMode] = useState<'append' | 'replace'>('replace')
  const [modelOverride, setModelOverrideState] = useState<ModelOverride | null>(loadModelOverride())

  const setModelOverride = (next: ModelOverride | null) => {
    setModelOverrideState(next)
    try {
      if (next) localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(next))
      else localStorage.removeItem(MODEL_STORAGE_KEY)
    } catch {
      /* no-op */
    }
  }

  const hasExistingSection = useMemo(
    () => findMantraSection(currentMarkdown) !== null,
    [currentMarkdown]
  )

  // Load existing mantras when dialog opens
  useEffect(() => {
    if (open) {
      const existing = extractMantrasFromMarkdown(currentMarkdown)
      setMantras(existing)
      setInsertMode(hasExistingSection ? 'replace' : 'append')
      // Capture current text selection if present
      try {
        const sel = window.getSelection()?.toString().trim() ?? ''
        if (sel) {
          setSelectionText(sel)
          setSourceMode('selection')
        }
      } catch {
        /* no-op */
      }
    }
  }, [open, currentMarkdown, hasExistingSection])

  const handleExtract = async () => {
    let sourceText = ''
    if (sourceMode === 'whole') sourceText = currentMarkdown
    else if (sourceMode === 'selection') sourceText = selectionText
    else sourceText = manualText

    if (!sourceText.trim()) {
      toast.error('沒有可抽取的文字')
      return
    }

    setExtracting(true)
    try {
      const extracted = await extractMantras(sourceText, modelOverride ?? undefined)
      if (extracted.length === 0) {
        toast.warning('沒有偵測到真言')
        return
      }
      setMantras((prev) => [...prev, ...extracted])
      toast.success(`抽取到 ${extracted.length} 條真言`)
    } catch (err) {
      toast.error(`抽取失敗：${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setExtracting(false)
    }
  }

  const handleApply = () => {
    if (mantras.length === 0) {
      toast.error('沒有真言可插入')
      return
    }
    const cleaned = mantras.filter(
      (m) => m.title.trim() || m.segments.length > 0 || m.summary.trim()
    )
    if (cleaned.length === 0) {
      toast.error('真言內容皆為空')
      return
    }
    const newMd = insertMantrasIntoMarkdown(currentMarkdown, cleaned, insertMode)
    onApply(newMd)
    toast.success(`已${insertMode === 'replace' ? '替換' : '加入'}文章`)
    onClose()
  }

  const updateMantra = (idx: number, m: Mantra) => {
    setMantras((prev) => prev.map((p, i) => (i === idx ? m : p)))
  }

  const moveMantra = (idx: number, dir: -1 | 1) => {
    setMantras((prev) => {
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const arr = [...prev]
      ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
      return arr
    })
  }

  const deleteMantra = (idx: number) => {
    setMantras((prev) => prev.filter((_, i) => i !== idx))
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>真言整理</DialogTitle>
        </DialogHeader>

        <datalist id="mantra-row-labels">
          {COMMON_ROW_LABELS.map((l) => <option key={l} value={l} />)}
        </datalist>

        {/* Source selection */}
        <div className="border rounded p-3 space-y-2 shrink-0">
          <div className="flex items-center gap-3 text-sm">
            <Label className="text-xs font-medium">來源：</Label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={sourceMode === 'whole'} onChange={() => setSourceMode('whole')} />
              整篇文章
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={sourceMode === 'selection'} onChange={() => setSourceMode('selection')} disabled={!selectionText} />
              選取段落 {selectionText && <span className="text-xs text-muted-foreground">({selectionText.length} 字)</span>}
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={sourceMode === 'manual'} onChange={() => setSourceMode('manual')} />
              手動貼上
            </label>
          </div>
          {sourceMode === 'manual' && (
            <Textarea
              className="text-sm min-h-[80px]"
              placeholder="貼上含真言的文字..."
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
            />
          )}
          <div className="flex items-center gap-2 text-xs">
            <Label className="text-xs font-medium">模型：</Label>
            <Select
              value={modelKey(modelOverride)}
              onValueChange={(v) => setModelOverride(parseModelKey(v))}
            >
              <SelectTrigger className="h-7 text-xs flex-1 max-w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_MODEL_VALUE}>
                  使用設定預設（AI 功能 → 真言抽取/重排）
                </SelectItem>
                {(Object.keys(AI_PROVIDERS) as AIProviderId[]).map((pid) => (
                  <SelectGroup key={pid}>
                    <SelectLabel>{AI_PROVIDERS[pid].name}</SelectLabel>
                    {AI_PROVIDERS[pid].models.map((m) => (
                      <SelectItem key={`${pid}::${m.id}`} value={`${pid}::${m.id}`}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">套用於抽取與重排</span>
          </div>
          <div className="flex justify-between items-center">
            <Button size="sm" variant="default" onClick={handleExtract} disabled={extracting}>
              {extracting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
              AI 抽取真言
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMantras((prev) => [...prev, emptyMantra()])}>
              <Plus className="h-3 w-3 mr-1" /> 手動新增空白真言
            </Button>
          </div>
        </div>

        {/* Mantras list */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-3 -mr-3">
          <div className="space-y-3 py-2">
            {mantras.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                尚無真言。點上方「AI 抽取真言」或「手動新增空白真言」開始。
              </div>
            ) : (
              mantras.map((m, idx) => (
                <MantraCard
                  key={idx}
                  mantra={m}
                  index={idx}
                  total={mantras.length}
                  modelOverride={modelOverride}
                  onChange={(updated) => updateMantra(idx, updated)}
                  onMove={(dir) => moveMantra(idx, dir)}
                  onDelete={() => deleteMantra(idx)}
                />
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t pt-3 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3 text-sm">
            <Label className="text-xs font-medium">插入位置：</Label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={insertMode === 'append'} onChange={() => setInsertMode('append')} />
              附加到末尾
            </label>
            <label className="flex items-center gap-1" title={hasExistingSection ? '' : '文章中沒有現有真言整理區塊'}>
              <input type="radio" checked={insertMode === 'replace'} onChange={() => setInsertMode('replace')} />
              {hasExistingSection ? '替換現有真言整理區塊' : '建立真言整理區塊'}
            </label>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button onClick={handleApply} disabled={mantras.length === 0}>
              插入文章
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
