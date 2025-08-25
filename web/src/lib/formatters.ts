/**
 * Currency and date formatting utilities
 */

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMonth(monthStr: string): string {
  try {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-CA', { 
      year: 'numeric', 
      month: 'short' 
    });
  } catch {
    return monthStr;
  }
}

export function formatMonthLong(monthStr: string): string {
  try {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-CA', { 
      year: 'numeric', 
      month: 'long' 
    });
  } catch {
    return monthStr;
  }
}

export function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

export function isCurrentMonth(monthStr: string): boolean {
  return monthStr === getCurrentMonth();
}

export function isAfterCurrentMonth(monthStr: string): boolean {
  return monthStr > getCurrentMonth();
}