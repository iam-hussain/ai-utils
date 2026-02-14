"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
async function connectViaUrl(url) {
    const { Client } = await Promise.resolve().then(() => __importStar(require('@modelcontextprotocol/sdk/client/index.js')));
    const { StreamableHTTPClientTransport } = await Promise.resolve().then(() => __importStar(require('@modelcontextprotocol/sdk/client/streamableHttp.js')));
    const baseUrl = new URL(url);
    const client = new Client({ name: 'ai-utils-mcp-client', version: '1.0.0' }, { capabilities: {} });
    const transport = new StreamableHTTPClientTransport(baseUrl);
    await client.connect(transport);
    try {
        const result = await client.listTools();
        const serverVersion = client.getServerVersion();
        return {
            tools: (result.tools ?? []).map((t) => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema,
            })),
            serverInfo: serverVersion
                ? { name: serverVersion.name, version: serverVersion.version }
                : undefined,
        };
    }
    finally {
        await transport.close();
    }
}
async function connectViaCommand(command, args) {
    const { Client } = await Promise.resolve().then(() => __importStar(require('@modelcontextprotocol/sdk/client/index.js')));
    const { StdioClientTransport } = await Promise.resolve().then(() => __importStar(require('@modelcontextprotocol/sdk/client/stdio.js')));
    const client = new Client({ name: 'ai-utils-mcp-client', version: '1.0.0' }, { capabilities: {} });
    const transport = new StdioClientTransport({ command, args });
    await client.connect(transport);
    try {
        const result = await client.listTools();
        const serverVersion = client.getServerVersion();
        return {
            tools: (result.tools ?? []).map((t) => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema,
            })),
            serverInfo: serverVersion
                ? { name: serverVersion.name, version: serverVersion.version }
                : undefined,
        };
    }
    finally {
        await transport.close();
    }
}
async function getConnectedClient(opts) {
    const { Client } = await Promise.resolve().then(() => __importStar(require('@modelcontextprotocol/sdk/client/index.js')));
    const client = new Client({ name: 'ai-utils-mcp-client', version: '1.0.0' }, { capabilities: {} });
    if ('url' in opts) {
        const { StreamableHTTPClientTransport } = await Promise.resolve().then(() => __importStar(require('@modelcontextprotocol/sdk/client/streamableHttp.js')));
        const transport = new StreamableHTTPClientTransport(new URL(opts.url));
        await client.connect(transport);
        return { client, transport };
    }
    const { StdioClientTransport } = await Promise.resolve().then(() => __importStar(require('@modelcontextprotocol/sdk/client/stdio.js')));
    const transport = new StdioClientTransport({ command: opts.command, args: opts.args });
    await client.connect(transport);
    return { client, transport };
}
router.post('/call-tool', async (req, res) => {
    try {
        const body = req.body;
        if (!body.toolName || typeof body.toolName !== 'string') {
            res.status(400).json({ error: 'toolName is required' });
            return;
        }
        let clientAndTransport;
        if (body.url && typeof body.url === 'string') {
            clientAndTransport = await getConnectedClient({ url: body.url });
        }
        else if (body.command && typeof body.command === 'string' && Array.isArray(body.args)) {
            const args = body.args.filter((a) => typeof a === 'string');
            clientAndTransport = await getConnectedClient({ command: body.command, args });
        }
        else {
            res.status(400).json({ error: 'Provide either url or command+args' });
            return;
        }
        try {
            const result = await clientAndTransport.client.callTool({
                name: body.toolName,
                arguments: body.toolArgs ?? {},
            });
            res.json(result);
        }
        finally {
            await clientAndTransport.transport.close();
        }
    }
    catch (err) {
        console.error('MCP call-tool error:', err);
        const message = err instanceof Error ? err.message : 'Failed to call tool';
        res.status(500).json({ error: message });
    }
});
router.post('/connect', async (req, res) => {
    try {
        const body = req.body;
        if (body.url && typeof body.url === 'string') {
            const url = body.url.trim();
            let parsed;
            try {
                parsed = new URL(url);
            }
            catch {
                res.status(400).json({ error: 'Invalid URL format' });
                return;
            }
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                res.status(400).json({ error: 'URL must use http or https' });
                return;
            }
            const result = await connectViaUrl(url);
            res.json(result);
            return;
        }
        if (body.command && typeof body.command === 'string' && Array.isArray(body.args)) {
            const command = body.command.trim();
            const args = body.args.filter((a) => typeof a === 'string');
            if (!command) {
                res.status(400).json({ error: 'Command is required' });
                return;
            }
            const result = await connectViaCommand(command, args);
            res.json(result);
            return;
        }
        res.status(400).json({
            error: 'Provide either { url: string } or { command: string, args: string[] }',
        });
    }
    catch (err) {
        console.error('MCP connect error:', err);
        const message = err instanceof Error ? err.message : 'Failed to connect to MCP server';
        res.status(500).json({ error: message });
    }
});
exports.default = router;
