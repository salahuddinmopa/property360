export const dynamic = 'force-dynamic'

import { Sidebar } from '@/components/layout/sidebar'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Toaster } from '@/components/ui/sonner'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id')
    .eq('is_read', false)

  const unreadCount = notifications?.length ?? 0

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar unreadCount={unreadCount} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  )
}
