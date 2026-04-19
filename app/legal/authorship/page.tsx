import { redirect } from 'next/navigation'

export default function AuthorshipRedirect() {
  redirect('/legal/mentions#authorship')
}
