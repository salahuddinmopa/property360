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
import { Plus, Pencil, Trash2, Search, Car, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils/format'
import type { Vehicle } from '@/lib/types/database'

const emptyForm = { name: '', registration_number: '', make: '', model: '', year: new Date().getFullYear(), driver_name: '', driver_phone: '', insurance_expiry: '', fitness_expiry: '', tax_token_expiry: '', status: 'available' as const, notes: '' }

function isExpiringSoon(date: string | null) {
  if (!date) return false
  const d = new Date(date)
  const soon = new Date(); soon.setMonth(soon.getMonth() + 2)
  return d <= soon
}

export default function VehiclesPage() {
  const supabase = createClient()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Vehicle | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('vehicles').select('*').order('name')
    setVehicles(data ?? [])
    setLoading(false)
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Name required')
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const payload = { ...form, insurance_expiry: form.insurance_expiry || null, fitness_expiry: form.fitness_expiry || null, tax_token_expiry: form.tax_token_expiry || null }
    if (editing) {
      const { error } = await supabase.from('vehicles').update(payload).eq('id', editing.id)
      if (error) toast.error(error.message)
      else { toast.success('Updated'); setOpen(false); load() }
    } else {
      const { error } = await supabase.from('vehicles').insert({ ...payload, owner_id: user.id })
      if (error) toast.error(error.message)
      else { toast.success('Vehicle added'); setOpen(false); load() }
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete?')) return
    const { error } = await supabase.from('vehicles').delete().eq('id', id)
    if (error) toast.error(error.message); else { toast.success('Deleted'); load() }
  }

  const expiringCount = vehicles.filter(v => isExpiringSoon(v.insurance_expiry) || isExpiringSoon(v.fitness_expiry) || isExpiringSoon(v.tax_token_expiry)).length
  const filtered = vehicles.filter(v => v.name.toLowerCase().includes(search.toLowerCase()) || (v.registration_number ?? '').toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <PageHeader title="Vehicles" description="Manage vehicle fleet" actions={<Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true) }}><Plus className="h-4 w-4 mr-2" />Add Vehicle</Button>} />

      {expiringCount > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4" />{expiringCount} vehicle(s) have documents expiring within 2 months
        </div>
      )}

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: vehicles.length },
          { label: 'Rented', value: vehicles.filter(v => v.status === 'rented').length, color: 'text-blue-600' },
          { label: 'Available', value: vehicles.filter(v => v.status === 'available').length, color: 'text-green-600' },
          { label: 'Maintenance', value: vehicles.filter(v => v.status === 'maintenance').length, color: 'text-orange-600' },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className={`text-2xl font-bold ${(s as any).color ?? ''}`}>{s.value}</p></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search vehicles..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} /></div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Reg. Number</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Insurance</TableHead>
                <TableHead>Fitness</TableHead>
                <TableHead>Tax Token</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={8} className="text-center py-8">Loading...</TableCell></TableRow>}
              {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground"><Car className="h-8 w-8 mx-auto mb-2 opacity-30" />No vehicles</TableCell></TableRow>}
              {filtered.map(v => (
                <TableRow key={v.id}>
                  <TableCell>
                    <p className="font-medium">{v.name}</p>
                    <p className="text-xs text-muted-foreground">{v.make} {v.model} {v.year}</p>
                  </TableCell>
                  <TableCell className="text-sm">{v.registration_number ?? '—'}</TableCell>
                  <TableCell className="text-sm">{v.driver_name ?? '—'}</TableCell>
                  {[v.insurance_expiry, v.fitness_expiry, v.tax_token_expiry].map((exp, i) => (
                    <TableCell key={i} className={`text-sm ${isExpiringSoon(exp) ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                      {formatDate(exp)} {isExpiringSoon(exp) && <AlertTriangle className="h-3 w-3 inline ml-1" />}
                    </TableCell>
                  ))}
                  <TableCell><StatusBadge status={v.status} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(v); setForm({ name: v.name, registration_number: v.registration_number ?? '', make: v.make ?? '', model: v.model ?? '', year: v.year ?? new Date().getFullYear(), driver_name: v.driver_name ?? '', driver_phone: v.driver_phone ?? '', insurance_expiry: v.insurance_expiry ?? '', fitness_expiry: v.fitness_expiry ?? '', tax_token_expiry: v.tax_token_expiry ?? '', status: v.status, notes: v.notes ?? '' }); setOpen(true) }} className="h-7 w-7 p-0"><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(v.id)} className="h-7 w-7 p-0 text-red-500"><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Registration Number</Label><Input value={form.registration_number} onChange={e => setForm(f => ({ ...f, registration_number: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Make</Label><Input value={form.make} onChange={e => setForm(f => ({ ...f, make: e.target.value }))} placeholder="Toyota" /></div>
            <div className="space-y-1"><Label>Model</Label><Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="Noah" /></div>
            <div className="space-y-1"><Label>Year</Label><Input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) || 2020 }))} /></div>
            <div className="space-y-1"><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="available">Available</SelectItem><SelectItem value="rented">Rented</SelectItem><SelectItem value="maintenance">Maintenance</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-1"><Label>Driver Name</Label><Input value={form.driver_name} onChange={e => setForm(f => ({ ...f, driver_name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Driver Phone</Label><Input value={form.driver_phone} onChange={e => setForm(f => ({ ...f, driver_phone: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Insurance Expiry</Label><Input type="date" value={form.insurance_expiry} onChange={e => setForm(f => ({ ...f, insurance_expiry: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Fitness Expiry</Label><Input type="date" value={form.fitness_expiry} onChange={e => setForm(f => ({ ...f, fitness_expiry: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Tax Token Expiry</Label><Input type="date" value={form.tax_token_expiry} onChange={e => setForm(f => ({ ...f, tax_token_expiry: e.target.value }))} /></div>
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
