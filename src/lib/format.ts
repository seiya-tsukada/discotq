// いいね数などの件数表示。1万以上は「1.2万」のように縮める
export const formatCount = (n: number): string => {
  if (n < 10_000) return String(n);
  const man = Math.floor(n / 1_000) / 10;
  return `${Number.isInteger(man) ? man.toFixed(0) : man.toFixed(1)}万`;
};
