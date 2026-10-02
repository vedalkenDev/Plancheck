"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { openSansBook } from "@/lib/sans/open-book";
import { supabaseBrowser } from "@/lib/supabase/browser";

type HeadingHit = {
  id: number;
  part_letter: string;
  label: string;
  clause_ref: string | null;
  page: number | null;
};

export function SansBook() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<HeadingHit[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function search(event: FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (term.length < 2) {
      setHits([]);
      setStatus("Type at least two characters.");
      return;
    }
    setBusy(true);
    setStatus("");
    const pattern = `"%${term.replace(/[%_,\\"]/g, "")}%"`;
    const { data, error } = await supabaseBrowser()
      .from("headings")
      .select("id, part_letter, label, clause_ref, page, sort_order")
      .or(`label.ilike.${pattern},clause_ref.ilike.${pattern}`)
      .order("part_letter")
      .order("sort_order")
      .limit(20);
    setBusy(false);
    if (error) {
      setHits([]);
      setStatus(error.message);
      return;
    }
    const rows = (data ?? []).map((row) => ({
      id: row.id,
      part_letter: row.part_letter,
      label: row.label,
      clause_ref: row.clause_ref,
      page: row.page,
    }));
    setHits(rows);
    setStatus(rows.length ? "" : "No heading matched.");
  }

  async function openBook(hit: HeadingHit) {
    setStatus("");
    const message = await openSansBook(hit.part_letter, hit.page);
    if (message) {
      setStatus(message);
    }
  }

  return (
    <form onSubmit={(event) => void search(event)} className="space-y-3">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a heading or clause"
          aria-label="Search SANS headings"
          className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Searching" : "Search"}
        </Button>
      </div>
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      {hits.length ? (
        <ul className="divide-y rounded-lg border">
          {hits.map((hit) => (
            <li key={hit.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <p className="min-w-0 text-sm">
                <span className="font-mono text-xs">{hit.part_letter}</span>
                {" "}
                {hit.label}
                {hit.clause_ref ? ` · ${hit.clause_ref}` : ""}
                {hit.page ? ` · p. ${hit.page}` : ""}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => void openBook(hit)}>
                Open book
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
