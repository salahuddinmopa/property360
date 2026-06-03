'use client'

import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, AreaChart, Area
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Building2, Store, ShoppingBag, Users, TrendingUp, TrendingDown,
  DollarSign, AlertCircle, PiggyBank, Bell, Home, Car, FileWarning
} from 'lucide-react'

interface DashboardStats {
  totalMarkets: number
  totalShops: number
  occupiedShops: number
  vacantShops: number
  totalTenants: number
  totalApartments: number
  totalVehicles: number
  activeAgreements: number
  monthlyIncome: number
  lastMonthIncome: number
  monthlyExpenses: number
  lastMonthExpenses: number
  netProfit: number
  totalDue: number
  totalDepositBalance: number
  depositFinishingSoon: number
  unreadNotifications: number
}

function StatCard({
  title, value, icon: Icon, sub, trend, color = 'blue', format = 'number'
}: {
  title: string
  value: number
  icon: React.ElementType
  sub?: string
  trend?: number
  color?: string
  format?: 'number' | 'currency'
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    teal: 'bg-teal-50 text-teal-600',
  }

  const displayValue = format === 'currency'
    ? `৳${value.toLocaleString()}`
    : value.toLocaleString()

  const trendPositive = trend !== undefined && trend >= 0

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold text-foreground">{displayValue}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
            {trend !== undefined && (
              <div className={`flex items-center gap-1 text-xs font-medium ${trendPositive ? 'text-green-600' : 'text-red-600'}`}>
                {trendPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(trend).toFixed(1)}% vs last month
              </div>
            )}
          </div>
          <div className={`p-3 rounded-lg ${colorMap[color] || colorMap.blue}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function formatCurrency(v: number) {
  return `৳${v.toLocaleString()}`
}

export function DashboardClient({
  stats,
  monthlyChartData,
  yearlyChartData,
  assetTypeIncomeThisMonth = {},
  propertyTypeCounts = {},
}: {
  stats: DashboardStats
  monthlyChartData: { month: string; income: number; expenses: number; profit: number }[]
  yearlyChartData: { year: string; income: number; expenses: number; profit: number }[]
  assetTypeIncomeThisMonth?: Record<string, number>
  propertyTypeCounts?: Record<string, number>
}) {
  const incomeTrend = stats.lastMonthIncome > 0
    ? ((stats.monthlyIncome - stats.lastMonthIncome) / stats.lastMonthIncome) * 100
    : 0
  const expenseTrend = stats.lastMonthExpenses > 0
    ? ((stats.monthlyExpenses - stats.lastMonthExpenses) / stats.lastMonthExpenses) * 100
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Property360 — Overview</p>
        </div>
        {stats.depositFinishingSoon > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            {stats.depositFinishingSoon} deposit{stats.depositFinishingSoon > 1 ? 's' : ''} finishing soon
          </Badge>
        )}
      </div>

      {/* Key financial cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Monthly Income"
          value={stats.monthlyIncome}
          icon={DollarSign}
          format="currency"
          trend={incomeTrend}
          color="green"
        />
        <StatCard
          title="Monthly Expenses"
          value={stats.monthlyExpenses}
          icon={TrendingDown}
          format="currency"
          trend={expenseTrend}
          color="red"
        />
        <StatCard
          title="Net Profit"
          value={stats.netProfit}
          icon={TrendingUp}
          format="currency"
          sub="This month"
          color={stats.netProfit >= 0 ? 'teal' : 'red'}
        />
        <StatCard
          title="Total Due"
          value={stats.totalDue}
          icon={AlertCircle}
          format="currency"
          sub="Outstanding rent"
          color="orange"
        />
      </div>

      {/* Property stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title="Markets" value={stats.totalMarkets} icon={Store} color="blue" />
        <StatCard title="Total Shops" value={stats.totalShops} icon={ShoppingBag} color="blue" />
        <StatCard title="Occupied" value={stats.occupiedShops} icon={ShoppingBag} color="green" sub="shops" />
        <StatCard title="Vacant" value={stats.vacantShops} icon={ShoppingBag} color="yellow" sub="shops" />
        <StatCard title="Active Tenants" value={stats.totalTenants} icon={Users} color="purple" />
        <StatCard title="Deposit Balance" value={stats.totalDepositBalance} icon={PiggyBank} format="currency" color="teal" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Apartments" value={stats.totalApartments} icon={Home} color="blue" />
        <StatCard title="Vehicles" value={stats.totalVehicles} icon={Car} color="purple" />
        <StatCard title="Active Agreements" value={stats.activeAgreements} icon={FileWarning} color="orange" />
      </div>

      {/* Dynamic property type breakdown */}
      {(Object.keys(propertyTypeCounts).length > 0 || Object.keys(assetTypeIncomeThisMonth).length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Object.keys(propertyTypeCounts).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Properties by Type</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(propertyTypeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                    <div key={type} className="flex items-center gap-1.5 bg-slate-50 border rounded-md px-3 py-1.5">
                      <span className="text-sm font-medium">{count}</span>
                      <span className="text-xs text-muted-foreground">{type}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {Object.keys(assetTypeIncomeThisMonth).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">This Month Income by Asset Type</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {Object.entries(assetTypeIncomeThisMonth).sort((a, b) => b[1] - a[1]).map(([type, income]) => (
                    <div key={type} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{type}</span>
                      <span className="font-semibold text-green-700">{formatCurrency(income)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Income vs Expenses (12 months)</CardTitle>
            <CardDescription>Income, expenses, and profit trend</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyChartData}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Area type="monotone" dataKey="income" stroke="#22c55e" fill="url(#incomeGrad)" name="Income" strokeWidth={2} />
                <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="url(#expGrad)" name="Expenses" strokeWidth={2} />
                <Line type="monotone" dataKey="profit" stroke="#6366f1" name="Profit" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Year-over-Year Comparison</CardTitle>
            <CardDescription>Annual income vs expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={yearlyChartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
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
    </div>
  )
}
