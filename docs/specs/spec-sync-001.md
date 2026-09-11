---
spec_id: sync-001
title: arggon sync — sincronizar items con PRs abiertos rellenando branch vacío
status: proposed
created: 2026-09-10
depends_on:
  - branch field (tasks/convention.md y update.js ya lo implementan)

---

# Spec: arggon sync

## 1. Propósito

El desarrollador necesita mantener alineado el campo `branch` de los items con los PRs abiertos del repo. El comando `arggon sync` permite:
- **Verificar** (--check): ver qué items tienen branch que coincide con un PR, cuáles no tienen branch pero tienen PR, y cuáles no tienen PR.
- **Rellenar** (--write): rellenar SOLO los `branch` vacíos de items que tienen un PR coincidente. Nunca sobreescribe branch existente.

Principios enunciaos en el issue:
- Never overwrite human data (no toca branch existente)
- Never auto-done on merge (merge ≠ aceptación completa)

## 2. Synopsis

```bash
arggon sync [--check|--write] [--json] [--repo <owner/repo>]
```

- Por defecto: `--check` (modo solo-read, CI-safe, exit code distinto de 0 cuando hay sync pending)
- `--write`: modifica los archivos de tasks/ para rellenar branch vacío
- `--json`: output JSON en lugar de texto legible
- `--repo`: repo GitHub a consultar (por defecto: repo remoto configurado en local, o error si no hay)

## 3. Estrategia de matching

**Clave de matching:** `headRefName` del PR (la rama desde la que se hace el PR).

Para cada item (task o bug) con `branch` vacío/null:
1. Obtener lista de PRs abiertos del repo (estado != closed/merged)
2. Para cada PR, tomar `headRefName`
3. Si algún PR tiene `headRefName` que coincide con un candidato de branch para este item (ver sección 3.1), y no hay ambigüedad, ese PR es el match.
4. **Si hay >1 PR con mismo headRefName para el mismo item:** ambigüedad, reportar, NO rellenar.
5. Si no hay PR coincidente: reportar como sin branch y sin PR.

### 3.1 ¿Cómo se elige el candidato de branch para un item sin branch?

El item sin branch no tiene referencia. Se deben considerar todos los headRefName de los PRs abiertos. Para cada item, se busca si existe algún PR cuyo headRefName sea "razonable" para ese item (p.ej. contiene el id del item o sigue naming convention). Pero el issue no especifica cómo elegir — solo dice "match by head branch". Por tanto, el matching es: para cada item sin branch, examinar todos los headRefNames y ver si alguno coincide con... ¿qué?

**Acuerdo explícito necesario (esto es parte del spec que hay que resolver):**
La forma más simple y útil: el usuario ya debe haber configurado el branch del item en tasks/ (rellenado manualmente una vez). Si está vacío, no hay forma de saber a qué PR corresponde sin heurística. Por tanto, el comportamiento correcto es:
- Si el branch del item está vacío y hay un PR coincidente (headRefName == branch del item vacío → no puede coincidir porque branch es vacío).
- Alternativa: scopes the PR matching by **item id**: si el headRefName contiene el id del item (p.ej. "feat/123-foo" para item 123), ese es el match.

**Decisión para este spec:** el matching se hace por id del item contenido en el headRefName. El pattern esperado es `<type>/<id>[-<slug>]` o similar. Ver la convention de nombres de branch en docs/convention.md. Si no hay headRefName que contenga el id del item, no hay match.

Este es un detalle de diseño que en un flujo SDD real se resuelve antes de codear (revisión del spec). Para este spec, asumimos que existe una función `matchesBranch(item, headRefName)` que implementa esa lógica — su especificación interna queda fuera del alcance de este spec de alto nivel (se puede derivar en un spike o spec separado si es necesario).

## 4. Casos de uso (Gherkin)

### 4.1 Check: repo sync, todo coincide

```gherkin
Feature: arggon sync --check

  Scenario: Repo totalmente sincronizado
    Given existen 3 items en tasks/ con branch: feat/a-1, feat/a-2, feat/b-1
    And existen 3 PRs abiertos en el repo con headRefName iguales a los branches de los items
    And no hay items sin branch
    When se ejecuta arggon sync --check --json
    Then el JSON de salida es:
      {
        "command": "sync",
        "mode": "check",
        "matched": ["a-1", "a-2", "b-1"],
        "unmatched": [],
        "ambiguous": [],
        "errors": [],
        "exit_code": 0
      }
    And el stdout legible indica "3 items sync'd. 0 pending."
    And el exit code es 0
```

### 4.2 Check: items sin branch (PR existe)

```gherkin
  Scenario: Items con branch vacío pero con PR coincidente
    Given existen 2 items: item-a con branch=feat/a-1, item-b con branch=null
    And existe un PR abierto con headRefName="feat/b-1" que contiene id "b-1"
    When se ejecuta arggon sync --check --json
    Then el JSON de salida es:
      {
        "command": "sync",
        "mode": "check",
        "matched": ["a-1"],
        "unmatched": [],
        "ambiguous": [],
        "pending": ["b-1"],
        "errors": [],
        "exit_code": 1
      }
    And el stdout legible indica:
      "1 item sync'd, 1 pending (needs --write to fill branch from PR)"
    Y el exit code es 1
```

### 4.3 Write: rellena branch vacío

