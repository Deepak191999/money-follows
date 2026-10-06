import { Pipe, PipeTransform } from '@angular/core';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function toPaise(rupees: string | number): number {
  return Math.round(Number(rupees) * 100);
}

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(paise: number | null | undefined): string {
    return inr.format((paise ?? 0) / 100);
  }
}
