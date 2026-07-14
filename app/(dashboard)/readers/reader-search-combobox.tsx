"use client";

import { useRef, useState, useTransition } from "react";
import { searchReadersAction, type ReaderSearchResult } from "./actions";
import { Input } from "@/components/ui/input";

const DEBOUNCE_MS = 300;

// Search-as-you-type reader picker — used anywhere a plain <Select> would
// otherwise need to list every reader in the org (2800+ and growing).
// Queries name/mobile/email/readerCode server-side via searchReadersAction,
// capped to a handful of results, instead of shipping the full reader list
// to the client.
export function ReaderSearchCombobox({
  onSelect,
  placeholder = "Search by name, mobile, or reader ID...",
  initialLabel = "",
  inputId,
}: {
  onSelect: (reader: ReaderSearchResult) => void;
  placeholder?: string;
  initialLabel?: string;
  inputId?: string;
}) {
  const [query, setQuery] = useState(initialLabel);
  const [results, setResults] = useState<ReaderSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(value: string) {
    setQuery(value);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        setResults(await searchReadersAction(value));
      });
    }, DEBOUNCE_MS);
  }

  function handleSelect(reader: ReaderSearchResult) {
    setQuery(`${reader.name} (${reader.readerCode})`);
    setResults([]);
    setOpen(false);
    onSelect(reader);
  }

  return (
    <div className="relative">
      <Input
        id={inputId}
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => query.trim() && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && query.trim().length > 0 && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {pending && <div className="p-2 text-xs text-muted-foreground">Searching...</div>}
          {!pending && results.length === 0 && (
            <div className="p-2 text-xs text-muted-foreground">No readers found.</div>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              className="flex w-full flex-col items-start gap-0.5 border-b p-2 text-left text-xs last:border-0 hover:bg-muted"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(r)}
            >
              <span className="text-sm font-medium">
                {r.name} <span className="text-muted-foreground">({r.readerCode})</span>
              </span>
              <span className="text-muted-foreground">
                {r.mobile} · {r.centerName}, {r.cityName}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
