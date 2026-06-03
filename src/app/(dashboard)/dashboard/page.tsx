import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from './dashboard-client'
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears } from 'date-fns'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now = new Date()
  const thisMonth = format(now, 'yyyy-MM')
  const lastMonth = format(subMonths(now, 1), 'yyyy-MM')
  const thisYear = now.getFullYear()
  const lastYear = thisYear - 1

  // Parallel data fetching
  const [
    { data: markets },
    { data: shops },
    { data: tenants },
    { data: apartments },
    { data: vehicles },
    { data: agreements },
    { data: rentPayments },
    { data: expenses },
    { data: notifications },
  ] = await Promise.all([
    supabase.from('markets').select('id, status'),
    supabase.from('shops').select('id, status, monthly_rent'),
    supabase.from('tenants').select('id, status'),
    supabase.from('apartments').select('id, status'),
    supabase.from('vehicles').select('id, status'),
    supabase.from('rental_agreements').select('id, deposit_amount, total_deducted, deposit_balance, monthly_deduction, deduction_end_date, status, monthly_cash_payable'),
    supabase.from('rent_payments').select('id, month, year, cash_payable, paid_amount, due_amount, status'),
    supabase.from('expenses').select('id, amount, expense_date'),
    supabase.from('notifications').select('id').eq('is_read', false),
  ])

  // Summary stats
  const totalMarkets = markets?.length ?? 0
  const totalShops = shops?.length ?? 0
  const occupiedShops = shops?.filter(s => s.status === 'occupied').length ?? 0
  const vacantShops = shops?.filter(s => s.status === 'vacant').length ?? 0
  const totalTenants = tenants?.filter(t => t.status === 'active').length ?? 0
  const totalApartments = apartments?.length ?? 0
  const totalVehicles = vehicles?.length ?? 0
  const activeAgreements = agreements?.filter(a => a.status === 'active').length ?? 0

  // Monthly income (this month paid)
  const thisMonthPayments = rentPayments?.filter(p => p.month === now.getMonth() + 1 && p.year === thisYear) ?? []
  const lastMonthPayments = rentPayments?.filter(p => {
    const lm = subMonths(now, 1)
    return p.month === lm.getMonth() + 1 && p.year === lm.getFullYear()
  }) ?? []

  const monthlyIncome = thisMonthPayments.reduce((s, p) => s + (p.paid_amount ?? 0), 0)
  const lastMonthIncome = lastMonthPayments.reduce((s, p) => s + (p.paid_amount ?? 0), 0)
  const totalDue = rentPayments?.reduce((s, p) => s + Math.max(0, p.due_amount ?? 0), 0) ?? 0

  // Monthly expenses
  const thisMonthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const thisMonthEnd = format(endOfMonth(now), 'yyyy-MM-dd')
  const lastMonthStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd')
  const lastMonthEnd = format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd')

  const monthlyExpenses = expenses?.filter(e => e.expense_date >= thisMonthStart && e.expense_date <= thisMonthEnd)
    .reduce((s, e) => s + e.amount, 0) ?? 0
  const lastMonthExpenses = expenses?.filter(e => e.expense_date >= lastMonthStart && e.expense_date <= lastMonthEnd)
    .reduce((s, e) => s + e.amount, 0) ?? 0

  const netProfit = monthlyIncome - monthlyExpenses
  const totalDepositBalance = agreements?.reduce((s, a) => s + (a.deposit_balance ?? 0), 0) ?? 0

  // Agreements finishing deductions within 3 months
  const threeMonthsLater = new Date(now)
  threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3)
  const depositFinishingSoon = agreements?.filter(a =>
    a.deduction_end_date &&
    new Date(a.deduction_end_date) <= threeMonthsLater &&
    new Date(a.deduction_end_date) >= now &&
    a.status === 'active'
  ).length ?? 0

  // Build monthly chart data (last 12 months)
  const monthlyChartData = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(now, 11 - i)
    const m = d.getMonth() + 1
    const y = d.getFullYear()
    const monthStart = format(startOfMonth(d), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(d), 'yyyy-MM-dd')
    const income = rentPayments?.filter(p => p.month === m && p.year === y)
      .reduce((s, p) => s + (p.paid_amount ?? 0), 0) ?? 0
    const expense = expenses?.filter(e => e.expense_date >= monthStart && e.expense_date <= monthEnd)
      .reduce((s, e) => s + e.amount, 0) ?? 0
    return {
      month: format(d, 'MMM yy'),
      income,
      expenses: expense,
      profit: income - expense,
    }
  })

  // Yearly comparison
  const yearlyChartData = [lastYear, thisYear].map(yr => {
    const income = rentPayments?.filter(p => p.year === yr).reduce((s, p) => s + (p.paid_amount ?? 0), 0) ?? 0
    const expense = expenses?.filter(e => {
      const ey = new Date(e.expense_date).getFullYear()
      return ey === yr
    }).reduce((s, e) => s + e.amount, 0) ?? 0
    return { year: yr.toString(), income, expenses: expense, profit: income - expense }
  })

  return (
    <DashboardClient
      stats={{
        totalMarkets,
        totalShops,
        occupiedShops,
        vacantShops,
        totalTenants,
        totalApartments,
        totalVehicles,
        activeAgreements,
        monthlyIncome,
        lastMonthIncome,
        monthlyExpenses,
        lastMonthExpenses,
        netProfit,
        totalDue,
        totalDepositBalance,
        depositFinishingSoon,
        unreadNotifications: notifications?.length ?? 0,
      }}
      monthlyChartData={monthlyChartData}
      yearlyChartData={yearlyChartData}
    />
  )
}
