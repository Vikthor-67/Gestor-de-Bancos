export function parseMoneyNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  let normalized = raw.replace(/\s+/g, '');
  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');

  if (hasComma && hasDot) {
    // 1,234,567.89 -> remove thousand separators
    normalized = normalized.replace(/,/g, '');
  } else if (hasComma && !hasDot) {
    const decimalComma = /,\d{1,2}$/.test(normalized);
    normalized = decimalComma ? normalized.replace(',', '.') : normalized.replace(/,/g, '');
  }

  normalized = normalized.replace(/[^0-9.-]/g, '');
  if (!normalized || normalized === '.' || normalized === '-' || normalized === '-.') {
    return null;
  }

  const num = Number(normalized);
  return Number.isNaN(num) ? null : num;
}

export function formatMoneyNumber(value: unknown): string {
  const parsed = parseMoneyNumber(value);
  if (parsed === null) {
    return '';
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsed);
}
