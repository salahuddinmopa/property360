'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts'
import { formatCurrency, MONTHS, YEARS } from '@/lib/utils/format'
import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns'
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react'

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316']

export default function AnalyticsPage() {
  const supabase = createClient()
  const [year, setYear] = useState(new Date().getFullYear())
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [yearlyData, setYearlyData] = useState<any[]>([])
  const [expenseByCategory, setExpenseByCategory] = useState<any[]>([])
  const [incomeByAssetType, setIncomeByAssetType] = useState<any[]>([])
  const [propertyTypeSummary, setPropertyTypeSummary] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [year])

  async function load() {
    setLoading(true)
    const now = new Date()

    const [{ data: payments }, { data: expenses }, { data: properties }] = await Promise.all([
      supabase.from('rent_payments').select('month, year, paid_amount, asset_type'),
      supabase.from('expenses').select('expense_date, amount, category, asset_type'),
      supabase.from('properties').select('property_type, type, status'),
    ])

    // Monthly data for selected year
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const income = (payments ?? []).filter(p => p.month === m && p.year === year)
        .reduce((s, p) => s + p.paid_amount, 0)
      const startDate = `${year}-${m.toString().padStart(2, '0')}-01`
      const endDate = new Date(year, m, 0).toISOString().split('T')[0]
      const expense = (expenses ?? [])
        .filter(e => e.expense_date >= startDate && e.expense_date <= endDate)
        .reduce((s, e) => s + e.amount, 0)
      return { month: MONTHS[i].slice(0, 3), income, expenses: expense, profit: income - expense }
    })
    setMonthlyData(monthly)

    // Year-over-year (3 years)
    const years = [year - 2, year - 1, year]
    const yearly = years.map(yr => {
      const income = (payments ?? []).filter(p => p.year === yr).reduce((s, p) => s + p.paid_amount, 0)
      const expense = (expenses ?? [])
        .filter(e => new Date(e.expense_date).getFullYear() === yr)
        .reduce((s, e) => s + e.amount, 0)
      return { year: yr.toString(), income, expenses: expense, profit: income - expense }
    })
    setYearlyData(yearly)

    // Expenses by category (this year)
    const catMap: Record<string, number> = {}
    ;(expenses ?? [])
      .filter(e => new Date(e.expense_date).getFullYear() === year)
      .forEach(e => { catMap[e.category] = (catMap[e.category] ?? 0) + e.amount })
    setExpenseByCategory(
      Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 8)
        .map(([name, value]) => ({ name, value }))
    )

    // Income by asset_type (rent_payments.asset_type — legacy enum: shop/apartment/vehicle)
    const assetMap: Record<string, number> = {}
    ;(payments ?? []).filter(p => p.year === year).forEach(p => {
      const label = p.asset_type.charAt(0).toUpperCase() + p.asset_type.slice(1)
      assetMap[label] = (assetMap[label] ?? 0) + p.paid_amount
    })
    setIncomeByAssetType(
      Object.entries(assetMap)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value }))
    )

    // Properties breakdown by property_type (from properties table)
    const propTypeMap: Record<string, { total: number; active: number }> = {}
    ;(properties ?? []).forEach(p => {
      const label = p.property_type || p.type || 'Unknown'
      if (!propTypeMap[label]) propTypeMap[label] = { total: 0, active: 0 }
      propTypeMap[label].total++
      if (p.status === 'active') propTypeMap[label].active++
    })
    setPropertyTypeSummary(
      Object.entries(propTypeMap)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([name, v]) => ({ name, total: v.total, active: v.active }))
    )

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
        description="Financial analytics and property performance"
        actions={
          <Select value={year.toString()} onValueChange={v => setYear(parseInt(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{YEARS.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
          </Select>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: `${year} Income`, value: formatCurrency(totalIncome), color: 'text-green-600' },
          { label: `${year} Expenses`, value: formatCurrency(totalExpenses), color: 'text-red-600' },
          { label: 'Net Profit', value: formatCurrency(netProfit), color: netProfit >= 0 ? 'text-blue-600' : 'text-red-600' },
          { label: 'Avg Monthly Profit', value: formatCurrency(netProfit / 12), color: 'text-purple-600' },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Monthly income vs expenses */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Income vs Expenses — {year}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `৳${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="income" fill="#22c55e" name="Income" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Profit trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Profit Trend</CardTitle>
            {bestMonth && (
              <CardDescription>
                Best: {bestMonth.month} ({formatCurrency(bestMonth.profit)})
                {worstMonth && worstMonth.month !== bestMonth.month && ` · Worst: ${worstMonth.month}`}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `৳${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Line type="monotone" dataKey="profit" stroke="#6366f1" strokeWidth={2.5}
                  dot={{ fill: '#6366f1', r: 4 }} name="Profit" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Expenses by category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense Breakdown by Category — {year}</CardTitle>
          </CardHeader>
          <CardContent>
            {expenseByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No expense data</p>
            ) : (
              <div className="flex gap-4">
                <ResponsiveContainer width="45%" height={220}>
                  <PieChart>
                    <Pie data={expenseByCategory} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value">
                      {expenseByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5 py-2 overflow-hidden">
                  {expenseByCategory.map((cat, i) => (
                    <div key={cat.name} className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-muted-foreground truncate">{cat.name}</span>
                      </div>
                      <span className="font-medium shrink-0">{formatCurrency(cat.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Income by asset type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Income by Asset Type — {year}</CardTitle>
          </CardHeader>
          <CardContent>
            {incomeByAssetType.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No income data</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={incomeByAssetType} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `৳${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="value" name="Income" radius={[0, 4, 4, 0]}>
                    {incomeByAssetType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Property type portfolio */}
      {propertyTypeSummary.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Property Portfolio by Type</CardTitle>
            <CardDescription>All registered property types and counts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {propertyTypeSummary.map((pt, i) => (
                <div key={pt.name} className="bg-slate-50 rounded-lg p-3 border">
                  <div className="w-3 h-3 rounded-full mb-2" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <p className="text-sm font-semibold">{pt.total}</p>
                  <p className="text-xs text-muted-foreground leading-tight">{pt.name}</p>
                  <p className="text-xs text-green-600">{pt.active} active</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `৳${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="income" fill="#22c55e" name="Income" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} />
              <Bar dataKey="profit" fill="#6366f1" name="Profit" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
