'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Search, FileText, Calculator } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, formatDate, MONTHS } from '@/lib/utils/format'
import type { RentalAgreement, Tenant, Shop, Apartment, Vehicle } from '@/lib/types/database'

type Agreement = RentalAgreement & {
  tenants?: { full_name: string } | null
}

type FormType = {
  tenant_id: string; asset_type: 'shop' | 'apartment' | 'vehicle'; asset_id: string;
  start_date: string; end_date: string; monthly_rent: number; deposit_amount: number;
  monthly_deduction: number; deduction_start_month: number; deduction_start_year: number;
  total_deducted: number; status: 'active' | 'expired' | 'terminated'; notes: string;
}
const emptyForm: FormType = {
  tenant_id: '', asset_type: 'shop', asset_id: '',
  start_date: '', end_date: '', monthly_rent: 0, deposit_amount: 0,
  monthly_deduction: 0, deduction_start_month: 1, deduction_start_year: new Date().getFullYear(),
  total_deducted: 0, status: 'active', notes: ''
}

export default function AgreementsPage() {
  const supabase = createClient()
  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Agreement | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: agrData }, { data: tData }, { data: sData }, { data: aData }, { data: vData }] = await Promise.all([
      supabase.from('rental_agreements').select('*, tenants(full_name)').order('created_at', { ascending: false }),
      supabase.from('tenants').select('id, full_name').eq('status', 'active'),
      supabase.from('shops').select('id, shop_number, market_id'),
      supabase.from('apartments').select('id, name, unit_number'),
      supabase.from('vehicles').select('id, name, registration_number'),
    ])
    setAgreements(agrData ?? [])
    setTenants(tData ?? [])
    setShops(sData ?? [])
    setApartments(aData ?? [])
    setVehicles(vData ?? [])
    setLoading(false)
  }

  function getAssetOptions() {
    if (form.asset_type === 'shop') return shops.map(s => ({ id: s.id, label: `Shop ${s.shop_number}` }))
    if (form.asset_type === 'apartment') return apartments.map(a => ({ id: a.id, label: `${a.name} ${a.unit_number ?? ''}`.trim() }))
    return vehicles.map(v => ({ id: v.id, label: `${v.name} (${v.registration_number ?? ''})` }))
  }

  function getAssetLabel(type: string, id: string) {
    if (type === 'shop') {
      const s = shops.find(x => x.id === id)
      return s ? `Shop ${s.shop_number}` : id
    }
    if (type === 'apartment') {
      const a = apartments.find(x => x.id === id)
      return a ? `${a.name} ${a.unit_number ?? ''}`.trim() : id
    }
    const v = vehicles.find(x => x.id === id)
    return v ? v.name : id
  }

  const months2Finish = form.monthly_deduction > 0 && form.deposit_amount > 0
    ? Math.ceil(form.deposit_amount / form.monthly_deduction)
    : null
  const cashPayable = form.monthly_rent - form.monthly_deduction

  function openNew() { setEditing(null); setForm(emptyForm); setOpen(true) }
  function openEdit(a: Agreement) {
    setEditing(a)
    setForm({
      tenant_id: a.tenant_id, asset_type: a.asset_type, asset_id: a.asset_id,
      start_date: a.start_date, end_date: a.end_date ?? '',
      monthly_rent: a.monthly_rent, deposit_amount: a.deposit_amount,
      monthly_deduction: a.monthly_deduction, deduction_start_month: a.deduction_start_month ?? 1,
      deduction_start_year: a.deduction_start_year ?? new Date().getFullYear(),
      total_deducted: a.total_deducted, status: a.status, notes: a.notes ?? ''
    })
    setOpen(true)
  }

  async function handleSave() {
    if (!form.tenant_id || !form.asset_id || !form.start_date) return toast.error('Required fields missing')
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const payload = {
      tenant_id: form.tenant_id, asset_type: form.asset_type, asset_id: form.asset_id,
      start_date: form.start_date, end_date: form.end_date || null,
      monthly_rent: form.monthly_rent, deposit_amount: form.deposit_amount,
      monthly_deduction: form.monthly_deduction, total_deducted: form.total_deducted,
      deduction_start_month: form.monthly_deduction > 0 ? form.deduction_start_month : null,
      deduction_start_year: form.monthly_deduction > 0 ? form.deduction_start_year : null,
      status: form.status, notes: form.notes || null
    }
    if (editing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from('rental_agreements').update(payload as any).eq('id', editing.id)
      if (error) toast.error(error.message)
      else { toast.success('Agreement updated'); setOpen(false); load() }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from('rental_agreements').insert({ ...payload, owner_id: user.id } as any)
      if (error) toast.error(error.message)
      else { toast.success('Agreement created'); setOpen(false); load() }
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this agreement?')) return
    const { error } = await supabase.from('rental_agreements').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Deleted'); load() }
  }

  const filtered = agreements.filter(a =>
    (a.tenants?.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    a.asset_type.includes(search.toLowerCase())
  )

  return (
    <div>
      <PageHeader
        title="Rental Agreements"
        description="Manage all rental agreements with deposit deduction tracking"
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Agreement</Button>}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: agreements.length },
          { label: 'Active', value: agreements.filter(a => a.status === 'active').length },
          { label: 'Total Deposit', value: formatCurrency(agreements.reduce((s, a) => s + a.deposit_amount, 0)) },
          { label: 'Deposit Balance', value: formatCurrency(agreements.reduce((s, a) => s + a.deposit_balance, 0)) },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-xl font-bold">{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by tenant..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Rent</TableHead>
                <TableHead>Cash Payable</TableHead>
                <TableHead>Deposit</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Deduction End</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={10} className="text-center py-8">Loading...</TableCell></TableRow>}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />No agreements
                </TableCell></TableRow>
              )}
              {filtered.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.tenants?.full_name ?? '—'}</TableCell>
                  <TableCell>
                    <div>
                      <Badge variant="outline" className="text-xs mb-1">{a.asset_type}</Badge>
                      <div className="text-xs text-muted-foreground">{getAssetLabel(a.asset_type, a.asset_id)}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(a.start_date)}</TableCell>
                  <TableCell className="text-sm font-medium">{formatCurrency(a.monthly_rent)}</TableCell>
                  <TableCell className="text-sm font-medium text-green-700">{formatCurrency(a.monthly_cash_payable)}</TableCell>
                  <TableCell className="text-sm">{formatCurrency(a.deposit_amount)}</TableCell>
                  <TableCell className={`text-sm font-medium ${a.deposit_balance <= 0 ? 'text-gray-500' : 'text-blue-600'}`}>
                    {formatCurrency(Math.max(0, a.deposit_balance))}
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(a.deduction_end_date)}</TableCell>
                  <TableCell><StatusBadge status={a.status} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(a)} className="h-7 w-7 p-0"><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)} className="h-7 w-7 p-0 text-red-500"><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Agreement' : 'New Rental Agreement'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1">
              <Label>Tenant *</Label>
              <Select value={form.tenant_id} onValueChange={v => setForm(f => ({ ...f, tenant_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                <SelectContent>{tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Asset Type *</Label>
              <Select value={form.asset_type} onValueChange={v => setForm(f => ({ ...f, asset_type: v as any, asset_id: '' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="shop">Shop</SelectItem>
                  <SelectItem value="apartment">Apartment</SelectItem>
                  <SelectItem value="vehicle">Vehicle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Asset *</Label>
              <Select value={form.asset_id} onValueChange={v => setForm(f => ({ ...f, asset_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger>
                <SelectContent>{getAssetOptions().map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Start Date *</Label>
              <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>End Date (optional)</Label>
              <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Monthly Rent (৳) *</Label>
              <Input type="number" value={form.monthly_rent} onChange={e => setForm(f => ({ ...f, monthly_rent: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-1">
              <Label>Deposit Amount (৳)</Label>
              <Input type="number" value={form.deposit_amount} onChange={e => setForm(f => ({ ...f, deposit_amount: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-1">
              <Label>Monthly Deduction (৳)</Label>
              <Input type="number" value={form.monthly_deduction} onChange={e => setForm(f => ({ ...f, monthly_deduction: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-1">
              <Label>Total Already Deducted (৳)</Label>
              <Input type="number" value={form.total_deducted} onChange={e => setForm(f => ({ ...f, total_deducted: parseFloat(e.target.value) || 0 }))} />
            </div>
            {form.monthly_deduction > 0 && (
              <>
                <div className="space-y-1">
                  <Label>Deduction Start Month</Label>
                  <Select value={form.deduction_start_month.toString()} onValueChange={v => setForm(f => ({ ...f, deduction_start_month: parseInt(v) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={(i+1).toString()}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Deduction Start Year</Label>
                  <Input type="number" value={form.deduction_start_year} onChange={e => setForm(f => ({ ...f, deduction_start_year: parseInt(e.target.value) || 2024 }))} />
                </div>
              </>
            )}
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Calculation summary */}
            {(form.monthly_rent > 0 || form.monthly_deduction > 0) && (
              <div className="col-span-2 bg-blue-50 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 mb-2">
                  <Calculator className="h-4 w-4" />
                  Calculation Summary
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Monthly Cash Payable:</span>
                  <span className="font-semibold text-green-700">{formatCurrency(Math.max(0, cashPayable))}</span>
                  {months2Finish && (
                    <>
                      <span className="text-muted-foreground">Months to finish deduction:</span>
                      <span className="font-semibold">{months2Finish} months</span>
                    </>
                  )}
                </div>
              </div>
            )}
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
