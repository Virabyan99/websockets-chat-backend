import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Welcome to WebSocket Chat Backend! Connect via wss://websockets-chat-backend.gmparstone99.workers.dev/ws')
})

app.get('/ws', async (c) => {
  const upgradeHeader = c.req.header('Upgrade')
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket connection', 400)
  }

  // Access the Durable Object
  const env = c.env as any // Type this properly if you have an Env interface
  const chatRoomId = env.CHAT_ROOM.idFromName('global') // Use a single "global" room
  const chatRoom = env.CHAT_ROOM.get(chatRoomId)

  // Forward the WebSocket upgrade request to the Durable Object
  return chatRoom.fetch(c.req.raw)
})

// Durable Object class to manage WebSocket connections
export class ChatRoom {
  private clients: Set<WebSocket> = new Set()

  async fetch(request: Request) {
    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket]

    server.accept()
    this.clients.add(server)

    server.addEventListener('message', (event) => {
      console.log(`Received Message: ${event.data}`)
      this.broadcast(event.data as string)
    })

    server.addEventListener('close', () => {
      console.log('Client disconnected')
      this.clients.delete(server)
    })

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  private broadcast(message: string) {
    this.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) { // 1 = OPEN
        ws.send(message)
      }
    })
  }
}

export default app