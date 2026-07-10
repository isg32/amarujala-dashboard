"use client";

import { useRouter } from "next/navigation";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";

type Option = { id: number; label: string };

export function ReaderPicker({ readerOptions, selectedReaderId }: { readerOptions: Option[]; selectedReaderId?: number }) {
  const router = useRouter();

  return (
    <Select
      value={selectedReaderId ? String(selectedReaderId) : undefined}
      onValueChange={(v) => router.push(v ? `/attendance?readerId=${v}` : "/attendance")}
      items={Object.fromEntries(readerOptions.map((o) => [String(o.id), o.label]))}
    >
      <SelectTrigger className="w-72">
        <SelectValue placeholder="Select a reader" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {readerOptions.map((o) => (
            <SelectItem key={o.id} value={String(o.id)}>
              {o.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
