'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Search, CreditCard, RefreshCw, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, formatDate, MONTHS, PAYMENT_METHODS, YEARS } from '@/lib/utils/format'
import type { RentPayment } from '@/lib/types/database'

type Payment = RentPayment & {
  tenants?: { full_name: string } | null
  rental_agreements?: { monthly_rent: number; monthly_cash_payable: number; monthly_deduction: number } | null
}

export default function RentPage() {
  const supabase = createClient()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())
  const [filterStatus, setFilterStatus] = useState('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Payment | null>(null)
  const [payForm, setPayForm] = useState({ paid_amount: 0, payment_method: 'cash' as const, payment_date: new Date().toISOString().split('T')[0], notes: '' })
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => { load() }, [filterMonth, filterYear])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('rent_payments')
      .select('*, tenants(full_name), rental_agreements(monthly_rent, monthly_cash_payable, monthly_deduction)')
      .eq('month', filterMonth)
      .eq('year', filterYear)
      .order('created_at', { ascending: false })
    setPayments(data ?? [])
    setLoading(false)
  }

  async function generateMonthlyRecords() {
    setGenerating(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get all active agreements
    const { data: agreements } = await supabase
      .from('rental_agreements')
      .select('*')
      .eq('status', 'active')
      .eq('owner_id', user.id)

    if (!agreements?.length) {
      toast.info('No active agreements found')
      setGenerating(false)
      return
    }

    let created = 0, skipped = 0
    for (const agr of agreements) {
      // Check if record already exists
      const { data: existing } = await supabase
        .from('rent_payments')
        .select('id')
        .eq('agreement_id', agr.id)
        .eq('month', filterMonth)
        .eq('year', filterYear)
        .single()

      if (existing) { skipped++; continue }

      // Determine deduction for this month
      let deduction = agr.monthly_deduction ?? 0
      if (deduction > 0 && agr.deduction_end_date) {
        const endDate = new Date(agr.deduction_end_date)
        const checkDate = new Date(filterYear, filterMonth - 1, 1)
        if (checkDate > endDate) deduction = 0
      }
      if (deduction > agr.deposit_balance) deduction = Math.max(0, agr.deposit_balance)

      const cashPayable = agr.monthly_rent - deduction

      await supabase.from('rent_payments').insert({
        owner_id: user.id,
        agreement_id: agr.id,
        tenant_id: agr.tenant_id,
        asset_type: agr.asset_type,
        asset_id: agr.asset_id,
        month: filterMonth,
        year: filterYear,
        monthly_rent: agr.monthly_rent,
        deduction_amount: deduction,
        cash_payable: cashPayable,
        paid_amount: 0,
        payment_method: null,
        status: 'unpaid',
      })
      created++
    }

    toast.success(`Generated ${created} records. ${skipped} already existed.`)
    setGenerating(false)
    load()
  }

  function openPay(p: Payment) {
    setEditing(p)
    setPayForm({
      paid_amount: p.cash_payable - p.paid_amount,
      payment_method: 'cash',
      payment_date: new Date().toISOString().split('T')[0],
      notes: ''
    })
    setOpen(true)
  }

  async function handlePayment() {
    if (!editing) return
    setSaving(true)
    const newPaid = editing.paid_amount + payForm.paid_amount
    const newStatus = newPaid >= editing.cash_payable ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid'

    const { error } = await supabase
      .from('rent_payments')
      .update({
        paid_amount: newPaid,
        payment_date: payForm.payment_date,
        payment_method: payForm.payment_method,
        status: newStatus,
        notes: payForm.notes || null,
      })
      .eq('id', editing.id)

    if (error) toast.error(error.message)
    else {
      // Update total_deducted on agreement if deduction > 0
      if (editing.deduction_amount > 0) {
        await supabase.rpc('update_total_deducted' as any, {
          p_agreement_id: editing.agreement_id,
          p_deduction: editing.deduction_amount,
        }).catch(() => {
          // Manual update fallback
          supabase.from('rental_agreements')
            .select('total_deducted')
            .eq('id', editing.agreement_id)
            .single()
            .then(({ data }) => {
              if (data) {
                supabase.from('rental_agreements')
                  .update({ total_deducted: data.total_deducted + editing.deduction_amount })
                  .eq('id', editing.agreement_id)
              }
            })
        })
      }
      toast.success('Payment recorded')
      setOpen(false)
      load()
    }
    setSaving(false)
  }

  const filtered = payments.filter(p => {
    const matchSearch = (p.tenants?.full_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || p.status === filterStatus
    return matchSearch && matchStatus
  })

  const stats = {
    total: payments.length,
    paid: payments.filter(p => p.status === 'paid').length,
    partial: payments.filter(p => p.status === 'partial').length,
    unpaid: payments.filter(p => p.status === 'unpaid' || p.status === 'overdue').length,
    totalCollected: payments.reduce((s, p) => s + p.paid_amount, 0),
    totalDue: payments.reduce((s, p) => s + Math.max(0, p.due_amount), 0),
    totalPayable: payments.reduce((s, p) => s + p.cash_payable, 0),
  }

  return (
    <div>
      <PageHeader
        title="Rent Collection"
        description="Track and record monthly rent payments"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={generateMonthlyRecords} disabled={generating}>
              <RefreshCw className={`h-4 w-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
              Generate {MONTHS[filterMonth - 1]} {filterYear}
            </Button>
          </div>
        }
      />

      {/* Month/Year filter */}
      <div className="flex gap-3 mb-6">
        <Select value={filterMonth.toString()} onValueChange={v => setFilterMonth(parseInt(v))}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={(i+1).toString()}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterYear.toString()} onValueChange={v => setFilterYear(parseInt(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{YEARS.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Collected', value: formatCurrency(stats.totalCollected), color: 'text-green-600' },
          { label: 'Total Due', value: formatCurrency(stats.totalDue), color: 'text-red-600' },
          { label: 'Paid', value: `${stats.paid}/${stats.total}`, color: 'text-blue-600' },
          { label: 'Unpaid', value: stats.unpaid, color: 'text-orange-600' },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search tenant..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
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
                <TableHead>Rent</TableHead>
                <TableHead>Deduction</TableHead>
                <TableHead>Cash Payable</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={11} className="text-center py-8">Loading...</TableCell></TableRow>}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No records. Click &quot;Generate&quot; to create this month&apos;s records.
                </TableCell></TableRow>
              )}
              {filtered.map(p => (
                <TableRow key={p.id} className={p.due_amount > 0 ? 'bg-red-50/30' : ''}>
                  <TableCell className="font-medium text-sm">{p.tenants?.full_name ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{p.asset_type}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{formatCurrency(p.monthly_rent)}</TableCell>
                  <TableCell className="text-sm text-blue-600">{formatCurrency(p.deduction_amount)}</TableCell>
                  <TableCell className="text-sm font-medium">{formatCurrency(p.cash_payable)}</TableCell>
                  <TableCell className="text-sm text-green-700 font-medium">{formatCurrency(p.paid_amount)}</TableCell>
                  <TableCell className={`text-sm font-medium ${p.due_amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(Math.max(0, p.due_amount))}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(p.payment_date)}</TableCell>
                  <TableCell className="text-xs capitalize">{p.payment_method?.replace('_', ' ') ?? '—'}</TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell>
                    {p.status !== 'paid' && (
                      <Button size="sm" variant="outline" onClick={() => openPay(p)} className="h-7 text-xs">
                        <Plus className="h-3 w-3 mr-1" />Pay
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment — {editing?.tenants?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editing && (
              <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Cash Payable:</span><span className="font-medium">{formatCurrency(editing.cash_payable)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Already Paid:</span><span className="font-medium text-green-700">{formatCurrency(editing.paid_amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Remaining Due:</span><span className="font-semibold text-red-600">{formatCurrency(Math.max(0, editing.due_amount))}</span></div>
              </div>
            )}
            <div className="space-y-1">
              <Label>Payment Amount (৳)</Label>
              <Input type="number" value={payForm.paid_amount} onChange={e => setPayForm(f => ({ ...f, paid_amount: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Payment Date</Label>
                <Input type="date" value={payForm.payment_date} onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Payment Method</Label>
                <Select value={payForm.payment_method} onValueChange={v => setPayForm(f => ({ ...f, payment_method: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="mobile_banking">Mobile Banking</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handlePayment} disabled={saving}>{saving ? 'Saving...' : 'Record Payment'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
