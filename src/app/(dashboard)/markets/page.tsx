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
import { Plus, Pencil, Trash2, Search, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Market } from '@/lib/types/database'

const emptyForm = { name: '', address: '', total_shops: 0, manager_name: '', status: 'active' as const }

export default function MarketsPage() {
  const supabase = createClient()
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Market | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('markets').select('*').order('created_at', { ascending: false })
    setMarkets(data ?? [])
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setForm(emptyForm)
    setOpen(true)
  }

  function openEdit(m: Market) {
    setEditing(m)
    setForm({ name: m.name, address: m.address ?? '', total_shops: m.total_shops, manager_name: m.manager_name ?? '', status: m.status })
    setOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Name required')
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (editing) {
      const { error } = await supabase.from('markets').update(form).eq('id', editing.id)
      if (error) toast.error(error.message)
      else { toast.success('Market updated'); setOpen(false); load() }
    } else {
      const { error } = await supabase.from('markets').insert({ ...form, owner_id: user.id })
      if (error) toast.error(error.message)
      else { toast.success('Market created'); setOpen(false); load() }
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this market? This cannot be undone.')) return
    const { error } = await supabase.from('markets').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Deleted'); load() }
  }

  const filtered = markets.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.address ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <PageHeader
        title="Markets"
        description="Manage your market properties"
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Add Market</Button>}
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Markets', value: markets.length },
          { label: 'Active', value: markets.filter(m => m.status === 'active').length },
          { label: 'Total Shops', value: markets.reduce((s, m) => s + m.total_shops, 0) },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold">{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Search + Table */}
      <Card>
        <CardHeader>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search markets..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Shops</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No markets found
                </TableCell></TableRow>
              )}
              {filtered.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{m.address ?? '—'}</TableCell>
                  <TableCell>{m.total_shops}</TableCell>
                  <TableCell>{m.manager_name ?? '—'}</TableCell>
                  <TableCell><StatusBadge status={m.status} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(m)} className="h-7 w-7 p-0">
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(m.id)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Market' : 'Add Market'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Market Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Number of Shops</Label>
                <Input type="number" value={form.total_shops} onChange={e => setForm(f => ({ ...f, total_shops: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1">
                <Label>Manager Name</Label>
                <Input value={form.manager_name} onChange={e => setForm(f => ({ ...f, manager_name: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as 'active' | 'inactive' }))}>
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
