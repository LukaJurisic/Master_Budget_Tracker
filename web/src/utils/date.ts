/**
 * Date utilities for handling ISO date strings without timezone issues
 */

/**
 * Format ISO date string (YYYY-MM-DD) to display format without timezone conversion
 * @param iso - ISO date string (YYYY-MM-DD)
 * @returns Formatted date string (DD/MM/YYYY) or empty string
 */
export function formatISODate(iso?: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`; // dd/mm/yyyy
}

/**
 * Create a Date object for local midnight from ISO date string
 * Use this when you need Date objects for calculations but want to avoid timezone issues
 * @param iso - ISO date string (YYYY-MM-DD)
 * @returns Date object at local midnight or null
 */
export function createLocalDate(iso?: string): Date | null {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00`); // note: no trailing Z
}

/**
 * Sort array by ISO date strings in descending order (newest first)
 * @param items - Array of items with date property
 * @param dateKey - Property name containing ISO date string
 * @returns Sorted array (does not mutate original)
 */
export function sortByDateDesc<T extends Record<string, any>>(
  items: T[], 
  dateKey: keyof T = 'date'
): T[] {
  return [...items].sort((a, b) => {
    const dateA = a[dateKey] as string;
    const dateB = b[dateKey] as string;
    // Lexicographic sort works perfectly for YYYY-MM-DD format
    return dateA > dateB ? -1 : dateA < dateB ? 1 : 0;
  });
}