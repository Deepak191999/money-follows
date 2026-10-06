import { formatPaise, rupeesToPaise } from './money'

describe('formatPaise', () => {
  it('formats paise as INR with two decimals', () => {
    expect(formatPaise(450000)).toBe('₹4,500.00')
    expect(formatPaise(106667)).toBe('₹1,066.67')
    expect(formatPaise(0)).toBe('₹0.00')
  })

  it('formats negative balances', () => {
    expect(formatPaise(-25000)).toBe('-₹250.00')
  })
})

describe('rupeesToPaise', () => {
  it('converts rupee strings to integer paise', () => {
    expect(rupeesToPaise('12.34')).toBe(1234)
    expect(rupeesToPaise('0.1')).toBe(10)
    expect(rupeesToPaise('999')).toBe(99900)
  })

  it('returns NaN for unparsable input', () => {
    expect(rupeesToPaise('abc')).toBeNaN()
  })
})
