import { useState, useRef, useEffect } from 'react'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCorrectionShortcutsStore } from '@/stores/correctionShortcutsStore'

interface ShortcutPickerProps {
  onInsert: (text: string) => void
  disabled?: boolean
}

export function ShortcutPicker({ onInsert, disabled }: ShortcutPickerProps) {
  const shortcuts = useCorrectionShortcutsStore((s) => s.shortcuts)
  const incrementUsage = useCorrectionShortcutsStore((s) => s.incrementUsage)
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (shortcuts.length === 0) return null

  const sorted = [...shortcuts].sort((a, b) => b.usageCount - a.usageCount)

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        title="快捷修正"
      >
        <Zap className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute bottom-full right-0 mb-1 z-50 w-56 rounded-md border bg-popover p-1 shadow-md">
          {sorted.map((s) => (
            <button
              key={s.id}
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground text-left"
              onClick={() => {
                onInsert(s.text)
                incrementUsage(s.id)
                setOpen(false)
              }}
            >
              <span className="truncate">{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
