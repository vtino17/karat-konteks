function shingles(content: string, size = 3): Set<string> {
  const words = content.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? [];
  if (words.length < size) return new Set(words);
  return new Set(
    Array.from({ length: words.length - size + 1 }, (_, index) =>
      words.slice(index, index + size).join(" "),
    ),
  );
}

export function jaccardSimilarity(left: string, right: string): number {
  const a = shingles(left);
  const b = shingles(right);
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = [...a].filter((entry) => b.has(entry)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}