```gherkin
  Scenario: Write rellena branch de item pendiente
    Given existe un item "b-1" con branch=null
    Y existe un PR abierto con headRefName="feat/b-1" que contiene id "b-1"
    When se ejecuta arggon sync --write
    Then el archivo de item "b-1" en tasks/ tiene branch="feat/b-1"
    And el stdout legible indica "1 branch filled: b-1 -> feat/b-1"
    And el exit code es 0

  Scenario: Write no toca branch existente
    Given existe un item "a-1" con branch="feat/a-1"
    Y existe un PR abierto con headRefName="feat/a-1"
    When se ejecuta arggon sync --write
    Then el archivo de item "a-1" NO es modificado (branch permanece "feat/a-1")
    And el stdout NO menciona a-1 ni como filled
    Y el exit code es 0
```

### 4.4 Ambigüedad

```gherkin
  Scenario: Ambigüedad — múltiples PRs con mismo headRefName para mismo item
    Given existe un item "c-1" con branch=null
    Y existen 2 PRs abiertos con headRefName="feat/c-1" (PR #42 y PR #43)
    When se ejecuta arggon sync --check --json
    Then el JSON es:
      {
        "command": "sync",
        "mode": "check",
        "matched": [],
        "unmatched": [],
        "ambiguous": [{"id": "c-1", "prs": [42, 43]}],
        "pending": [],
        "errors": [],
        "exit_code": 1
      }
    And en modo write, NO se escribe branch para c-1 (ambigüedad → no escribir)
```

### 4.5 Error: GitHub no disponible

```gherkin
  Scenario: GitHub no disponible
    Given no hay gh instalado o no hay credenciales para el repo
    When se ejecuta arggon sync --check
    Then el stdout o stderr contiene "GitHub not available" (o equivalente)
    And el exit code es distinto de 0
    And no se modifican archivos en tasks/
    Y el JSON (si --json) tiene "errors": ["GitHub not available"]
```

## 5. Criterios de aceptación (checklist)

- [ ] `--check` reporta correctamente: matched (items con branch que coincide con PR), pending (items sin branch pero con PR candidato), no PR (items sin PR), ambiguous (múltiples PRs para mismo match).
- [ ] `--check` exit code es 0 cuando no hay pending ni ambiguous; es 1 cuando hay pending o ambiguous (CI gate usable).
- [ ] `--write` rellena SOLO los branch vacíos de items que tienen un PR único coincidente.
- [ ] `--write` NO modifica items con branch ya seteado (incluso si hay PR coincidente).
- [ ] `--write` NO rellena en caso de ambigüedad.
- [ ] `--json` output es JSON válido según estructura definida arriba.
- [ ] GitHub no disponible → error manejado, no crash, archivos intactos.
- [ ] El comando detecta automáticamente el repo GitHub del local (por defecto: origin remote), o usa --repo explícito.

## 6. Estructura de JSON output

```typescript
interface SyncResult {
  command: "sync";
  mode: "check" | "write";
  matched: string[];        // IDs de items con branch que coincide con PR
  unmatched: string[];      // IDs de items sin branch y sin PR coincidente
  pending: string[];        // IDs de items sin branch pero con PR candidato (solo en check)
  ambiguous: Array<{        // IDs con más de un PR candidato
    id: string;
    prs: number[];
  }>;
  filled: Record<string, string> | null; // {id: branch} solo en write
  errors: string[];
  exit_code: 0 | 1;
}
```

## 7. Especificación de errores

| Condición | Mensaje (stderr o JSON errors) | Exit code |
|-----------|-------------------------------|-----------|
| No tasks/ directory | "No tasks/ directory found" | 1 |
| No git repo (no .git) | "Not a git repository" | 1 |
| No GitHub remote configurado | "No GitHub remote configured. Pass --repo or set origin" | 1 |
| gh no disponible (no instalado) | "gh CLI not found. Install GitHub CLI" | 1 |
| gh no autenticado | "GitHub not authenticated. Run 'gh auth login'" | 1 |
| GitHub API error (rate limit, etc.) | "GitHub API error: [details]" | 1 |
| Item con formato inválido | "Invalid item format: [id]" (y se salta) | 0 (si hay otros items válidos) o 1 |
| Ambigüedad en write | "Ambiguous match for [id]: [PRs]. Not writing." (y no se escribe) | 1 |

## 8. Comportamiento por defecto del repo

- Si no se pasa `--repo`, el comando usa el remote `origin` del repo local.
- Si el remote origin no es de GitHub (p.ej. GitLab, local), hay que detectarlo y decir "no GitHub repo" o usar otro remote.
- El comando debe funcionar en cualquier subdirectory del repo (busca .git hacia arriba).

## 9. Dependencias implícitas

- `gh` CLI instalado y autenticado
- Repo con remoto GitHub
- `branch` field implementado en tasks/ (ya existe en v0)
- `items.js` / `loadItems` para leer items de tasks/

## 10. Alcance excluido

- No detecta automáticamente el id del item a partir de slug del branch (se asume que la función matchesBranch está definida — ver sección 3.1).
- No cierra ni hace nada con los PRs.
- No modifica otros campos de los items.
- No maneja repos múltiples simultáneamente.

## 11. Verificación (post-implementación)

Para cada escenario de la sección 4 y cada criterio de la sección 5, ejecutar el comando con datos de prueba controlados (mock de gh o repo real con PRs) y verificar el resultado observable contra lo especificado. Registrar: PASS / FAIL. Véase skill spec-driven-review Fase B.

---

## Acuerdo

Este spec es fuente de verdad para el desarrollo del issue #52 hasta que se acuerde su modificación. Si durante implementación surge un desacuerdo entre este spec y el comportamiento deseado, se revisa el spec antes de modificar el código.
