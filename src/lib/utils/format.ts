export function formatCurrency(amount: number): string {
  return `৳${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export const PAYMENT_METHODS = ['cash', 'bank', 'mobile_banking', 'cheque'] as const

export const EXPENSE_CATEGORIES = {
  market: ['Manager Salary', 'Electricity', 'Repair', 'Cleaning', 'Security', 'Tax', 'Maintenance', 'Legal', 'Miscellaneous'],
  shop: ['Repair', 'Maintenance', 'Miscellaneous'],
  apartment: ['Maintenance', 'Service Charge', 'Utility', 'Repair', 'Tax', 'Cleaning'],
  vehicle: ['Fuel', 'Driver Salary', 'Insurance', 'Maintenance', 'Registration', 'Repair'],
  general: ['Office', 'Accounting', 'Travel', 'Miscellaneous'],
}

export const YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i)
