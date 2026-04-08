import { NextRequest, NextResponse } from 'next/server'
import { isAdmin, getAuthUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

// GET: ticket detail with messages
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = supabaseAdmin()

  const [{ data: ticket }, { data: messages }] = await Promise.all([
    admin.from('refund_tickets')
      .select(`
        id, ticket_number, status, reason, months, total_amount_eur, stripe_refund_ids, created_at, updated_at,
        user:user_id (id, email, full_name, tier, stripe_customer_id),
        requester:requested_by (id, email, full_name, is_admin, is_delegate_admin)
      `)
      .eq('id', id).single(),
    admin.from('refund_ticket_messages')
      .select('id, message, action, created_at, author:author_id (id, email, full_name, is_admin, is_delegate_admin)')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (!ticket) return NextResponse.json({ error: 'Ticket non trouvé' }, { status: 404 })

  return NextResponse.json({ ticket, messages: messages ?? [] })
}

// PATCH: update ticket status (approve, reject, request_info, respond)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { action, message } = body // action: 'approve'|'reject'|'request_info'|'respond'

  if (!action || !message?.trim()) {
    return NextResponse.json({ error: 'Action et message requis' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  // Get requester info
  const { data: requesterProfile } = await admin.from('profiles')
    .select('is_admin, is_delegate_admin').eq('id', user.id).single()

  const isSuperAdmin = requesterProfile?.is_admin === true

  // Validate action permissions
  if (['approve', 'reject', 'request_info'].includes(action) && !isSuperAdmin) {
    return NextResponse.json({ error: 'Seul le super admin peut effectuer cette action' }, { status: 403 })
  }

  // Map action to status
  const statusMap: Record<string, string> = {
    approve: 'approved',
    reject: 'rejected',
    request_info: 'info_requested',
    respond: 'pending', // delegate responds → back to pending for review
  }

  const newStatus = statusMap[action]
  if (!newStatus) return NextResponse.json({ error: 'Action invalide' }, { status: 400 })

  // Update ticket
  await admin.from('refund_tickets')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id)

  // Add message
  await admin.from('refund_ticket_messages').insert({
    ticket_id: id,
    author_id: user.id,
    message: message.trim(),
    action,
  })

  // If approved by super admin → process Stripe refund
  if (action === 'approve') {
    const { data: ticket } = await admin.from('refund_tickets')
      .select('id, user_id, months, total_amount_eur, user:user_id (stripe_customer_id)')
      .eq('id', id).single()

    if (ticket) {
      const stripeKey = process.env.STRIPE_SECRET_KEY
      if (stripeKey) {
        try {
          const Stripe = (await import('stripe')).default
          const stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' })
          const refundIds: string[] = []

          // Get customer's payment intents to refund
          const customerData = ticket.user as any
          if (customerData?.stripe_customer_id) {
            const charges = await stripe.charges.list({
              customer: customerData.stripe_customer_id,
              limit: 50,
            })

            // Match invoices to charges and refund
            const months = ticket.months as any[]
            let remainingAmount = Math.round(Number(ticket.total_amount_eur) * 100) // cents

            for (const charge of charges.data) {
              if (remainingAmount <= 0) break
              if (charge.refunded) continue

              const refundAmount = Math.min(remainingAmount, charge.amount - (charge.amount_refunded ?? 0))
              if (refundAmount <= 0) continue

              const refund = await stripe.refunds.create({
                charge: charge.id,
                amount: refundAmount,
                reason: 'requested_by_customer',
              })
              refundIds.push(refund.id)
              remainingAmount -= refundAmount
            }

            // Update ticket with refund IDs and mark completed
            await admin.from('refund_tickets')
              .update({
                status: 'completed',
                stripe_refund_ids: refundIds,
                updated_at: new Date().toISOString(),
              })
              .eq('id', id)

            // Log completion message
            if (refundIds.length > 0) {
              await admin.from('refund_ticket_messages').insert({
                ticket_id: id,
                author_id: user.id,
                message: `Remboursement Stripe exécuté: ${refundIds.join(', ')} (${Number(ticket.total_amount_eur).toFixed(2)} €)`,
                action: 'approve',
              })
            }
          }
        } catch (err: any) {
          // Log error but don't fail the ticket approval
          await admin.from('refund_ticket_messages').insert({
            ticket_id: id,
            author_id: user.id,
            message: `Erreur Stripe: ${err.message}. Le remboursement devra être effectué manuellement.`,
            action: null,
          })
        }
      }
    }
  }

  return NextResponse.json({ ok: true, status: newStatus })
}
