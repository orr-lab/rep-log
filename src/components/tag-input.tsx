"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function TagInput({
  value,
  onChange,
  placeholder = "Add a tag and press Enter",
  suggestions = [],
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  /** Merged list of previously-used tags + a common-tag catalog. */
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (trimmed && !value.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...value, trimmed]);
    }
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  const filteredSuggestions = useMemo(() => {
    const used = new Set(value.map((t) => t.toLowerCase()));
    const query = draft.trim().toLowerCase();
    const pool = suggestions.filter((s) => !used.has(s.toLowerCase()));
    const matches = query ? pool.filter((s) => s.toLowerCase().includes(query)) : pool;
    return matches.slice(0, 8);
  }, [draft, suggestions, value]);

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring/50">
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="rounded-full p-0.5 hover:bg-foreground/10"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            addTag(draft);
            setOpen(false);
          }}
          placeholder={value.length === 0 ? placeholder : undefined}
          className="h-7 min-w-24 flex-1 border-0 px-1 shadow-none focus-visible:ring-0"
        />
      </div>
      {open && filteredSuggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <ul className="max-h-48 overflow-y-auto py-1 text-sm">
            {filteredSuggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left hover:bg-muted"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addTag(s)}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
