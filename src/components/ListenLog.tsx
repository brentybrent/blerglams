"use client";

import { FormEvent, useState } from "react";
import type { Listen } from "@/lib/types";

function toDateInputValue(iso: string) {
  return iso.slice(0, 10);
}

function EditListenForm({
  listen,
  onSave,
  onCancel,
}: {
  listen: Listen;
  onSave: (date: string, note: string) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(toDateInputValue(listen.listenedAt));
  const [note, setNote] = useState(listen.note ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(date, note);
      }}
      className="flex flex-col gap-2 bg-panel2 rounded-lg p-3"
    >
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="rounded-md bg-panel border border-edge px-2 py-1.5 text-sm"
      />
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        className="rounded-md bg-panel border border-edge px-2 py-1.5 text-sm placeholder:text-muted"
      />
      <div className="flex gap-2">
        <button type="submit" className="text-sm font-medium bg-spotify text-black rounded-md px-3 py-1.5">
          Save
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-muted px-3 py-1.5">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function ListenLog({
  listens,
  onAdd,
  onUpdate,
  onDelete,
}: {
  listens: Listen[];
  onAdd: (date: string, note: string) => void;
  onUpdate: (id: string, date: string, note: string) => void;
  onDelete: (id: string) => void;
}) {
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newNote, setNewNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    onAdd(newDate, newNote);
    setNewNote("");
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2">
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className="rounded-lg bg-panel border border-edge px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder={'Note (optional) — e.g. "road trip, on vinyl"'}
          className="flex-1 rounded-lg bg-panel border border-edge px-3 py-2 text-sm placeholder:text-muted"
        />
        <button type="submit" className="bg-spotify text-black font-medium rounded-lg px-4 py-2 text-sm">
          Log listen
        </button>
      </form>

      {listens.length === 0 && (
        <p className="text-muted text-sm">No listens logged yet.</p>
      )}

      <ul className="space-y-2">
        {listens.map((listen) =>
          editingId === listen.id ? (
            <li key={listen.id}>
              <EditListenForm
                listen={listen}
                onSave={(date, note) => {
                  onUpdate(listen.id, date, note);
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            </li>
          ) : (
            <li
              key={listen.id}
              className="flex items-start justify-between gap-3 bg-panel2 rounded-lg p-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {new Date(listen.listenedAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                {listen.note && <p className="text-sm text-muted mt-0.5">{listen.note}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setEditingId(listen.id)}
                  className="text-xs text-muted hover:text-ink"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(listen.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            </li>
          )
        )}
      </ul>
    </div>
  );
}
