'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Search, Receipt } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, formatDate, EXPENSE_CATEGORIES, YEARS, MONTHS } from '@/lib/utils/format'
import type { Expense, Market, Shop, Apartment, Vehicle } from '@/lib/types/database'

const emptyForm = { asset_type: 'general' as const, asset_id: '', category: '', amount: 0, expense_date: new Date().toISOString().split('T')[0], paid_to: '', payment_method: 'cash' as const, notes: '' }

export default function ExpensesPage() {
  const supabase = createClient()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [markets, setMarkets] = useState<Market[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [filterMonth, filterYear])

  async function load() {
    setLoading(true)
    const startDate = `${filterYear}-${filterMonth.toString().padStart(2, '0')}-01`
    const endDate = new Date(filterYear, filterMonth, 0).toISOString().split('T')[0]
    const [{ data: expData }, { data: mData }, { data: sData }, { data: aData }, { data: vData }] = await Promise.all([
      supabase.from('expenses').select('*').gte('expense_date', startDate).lte('expense_date', endDate).order('expense_date', { ascending: false }),
      supabase.from('markets').select('id, name'),
      supabase.from('shops').select('id, shop_number'),
      supabase.from('apartments').select('id, name, unit_number'),
      supabase.from('vehicles').select('id, name'),
    ])
    setExpenses(expData ?? [])
    setMarkets(mData ?? [])
    setShops(sData ?? [])
    setApartments(aData ?? [])
    setVehicles(vData ?? [])
    setLoading(false)
  }

  function getAssetOptions() {
    if (form.asset_type === 'market') return markets.map(m => ({ id: m.id, label: m.name }))
    if (form.asset_type === 'shop') return shops.map(s => ({ id: s.id, label: `Shop ${s.shop_number}` }))
    if (form.asset_type === 'apartment') return apartments.map(a => ({ id: a.id, label: `${a.name} ${a.unit_number ?? ''}`.trim() }))
    if (form.asset_type === 'vehicle') return vehicles.map(v => ({ id: v.id, label: v.name }))
    return []
  }

  function getAssetName(type: string | null, id: string | null) {
    if (!type || !id) return '—'
    if (type === 'market') return markets.find(m => m.id === id)?.name ?? id
    if (type === 'shop') { const s = shops.find(s => s.id === id); return s ? `Shop ${s.shop_number}` : id }
    if (type === 'apartment') { const a = apartments.find(a => a.id === id); return a ? `${a.name} ${a.unit_number ?? ''}`.trim() : id }
    if (type === 'vehicle') return vehicles.find(v => v.id === id)?.name ?? id
    return '—'
  }

  const categories = form.asset_type ? EXPENSE_CATEGORIES[form.asset_type as keyof typeof EXPENSE_CATEGORIES] ?? [] : []

  function openNew() { setEditing(null); setForm(emptyForm); setOpen(true) }
  function openEdit(e: Expense) {
    setEditing(e)
    setForm({ asset_type: (e.asset_type ?? 'general') as any, asset_id: e.asset_id ?? '', category: e.category, amount: e.amount, expense_date: e.expense_date, paid_to: e.paid_to ?? '', payment_method: (e.payment_method ?? 'cash') as any, notes: e.notes ?? '' })
    setOpen(true)
  }

  async function handleSave() {
    if (!form.category || form.amount <= 0) return toast.error('Category and amount required')
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const payload = { ...form, asset_id: form.asset_id || null, owner_id: user.id }
    if (editing) {
      const { error } = await supabase.from('expenses').update(payload).eq('id', editing.id)
      if (error) toast.error(error.message)
      else { toast.success('Expense updated'); setOpen(false); load() }
    } else {
      const { error } = await supabase.from('expenses').insert(payload)
      if (error) toast.error(error.message)
      else { toast.success('Expense added'); setOpen(false); load() }
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this expense?')) return
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Deleted'); load() }
  }

  const filtered = expenses.filter(e => {
    const matchSearch = e.category.toLowerCase().includes(search.toLowerCase()) ||
      (e.paid_to ?? '').toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'all' || e.asset_type === filterType
    return matchSearch && matchType
  })

  const totalExpenses = filtered.reduce((s, e) => s + e.amount, 0)
  const byCategory = filtered.reduce((acc: Record<string, number>, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount
    return acc
  }, {})
  const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Track and manage all property expenses"
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Add Expense</Button>}
      />

      {/* Month filter */}
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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total Expenses</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Transactions</p>
          <p className="text-2xl font-bold">{filtered.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Top Category</p>
          <p className="text-lg font-bold">{topCategory ? topCategory[0] : '—'}</p>
          {topCategory && <p className="text-xs text-muted-foreground">{formatCurrency(topCategory[1])}</p>}
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search expenses..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="market">Market</SelectItem>
                <SelectItem value="shop">Shop</SelectItem>
                <SelectItem value="apartment">Apartment</SelectItem>
                <SelectItem value="vehicle">Vehicle</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Paid To</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />No expenses for this period
                </TableCell></TableRow>
              )}
              {filtered.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm">{formatDate(e.expense_date)}</TableCell>
                  <TableCell className="font-medium text-sm">{e.category}</TableCell>
                  <TableCell>
                    <div>
                      <Badge variant="outline" className="text-xs capitalize">{e.asset_type ?? 'general'}</Badge>
                      {e.asset_id && <div className="text-xs text-muted-foreground mt-0.5">{getAssetName(e.asset_type, e.asset_id)}</div>}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-red-700">{formatCurrency(e.amount)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.paid_to ?? '—'}</TableCell>
                  <TableCell className="text-xs capitalize">{e.payment_method?.replace('_', ' ') ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(e)} className="h-7 w-7 p-0"><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(e.id)} className="h-7 w-7 p-0 text-red-500"><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Expense' : 'Add Expense'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Asset Type</Label>
                <Select value={form.asset_type} onValueChange={v => setForm(f => ({ ...f, asset_type: v as any, asset_id: '', category: '' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="market">Market</SelectItem>
                    <SelectItem value="shop">Shop</SelectItem>
                    <SelectItem value="apartment">Apartment</SelectItem>
                    <SelectItem value="vehicle">Vehicle</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.asset_type !== 'general' && (
                <div className="space-y-1">
                  <Label>Asset</Label>
                  <Select value={form.asset_id} onValueChange={v => setForm(f => ({ ...f, asset_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{getAssetOptions().map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Amount (৳) *</Label>
                <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1">
                <Label>Date *</Label>
                <Input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Paid To</Label>
                <Input value={form.paid_to} onChange={e => setForm(f => ({ ...f, paid_to: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Payment Method</Label>
                <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="mobile_banking">Mobile Banking</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
