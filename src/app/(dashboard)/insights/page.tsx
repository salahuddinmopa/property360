'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Lightbulb, AlertTriangle, TrendingUp, TrendingDown, Clock, DollarSign, RefreshCw } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'

interface Insight {
  type: 'warning' | 'info' | 'success' | 'tip'
  title: string
  message: string
  value?: string
  action?: string
}

export default function InsightsPage() {
  const supabase = createClient()
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { generateInsights() }, [])

  async function generateInsights() {
    setLoading(true)
    const now = new Date()
    const thisMonth = now.getMonth() + 1
    const thisYear = now.getFullYear()
    const threeMonthsLater = new Date(now); threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3)
    const twoMonthsLater = new Date(now); twoMonthsLater.setMonth(twoMonthsLater.getMonth() + 2)

    const [
      { data: agreements },
      { data: payments },
      { data: expenses },
      { data: shops },
      { data: vehicles },
      { data: tenants },
    ] = await Promise.all([
      supabase.from('rental_agreements').select('*, tenants(full_name)').eq('status', 'active'),
      supabase.from('rent_payments').select('*, tenants(full_name)').order('year', { ascending: false }).order('month', { ascending: false }),
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
      supabase.from('shops').select('*'),
      supabase.from('vehicles').select('*'),
      supabase.from('tenants').select('*'),
    ])

    const newInsights: Insight[] = []

    // 1. Deposits finishing soon
    const finishingSoon = (agreements ?? []).filter(a =>
      a.deduction_end_date && new Date(a.deduction_end_date) <= threeMonthsLater && new Date(a.deduction_end_date) >= now
    )
    if (finishingSoon.length > 0) {
      const extraIncome = finishingSoon.reduce((s, a) => s + a.monthly_deduction, 0)
      newInsights.push({
        type: 'success',
        title: `${finishingSoon.length} Deposit(s) Finishing Soon`,
        message: `${finishingSoon.map((a: any) => a.tenants?.full_name).join(', ')} will complete deposit deduction within 3 months.`,
        value: `+${formatCurrency(extraIncome)}/month additional cash income after completion`,
        action: 'Review deposit schedule',
      })
    }

    // 2. Repeated due payments
    const duePayments = (payments ?? []).filter(p => p.due_amount > 0)
    const tenantDueMap: Record<string, { name: string; count: number; totalDue: number }> = {}
    duePayments.forEach(p => {
      const name = (p as any).tenants?.full_name ?? p.tenant_id
      if (!tenantDueMap[p.tenant_id]) tenantDueMap[p.tenant_id] = { name, count: 0, totalDue: 0 }
      tenantDueMap[p.tenant_id].count++
      tenantDueMap[p.tenant_id].totalDue += p.due_amount
    })
    const repeatDue = Object.values(tenantDueMap).filter(t => t.count >= 2)
    if (repeatDue.length > 0) {
      newInsights.push({
        type: 'warning',
        title: `${repeatDue.length} Tenant(s) with Repeated Due Payments`,
        message: `${repeatDue.map(t => t.name).join(', ')} have missed payments multiple times.`,
        value: `Total outstanding: ${formatCurrency(repeatDue.reduce((s, t) => s + t.totalDue, 0))}`,
        action: 'Contact tenants immediately',
      })
    }

    // 3. Vacant shops
    const vacantShops = (shops ?? []).filter(s => s.status === 'vacant')
    if (vacantShops.length > 0) {
      const potentialRent = vacantShops.reduce((s, sh) => s + sh.monthly_rent, 0)
      newInsights.push({
        type: 'warning',
        title: `${vacantShops.length} Vacant Shop(s) — Revenue Loss`,
        message: `Shops ${vacantShops.slice(0, 5).map(s => s.shop_number).join(', ')}${vacantShops.length > 5 ? ` and ${vacantShops.length - 5} more` : ''} are vacant.`,
        value: `Potential: ${formatCurrency(potentialRent)}/month if occupied`,
        action: 'Start tenant acquisition drive',
      })
    }

    // 4. High expense months
    const monthlyExpMap: Record<string, number> = {}
    ;(expenses ?? []).forEach(e => {
      const key = e.expense_date.slice(0, 7)
      monthlyExpMap[key] = (monthlyExpMap[key] ?? 0) + e.amount
    })
    const expValues = Object.values(monthlyExpMap)
    const avgExp = expValues.length > 0 ? expValues.reduce((s, v) => s + v, 0) / expValues.length : 0
    const highExpMonths = Object.entries(monthlyExpMap).filter(([, v]) => v > avgExp * 1.5)
    if (highExpMonths.length > 0) {
      newInsights.push({
        type: 'warning',
        title: 'High Expense Months Detected',
        message: `${highExpMonths.map(([k]) => k).join(', ')} had expenses 50% above average.`,
        value: `Average monthly expense: ${formatCurrency(avgExp)}`,
        action: 'Review expense categories for savings',
      })
    }

    // 5. Vehicle document expiry
    const expiredDocs = (vehicles ?? []).filter(v =>
      (v.insurance_expiry && new Date(v.insurance_expiry) <= twoMonthsLater) ||
      (v.fitness_expiry && new Date(v.fitness_expiry) <= twoMonthsLater) ||
      (v.tax_token_expiry && new Date(v.tax_token_expiry) <= twoMonthsLater)
    )
    if (expiredDocs.length > 0) {
      newInsights.push({
        type: 'warning',
        title: `${expiredDocs.length} Vehicle(s) Need Document Renewal`,
        message: `${expiredDocs.map(v => v.name).join(', ')} have insurance, fitness, or tax token expiring within 2 months.`,
        action: 'Renew vehicle documents to avoid legal issues',
      })
    }

    // 6. Most profitable asset type
    const incomeByType: Record<string, number> = {}
    ;(payments ?? []).filter(p => p.year === thisYear).forEach(p => {
      incomeByType[p.asset_type] = (incomeByType[p.asset_type] ?? 0) + p.paid_amount
    })
    const topType = Object.entries(incomeByType).sort((a, b) => b[1] - a[1])[0]
    if (topType) {
      newInsights.push({
        type: 'success',
        title: `Best Performing Asset: ${topType[0].charAt(0).toUpperCase() + topType[0].slice(1)}`,
        message: `${topType[0]} rentals generated the highest income this year.`,
        value: `${formatCurrency(topType[1])} in ${thisYear}`,
        action: 'Consider expanding this asset category',
      })
    }

    // 7. Top expense category
    const catMap: Record<string, number> = {}
    ;(expenses ?? []).filter(e => new Date(e.expense_date).getFullYear() === thisYear).forEach(e => {
      catMap[e.category] = (catMap[e.category] ?? 0) + e.amount
    })
    const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]
    if (topCat) {
      newInsights.push({
        type: 'info',
        title: `Highest Expense: ${topCat[0]}`,
        message: `${topCat[0]} accounts for your largest expense category this year.`,
        value: `${formatCurrency(topCat[1])} in ${thisYear}`,
        action: 'Review if any cost reduction is possible',
      })
    }

    // 8. Agreement expiring soon
    const agrExpiring = (agreements ?? []).filter(a => a.end_date && new Date(a.end_date) <= threeMonthsLater && new Date(a.end_date) >= now)
    if (agrExpiring.length > 0) {
      newInsights.push({
        type: 'info',
        title: `${agrExpiring.length} Agreement(s) Expiring Soon`,
        message: `Agreements for ${agrExpiring.map((a: any) => a.tenants?.full_name ?? '').filter(Boolean).join(', ')} expire within 3 months.`,
        action: 'Initiate renewal discussions early',
      })
    }

    // 9. Rent increase opportunity
    const oldAgreements = (agreements ?? []).filter(a => {
      const startYear = new Date(a.start_date).getFullYear()
      return thisYear - startYear >= 2
    })
    if (oldAgreements.length > 0) {
      newInsights.push({
        type: 'tip',
        title: `${oldAgreements.length} Agreements Older than 2 Years`,
        message: `These agreements may benefit from a rent review to keep pace with market rates.`,
        action: 'Consider proposing a reasonable rent increase',
      })
    }

    setInsights(newInsights.length > 0 ? newInsights : [{
      type: 'success',
      title: 'All Systems Healthy',
      message: 'No significant issues found. Your property portfolio is performing well.',
    }])
    setLoading(false)
  }

  const typeConfig = {
    warning: { icon: AlertTriangle, bg: 'bg-amber-50 border-amber-200', iconColor: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
    info: { icon: Lightbulb, bg: 'bg-blue-50 border-blue-200', iconColor: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' },
    success: { icon: TrendingUp, bg: 'bg-green-50 border-green-200', iconColor: 'text-green-600', badge: 'bg-green-100 text-green-700' },
    tip: { icon: DollarSign, bg: 'bg-purple-50 border-purple-200', iconColor: 'text-purple-600', badge: 'bg-purple-100 text-purple-700' },
  }

  return (
    <div>
      <PageHeader
        title="Smart Insights"
        description="AI-powered business suggestions and performance analysis"
        actions={
          <Button variant="outline" onClick={generateInsights} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4">
        {loading && (
          <Card><CardContent className="p-8 text-center text-muted-foreground">
            <Lightbulb className="h-8 w-8 mx-auto mb-2 animate-pulse" />
            Analyzing your property data...
          </CardContent></Card>
        )}
        {!loading && insights.map((insight, i) => {
          const config = typeConfig[insight.type]
          const Icon = config.icon
          return (
            <div key={i} className={`p-4 rounded-lg border ${config.bg}`}>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${config.iconColor}`}><Icon className="h-5 w-5" /></div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm">{insight.title}</h3>
                    <Badge className={`text-xs ${config.badge}`}>{insight.type}</Badge>
                  </div>
                  <p className="text-sm text-slate-600">{insight.message}</p>
                  {insight.value && (
                    <p className="text-sm font-medium mt-1 text-slate-700">{insight.value}</p>
                  )}
                  {insight.action && (
                    <p className="text-xs text-slate-500 mt-1.5 italic">Recommendation: {insight.action}</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
