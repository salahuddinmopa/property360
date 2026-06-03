'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Building2, Home, Car, Store } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils/format'
import type { Property } from '@/lib/types/database'

const emptyForm = { name: '', type: 'market' as const, address: '', description: '', ownership_details: '', status: 'active' as const }

const typeIcons = { market: Store, apartment: Home, vehicle: Car }
const typeColors: Record<string, string> = { market: 'bg-blue-50 text-blue-700', apartment: 'bg-purple-50 text-purple-700', vehicle: 'bg-orange-50 text-orange-700' }

export default function PropertiesPage() {
  const supabase = createClient()
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Property | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('properties').select('*').order('created_at', { ascending: false })
    setProperties(data ?? [])
    setLoading(false)
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Name required')
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (editing) {
      const { error } = await supabase.from('properties').update(form).eq('id', editing.id)
      if (error) toast.error(error.message)
      else { toast.success('Updated'); setOpen(false); load() }
    } else {
      const { error } = await supabase.from('properties').insert({ ...form, owner_id: user.id })
      if (error) toast.error(error.message)
      else { toast.success('Property created'); setOpen(false); load() }
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this property?')) return
    const { error } = await supabase.from('properties').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Deleted'); load() }
  }

  const grouped = { market: properties.filter(p => p.type === 'market'), apartment: properties.filter(p => p.type === 'apartment'), vehicle: properties.filter(p => p.type === 'vehicle') }

  return (
    <div>
      <PageHeader
        title="Properties"
        description="Manage all property assets"
        actions={<Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true) }}><Plus className="h-4 w-4 mr-2" />Add Property</Button>}
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        {(['market', 'apartment', 'vehicle'] as const).map(type => {
          const Icon = typeIcons[type]
          return (
            <Card key={type}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`p-3 rounded-lg ${typeColors[type]}`}><Icon className="h-5 w-5" /></div>
                <div>
                  <p className="text-sm text-muted-foreground capitalize">{type}s</p>
                  <p className="text-2xl font-bold">{grouped[type].length}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && <div className="col-span-3 text-center py-8 text-muted-foreground">Loading...</div>}
        {!loading && properties.length === 0 && (
          <div className="col-span-3 text-center py-12 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No properties yet. Add your first property.</p>
          </div>
        )}
        {properties.map(p => {
          const Icon = typeIcons[p.type] ?? Building2
          return (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2 flex flex-row items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-md ${typeColors[p.type]}`}><Icon className="h-4 w-4" /></div>
                  <div>
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <Badge variant="outline" className="text-xs capitalize mt-0.5">{p.type}</Badge>
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </CardHeader>
              <CardContent className="pt-0">
                {p.address && <p className="text-sm text-muted-foreground mb-1">{p.address}</p>}
                {p.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{p.description}</p>}
                {p.ownership_details && <p className="text-xs text-muted-foreground">Owner: {p.ownership_details}</p>}
                <p className="text-xs text-muted-foreground mt-2">Added {formatDate(p.created_at)}</p>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => { setEditing(p); setForm({ name: p.name, type: p.type, address: p.address ?? '', description: p.description ?? '', ownership_details: p.ownership_details ?? '', status: p.status }); setOpen(true) }}>
                    <Pencil className="h-3 w-3 mr-1" />Edit
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs text-red-500 hover:text-red-700" onClick={() => handleDelete(p.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Property' : 'Add Property'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Type *</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="market">Market</SelectItem>
                    <SelectItem value="apartment">Apartment</SelectItem>
                    <SelectItem value="vehicle">Vehicle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Ownership Details</Label>
              <Input value={form.ownership_details} onChange={e => setForm(f => ({ ...f, ownership_details: e.target.value }))} placeholder="e.g. Purchased 2020, sole owner" />
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
