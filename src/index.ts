import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Welcome to WebSocket Chat Backend! Connect via wss://websockets-chat-backend.gmparstone99.workers.dev/ws')
})

app.get('/ws', (c) => {
  const upgradeHeader = c.req.header('Upgrade')
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket connection', 400)
  }

  const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket]

  server.accept()

  server.addEventListener('message', (event) => {
    console.log(`Received Message: ${event.data}`)
  })

  server.addEventListener('close', () => {
    console.log('Client disconnected')
  })

  return new Response(null, {
    status: 101,
    webSocket: client,
  })
})

export default app