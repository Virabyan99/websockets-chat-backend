import { Hono } from 'hono'

// Define an Env interface for type safety
interface Env {
  CHAT_ROOM: DurableObjectNamespace
  CHAT_MESSAGES: KVNamespace
}

const app = new Hono<{ Bindings: Env }>()

app.get('/', (c) => {
  return c.text('Welcome to WebSocket Chat Backend! Connect via wss://websockets-chat-backend.gmparstone99.workers.dev/ws')
})

app.get('/ws', async (c) => {
  const upgradeHeader = c.req.header('Upgrade')
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket connection', 400)
  }

  const env = c.env
  const chatRoomId = env.CHAT_ROOM.idFromName('global')
  const chatRoom = env.CHAT_ROOM.get(chatRoomId)

  // Call fetch with only the Request object; env is available via constructor
  return chatRoom.fetch(c.req.raw)
})

// Durable Object class to manage WebSocket connections and message history
export class ChatRoom {
  private clients: Set<WebSocket> = new Set()
  private env: Env

  constructor(state: DurableObjectState, env: Env) {
    this.env = env // Store env from the constructor
  }

  async fetch(request: Request) {
    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket]

    server.accept()
    this.clients.add(server)

    // Send chat history to the new client with type assertion
    const history = (await this.env.CHAT_MESSAGES.get('messages', { type: 'json' }) as string[]) || []
    history.slice(-50).forEach((message: string) => {
      server.send(message)
    })

    server.addEventListener('message', async (event) => {
      console.log(`Received Message: ${event.data}`)
      const message = event.data as string

      // Save the message in KV with type assertion
      let messages = (await this.env.CHAT_MESSAGES.get('messages', { type: 'json' }) as string[]) || []
      messages.push(message)
      if (messages.length > 50) messages = messages.slice(-50) // Keep only the last 50
      await this.env.CHAT_MESSAGES.put('messages', JSON.stringify(messages))

      // Broadcast to all clients
      this.broadcast(message)
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
      if (ws.readyState === 1) { // Use 1 for OPEN state
        ws.send(message)
      }
    })
  }
}

export default app