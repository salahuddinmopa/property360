'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Bell, BellOff, CheckCheck, AlertTriangle, Clock, Info, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils/format'
import type { Notification } from '@/lib/types/database'

const priorityConfig = {
  urgent: { icon: Zap, color: 'text-red-600', bg: 'bg-red-50 border-red-100' },
  high: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100' },
  normal: { icon: Bell, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
  low: { icon: Info, color: 'text-gray-600', bg: 'bg-gray-50 border-gray-100' },
}

export default function NotificationsPage() {
  const supabase = createClient()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [generating, setGenerating] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
    setNotifications(data ?? [])
    setLoading(false)
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    toast.success('All notifications marked as read')
  }

  async function generateNotifications() {
    setGenerating(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const now = new Date()
    const threeMonths = new Date(now); threeMonths.setMonth(threeMonths.getMonth() + 3)
    const twoMonths = new Date(now); twoMonths.setMonth(twoMonths.getMonth() + 2)
    const notifs: Omit<Notification, 'id' | 'created_at'>[] = []

    const [
      { data: agreements },
      { data: payments },
      { data: vehicles },
      { data: expenses },
      { data: shops },
    ] = await Promise.all([
      supabase.from('rental_agreements').select('*, tenants(full_name)').eq('status', 'active'),
      supabase.from('rent_payments').select('*, tenants(full_name)').eq('status', 'unpaid').lt('year', now.getFullYear()).or(`year.eq.${now.getFullYear()},month.lt.${now.getMonth() + 1}`),
      supabase.from('vehicles').select('*'),
      supabase.from('expenses').select('expense_date, amount').gte('expense_date', new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]),
      supabase.from('shops').select('*').eq('status', 'vacant'),
    ])

    // Rent due notifications
    ;(payments ?? []).forEach((p: any) => {
      notifs.push({
        owner_id: user.id,
        type: 'rent_due',
        title: 'Overdue Rent Payment',
        message: `${p.tenants?.full_name ?? 'Tenant'} has an unpaid rent for ${p.month}/${p.year} — Amount due: ৳${p.due_amount?.toLocaleString()}`,
        related_id: p.id,
        related_type: 'rent_payment',
        is_read: false,
        priority: 'high',
      })
    })

    // Deposits finishing soon
    ;(agreements ?? []).filter((a: any) => a.deduction_end_date && new Date(a.deduction_end_date) <= threeMonths).forEach((a: any) => {
      notifs.push({
        owner_id: user.id,
        type: 'deposit_ending',
        title: 'Deposit Deduction Ending Soon',
        message: `${(a as any).tenants?.full_name}'s deposit deduction ends on ${a.deduction_end_date}. They will pay full rent from next month.`,
        related_id: a.id,
        related_type: 'rental_agreement',
        is_read: false,
        priority: 'normal',
      })
    })

    // Vehicle doc expiry
    ;(vehicles ?? []).forEach(v => {
      if (v.insurance_expiry && new Date(v.insurance_expiry) <= twoMonths) {
        notifs.push({ owner_id: user.id, type: 'vehicle_expiry', title: 'Vehicle Insurance Expiring', message: `${v.name} insurance expires on ${v.insurance_expiry}. Renew immediately.`, related_id: v.id, related_type: 'vehicle', is_read: false, priority: 'urgent' })
      }
      if (v.fitness_expiry && new Date(v.fitness_expiry) <= twoMonths) {
        notifs.push({ owner_id: user.id, type: 'vehicle_expiry', title: 'Vehicle Fitness Certificate Expiring', message: `${v.name} fitness expires on ${v.fitness_expiry}.`, related_id: v.id, related_type: 'vehicle', is_read: false, priority: 'high' })
      }
      if (v.tax_token_expiry && new Date(v.tax_token_expiry) <= twoMonths) {
        notifs.push({ owner_id: user.id, type: 'vehicle_expiry', title: 'Vehicle Tax Token Expiring', message: `${v.name} tax token expires on ${v.tax_token_expiry}.`, related_id: v.id, related_type: 'vehicle', is_read: false, priority: 'high' })
      }
    })

    // Vacant shops
    if ((shops ?? []).length > 0) {
      notifs.push({
        owner_id: user.id,
        type: 'vacant_shop',
        title: `${(shops ?? []).length} Vacant Shop(s)`,
        message: `Shops ${(shops ?? []).slice(0, 5).map(s => s.shop_number).join(', ')} are currently vacant.`,
        related_id: null,
        related_type: 'shop',
        is_read: false,
        priority: 'low',
      })
    }

    if (notifs.length > 0) {
      await supabase.from('notifications').insert(notifs)
      toast.success(`Generated ${notifs.length} notifications`)
      load()
    } else {
      toast.info('No new notifications to generate')
    }
    setGenerating(false)
  }

  async function deleteNotification(id: string) {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read
    if (filter === 'read') return n.is_read
    if (filter === 'urgent') return n.priority === 'urgent' || n.priority === 'high'
    return true
  })

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="System alerts and important updates"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={markAllRead} disabled={unreadCount === 0}>
              <CheckCheck className="h-4 w-4 mr-2" />Mark All Read
            </Button>
            <Button onClick={generateNotifications} disabled={generating}>
              <Bell className={`h-4 w-4 mr-2 ${generating ? 'animate-bounce' : ''}`} />
              {generating ? 'Generating...' : 'Generate Alerts'}
            </Button>
          </div>
        }
      />

      <div className="flex gap-3 mb-6">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({notifications.length})</SelectItem>
            <SelectItem value="unread">Unread ({unreadCount})</SelectItem>
            <SelectItem value="read">Read</SelectItem>
            <SelectItem value="urgent">High Priority</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {loading && <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>}
        {!loading && filtered.length === 0 && (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            <BellOff className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No notifications. Click "Generate Alerts" to check for issues.</p>
          </CardContent></Card>
        )}
        {filtered.map(n => {
          const config = priorityConfig[n.priority] ?? priorityConfig.normal
          const Icon = config.icon
          return (
            <div key={n.id} className={`p-4 rounded-lg border cursor-pointer transition-opacity ${config.bg} ${n.is_read ? 'opacity-60' : ''}`}
              onClick={() => !n.is_read && markRead(n.id)}>
              <div className="flex items-start gap-3">
                <Icon className={`h-5 w-5 mt-0.5 ${config.color}`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{n.title}</span>
                      {!n.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                      <Badge className="text-xs capitalize" variant="outline">{n.priority}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{formatDate(n.created_at)}</span>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-600" onClick={e => { e.stopPropagation(); deleteNotification(n.id) }}>×</Button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{n.message}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
