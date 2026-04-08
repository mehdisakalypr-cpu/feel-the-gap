import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/supabase-server'
import AdminSidebar from './AdminSidebar'

export const metadata: Metadata = { title: 'Admin — Feel The Gap' }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authorized = await isAdmin()
  if (!authorized) redirect('/map')

  return (
    <div className="min-h-screen flex bg-[#07090F]">
      <AdminSidebar />
      <main className="flex-1 overflow-auto min-w-0">{children}</main>
    </div>
  )
}
