'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Pencil, Trash2, Search, Users } from 'lucide-react'
import { toast } from 'sonner'
import type { Tenant } from '@/lib/types/database'

const emptyForm = { full_name: '', phone: '', email: '', nid_passport: '', address: '', emergency_contact: '', business_name: '', notes: '', status: 'active' as const }

export default function TenantsPage() {
  const supabase = createClient()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Tenant | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('tenants').select('*').order('full_name')
    setTenants(data ?? [])
    setLoading(false)
  }

  function openNew() { setEditing(null); setForm(emptyForm); setOpen(true) }
  function openEdit(t: Tenant) {
    setEditing(t)
    setForm({ full_name: t.full_name, phone: t.phone ?? '', email: t.email ?? '', nid_passport: t.nid_passport ?? '', address: t.address ?? '', emergency_contact: t.emergency_contact ?? '', business_name: t.business_name ?? '', notes: t.notes ?? '', status: t.status })
    setOpen(true)
  }

  async function handleSave() {
    if (!form.full_name.trim()) return toast.error('Name required')
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (editing) {
      const { error } = await supabase.from('tenants').update(form).eq('id', editing.id)
      if (error) toast.error(error.message)
      else { toast.success('Tenant updated'); setOpen(false); load() }
    } else {
      const { error } = await supabase.from('tenants').insert({ ...form, owner_id: user.id })
      if (error) toast.error(error.message)
      else { toast.success('Tenant added'); setOpen(false); load() }
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this tenant?')) return
    const { error } = await supabase.from('tenants').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Deleted'); load() }
  }

  const filtered = tenants.filter(t =>
    t.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (t.phone ?? '').includes(search) ||
    (t.business_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <PageHeader
        title="Tenants"
        description="Manage all tenants"
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Add Tenant</Button>}
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">{tenants.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Active</p><p className="text-2xl font-bold text-green-600">{tenants.filter(t => t.status === 'active').length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Inactive</p><p className="text-2xl font-bold text-gray-500">{tenants.filter(t => t.status === 'inactive').length}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name, phone, business..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Business</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>NID/Passport</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />No tenants found
                </TableCell></TableRow>
              )}
              {filtered.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.full_name}</TableCell>
                  <TableCell className="text-sm">{t.phone ?? '—'}</TableCell>
                  <TableCell className="text-sm">{t.business_name ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.email ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.nid_passport ?? '—'}</TableCell>
                  <TableCell><StatusBadge status={t.status} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(t)} className="h-7 w-7 p-0"><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)} className="h-7 w-7 p-0 text-red-500"><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? 'Edit Tenant' : 'Add Tenant'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1">
              <Label>Full Name *</Label>
              <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>NID/Passport</Label>
              <Input value={form.nid_passport} onChange={e => setForm(f => ({ ...f, nid_passport: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Business Name</Label>
              <Input value={form.business_name} onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Emergency Contact</Label>
              <Input value={form.emergency_contact} onChange={e => setForm(f => ({ ...f, emergency_contact: e.target.value }))} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Notes</Label>
              <Textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
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
