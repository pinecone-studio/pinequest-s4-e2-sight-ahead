"use client"

import { useEffect, useRef } from "react"

type NoteEditorProps = {
  draft: string
  onDraftChange: (value: string) => void
  onAddNote: () => void
}

export function NoteEditor({ draft, onDraftChange, onAddNote }: NoteEditorProps) {
  const canSave = draft.trim().length > 0
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Бичсэн хэмжээгээр өндрөө автоматаар тохируулна (scrollbar гаргахгүй).
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`
  }, [draft])

  return (
    <div className="dashboard-note-editor">
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          // Enter → хадгалах (видеоны яг тэр агшны цагтай), Shift+Enter → шинэ мөр
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault()
            if (canSave) onAddNote()
          }
        }}
        rows={1}
        placeholder="Тэмдэглэл бичих…"
        className="dashboard-note-textarea"
      />
      <button
        type="button"
        onClick={onAddNote}
        disabled={!canSave}
        className="dashboard-send-button"
        aria-label="Хадгалах"
        title="Хадгалах (Enter)"
      >
        →
      </button>
    </div>
  )
}
