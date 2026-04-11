import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import DemoClient from './demo-client'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function DemoTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const { data: demo } = await supabase
    .from('entrepreneur_demos')
    .select('id, token, full_name, company_name, country_iso, city, sector, product_focus, business_plan, opportunities, investors, market_data, hero_message, status, views_count, first_viewed_at, created_at')
    .eq('token', token)
    .single()

  if (!demo || demo.status === 'expired') return notFound()

  // Track view
  if (demo.status === 'generated' || demo.status === 'sent') {
    await supabase
      .from('entrepreneur_demos')
      .update({
        status: 'viewed',
        views_count: (demo.views_count || 0) + 1,
        first_viewed_at: demo.first_viewed_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', demo.id)
  } else {
    await supabase
      .from('entrepreneur_demos')
      .update({ views_count: (demo.views_count || 0) + 1 })
      .eq('id', demo.id)
  }

  return <DemoClient demo={demo} />
}
