import { useState } from 'react'
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useCorrectionShortcutsStore } from '@/stores/correctionShortcutsStore'
import { toast } from 'sonner'

export function CorrectionShortcuts() {
  const shortcuts = useCorrectionShortcutsStore((s) => s.shortcuts)
  const addShortcut = useCorrectionShortcutsStore((s) => s.addShortcut)
  const updateShortcut = useCorrectionShortcutsStore((s) => s.updateShortcut)
  const deleteShortcut = useCorrectionShortcutsStore((s) => s.deleteShortcut)

  const [newLabel, setNewLabel] = useState('')
  const [newText, setNewText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editText, setEditText] = useState('')

  const handleAdd = () => {
    if (!newLabel.trim() || !newText.trim()) {
      toast.error('請填寫標籤和內容')
      return
    }
    addShortcut(newLabel.trim(), newText.trim())
    setNewLabel('')
    setNewText('')
    toast.success('已新增快捷修正')
  }

  const handleEdit = (id: string) => {
    const s = shortcuts.find((x) => x.id === id)
    if (!s) return
    setEditingId(id)
    setEditLabel(s.label)
    setEditText(s.text)
  }

  const handleSaveEdit = () => {
    if (!editingId || !editLabel.trim() || !editText.trim()) return
    updateShortcut(editingId, { label: editLabel.trim(), text: editText.trim() })
    setEditingId(null)
    toast.success('已更新')
  }

  const handleDelete = (id: string) => {
    deleteShortcut(id)
    toast.success('已刪除')
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="text-sm font-medium">新增快捷修正</h3>
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">標籤</Label>
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="例：補原文"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">插入內容</Label>
            <Textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="例：請在翻譯中補上原文對照"
              className="min-h-[60px] text-sm"
            />
          </div>
        </div>
        <Button size="sm" onClick={handleAdd} disabled={!newLabel.trim() || !newText.trim()}>
          <Plus className="mr-1 h-3 w-3" />
          新增
        </Button>
      </div>

      {shortcuts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          尚未新增任何快捷修正
        </p>
      ) : (
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div key={s.id} className="rounded-lg border p-3">
              {editingId === s.id ? (
                <div className="space-y-2">
                  <Input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="min-h-[60px] text-sm"
                  />
                  <div className="flex gap-1">
                    <Button size="sm" variant="default" onClick={handleSaveEdit}>
                      <Save className="mr-1 h-3 w-3" />儲存
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      <X className="mr-1 h-3 w-3" />取消
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{s.label}</span>
                      <span className="text-xs text-muted-foreground">使用 {s.usageCount} 次</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{s.text}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(s.id)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
