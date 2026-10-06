const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatPaise(paise: number): string {
  return inr.format(paise / 100)
}

export function rupeesToPaise(rupees: string | number): number {
  const value = typeof rupees === 'string' ? Number(rupees) : rupees
  if (!Number.isFinite(value)) return NaN
  return Math.round(value * 100)
}

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}
