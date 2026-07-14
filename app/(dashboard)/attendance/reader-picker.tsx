"use client";

import { useRouter } from "next/navigation";
import { ReaderSearchCombobox } from "../readers/reader-search-combobox";

export function ReaderPicker({ selectedReaderLabel }: { selectedReaderLabel?: string }) {
  const router = useRouter();

  return (
    <div className="w-72">
      <ReaderSearchCombobox
        initialLabel={selectedReaderLabel}
        onSelect={(reader) => router.push(`/attendance?readerId=${reader.id}`)}
      />
    </div>
  );
}
