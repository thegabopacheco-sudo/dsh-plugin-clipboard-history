# dsh-plugin-clipboard-history — Clipboard History

Historial local de portapapeles en Windows: captura el texto actual, busca en el historial y lo vuelve a copiar con confirmacion.

## Herramientas

| Tool | Qué hace |
|---|---|
| `status` | Estado |
| `capture` | Capturar portapapeles |
| `list` | Listar historial |
| `search` | Buscar historial |
| `get` | Obtener entrada |
| `copy` | Copiar al portapapeles |

## Instalación

Desde **DSH → Settings → Plugins** instala `github:thegabopacheco-sudo/dsh-plugin-clipboard-history` y permite el script de instalación.

```
dsh plugin --profile <perfil> add github:thegabopacheco-sudo/dsh-plugin-clipboard-history
```

## Seguridad

- Lectura por defecto; escritura solo con `confirm:true` y pedido explícito.
- `DSH_CLIPBOARD_HISTORY_MODE=read-only` desactiva acciones.
- Listas blancas y auditoría en `<DSH_HOME>\cache\clipboard-history\audit.jsonl`.

## Licencia

MIT © thegabopacheco-sudo
