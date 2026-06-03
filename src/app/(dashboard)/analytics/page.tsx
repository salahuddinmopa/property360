'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts'
import { formatCurrency, MONTHS, YEARS } from '@/lib/utils/format'
import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns'
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react'

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16']

export default function AnalyticsPage() {
  const supabase = createClient()
  const [year, setYear] = useState(new Date().getFullYear())
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [yearlyData, setYearlyData] = useState<any[]>([])
  const [expenseByCategory, setExpenseByCategory] = useState<any[]>([])
  const [assetIncome, setAssetIncome] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [year])

  async function load() {
    setLoading(true)
    const now = new Date()

    const [{ data: payments }, { data: expenses }] = await Promise.all([
      supabase.from('rent_payments').select('month, year, paid_amount, asset_type'),
      supabase.from('expenses').select('expense_date, amount, category, asset_type'),
    ])

    // Monthly data for selected year
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const income = (payments ?? []).filter(p => p.month === m && p.year === year).reduce((s, p) => s + p.paid_amount, 0)
      const startDate = `${year}-${m.toString().padStart(2, '0')}-01`
      const endDate = new Date(year, m, 0).toISOString().split('T')[0]
      const expense = (expenses ?? []).filter(e => e.expense_date >= startDate && e.expense_date <= endDate).reduce((s, e) => s + e.amount, 0)
      return { month: MONTHS[i].slice(0, 3), income, expenses: expense, profit: income - expense }
    })
    setMonthlyData(monthly)

    // Year-over-year
    const years = [year - 2, year - 1, year]
    const yearly = years.map(yr => {
      const income = (payments ?? []).filter(p => p.year === yr).reduce((s, p) => s + p.paid_amount, 0)
      const expense = (expenses ?? []).filter(e => new Date(e.expense_date).getFullYear() === yr).reduce((s, e) => s + e.amount, 0)
      return { year: yr.toString(), income, expenses: expense, profit: income - expense }
    })
    setYearlyData(yearly)

    // Expenses by category (this year)
    const catMap: Record<string, number> = {}
    ;(expenses ?? []).filter(e => new Date(e.expense_date).getFullYear() === year).forEach(e => {
      catMap[e.category] = (catMap[e.category] ?? 0) + e.amount
    })
    setExpenseByCategory(Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value })))

    // Asset type income
    const assetMap: Record<string, number> = {}
    ;(payments ?? []).filter(p => p.year === year).forEach(p => {
      assetMap[p.asset_type] = (assetMap[p.asset_type] ?? 0) + p.paid_amount
    })
    setAssetIncome(Object.entries(assetMap).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value })))

    setLoading(false)
  }

  const totalIncome = monthlyData.reduce((s, m) => s + m.income, 0)
  const totalExpenses = monthlyData.reduce((s, m) => s + m.expenses, 0)
  const netProfit = totalIncome - totalExpenses
  const bestMonth = [...monthlyData].sort((a, b) => b.profit - a.profit)[0]
  const worstMonth = [...monthlyData].sort((a, b) => a.profit - b.profit)[0]

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Deep financial analytics and performance metrics"
        actions={
          <Select value={year.toString()} onValueChange={v => setYear(parseInt(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{YEARS.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
          </Select>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: `${year} Income`, value: formatCurrency(totalIncome), icon: TrendingUp, color: 'text-green-600' },
          { label: `${year} Expenses`, value: formatCurrency(totalExpenses), icon: TrendingDown, color: 'text-red-600' },
          { label: 'Net Profit', value: formatCurrency(netProfit), icon: DollarSign, color: netProfit >= 0 ? 'text-blue-600' : 'text-red-600' },
          { label: 'Avg Monthly Profit', value: formatCurrency(netProfit / 12), icon: DollarSign, color: 'text-purple-600' },
        ].map(s => {
          const Icon = s.icon
          return (
            <Card key={s.label}><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent></Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Monthly trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Income vs Expenses — {year}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `৳${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="income" fill="#22c55e" name="Income" radius={[3,3,0,0]} />
                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Profit line */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Profit Trend</CardTitle>
            <CardDescription>
              Best: {bestMonth?.month} ({formatCurrency(bestMonth?.profit ?? 0)}) | Worst: {worstMonth?.month}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `৳${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Line type="monotone" dataKey="profit" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 4 }} name="Profit" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Expense by category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense Breakdown by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex">
              <ResponsiveContainer width="50%" height={220}>
                <PieChart>
                  <Pie data={expenseByCategory} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                    {expenseByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5 py-2">
                {expenseByCategory.map((cat, i) => (
                  <div key={cat.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-muted-foreground">{cat.name}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(cat.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Asset profitability */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Income by Asset Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={assetIncome} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `৳${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="value" fill="#3b82f6" name="Income" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Year-over-year */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Year-over-Year Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={yearlyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `৳${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="income" fill="#22c55e" name="Income" radius={[4,4,0,0]} />
              <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[4,4,0,0]} />
              <Bar dataKey="profit" fill="#6366f1" name="Profit" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
