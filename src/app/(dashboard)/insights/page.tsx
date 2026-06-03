'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Lightbulb, AlertTriangle, TrendingUp, TrendingDown, Clock, DollarSign, RefreshCw, PiggyBank } from 'lucide-react'
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
    const thisYear = now.getFullYear()
    const threeMonthsLater = new Date(now); threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3)
    const twoMonthsLater = new Date(now); twoMonthsLater.setMonth(twoMonthsLater.getMonth() + 2)

    const [
      { data: agreements },
      { data: payments },
      { data: expenses },
      { data: properties },
      { data: vehicles },
    ] = await Promise.all([
      supabase.from('rental_agreements').select('*, tenants(full_name)').eq('status', 'active'),
      supabase.from('rent_payments').select('*, tenants(full_name)'),
      supabase.from('expenses').select('*'),
      supabase.from('properties').select('id, name, property_type, type, status'),
      supabase.from('vehicles').select('*'),
    ])

    const newInsights: Insight[] = []

    // 1. Deposits finishing within 3 months
    const finishingSoon = (agreements ?? []).filter(a =>
      a.deduction_end_date &&
      new Date(a.deduction_end_date) <= threeMonthsLater &&
      new Date(a.deduction_end_date) >= now &&
      a.monthly_deduction > 0
    )
    if (finishingSoon.length > 0) {
      const extraIncome = finishingSoon.reduce((s, a) => s + (a.monthly_deduction ?? 0), 0)
      newInsights.push({
        type: 'success',
        title: `${finishingSoon.length} Deposit(s) Completing Soon`,
        message: `${finishingSoon.map((a: any) => a.tenants?.full_name).filter(Boolean).join(', ')} will complete deposit deduction within 3 months. They will start paying full rent after this.`,
        value: `+${formatCurrency(extraIncome)}/month additional cash income after completion`,
        action: 'Notify tenants, update agreements on time',
      })
    }

    // 2. Tenants with repeated due payments
    const duePayments = (payments ?? []).filter(p => (p.due_amount ?? 0) > 0)
    const tenantDueMap: Record<string, { name: string; count: number; totalDue: number }> = {}
    duePayments.forEach(p => {
      const name = (p as any).tenants?.full_name ?? p.tenant_id
      if (!tenantDueMap[p.tenant_id]) tenantDueMap[p.tenant_id] = { name, count: 0, totalDue: 0 }
      tenantDueMap[p.tenant_id].count++
      tenantDueMap[p.tenant_id].totalDue += (p.due_amount ?? 0)
    })
    const repeatDue = Object.values(tenantDueMap).filter(t => t.count >= 2)
    if (repeatDue.length > 0) {
      newInsights.push({
        type: 'warning',
        title: `${repeatDue.length} Tenant(s) with Repeated Missed Payments`,
        message: `${repeatDue.map(t => t.name).join(', ')} have missed payments multiple times.`,
        value: `Total outstanding: ${formatCurrency(repeatDue.reduce((s, t) => s + t.totalDue, 0))}`,
        action: 'Contact these tenants and review their agreements',
      })
    }

    // 3. High-expense properties — dynamically from properties table
    const expByProperty: Record<string, { name: string; type: string; total: number }> = {}
    ;(expenses ?? []).filter(e => e.asset_id).forEach(e => {
      const prop = (properties ?? []).find(p => p.id === e.asset_id)
      const label = prop ? prop.name : e.asset_id!
      const type = prop ? (prop.property_type || prop.type || 'Unknown') : (e.asset_type ?? 'Unknown')
      if (!expByProperty[label]) expByProperty[label] = { name: label, type, total: 0 }
      expByProperty[label].total += e.amount
    })
    const sortedExpProp = Object.values(expByProperty).sort((a, b) => b.total - a.total)
    if (sortedExpProp.length > 0) {
      const top = sortedExpProp[0]
      newInsights.push({
        type: 'info',
        title: `Highest Expense: ${top.name} (${top.type})`,
        message: `This asset has the highest recorded expenses this period.`,
        value: formatCurrency(top.total) + ' in expenses',
        action: 'Review expense categories — look for cost reduction opportunities',
      })
    }

    // 4. Vehicle document expiry (dynamic — works for any vehicle)
    const expiredDocs = (vehicles ?? []).filter(v =>
      (v.insurance_expiry && new Date(v.insurance_expiry) <= twoMonthsLater) ||
      (v.fitness_expiry && new Date(v.fitness_expiry) <= twoMonthsLater) ||
      (v.tax_token_expiry && new Date(v.tax_token_expiry) <= twoMonthsLater)
    )
    if (expiredDocs.length > 0) {
      const details = expiredDocs.map(v => {
        const parts = []
        if (v.insurance_expiry && new Date(v.insurance_expiry) <= twoMonthsLater) parts.push('insurance')
        if (v.fitness_expiry && new Date(v.fitness_expiry) <= twoMonthsLater) parts.push('fitness')
        if (v.tax_token_expiry && new Date(v.tax_token_expiry) <= twoMonthsLater) parts.push('tax token')
        return `${v.name} (${parts.join(', ')})`
      })
      newInsights.push({
        type: 'warning',
        title: `${expiredDocs.length} Vehicle(s) Need Document Renewal`,
        message: details.join('; '),
        action: 'Renew documents before expiry to avoid fines and legal issues',
      })
    }

    // 5. Best-performing property type by income (this year)
    const incomeByType: Record<string, number> = {}
    ;(payments ?? []).filter(p => p.year === thisYear).forEach(p => {
      const label = p.asset_type.charAt(0).toUpperCase() + p.asset_type.slice(1)
      incomeByType[label] = (incomeByType[label] ?? 0) + (p.paid_amount ?? 0)
    })
    const sortedTypes = Object.entries(incomeByType).sort((a, b) => b[1] - a[1])
    if (sortedTypes.length > 0) {
      const [bestType, bestIncome] = sortedTypes[0]
      newInsights.push({
        type: 'success',
        title: `Best Performing Asset Type: ${bestType}`,
        message: `${bestType} rentals generated the highest income this year. Consider expanding this category.`,
        value: `${formatCurrency(bestIncome)} in ${thisYear}`,
        action: 'Review capacity for expansion in this asset category',
      })
    }
    if (sortedTypes.length > 1) {
      const [worstType, worstIncome] = sortedTypes[sortedTypes.length - 1]
      newInsights.push({
        type: 'tip',
        title: `Lowest Performing Asset Type: ${worstType}`,
        message: `${worstType} has the lowest income this year compared to other asset types.`,
        value: `${formatCurrency(worstIncome)} in ${thisYear}`,
        action: 'Review utilisation, pricing, or consider repurposing',
      })
    }

    // 6. Top expense category (dynamic)
    const catMap: Record<string, number> = {}
    ;(expenses ?? []).filter(e => new Date(e.expense_date).getFullYear() === thisYear)
      .forEach(e => { catMap[e.category] = (catMap[e.category] ?? 0) + e.amount })
    const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]
    if (topCat) {
      newInsights.push({
        type: 'info',
        title: `Highest Expense Category: ${topCat[0]}`,
        message: `${topCat[0]} accounts for the largest expense category this year.`,
        value: `${formatCurrency(topCat[1])} in ${thisYear}`,
        action: 'Check if any savings are possible in this category',
      })
    }

    // 7. Agreements expiring within 3 months
    const agrExpiring = (agreements ?? []).filter(a =>
      a.end_date && new Date(a.end_date) <= threeMonthsLater && new Date(a.end_date) >= now
    )
    if (agrExpiring.length > 0) {
      newInsights.push({
        type: 'info',
        title: `${agrExpiring.length} Agreement(s) Expiring Soon`,
        message: `Agreements for ${agrExpiring.map((a: any) => a.tenants?.full_name ?? 'tenant').join(', ')} expire within 3 months.`,
        action: 'Initiate renewal discussions now to avoid vacant periods',
      })
    }

    // 8. Old agreements (2+ years — rent review opportunity)
    const oldAgreements = (agreements ?? []).filter(a =>
      thisYear - new Date(a.start_date).getFullYear() >= 2
    )
    if (oldAgreements.length > 0) {
      newInsights.push({
        type: 'tip',
        title: `${oldAgreements.length} Agreement(s) Older than 2 Years`,
        message: `These agreements have not been renewed recently and may be due for a rent review.`,
        action: 'Propose a reasonable increase aligned with market rates',
      })
    }

    // 9. Properties in use vs registered (dynamic — any property type)
    const totalProps = (properties ?? []).length
    const activeProps = (properties ?? []).filter(p => p.status === 'active').length
    const inactiveProps = totalProps - activeProps
    if (inactiveProps > 0) {
      newInsights.push({
        type: 'warning',
        title: `${inactiveProps} Inactive Propert${inactiveProps > 1 ? 'ies' : 'y'}`,
        message: `${inactiveProps} of your registered properties are currently inactive and not generating income.`,
        action: 'Review inactive properties — activate, lease, or repurpose them',
      })
    }

    // 10. High-expense months
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
        title: `${highExpMonths.length} High-Expense Month(s) Detected`,
        message: `${highExpMonths.map(([k]) => k).join(', ')} had expenses more than 50% above average.`,
        value: `Average monthly expense: ${formatCurrency(avgExp)}`,
        action: 'Review what drove costs up in these months',
      })
    }

    setInsights(
      newInsights.length > 0
        ? newInsights
        : [{ type: 'success', title: 'All Systems Healthy', message: 'No significant issues detected. Your portfolio is performing well.' }]
    )
    setLoading(false)
  }

  const typeConfig = {
    warning: { icon: AlertTriangle, bg: 'bg-amber-50 border-amber-200', iconColor: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
    info:    { icon: Lightbulb,   bg: 'bg-blue-50 border-blue-200',   iconColor: 'text-blue-600',   badge: 'bg-blue-100 text-blue-700'   },
    success: { icon: TrendingUp,  bg: 'bg-green-50 border-green-200', iconColor: 'text-green-600',  badge: 'bg-green-100 text-green-700' },
    tip:     { icon: DollarSign,  bg: 'bg-purple-50 border-purple-200', iconColor: 'text-purple-600', badge: 'bg-purple-100 text-purple-700' },
  }

  const summary = {
    warning: insights.filter(i => i.type === 'warning').length,
    info: insights.filter(i => i.type === 'info').length,
    success: insights.filter(i => i.type === 'success').length,
    tip: insights.filter(i => i.type === 'tip').length,
  }

  return (
    <div>
      <PageHeader
        title="Smart Insights"
        description="Auto-generated business suggestions from your property data"
        actions={
          <Button variant="outline" onClick={generateInsights} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {/* Summary chips */}
      {!loading && insights.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {summary.warning > 0 && <Badge className="bg-amber-100 text-amber-700">{summary.warning} warning{summary.warning > 1 ? 's' : ''}</Badge>}
          {summary.info > 0 && <Badge className="bg-blue-100 text-blue-700">{summary.info} insight{summary.info > 1 ? 's' : ''}</Badge>}
          {summary.success > 0 && <Badge className="bg-green-100 text-green-700">{summary.success} positive</Badge>}
          {summary.tip > 0 && <Badge className="bg-purple-100 text-purple-700">{summary.tip} tip{summary.tip > 1 ? 's' : ''}</Badge>}
        </div>
      )}

      <div className="space-y-3">
        {loading && (
          <Card><CardContent className="p-8 text-center text-muted-foreground">
            <Lightbulb className="h-8 w-8 mx-auto mb-2 animate-pulse" />
            Analysing your property data...
          </CardContent></Card>
        )}
        {!loading && insights.map((insight, i) => {
          const config = typeConfig[insight.type]
          const Icon = config.icon
          return (
            <div key={i} className={`p-4 rounded-lg border ${config.bg}`}>
              <div className="flex items-start gap-3">
                <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${config.iconColor}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-sm">{insight.title}</span>
                    <Badge className={`text-xs capitalize ${config.badge}`}>{insight.type}</Badge>
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
