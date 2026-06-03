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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Pencil, Trash2, Search, UserCheck, DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, formatDate, MONTHS, YEARS } from '@/lib/utils/format'
import type { Staff, StaffSalaryPayment } from '@/lib/types/database'

type StaffWithPayment = Staff & { lastPaid?: string }

const emptyStaffForm = { name: '', phone: '', email: '', role: '', monthly_salary: 0, start_date: '', status: 'active' as const, notes: '' }
const emptySalaryForm = { staff_id: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(), amount: 0, payment_date: new Date().toISOString().split('T')[0], payment_method: 'cash' as const, notes: '' }

export default function StaffPage() {
  const supabase = createClient()
  const [staff, setStaff] = useState<Staff[]>([])
  const [salaryPayments, setSalaryPayments] = useState<(StaffSalaryPayment & { staff?: { name: string } | null })[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [staffOpen, setStaffOpen] = useState(false)
  const [salaryOpen, setSalaryOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [staffForm, setStaffForm] = useState(emptyStaffForm)
  const [salaryForm, setSalaryForm] = useState(emptySalaryForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: staffData }, { data: salaryData }] = await Promise.all([
      supabase.from('staff').select('*').order('name'),
      supabase.from('staff_salary_payments').select('*, staff(name)').order('created_at', { ascending: false }).limit(50),
    ])
    setStaff(staffData ?? [])
    setSalaryPayments(salaryData ?? [])
    setLoading(false)
  }

  function openEditStaff(s: Staff) {
    setEditingStaff(s)
    setStaffForm({ name: s.name, phone: s.phone ?? '', email: s.email ?? '', role: s.role, monthly_salary: s.monthly_salary, start_date: s.start_date ?? '', status: s.status, notes: s.notes ?? '' })
    setStaffOpen(true)
  }

  async function handleSaveStaff() {
    if (!staffForm.name || !staffForm.role) return toast.error('Name and role required')
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (editingStaff) {
      const { error } = await supabase.from('staff').update(staffForm).eq('id', editingStaff.id)
      if (error) toast.error(error.message)
      else { toast.success('Staff updated'); setStaffOpen(false); load() }
    } else {
      const { error } = await supabase.from('staff').insert({ ...staffForm, owner_id: user.id })
      if (error) toast.error(error.message)
      else { toast.success('Staff added'); setStaffOpen(false); load() }
    }
    setSaving(false)
  }

  async function handleDeleteStaff(id: string) {
    if (!confirm('Delete this staff member?')) return
    const { error } = await supabase.from('staff').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Deleted'); load() }
  }

  function openPaySalary(s?: Staff) {
    setSalaryForm({ ...emptySalaryForm, staff_id: s?.id ?? '', amount: s?.monthly_salary ?? 0 })
    setSalaryOpen(true)
  }

  async function handlePaySalary() {
    if (!salaryForm.staff_id || salaryForm.amount <= 0) return toast.error('Staff and amount required')
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('staff_salary_payments').insert({ ...salaryForm, owner_id: user.id })
    if (error) { toast.error(error.message); setSaving(false); return }

    // Also record as general expense
    const staffMember = staff.find(s => s.id === salaryForm.staff_id)
    await supabase.from('expenses').insert({
      owner_id: user.id,
      asset_type: 'general',
      category: 'Staff Salary',
      amount: salaryForm.amount,
      expense_date: salaryForm.payment_date,
      paid_to: staffMember?.name ?? 'Staff',
      payment_method: salaryForm.payment_method,
      notes: `Salary ${MONTHS[salaryForm.month - 1]} ${salaryForm.year} — ${staffMember?.role ?? ''}`,
    })

    toast.success('Salary paid and recorded as expense')
    setSalaryOpen(false)
    load()
    setSaving(false)
  }

  const filtered = staff.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.role.toLowerCase().includes(search.toLowerCase())
  )

  const totalSalary = staff.filter(s => s.status === 'active').reduce((sum, s) => sum + s.monthly_salary, 0)

  return (
    <div>
      <PageHeader
        title="Staff & Salary"
        description="Manage staff and salary payments"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openPaySalary()}>
              <DollarSign className="h-4 w-4 mr-2" />Pay Salary
            </Button>
            <Button onClick={() => { setEditingStaff(null); setStaffForm(emptyStaffForm); setStaffOpen(true) }}>
              <Plus className="h-4 w-4 mr-2" />Add Staff
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Staff</p><p className="text-2xl font-bold">{staff.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Active</p><p className="text-2xl font-bold text-green-600">{staff.filter(s => s.status === 'active').length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Monthly Salary Bill</p><p className="text-2xl font-bold text-red-600">{formatCurrency(totalSalary)}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="staff">
        <TabsList className="mb-4">
          <TabsTrigger value="staff">Staff List</TabsTrigger>
          <TabsTrigger value="payments">Salary Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="staff">
          <Card>
            <CardHeader>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search staff..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Monthly Salary</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-sm">{s.role}</TableCell>
                      <TableCell className="text-sm">{s.phone ?? '—'}</TableCell>
                      <TableCell className="font-medium text-red-700">{formatCurrency(s.monthly_salary)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(s.start_date)}</TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openPaySalary(s)} className="h-7 px-2 text-xs text-green-700">Pay</Button>
                          <Button variant="ghost" size="sm" onClick={() => openEditStaff(s)} className="h-7 w-7 p-0"><Pencil className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteStaff(s.id)} className="h-7 w-7 p-0 text-red-500"><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead>Month/Year</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead>Method</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaryPayments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{(p as any).staff?.name ?? '—'}</TableCell>
                      <TableCell className="text-sm">{MONTHS[p.month - 1]} {p.year}</TableCell>
                      <TableCell className="font-medium text-green-700">{formatCurrency(p.amount)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(p.payment_date)}</TableCell>
                      <TableCell className="text-xs capitalize">{p.payment_method?.replace('_', ' ') ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Staff Dialog */}
      <Dialog open={staffOpen} onOpenChange={setStaffOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingStaff ? 'Edit Staff' : 'Add Staff'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={staffForm.name} onChange={e => setStaffForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Role *</Label>
              <Input value={staffForm.role} onChange={e => setStaffForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. Market Manager" />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={staffForm.phone} onChange={e => setStaffForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={staffForm.email} onChange={e => setStaffForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Monthly Salary (৳)</Label>
              <Input type="number" value={staffForm.monthly_salary} onChange={e => setStaffForm(f => ({ ...f, monthly_salary: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-1">
              <Label>Start Date</Label>
              <Input type="date" value={staffForm.start_date} onChange={e => setStaffForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={staffForm.status} onValueChange={v => setStaffForm(f => ({ ...f, status: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStaffOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveStaff} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Salary Dialog */}
      <Dialog open={salaryOpen} onOpenChange={setSalaryOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pay Salary</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Staff Member *</Label>
              <Select value={salaryForm.staff_id} onValueChange={v => {
                const s = staff.find(s => s.id === v)
                setSalaryForm(f => ({ ...f, staff_id: v, amount: s?.monthly_salary ?? 0 }))
              }}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>{staff.filter(s => s.status === 'active').map(s => <SelectItem key={s.id} value={s.id}>{s.name} — {s.role}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Month</Label>
                <Select value={salaryForm.month.toString()} onValueChange={v => setSalaryForm(f => ({ ...f, month: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={(i+1).toString()}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Year</Label>
                <Input type="number" value={salaryForm.year} onChange={e => setSalaryForm(f => ({ ...f, year: parseInt(e.target.value) || 2025 }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Amount (৳) *</Label>
                <Input type="number" value={salaryForm.amount} onChange={e => setSalaryForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1">
                <Label>Payment Date</Label>
                <Input type="date" value={salaryForm.payment_date} onChange={e => setSalaryForm(f => ({ ...f, payment_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Payment Method</Label>
              <Select value={salaryForm.payment_method} onValueChange={v => setSalaryForm(f => ({ ...f, payment_method: v as any }))}>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setSalaryOpen(false)}>Cancel</Button>
            <Button onClick={handlePaySalary} disabled={saving}>{saving ? 'Processing...' : 'Pay Salary'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
