import { Router } from 'express'

const router = Router()

interface MCPTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

type ConnectResult = { tools: MCPTool[]; serverInfo?: { name: string; version?: string } }

async function connectViaUrl(url: string): Promise<ConnectResult> {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
  const { StreamableHTTPClientTransport } = await import(
    '@modelcontextprotocol/sdk/client/streamableHttp.js'
  )

  const baseUrl = new URL(url)
  const client = new Client(
    { name: 'ai-utils-mcp-client', version: '1.0.0' },
    { capabilities: {} }
  )

  const transport = new StreamableHTTPClientTransport(baseUrl)
  await client.connect(transport)

  try {
    const result = await client.listTools()
    const serverVersion = client.getServerVersion()
    return {
      tools: (result.tools ?? []).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
      serverInfo: serverVersion
        ? { name: serverVersion.name, version: serverVersion.version }
        : undefined,
    }
  } finally {
    await transport.close()
  }
}

async function connectViaCommand(command: string, args: string[]): Promise<ConnectResult> {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js')

  const client = new Client(
    { name: 'ai-utils-mcp-client', version: '1.0.0' },
    { capabilities: {} }
  )

  const transport = new StdioClientTransport({ command, args })
  await client.connect(transport)

  try {
    const result = await client.listTools()
    const serverVersion = client.getServerVersion()
    return {
      tools: (result.tools ?? []).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
      serverInfo: serverVersion
        ? { name: serverVersion.name, version: serverVersion.version }
        : undefined,
    }
  } finally {
    await transport.close()
  }
}

async function getConnectedClient(
  opts: { url: string } | { command: string; args: string[] }
): Promise<{ client: { callTool: (params: { name: string; arguments?: Record<string, unknown> }) => Promise<unknown> }; transport: { close: () => Promise<void> } }> {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
  const client = new Client(
    { name: 'ai-utils-mcp-client', version: '1.0.0' },
    { capabilities: {} }
  )

  if ('url' in opts) {
    const { StreamableHTTPClientTransport } = await import(
      '@modelcontextprotocol/sdk/client/streamableHttp.js'
    )
    const transport = new StreamableHTTPClientTransport(new URL(opts.url))
    await client.connect(transport)
    return { client, transport }
  }

  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js')
  const transport = new StdioClientTransport({ command: opts.command, args: opts.args })
  await client.connect(transport)
  return { client, transport }
}

router.post('/call-tool', async (req, res) => {
  try {
    const body = req.body as {
      url?: string
      command?: string
      args?: string[]
      toolName: string
      toolArgs?: Record<string, unknown>
    }

    if (!body.toolName || typeof body.toolName !== 'string') {
      res.status(400).json({ error: 'toolName is required' })
      return
    }

    let clientAndTransport: Awaited<ReturnType<typeof getConnectedClient>>
    if (body.url && typeof body.url === 'string') {
      clientAndTransport = await getConnectedClient({ url: body.url })
    } else if (body.command && typeof body.command === 'string' && Array.isArray(body.args)) {
      const args = body.args.filter((a): a is string => typeof a === 'string')
      clientAndTransport = await getConnectedClient({ command: body.command, args })
    } else {
      res.status(400).json({ error: 'Provide either url or command+args' })
      return
    }

    try {
      const result = await clientAndTransport.client.callTool({
        name: body.toolName,
        arguments: body.toolArgs ?? {},
      })
      res.json(result)
    } finally {
      await clientAndTransport.transport.close()
    }
  } catch (err) {
    console.error('MCP call-tool error:', err)
    const message = err instanceof Error ? err.message : 'Failed to call tool'
    res.status(500).json({ error: message })
  }
})

router.post('/connect', async (req, res) => {
  try {
    const body = req.body as { url?: string; command?: string; args?: string[] }

    if (body.url && typeof body.url === 'string') {
      const url = body.url.trim()
      let parsed: URL
      try {
        parsed = new URL(url)
      } catch {
        res.status(400).json({ error: 'Invalid URL format' })
        return
      }
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        res.status(400).json({ error: 'URL must use http or https' })
        return
      }
      const result = await connectViaUrl(url)
      res.json(result)
      return
    }

    if (body.command && typeof body.command === 'string' && Array.isArray(body.args)) {
      const command = body.command.trim()
      const args = body.args.filter((a): a is string => typeof a === 'string')
      if (!command) {
        res.status(400).json({ error: 'Command is required' })
        return
      }
      const result = await connectViaCommand(command, args)
      res.json(result)
      return
    }

    res.status(400).json({
      error: 'Provide either { url: string } or { command: string, args: string[] }',
    })
  } catch (err) {
    console.error('MCP connect error:', err)
    const message = err instanceof Error ? err.message : 'Failed to connect to MCP server'
    res.status(500).json({ error: message })
  }
})

export default router
