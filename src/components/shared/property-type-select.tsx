'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Check, ChevronDown, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { PropertyType } from '@/lib/types/database'

interface PropertyTypeSelectProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function PropertyTypeSelect({ value, onChange, disabled }: PropertyTypeSelectProps) {
  const supabase = createClient()
  const [types, setTypes] = useState<PropertyType[]>([])
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customName, setCustomName] = useState('')
  const [saving, setSaving] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadTypes() }, [])

  // Close on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  async function loadTypes() {
    const { data } = await supabase
      .from('property_types')
      .select('*')
      .order('is_default', { ascending: false })
      .order('name')
    setTypes(data ?? [])
  }

  async function saveCustomType() {
    const name = customName.trim()
    if (!name) return toast.error('Enter a type name')
    if (types.find(t => t.name.toLowerCase() === name.toLowerCase())) {
      onChange(types.find(t => t.name.toLowerCase() === name.toLowerCase())!.name)
      setShowCustomInput(false)
      setOpen(false)
      return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const { data, error } = await supabase
      .from('property_types')
      .insert({ name, is_default: false, owner_id: user.id })
      .select()
      .single()
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success(`Custom type "${name}" saved`)
    setTypes(prev => [...prev, data])
    onChange(data.name)
    setShowCustomInput(false)
    setCustomName('')
    setOpen(false)
    setSaving(false)
  }

  const defaultTypes = types.filter(t => t.is_default)
  const customTypes = types.filter(t => !t.is_default)

  function filterTypes(list: PropertyType[]) {
    if (!search) return list
    return list.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
  }

  const filteredDefault = filterTypes(defaultTypes)
  const filteredCustom = filterTypes(customTypes)
  const hasResults = filteredDefault.length > 0 || filteredCustom.length > 0

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(o => !o); setSearch('') }}
        className={cn(
          'flex items-center justify-between w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          !value && 'text-muted-foreground'
        )}
      >
        <span>{value || 'Select property type'}</span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg">
          {/* Search */}
          <div className="flex items-center border-b px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
            <input
              autoFocus
              className="flex-1 text-sm outline-none bg-transparent placeholder:text-muted-foreground"
              placeholder="Search types..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {/* Default types */}
            {filteredDefault.length > 0 && (
              <>
                <div className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Default Types
                </div>
                {filteredDefault.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { onChange(t.name); setOpen(false); setSearch('') }}
                    className={cn(
                      'flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-slate-50 text-left',
                      value === t.name && 'bg-blue-50 text-blue-700'
                    )}
                  >
                    {t.name}
                    {value === t.name && <Check className="h-4 w-4" />}
                  </button>
                ))}
              </>
            )}

            {/* Custom types */}
            {filteredCustom.length > 0 && (
              <>
                <div className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-1">
                  My Custom Types
                </div>
                {filteredCustom.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { onChange(t.name); setOpen(false); setSearch('') }}
                    className={cn(
                      'flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-slate-50 text-left',
                      value === t.name && 'bg-blue-50 text-blue-700'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {t.name}
                      <Badge variant="outline" className="text-xs py-0">custom</Badge>
                    </span>
                    {value === t.name && <Check className="h-4 w-4" />}
                  </button>
                ))}
              </>
            )}

            {!hasResults && (
              <div className="px-3 py-3 text-sm text-muted-foreground text-center">No types found</div>
            )}
          </div>

          {/* Add custom type */}
          <div className="border-t p-2">
            {!showCustomInput ? (
              <button
                type="button"
                onClick={() => { setShowCustomInput(true); setCustomName(search) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md font-medium"
              >
                <Plus className="h-4 w-4" />
                Add Custom Type{search ? ` "${search}"` : ''}
              </button>
            ) : (
              <div className="space-y-2 p-1">
                <Input
                  autoFocus
                  placeholder="e.g. Fish Farm, Event Hall..."
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveCustomType() } if (e.key === 'Escape') setShowCustomInput(false) }}
                  className="h-8 text-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-xs flex-1" onClick={saveCustomType} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Type'}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowCustomInput(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
