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
import { Plus, Pencil, Trash2, Search, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils/format'
import type { Shop, Market } from '@/lib/types/database'

const emptyForm = { market_id: '', shop_number: '', size: '', business_type: '', monthly_rent: 0, status: 'vacant' as const, notes: '' }

export default function ShopsPage() {
  const supabase = createClient()
  const [shops, setShops] = useState<(Shop & { markets?: { name: string } | null })[]>([])
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterMarket, setFilterMarket] = useState('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Shop | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: shopsData }, { data: marketsData }] = await Promise.all([
      supabase.from('shops').select('*, markets(name)').order('shop_number'),
      supabase.from('markets').select('id, name').eq('status', 'active'),
    ])
    setShops(shopsData ?? [])
    setMarkets(marketsData ?? [])
    setLoading(false)
  }

  function openNew() { setEditing(null); setForm(emptyForm); setOpen(true) }
  function openEdit(s: Shop) {
    setEditing(s)
    setForm({ market_id: s.market_id, shop_number: s.shop_number, size: s.size ?? '', business_type: s.business_type ?? '', monthly_rent: s.monthly_rent, status: s.status, notes: s.notes ?? '' })
    setOpen(true)
  }

  async function handleSave() {
    if (!form.market_id || !form.shop_number) return toast.error('Market and shop number required')
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (editing) {
      const { error } = await supabase.from('shops').update(form).eq('id', editing.id)
      if (error) toast.error(error.message)
      else { toast.success('Shop updated'); setOpen(false); load() }
    } else {
      const { error } = await supabase.from('shops').insert({ ...form, owner_id: user.id })
      if (error) toast.error(error.message)
      else { toast.success('Shop added'); setOpen(false); load() }
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this shop?')) return
    const { error } = await supabase.from('shops').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Deleted'); load() }
  }

  const filtered = shops.filter(s => {
    const matchSearch = s.shop_number.toLowerCase().includes(search.toLowerCase()) ||
      (s.business_type ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || s.status === filterStatus
    const matchMarket = filterMarket === 'all' || s.market_id === filterMarket
    return matchSearch && matchStatus && matchMarket
  })

  const stats = {
    total: shops.length,
    occupied: shops.filter(s => s.status === 'occupied').length,
    vacant: shops.filter(s => s.status === 'vacant').length,
    inactive: shops.filter(s => s.status === 'inactive').length,
    totalRent: shops.filter(s => s.status === 'occupied').reduce((sum, s) => sum + s.monthly_rent, 0),
  }

  return (
    <div>
      <PageHeader
        title="Shops"
        description="Manage all market shops"
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Add Shop</Button>}
      />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'text-slate-700' },
          { label: 'Occupied', value: stats.occupied, color: 'text-blue-600' },
          { label: 'Vacant', value: stats.vacant, color: 'text-yellow-600' },
          { label: 'Inactive', value: stats.inactive, color: 'text-gray-500' },
          { label: 'Monthly Rent', value: formatCurrency(stats.totalRent), color: 'text-green-600' },
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
              <Input placeholder="Search shops..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="occupied">Occupied</SelectItem>
                <SelectItem value="vacant">Vacant</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterMarket} onValueChange={setFilterMarket}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Market" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Markets</SelectItem>
                {markets.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shop #</TableHead>
                <TableHead>Market</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Business Type</TableHead>
                <TableHead>Monthly Rent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-30" />No shops found
                </TableCell></TableRow>
              )}
              {filtered.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.shop_number}</TableCell>
                  <TableCell className="text-sm">{(s as any).markets?.name ?? '—'}</TableCell>
                  <TableCell className="text-sm">{s.size ?? '—'}</TableCell>
                  <TableCell className="text-sm">{s.business_type ?? '—'}</TableCell>
                  <TableCell className="font-medium text-green-700">{formatCurrency(s.monthly_rent)}</TableCell>
                  <TableCell><StatusBadge status={s.status} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(s)} className="h-7 w-7 p-0"><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)} className="h-7 w-7 p-0 text-red-500"><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Shop' : 'Add Shop'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Market *</Label>
              <Select value={form.market_id} onValueChange={v => setForm(f => ({ ...f, market_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select market" /></SelectTrigger>
                <SelectContent>{markets.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Shop Number *</Label>
                <Input value={form.shop_number} onChange={e => setForm(f => ({ ...f, shop_number: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Size</Label>
                <Select value={form.size} onValueChange={v => setForm(f => ({ ...f, size: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {['Small', 'Medium', 'Large', 'Extra Large'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Business Type</Label>
                <Input value={form.business_type} onChange={e => setForm(f => ({ ...f, business_type: e.target.value }))} placeholder="e.g. Electronics" />
              </div>
              <div className="space-y-1">
                <Label>Monthly Rent (৳)</Label>
                <Input type="number" value={form.monthly_rent} onChange={e => setForm(f => ({ ...f, monthly_rent: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacant">Vacant</SelectItem>
                  <SelectItem value="occupied">Occupied</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
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
