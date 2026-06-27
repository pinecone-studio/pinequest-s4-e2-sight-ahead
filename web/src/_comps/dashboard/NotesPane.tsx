"use client"

import { useState } from "react"
import type { Note } from "./data"
import { PENCIL } from "./cursors"
import { NoteEditor } from "./NoteEditor"
import { NoteList } from "./NoteList"
import { NotesHeader } from "./NotesHeader"
import { ReviewPane } from "./ReviewPane"

type NotesPaneProps = {
  notes: Note[]
  draft: string
  mode: "write" | "review"
  justAdded: string | null
  onDraftChange: (value: string) => void
  onAddNote: () => void
  onSetMode: (mode: "write" | "review") => void
  onJump: (time: number) => void
  onOpenSummary: () => void
  onCollapse: () => void
}

export function NotesPane({
  notes,
  draft,
  mode,
  justAdded,
  onDraftChange,
  onAddNote,
  onSetMode,
  onJump,
  onOpenSummary,
  onCollapse,
}: NotesPaneProps) {
  const sorted = [...notes].sort((a, b) => a.time - b.time)
  const isWrite = mode === "write"
  const [isPressing, setIsPressing] = useState(false)

  return (
    <div
      className={isPressing ? "dashboard-notes-pane is-pressing" : "dashboard-notes-pane"}
      onPointerDown={() => setIsPressing(true)}
      onPointerUp={() => setIsPressing(false)}
      onPointerCancel={() => setIsPressing(false)}
      onPointerLeave={() => setIsPressing(false)}
      style={{ cursor: PENCIL }}
    >
      <div className="dashboard-paper" />
      <div className="dashboard-paper-light" />
      <div className="dashboard-notes-content">
        <NotesHeader
          count={sorted.length}
          mode={mode}
          onSetMode={onSetMode}
          onOpenSummary={onOpenSummary}
          onCollapse={onCollapse}
        />
        <div className="dashboard-scroll dashboard-notes-scroll">
          {isWrite ? (
            <div style={{ padding: "4px 24px 16px" }}>
              <NoteList notes={sorted} justAdded={justAdded} onJump={onJump} />
            </div>
          ) : (
            <ReviewPane notes={sorted} onJump={onJump} />
          )}
        </div>
        {isWrite && <NoteEditor draft={draft} onDraftChange={onDraftChange} onAddNote={onAddNote} />}
      </div>
    </div>
  )
}
