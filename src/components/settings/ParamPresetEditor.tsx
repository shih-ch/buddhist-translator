import { useState } from 'react'
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAIFunctionsStore } from '@/stores/aiFunctionsStore'
import type { TranslationParams, TranslationPreset } from '@/types/settings'

const defaultParams: TranslationParams = {
  keepOriginalPerLine: true,
  narrativePerLine: false,
  fiveColumnMode: false,
  fiveColumnScope: '全文',
  tibetanTranslitMode: 'A1',
  mantraTranslit: 'IAST',
  onlyVerseMantra: false,
  proofreadMode: 'off',
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm">{label}</Label>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${value ? 'bg-primary' : 'bg-muted'}`}
      >
        <span className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg transition-transform ${value ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}

function PresetForm({ preset, onSave, onCancel }: {
  preset: TranslationPreset
  onSave: (p: TranslationPreset) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(preset)

  const updateParam = <K extends keyof TranslationParams>(key: K, value: TranslationParams[K]) => {
    setDraft({ ...draft, params: { ...draft.params, [key]: value } })
  }

  return (
    <Card className="border-primary/50">
      <CardContent className="space-y-3 pt-4">
        <div className="grid grid-cols-[60px_1fr] gap-3">
          <div className="space-y-1">
            <Label className="text-xs">圖示</Label>
            <Input value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} className="text-center" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">名稱</Label>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <Toggle label="保留原文逐句" value={draft.params.keepOriginalPerLine} onChange={(v) => updateParam('keepOriginalPerLine', v)} />
          <Toggle label="敘述段逐句對照" value={draft.params.narrativePerLine} onChange={(v) => updateParam('narrativePerLine', v)} />
          <Toggle label="多語五欄模式" value={draft.params.fiveColumnMode} onChange={(v) => updateParam('fiveColumnMode', v)} />
          <Toggle label="只輸出偈頌/咒語段" value={draft.params.onlyVerseMantra} onChange={(v) => updateParam('onlyVerseMantra', v)} />
        </div>

        {draft.params.fiveColumnMode && (
          <div className="space-y-1">
            <Label className="text-xs">五欄範圍</Label>
            <Input value={draft.params.fiveColumnScope} onChange={(e) => updateParam('fiveColumnScope', e.target.value)} />
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Tibetan 轉寫</Label>
            <Select value={draft.params.tibetanTranslitMode} onValueChange={(v) => updateParam('tibetanTranslitMode', v as 'A1' | 'A2')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="A1">A1 (Wylie)</SelectItem>
                <SelectItem value="A2">A2 (藏音羅馬音)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">梵語轉寫</Label>
            <Select value={draft.params.mantraTranslit} onValueChange={(v) => updateParam('mantraTranslit', v as TranslationParams['mantraTranslit'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="IAST">IAST</SelectItem>
                <SelectItem value="keep_original">保留原狀</SelectItem>
                <SelectItem value="if_possible">能則提供</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">勘誤模式</Label>
            <Select value={draft.params.proofreadMode} onValueChange={(v) => updateParam('proofreadMode', v as TranslationParams['proofreadMode'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="off">關閉</SelectItem>
                <SelectItem value="annotate_only">標註不改</SelectItem>
                <SelectItem value="allow_correction">允許校正</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="mr-1 h-3 w-3" />取消
          </Button>
          <Button size="sm" onClick={() => onSave(draft)} disabled={!draft.name.trim()}>
            <Save className="mr-1 h-3 w-3" />儲存
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function ParamPresetEditor() {
  const { presets, updatePresets } = useAIFunctionsStore()
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)

  const handleSave = (index: number, preset: TranslationPreset) => {
    const updated = [...presets]
    updated[index] = preset
    updatePresets(updated)
    setEditingIndex(null)
  }

  const handleAdd = (preset: TranslationPreset) => {
    updatePresets([...presets, preset])
    setAdding(false)
  }

  const handleDelete = (index: number) => {
    updatePresets(presets.filter((_, i) => i !== index))
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>翻譯參數預設組合</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setAdding(true)} disabled={adding}>
            <Plus className="mr-1 h-3 w-3" />新增
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {presets.map((preset, i) =>
          editingIndex === i ? (
            <PresetForm
              key={i}
              preset={preset}
              onSave={(p) => handleSave(i, p)}
              onCancel={() => setEditingIndex(null)}
            />
          ) : (
            <div key={i} className="flex items-center justify-between rounded-md border p-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{preset.icon}</span>
                <span className="font-medium">{preset.name}</span>
                <span className="text-xs text-muted-foreground">
                  {preset.params.fiveColumnMode ? '五欄' : '標準'}
                  {preset.params.onlyVerseMantra ? ' | 僅偈頌' : ''}
                  {preset.params.proofreadMode !== 'off' ? ' | 勘誤' : ''}
                </span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingIndex(i)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(i)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )
        )}
        {adding && (
          <PresetForm
            preset={{ name: '', icon: '📝', params: defaultParams }}
            onSave={handleAdd}
            onCancel={() => setAdding(false)}
          />
        )}
      </CardContent>
    </Card>
  )
}
