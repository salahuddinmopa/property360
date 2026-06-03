'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Search, PiggyBank, AlertCircle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import type { RentalAgreement } from '@/lib/types/database'

type Agreement = RentalAgreement & {
  tenants?: { full_name: string } | null
}

export default function DepositsPage() {
  const supabase = createClient()
  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('rental_agreements')
      .select('*, tenants(full_name)')
      .gt('deposit_amount', 0)
      .order('deduction_end_date', { ascending: true })
    setAgreements(data ?? [])
    setLoading(false)
  }

  const now = new Date()
  const threeMonths = new Date(now); threeMonths.setMonth(threeMonths.getMonth() + 3)

  function getDepositStatus(a: Agreement) {
    if (a.deposit_balance <= 0) return 'completed'
    if (a.deduction_end_date && new Date(a.deduction_end_date) <= threeMonths) return 'finishing_soon'
    return 'active'
  }

  function getMonthsRemaining(a: Agreement) {
    if (!a.deduction_end_date) return null
    const end = new Date(a.deduction_end_date)
    const diff = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth())
    return Math.max(0, diff)
  }

  const filtered = agreements.filter(a => {
    const matchSearch = (a.tenants?.full_name ?? '').toLowerCase().includes(search.toLowerCase())
    if (filter === 'active') return matchSearch && a.deposit_balance > 0 && a.monthly_deduction > 0
    if (filter === 'completed') return matchSearch && a.deposit_balance <= 0
    if (filter === 'finishing_soon') return matchSearch && getDepositStatus(a) === 'finishing_soon'
    return matchSearch
  })

  const stats = {
    totalDeposit: agreements.reduce((s, a) => s + a.deposit_amount, 0),
    totalDeducted: agreements.reduce((s, a) => s + a.total_deducted, 0),
    totalBalance: agreements.reduce((s, a) => s + Math.max(0, a.deposit_balance), 0),
    finishingSoon: agreements.filter(a => getDepositStatus(a) === 'finishing_soon').length,
  }

  return (
    <div>
      <PageHeader
        title="Deposit Deductions"
        description="Track tenant deposits and monthly deduction progress"
      />

      {stats.finishingSoon > 0 && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800">{stats.finishingSoon} deposit(s) finishing within 3 months</p>
            <p className="text-sm text-amber-700">These tenants will start paying full rent soon.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Deposit', value: formatCurrency(stats.totalDeposit) },
          { label: 'Total Deducted', value: formatCurrency(stats.totalDeducted) },
          { label: 'Remaining Balance', value: formatCurrency(stats.totalBalance) },
          { label: 'Finishing Soon', value: stats.finishingSoon, color: stats.finishingSoon > 0 ? 'text-amber-600' : 'text-green-600' },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-xl font-bold ${(s as any).color ?? ''}`}>{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search tenant..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="finishing_soon">Finishing Soon</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Deposit</TableHead>
                <TableHead>Deducted</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Monthly Deduction</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Months Left</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={10} className="text-center py-8">Loading...</TableCell></TableRow>}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  <PiggyBank className="h-8 w-8 mx-auto mb-2 opacity-30" />No deposit records
                </TableCell></TableRow>
              )}
              {filtered.map(a => {
                const status = getDepositStatus(a)
                const monthsLeft = getMonthsRemaining(a)
                return (
                  <TableRow key={a.id} className={status === 'finishing_soon' ? 'bg-amber-50/50' : ''}>
                    <TableCell className="font-medium text-sm">{a.tenants?.full_name ?? '—'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs capitalize">{a.asset_type}</Badge></TableCell>
                    <TableCell className="text-sm">{formatCurrency(a.deposit_amount)}</TableCell>
                    <TableCell className="text-sm text-blue-600">{formatCurrency(a.total_deducted)}</TableCell>
                    <TableCell className={`text-sm font-medium ${a.deposit_balance <= 0 ? 'text-gray-500' : status === 'finishing_soon' ? 'text-amber-600' : 'text-green-700'}`}>
                      {formatCurrency(Math.max(0, a.deposit_balance))}
                    </TableCell>
                    <TableCell className="text-sm">{a.monthly_deduction > 0 ? formatCurrency(a.monthly_deduction) : '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.deduction_start_month ? `${a.deduction_start_month}/${a.deduction_start_year}` : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(a.deduction_end_date)}</TableCell>
                    <TableCell>
                      {monthsLeft !== null ? (
                        <Badge className={`text-xs ${monthsLeft <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                          {monthsLeft} mo
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={status === 'finishing_soon' ? 'active' : status} />
                      {status === 'finishing_soon' && (
                        <Badge className="ml-1 text-xs bg-amber-100 text-amber-700">Soon</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
