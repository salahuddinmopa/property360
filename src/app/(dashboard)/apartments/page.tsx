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
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Pencil, Trash2, Search, Home } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils/format'
import type { Apartment } from '@/lib/types/database'

const emptyForm = { name: '', unit_number: '', address: '', bedrooms: 0, bathrooms: 0, floor_area: 0, service_charge: 0, utility_included: false, status: 'vacant' as const, notes: '' }

export default function ApartmentsPage() {
  const supabase = createClient()
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Apartment | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('apartments').select('*').order('name')
    setApartments(data ?? [])
    setLoading(false)
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Name required')
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (editing) {
      const { error } = await supabase.from('apartments').update(form).eq('id', editing.id)
      if (error) toast.error(error.message)
      else { toast.success('Updated'); setOpen(false); load() }
    } else {
      const { error } = await supabase.from('apartments').insert({ ...form, owner_id: user.id })
      if (error) toast.error(error.message)
      else { toast.success('Apartment added'); setOpen(false); load() }
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete?')) return
    const { error } = await supabase.from('apartments').delete().eq('id', id)
    if (error) toast.error(error.message); else { toast.success('Deleted'); load() }
  }

  const filtered = apartments.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.unit_number ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <PageHeader title="Apartments" description="Manage apartment rentals" actions={<Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true) }}><Plus className="h-4 w-4 mr-2" />Add Apartment</Button>} />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{apartments.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Occupied</p><p className="text-2xl font-bold text-blue-600">{apartments.filter(a => a.status === 'occupied').length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Vacant</p><p className="text-2xl font-bold text-yellow-600">{apartments.filter(a => a.status === 'vacant').length}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search apartments..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} /></div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name / Unit</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Beds/Baths</TableHead>
                <TableHead>Service Charge</TableHead>
                <TableHead>Utility</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>}
              {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground"><Home className="h-8 w-8 mx-auto mb-2 opacity-30" />No apartments</TableCell></TableRow>}
              {filtered.map(a => (
                <TableRow key={a.id}>
                  <TableCell>
                    <p className="font-medium">{a.name}</p>
                    {a.unit_number && <p className="text-xs text-muted-foreground">Unit: {a.unit_number}</p>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.address ?? '—'}</TableCell>
                  <TableCell className="text-sm">{a.bedrooms ?? '—'} / {a.bathrooms ?? '—'}</TableCell>
                  <TableCell className="text-sm">{a.service_charge > 0 ? formatCurrency(a.service_charge) : '—'}</TableCell>
                  <TableCell className="text-sm">{a.utility_included ? 'Yes' : 'No'}</TableCell>
                  <TableCell><StatusBadge status={a.status} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(a); setForm({ name: a.name, unit_number: a.unit_number ?? '', address: a.address ?? '', bedrooms: a.bedrooms ?? 0, bathrooms: a.bathrooms ?? 0, floor_area: a.floor_area ?? 0, service_charge: a.service_charge, utility_included: a.utility_included, status: a.status, notes: a.notes ?? '' }); setOpen(true) }} className="h-7 w-7 p-0"><Pencil className="h-3 w-3" /></Button>
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
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Apartment' : 'Add Apartment'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Unit Number</Label><Input value={form.unit_number} onChange={e => setForm(f => ({ ...f, unit_number: e.target.value }))} /></div>
            <div className="space-y-1 col-span-2"><Label>Address</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Bedrooms</Label><Input type="number" value={form.bedrooms} onChange={e => setForm(f => ({ ...f, bedrooms: parseInt(e.target.value) || 0 }))} /></div>
            <div className="space-y-1"><Label>Bathrooms</Label><Input type="number" value={form.bathrooms} onChange={e => setForm(f => ({ ...f, bathrooms: parseInt(e.target.value) || 0 }))} /></div>
            <div className="space-y-1"><Label>Service Charge (৳)</Label><Input type="number" value={form.service_charge} onChange={e => setForm(f => ({ ...f, service_charge: parseFloat(e.target.value) || 0 }))} /></div>
            <div className="space-y-1"><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="vacant">Vacant</SelectItem><SelectItem value="occupied">Occupied</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select>
            </div>
            <div className="flex items-center gap-3 col-span-2 py-1">
              <Switch checked={form.utility_included} onCheckedChange={v => setForm(f => ({ ...f, utility_included: v }))} />
              <Label>Utility Included</Label>
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
