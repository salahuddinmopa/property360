'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Building2, Store, ShoppingBag, Users, FileText,
  CreditCard, PiggyBank, Home, Car, Receipt, UserCheck, BarChart3,
  TrendingUp, Lightbulb, Bell, LogOut, ChevronLeft, ChevronRight,
  DollarSign, Menu
} from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { type: 'section', label: 'Assets' },
  { href: '/properties', label: 'Properties', icon: Building2 },
  { href: '/markets', label: 'Markets', icon: Store },
  { href: '/shops', label: 'Shops', icon: ShoppingBag },
  { href: '/apartments', label: 'Apartments', icon: Home },
  { href: '/vehicles', label: 'Vehicles', icon: Car },
  { type: 'section', label: 'Tenants & Agreements' },
  { href: '/tenants', label: 'Tenants', icon: Users },
  { href: '/agreements', label: 'Agreements', icon: FileText },
  { type: 'section', label: 'Finance' },
  { href: '/rent', label: 'Rent Collection', icon: CreditCard },
  { href: '/deposits', label: 'Deposits', icon: PiggyBank },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
  { type: 'section', label: 'HR' },
  { href: '/staff', label: 'Staff & Salary', icon: UserCheck },
  { type: 'section', label: 'Analytics' },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/analytics', label: 'Analytics', icon: TrendingUp },
  { href: '/insights', label: 'Insights', icon: Lightbulb },
  { href: '/notifications', label: 'Notifications', icon: Bell, badge: 'new' },
]

export function Sidebar({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className={cn(
      'flex flex-col bg-slate-900 text-slate-100 transition-all duration-300 h-screen sticky top-0',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-400" />
            <span className="font-bold text-lg">Property360</span>
          </div>
        )}
        {collapsed && <Building2 className="h-6 w-6 text-blue-400 mx-auto" />}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-400 hover:text-white hover:bg-slate-700 h-8 w-8 p-0 ml-auto"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 py-2">
        <nav className="px-2 space-y-0.5">
          {navItems.map((item, i) => {
            if (item.type === 'section') {
              if (collapsed) return <div key={i} className="h-px bg-slate-700 my-2" />
              return (
                <div key={i} className="px-2 py-1 mt-3 mb-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {item.label}
                  </span>
                </div>
              )
            }
            const Icon = item.icon!
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href!}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700',
                  collapsed && 'justify-center px-2'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <span className="flex-1">{item.label}</span>
                )}
                {!collapsed && item.href === '/notifications' && unreadCount > 0 && (
                  <Badge className="bg-red-500 text-white text-xs px-1.5 py-0.5 h-5">
                    {unreadCount}
                  </Badge>
                )}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="p-2 border-t border-slate-700">
        <button
          onClick={handleSignOut}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-400 hover:text-white hover:bg-slate-700 w-full transition-colors',
            collapsed && 'justify-center px-2'
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  )
}
