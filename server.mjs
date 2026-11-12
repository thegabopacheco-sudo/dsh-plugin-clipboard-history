#!/usr/bin/env node
// dsh-plugin-clipboard-history — historial local de portapapeles (Windows).
// Tools: status, capture, list, search, get, copy.

import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';

const VERSION = '0.1.0';
const DSH_HOME = (() => {
  const v = process.env.DSH_HOME && process.env.DSH_HOME.trim();
  return v || path.join(process.env.USERPROFILE || process.env.HOME || os.homedir(), '.dsh');
})();
const HISTORY_FILE = path.join(DSH_HOME, 'clipboard-history', 'history.jsonl');
const CACHE_DIR = path.join(DSH_HOME, 'cache', 'clipboard-history');
const READ_ONLY = String(process.env.DSH_CLIPBOARD_MODE || '').toLowerCase() === 'read-only';
const log = (m) => process.stderr.write(`[clipboard] ${m}\n`);

function ps(command, timeoutMs = 15000) {
  const result = spawnSync('powershell', ['-NoProfile', '-STA', '-Command', command], { encoding: 'utf8', timeout: timeoutMs, windowsHide: true });
  if (result.status !== 0) throw new Error(`PowerShell falló: ${(result.stderr || '').trim().slice(0, 200)}`);
  return (result.stdout || '').trim();
}
function readClipboard() {
  if (process.platform !== 'win32') throw new Error('clipboard-history solo soporta Windows');
  const text = ps('Get-Clipboard -Raw');
  if (text.startsWith('PowerShell')) throw new Error('no se pudo leer el portapapeles');
  return text;
}
function writeClipboard(text) {
  const encoded = Buffer.from(String(text), 'utf8').toString('base64');
  ps(`$t=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')); Set-Clipboard -Value $t`);
}
function loadHistory() {
  if (!existsSync(HISTORY_FILE)) return [];
  try { return readFileSync(HISTORY_FILE, 'utf8').split('\n').filter(Boolean).map((line) => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean); } catch { return []; }
}
function textResult(text) { return { content: [{ type: 'text', text }] }; }
function preview(text, size = 80) { const clean = String(text || '').replace(/\s+/g, ' ').trim(); return clean.length > size ? `${clean.slice(0, size)}…` : clean; }

function buildInstructions() {
  return [
    'Clipboard History: historial local del portapapeles de Windows.',
    '',
    `Historial: ${HISTORY_FILE}`,
    '',
    'Herramientas: status, capture, list, search, get, copy.',
    '',
    'Reglas:',
    '- capture lee el portapapeles y lo agrega al historial local (solo cuando se pide).',
    '- copy escribe el portapapeles y requiere confirm:true.',
    '- Nunca inventes contenido; no leas contraseñas ni datos sensibles sin pedido explícito.',
    '- Respeta el modo read-only.',
  ].join('\n');
}

function buildServer() {
  const server = new McpServer({ name: 'dsh-plugin-clipboard-history', version: VERSION }, { capabilities: { tools: {} }, instructions: buildInstructions() });
  server.registerTool('status', { title: 'Estado', description: 'Entradas de historial y modo.', inputSchema: z.object({}) }, async () => textResult([`Entradas: ${loadHistory().length}`, `Historial: ${HISTORY_FILE}`, `Modo: ${READ_ONLY ? 'read-only' : 'normal'}`].join('\n')));
  server.registerTool('capture', { title: 'Capturar portapapeles', description: 'Agrega el texto actual al historial.', inputSchema: z.object({ tags: z.array(z.string()).max(10).optional() }) }, async (args) => {
    if (READ_ONLY) throw new Error('modo read-only: capture deshabilitado');
    const text = readClipboard();
    if (!text || !text.trim()) return textResult('El portapapeles está vacío; no se agregó nada.');
    const entry = { id: randomUUID().slice(0, 8), ts: new Date().toISOString(), text, tags: (args.tags || []).map(String) };
    mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
    appendFileSync(HISTORY_FILE, JSON.stringify(entry) + '\n', 'utf8');
    return textResult(`Capturado: ${entry.id} · ${preview(text)}\nHistorial: ${loadHistory().length} entradas`);
  });
  server.registerTool('list', { title: 'Listar historial', description: 'Últimas entradas.', inputSchema: z.object({ limit: z.number().int().min(1).max(100).optional() }) }, async (args) => {
    const entries = loadHistory().slice(-(args.limit ?? 20)).reverse();
    if (entries.length === 0) return textResult('Historial vacío. Usa capture.');
    return textResult(entries.map((entry) => `- ${entry.ts} · ${entry.id} · ${preview(entry.text, 100)}`).join('\n'));
  });
  server.registerTool('search', { title: 'Buscar historial', description: 'Busca por texto o tags.', inputSchema: z.object({ query: z.string().min(1).max(120), limit: z.number().int().min(1).max(50).optional() }) }, async (args) => {
    const query = args.query.toLowerCase();
    const entries = loadHistory().filter((entry) => `${entry.text} ${(entry.tags || []).join(' ')}`.toLowerCase().includes(query)).slice(-(args.limit ?? 20)).reverse();
    if (entries.length === 0) return textResult(`Sin resultados para "${args.query}".`);
    return textResult(entries.map((entry) => `- ${entry.ts} · ${entry.id} · ${preview(entry.text, 120)}`).join('\n'));
  });
  server.registerTool('get', { title: 'Obtener entrada', description: 'Texto completo de una entrada por id.', inputSchema: z.object({ id: z.string().min(1) }) }, async (args) => {
    const entry = loadHistory().find((item) => item.id === args.id || item.id.startsWith(args.id));
    if (!entry) throw new Error(`entrada no encontrada: ${args.id}`);
    return textResult(entry.text);
  });
  server.registerTool('copy', { title: 'Copiar al portapapeles', description: 'Vuelve a copiar una entrada. Requiere confirm:true.', inputSchema: z.object({ id: z.string().min(1), confirm: z.boolean().optional() }) }, async (args) => {
    if (READ_ONLY) throw new Error('modo read-only: copy deshabilitado');
    if (args.confirm !== true) throw new Error('copy requiere confirm:true y pedido explícito');
    const entry = loadHistory().find((item) => item.id === args.id || item.id.startsWith(args.id));
    if (!entry) throw new Error(`entrada no encontrada: ${args.id}`);
    writeClipboard(entry.text);
    return textResult(`Copiado al portapapeles: ${preview(entry.text)}`);
  });
  return server;
}

try { mkdirSync(CACHE_DIR, { recursive: true }); } catch { /* ignora */ }
log(`modo: ${READ_ONLY ? 'read-only' : 'normal'}`);
serveStdio(buildServer, { onerror: (e) => log(`serveStdio: ${e.message}`) });
process.on('uncaughtException', (e) => log(`excepción: ${e.message}`));
process.on('unhandledRejection', (e) => log(`rechazo: ${e && e.message ? e.message : String(e)}`));
