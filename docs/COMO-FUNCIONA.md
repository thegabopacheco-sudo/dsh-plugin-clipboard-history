# Cómo funciona dsh-plugin-clipboard-history

Historial local de portapapeles en Windows: captura el texto actual, busca en el historial y lo vuelve a copiar con confirmacion.

## Arquitectura

```
DSH ──MCP stdio──► server.mjs (bundle single-file)
                    └─ lógica local del plugin
```

## Herramientas reales

- `status`: Estado
- `capture`: Capturar portapapeles
- `list`: Listar historial
- `search`: Buscar historial
- `get`: Obtener entrada
- `copy`: Copiar al portapapeles

## Seguridad

- Lectura por defecto; acciones con `confirm:true`.
- Modo `read-only` por variable de entorno.
- Listas blancas cuando aplique.
- Auditoría en `<DSH_HOME>\cache\clipboard-history\audit.jsonl`.
- Rate limit de acciones.

## Verificación

Tests end-to-end con el cliente MCP oficial (`@modelcontextprotocol/client@2.2.0`)
y artefacto empaquetado (`npm pack` → `postinstall` → servidor desplegado).
