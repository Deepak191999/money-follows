import { MoneyPipe, toPaise } from './money.pipe';

describe('MoneyPipe', () => {
  const pipe = new MoneyPipe();

  it('formats paise as INR with two decimals', () => {
    expect(pipe.transform(450000)).toBe('₹4,500.00');
    expect(pipe.transform(99900)).toBe('₹999.00');
    expect(pipe.transform(5)).toBe('₹0.05');
  });

  it('formats negative balances', () => {
    expect(pipe.transform(-106667)).toBe('-₹1,066.67');
  });

  it('treats null as zero', () => {
    expect(pipe.transform(null)).toBe('₹0.00');
  });
});

describe('toPaise', () => {
  it('converts rupees to integer paise', () => {
    expect(toPaise('12.34')).toBe(1234);
    expect(toPaise(0.1 + 0.2)).toBe(30);
    expect(toPaise('1000')).toBe(100000);
  });
});
