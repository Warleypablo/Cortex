import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a number with maximum 2 decimal places.
 * Preserves 0 or 1 decimal places when the number already has that precision.
 * Examples:
 *   10 -> "10"
 *   10.5 -> "10.5"
 *   10.55 -> "10.55"
 *   10.556 -> "10.56"
 */
export function formatDecimal(value: number, maxDecimals: number = 2): string {
  if (value === null || value === undefined || isNaN(value)) return '0';
  
  // Round to max decimals first
  const rounded = Math.round(value * Math.pow(10, maxDecimals)) / Math.pow(10, maxDecimals);
  
  // Check if it's a whole number
  if (Number.isInteger(rounded)) {
    return rounded.toString();
  }
  
  // Get the string with max decimals
  const fixed = rounded.toFixed(maxDecimals);
  
  // Remove trailing zeros after decimal point
  return fixed.replace(/\.?0+$/, '');
}

/**
 * Formats a number as percentage with maximum 2 decimal places.
 * Examples:
 *   10 -> "10%"
 *   10.5 -> "10.5%"
 *   10.556 -> "10.56%"
 */
export function formatPercent(value: number, maxDecimals: number = 2): string {
  return formatDecimal(value, maxDecimals) + '%';
}

/**
 * Formats a number as Brazilian currency (BRL) with maximum 2 decimal places.
 */
export function formatCurrency(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formats a number as Brazilian currency (BRL) with exactly 2 decimal places.
 */
export function formatCurrencyWithDecimals(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formats a number as Brazilian currency (BRL) without decimal places.
 */
export function formatCurrencyNoDecimals(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Formats a number as compact Brazilian currency (K, M, B).
 */
export function formatCurrencyCompact(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0';
  if (Math.abs(value) >= 1000000000) return `R$ ${formatDecimal(value / 1000000000)}B`;
  if (Math.abs(value) >= 1000000) return `R$ ${formatDecimal(value / 1000000)}M`;
  if (Math.abs(value) >= 1000) return `R$ ${formatDecimal(value / 1000)}K`;
  return formatCurrency(value);
}
