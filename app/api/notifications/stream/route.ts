import { getInbox } from '@/lib/notifications'
import { getRoleForUser, getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }
  const userId = session.user.id
  const role = await getRoleForUser(userId)
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false
      const push = async () => {
        if (closed) return
        try {
          const inbox = await getInbox(userId, role)
          if (closed) return
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(inbox)}\n\n`))
        } catch {
          if (closed) return
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ items: [], stamp: '', unreadHint: 0 })}\n\n`))
        }
      }

      await push()
      const timer = setInterval(push, 12000)
      request.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(timer)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
