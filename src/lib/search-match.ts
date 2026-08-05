// Splits the query into words and requires every word to appear somewhere
// in the haystack (order-independent), so "grape nasty" matches "Nasty
// Trap Series Grape 60ml" -- a single contiguous substring match would miss it.
export function matchesSearch(haystack: string, query: string): boolean {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const h = haystack.toLowerCase();
  return words.every((w) => h.includes(w));
}
