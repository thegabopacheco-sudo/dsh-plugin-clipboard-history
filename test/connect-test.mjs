// Test end-to-end de clipboard-history (Windows).
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const packageDir = path.resolve(import.meta.dirname, '..');
const tmpDir = path.join(packageDir, 'test', 'tmp');
rmSync(tmpDir, { recursive: true, force: true });
const home = path.join(tmpDir, 'dsh-home');
mkdirSync(home, { recursive: true });
const ps = (command) => spawnSync('powershell', ['-NoProfile', '-Command', command], { encoding: 'utf8' });
ps("Set-Clipboard -Value 'hola WENDIGO 123'");

function makeClient(extraEnv = {}) {
  const entry = process.env.CLIPBOARD_SERVER ? path.resolve(process.env.CLIPBOARD_SERVER) : path.join(packageDir, 'server.mjs');
  const transport = new StdioClientTransport({ command: process.execPath, args: [entry], env: { SystemRoot: process.env.SystemRoot || 'C:\\Windows', PATH: process.env.PATH, USERPROFILE: process.env.USERPROFILE, HOME: process.env.HOME || process.env.USERPROFILE, TEMP: process.env.TEMP, TMP: process.env.TMP, DSH_HOME: home, ...extraEnv }, stderr: 'pipe' });
  transport.stderr?.on('data', (c) => process.stderr.write(`[server] ${c}`));
  const client = new Client({ name: 'clipboard-test', version: '1.0.0' }, { capabilities: {}, versionNegotiation: { mode: 'auto' } });
  return client.connect(transport).then(() => ({ client, transport }));
}
const textOf = (r) => (r.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');

const { client, transport } = await makeClient();
console.log('tools:', (await client.listTools()).tools.map((t) => t.name).join(', '));
console.log('--- status ---'); console.log(textOf(await client.callTool({ name: 'status', arguments: {} })));
const captured = textOf(await client.callTool({ name: 'capture', arguments: { tags: ['prueba'] } }));
console.log('--- capture ---'); console.log(captured);
console.log('capturó texto:', captured.includes('hola WENDIGO 123'));
const id = (captured.match(/Capturado: ([a-z0-9]+)/) || [])[1];
const list = textOf(await client.callTool({ name: 'list', arguments: {} }));
console.log('--- list ---'); console.log(list);
console.log('lista entrada:', list.includes(id));
const search = textOf(await client.callTool({ name: 'search', arguments: { query: 'wendigo' } }));
console.log('search ok:', search.includes(id));
const got = textOf(await client.callTool({ name: 'get', arguments: { id } }));
console.log('get texto:', got.includes('hola WENDIGO 123'));
const noConfirm = await client.callTool({ name: 'copy', arguments: { id } });
console.log('copy sin confirm isError:', noConfirm.isError === true);
ps("Set-Clipboard -Value 'otro valor'");
const copied = await client.callTool({ name: 'copy', arguments: { id, confirm: true } });
const clipboard = ps('Get-Clipboard -Raw').stdout.trim();
console.log('copy confirmado:', textOf(copied).includes('Copiado'), '| portapapeles restaurado:', clipboard === 'hola WENDIGO 123');
await client.close(); try { await transport.close?.(); } catch {}
const { client: roClient, transport: roTransport } = await makeClient({ DSH_CLIPBOARD_MODE: 'read-only' });
const roCapture = await roClient.callTool({ name: 'capture', arguments: {} });
console.log('read-only capture isError:', roCapture.isError === true);
await roClient.close(); try { await roTransport.close?.(); } catch {}
ps("Set-Clipboard -Value ''");
console.log('OK');
