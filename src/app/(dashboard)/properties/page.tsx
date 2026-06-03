'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { PropertyTypeSelect } from '@/components/shared/property-type-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Input as SearchInput } from '@/components/ui/input'
import { Plus, Pencil, Trash2, Building2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils/format'
import type { Property } from '@/lib/types/database'

type FormType = {
  name: string
  property_type: string
  address: string
  description: string
  ownership_details: string
  status: 'active' | 'inactive'
}

const emptyForm: FormType = {
  name: '',
  property_type: '',
  address: '',
  description: '',
  ownership_details: '',
  status: 'active',
}

export default function PropertiesPage() {
  const supabase = createClient()
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Property | null>(null)
  const [form, setForm] = useState<FormType>(emptyForm)
  const [saving, setSaving] = useState(false)

  // All unique property types in use (for filter dropdown)
  const uniqueTypes = Array.from(new Set(properties.map(p => p.property_type || p.type).filter(Boolean))).sort()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('properties').select('*').order('created_at', { ascending: false })
    setProperties(data ?? [])
    setLoading(false)
  }

  function getEffectiveType(p: Property) {
    return p.property_type || p.type || '—'
  }

  function openNew() {
    setEditing(null)
    setForm(emptyForm)
    setOpen(true)
  }

  function openEdit(p: Property) {
    setEditing(p)
    setForm({
      name: p.name,
      property_type: getEffectiveType(p),
      address: p.address ?? '',
      description: p.description ?? '',
      ownership_details: p.ownership_details ?? '',
      status: p.status,
    })
    setOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Name required')
    if (!form.property_type) return toast.error('Property type required')
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const payload = {
      name: form.name,
      property_type: form.property_type,
      // keep legacy 'type' in sync for backward compat (lowercase, mapped)
      type: mapToLegacyType(form.property_type),
      address: form.address || null,
      description: form.description || null,
      ownership_details: form.ownership_details || null,
      status: form.status,
    }

    if (editing) {
      const { error } = await supabase.from('properties').update(payload as any).eq('id', editing.id)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Property updated')
    } else {
      const { error } = await supabase.from('properties').insert({ ...payload, owner_id: user.id } as any)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Property created')
    }
    setOpen(false)
    load()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this property? This cannot be undone.')) return
    const { error } = await supabase.from('properties').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Deleted'); load() }
  }

  // Map new free-text type back to legacy enum for the 'type' column
  function mapToLegacyType(pt: string): string {
    const t = pt.toLowerCase()
    if (t.includes('market') || t.includes('shop') || t.includes('shopping')) return 'market'
    if (t.includes('apartment') || t.includes('house') || t.includes('building') || t.includes('office') || t.includes('commercial') || t.includes('warehouse') || t.includes('land') || t.includes('garage') || t.includes('parking') || t.includes('storage') || t.includes('hall') || t.includes('farm') || t.includes('space')) return 'apartment'
    if (t.includes('vehicle') || t.includes('car') || t.includes('microbus') || t.includes('truck') || t.includes('motorcycle') || t.includes('equipment') || t.includes('machinery')) return 'vehicle'
    return 'apartment' // default fallback
  }

  const filtered = properties.filter(p => {
    const effectiveType = getEffectiveType(p)
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      effectiveType.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'all' || effectiveType === filterType
    return matchSearch && matchType
  })

  // Group by type for stats
  const typeCounts = properties.reduce((acc: Record<string, number>, p) => {
    const t = getEffectiveType(p)
    acc[t] = (acc[t] ?? 0) + 1
    return acc
  }, {})

  return (
    <div>
      <PageHeader
        title="Properties"
        description="Manage all income-generating property assets"
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Add Property</Button>}
      />

      {/* Summary stats — dynamic by type */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Card className="min-w-28">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{properties.length}</p>
          </CardContent>
        </Card>
        {Object.entries(typeCounts).slice(0, 6).map(([type, count]) => (
          <Card key={type} className="min-w-28 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setFilterType(filterType === type ? 'all' : type)}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground truncate max-w-24">{type}</p>
              <p className={`text-xl font-bold ${filterType === type ? 'text-blue-600' : ''}`}>{count}</p>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-xl font-bold text-green-600">{properties.filter(p => p.status === 'active').length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <SearchInput
            placeholder="Search properties..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {uniqueTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        {filterType !== 'all' && (
          <Button variant="outline" size="sm" onClick={() => setFilterType('all')}>Clear filter</Button>
        )}
      </div>

      {/* Property cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && (
          <div className="col-span-3 text-center py-8 text-muted-foreground">Loading...</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="col-span-3 text-center py-12 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>{search || filterType !== 'all' ? 'No properties match filters.' : 'No properties yet. Add your first one.'}</p>
          </div>
        )}
        {filtered.map(p => {
          const effectiveType = getEffectiveType(p)
          return (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base leading-tight">{p.name}</CardTitle>
                    <Badge variant="outline" className="text-xs mt-1 font-normal">
                      {effectiveType}
                    </Badge>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-1">
                {p.address && (
                  <p className="text-sm text-muted-foreground">{p.address}</p>
                )}
                {p.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                )}
                {p.ownership_details && (
                  <p className="text-xs text-slate-500">Owner: {p.ownership_details}</p>
                )}
                <p className="text-xs text-muted-foreground">Added {formatDate(p.created_at)}</p>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline" size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={() => openEdit(p)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />Edit
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className="h-7 text-xs text-red-500 hover:text-red-700"
                    onClick={() => handleDelete(p.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Property' : 'Add Property'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Property Name *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Central Trade Market"
              />
            </div>
            <div className="space-y-1">
              <Label>Property Type *</Label>
              <PropertyTypeSelect
                value={form.property_type}
                onChange={v => setForm(f => ({ ...f, property_type: v }))}
              />
              {form.property_type && (
                <p className="text-xs text-muted-foreground">Selected: <span className="font-medium text-foreground">{form.property_type}</span></p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="e.g. 45 Commerce Street, Dhaka"
              />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Ownership Details</Label>
              <Input
                value={form.ownership_details}
                onChange={e => setForm(f => ({ ...f, ownership_details: e.target.value }))}
                placeholder="e.g. Purchased 2020, sole owner"
              />
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
