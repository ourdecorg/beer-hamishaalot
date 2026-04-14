import { redirect } from 'next/navigation'

// The peek experience lives on the home page (/).
// This route exists for backwards compatibility and direct links.
export default function PeekRedirect() {
  redirect('/')
}
