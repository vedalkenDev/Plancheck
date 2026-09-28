export async function openSansBook(book: string, page: number | null) {
  const params = new URLSearchParams({ part: book });
  if (page) {
    params.set("page", String(page));
  }
  const response = await fetch(`/api/sans/pdf?${params}`);
  const body = (await response.json()) as { url?: string; error?: string };
  if (!response.ok || !body.url) {
    return body.error ?? "Could not open the PDF.";
  }
  window.open(body.url, "_blank", "noopener,noreferrer");
  return "";
}
