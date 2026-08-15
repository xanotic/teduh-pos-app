export function fmt(n: number) {
  return "RM " + (Math.round(n * 100) / 100).toFixed(2);
}
