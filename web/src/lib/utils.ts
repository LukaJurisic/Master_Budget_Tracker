import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'CAD'): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Math.abs(amount))
}

export function formatAmount(amount: number, currency = 'CAD'): string {
  const formatted = formatCurrency(amount, currency)
  return amount < 0 ? `-${formatted}` : formatted
}

export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return format(dateObj, 'MMM d, yyyy')
}

export function formatMonth(month: string): string {
  const [year, monthNum] = month.split('-')
  const date = new Date(parseInt(year), parseInt(monthNum) - 1)
  return format(date, 'MMMM yyyy')
}

export function getCurrentMonth(): string {
  return format(new Date(), 'yyyy-MM')
}

export function getPreviousMonth(month: string): string {
  const [year, monthNum] = month.split('-')
  const date = new Date(parseInt(year), parseInt(monthNum) - 1)
  date.setMonth(date.getMonth() - 1)
  return format(date, 'yyyy-MM')
}

export function getNextMonth(month: string): string {
  const [year, monthNum] = month.split('-')
  const date = new Date(parseInt(year), parseInt(monthNum) - 1)
  date.setMonth(date.getMonth() + 1)
  return format(date, 'yyyy-MM')
}

export function getVarianceColor(variance: number): string {
  if (variance > 0) return 'text-red-600'
  if (variance < 0) return 'text-green-600'
  return 'text-gray-600'
}

export function getVarianceIcon(variance: number): string {
  if (variance > 0) return '↗'
  if (variance < 0) return '↘'
  return '→'
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}



















