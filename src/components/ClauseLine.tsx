"use client";

import { useState } from "react";
import type { SansClause } from "@/data/types";
import { formatClause } from "@/lib/sans/clauses";
import { openSansBook } from "@/lib/sans/open-book";

export function ClauseLine({ clause }: { clause?: SansClause }) {
  const [error, setError] = useState("");
  if (!clause) {
    return (
      <p className="text-xs text-muted-foreground">No SANS 10400 clause for this check.</p>
    );
  }
  const label = formatClause(clause);
  return (
    <div className="space-y-1">
      <button
        type="button"
        className="text-left text-xs text-foreground underline"
        aria-label={`Open ${label}`}
        onClick={() => {
          void openSansBook(clause.book, clause.page).then((message) => setError(message));
        }}
      >
        {label}
      </button>
      {error ? <p className="text-xs text-muted-foreground">{error}</p> : null}
    </div>
  );
}
