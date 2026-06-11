/** Allow only non-negative decimal amounts (e.g. "0.5", "12." while typing). */
export function sanitizeAmountInput(raw: string, maxDecimals: number): string {
  const cleaned = raw.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const match = cleaned.match(new RegExp(`^\\d*(?:\\.\\d{0,${maxDecimals}})?`));
  return match?.[0] ?? '';
}
