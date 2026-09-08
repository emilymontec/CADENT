# GitHub Wrapped — v0.1 Foundation + v0.2 GitHub Integration

Este scaffold implementa las primeras dos fases del roadmap (`ROADMAP.md`,
secciones 36 y 38), con todas las correcciones ⚠️ ya aplicadas:

## v0.1 — Foundation ✅
- Proyecto Next.js 14 (App Router) + TypeScript + Tailwind.
- `prisma/schema.prisma`: incluye los modelos estándar de Auth.js
  (`Account`, `Session`, `VerificationToken`), `User.timezone`,
  `GitHubAccount` con campos completos, `Commit.authorEmail`,
  `LanguageStat` como serie de tiempo (`capturedAt`), y `SyncState` para
  soportar el polling de progreso (sección 32).
- GitHub OAuth vía Auth.js (`lib/auth/index.ts`), con scope mínimo
  (`read:user user:email public_repo` — **sin** acceso a repos privados,
  ver sección 5). Tokens cifrados con AES-256-GCM antes de persistirse
  (`lib/auth/crypto.ts`) — nunca en texto plano.
- UI básica: landing con "Connect GitHub" y dashboard protegido por
  middleware.

## v0.2 — GitHub Integration ✅
- Cliente REST (`lib/github/client.ts`) con **retry + backoff exponencial**
  ante 403/429 (`withRetry`).
- Cliente GraphQL (`lib/github/graphql.ts`) exclusivamente para el
  **contribution calendar**, que no existe en REST (sección 6).
- Collectors: `repositories.ts` (filtra privados — alcance MVP),
  `commits.ts` (resuelve identidad del autor contra emails verificados,
  no solo `author.login`), `languages.ts` (snapshot con bytes/porcentaje).
- **Job queue con Inngest** (`lib/jobs/`): la sincronización pesada corre
  fuera del ciclo de vida de una request HTTP. `app/api/sync/route.ts`
  **solo encola** el evento — nunca hace el trabajo directamente (sección
  32, corrección crítica sobre límites de timeout serverless en Vercel).
- El dashboard hace polling de `/api/sync` (GET) para mostrar el progreso
  ("Analyzing your GitHub... 78%").

## v0.3 — Analytics ✅
- `lib/analytics/`: motor puro, sin dependencias de GitHub API, DB ni UI
  (sección 13) — recibe arrays en memoria y devuelve métricas.
- `timezone.ts`: único punto de conversión UTC → hora local, usando
  `Intl.DateTimeFormat` (sin dependencias extra). Todo lo demás depende de
  este módulo en vez de leer `Date` directamente (corrección sección 14.4).
- `commits.ts` / `repositories.ts` / `languages.ts`: estadísticas de las
  secciones 14.1-14.3. `languages.ts` toma el snapshot más reciente por
  repo+lenguaje, ya que `LanguageStat` es una serie de tiempo.
- `activity.ts`: distribución por hora/día, hora y día más activos,
  actividad nocturna/fin de semana — todo timezone-normalizado (14.4/14.5).
- `streaks.ts`: rachas (sección 15) calculadas sobre la fecha local, no UTC.
- `engine.ts` (`runAnalytics`): compone todo lo anterior. Expuesto en
  `app/api/analytics` (route handler delgado: solo trae datos de Prisma y
  delega el cálculo al engine).
- `lib/analytics/__tests__/`: 22 tests con Vitest, incluyendo casos
  explícitos con usuarios en distintas timezones (mejora sugerida en
  sección 28) — corren con `npm test`.

## Fase 1 — Insights Engine ✅
- `lib/insights/rules.ts`: 10 reglas de detección puras (`night_owl`,
  `early_bird`, `weekend_warrior`, `consistent_committer`,
  `language_loyalist`, `polyglot`, `mono_repo_focus`, `serial_starter`,
  `longest_streak`, `active_streak`), cada una con umbral de tamaño de
  muestra mínimo y **cero** cálculo propio — solo leen lo que ya calculó
  el Analytics Engine.
- `rank.ts`: ordena por prioridad y resuelve pares mutuamente excluyentes
  (`night_owl` vs `early_bird`, `language_loyalist` vs `polyglot`,
  `mono_repo_focus` vs `serial_starter`).
- `templates.ts`: plantillas deterministas en español — fallback
  obligatorio cuando la IA está desactivada, falla, o el texto generado no
  pasa moderación básica.
- `narrate.ts`: única capa que llama a la IA (Claude Haiku 4.5), y
  **solo** para redactar sobre datos ya calculados — nunca para calcular
  estadísticas (pipeline `datos → Analytics Engine → métricas → Insights
  Engine → lenguaje natural`, no al revés). Loguea costo/uso en
  `AiUsageLog` en cada llamada, exitosa o no.
- `engine.ts` (`generateInsights`): compone detección → ranking →
  narración.
- Job de Inngest (`lib/jobs/insights.ts`) separado de la sincronización:
  se dispara por evento al terminar `sync-user-data`, y un fallo ahí
  **nunca** marca la sincronización de datos como fallida.
- `app/api/insights` — route handler delgado, solo lee lo ya persistido.
- 38 tests nuevos (60 en total con los de Fase 0): reglas de detección
  con casos límite, ranking y exclusión mutua, plantillas, narración con
  IA/fetch/Prisma mockeados (nunca toca red ni DB real), y un test
  end-to-end del pipeline completo con IA desactivada.

## Fase 2 — Dashboard ✅
- Extendido el Analytics Engine con `buildDailyDistribution` (día por día
  del período, timezone-normalizado) — necesario para el heatmap; nunca
  se calculó en un componente de UI (regla explícita de la Fase 2).
- `lib/dashboard/period.ts`: resuelve los 3 períodos del selector
  (últimos 30 días / año calendario / rolling 12 meses). Trunca a
  medianoche UTC a propósito — es lo que permite que el job de insights
  (que corre en background con latencia variable) y el Route Handler que
  los sirve calculen exactamente el mismo rango sin depender de que
  ambos corran en el mismo instante.
- `lib/analytics/service.ts` / `lib/insights/service.ts`: capa
  compartida entre el Server Component del dashboard (render inicial) y
  los Route Handlers (`/api/analytics?period=...`, `/api/insights`) — un
  solo lugar arma la consulta a Prisma para cada período.
- Componentes en `components/dashboard/`: `ActivityHeatmap` (estilo
  contribution graph), `LanguageChart` y `CommitTrend` (Recharts),
  `StreakCard`, `InsightsGrid`, `PeriodSelector`, `EmptyState`,
  `Skeleton`. Todos reciben datos ya calculados por props — ninguno
  agrega o promedia nada por su cuenta.
- Tipografía dedicada (Space Grotesk + Manrope vía `next/font/google`) y
  paleta de heatmap alineada a la convención visual de GitHub.
- **Corrección real encontrada durante el build:** `middleware.ts`
  reexportaba `auth()` para proteger `/dashboard`, pero esa función usa
  `node:crypto` (cifrado de tokens) y sesiones de base de datos vía
  Prisma — ninguno de los dos corre en el Edge Runtime, donde Next.js
  ejecuta middleware por defecto. `npm run build` lo detectó
  (`UnhandledSchemeError` en `node:crypto`). Se eliminó `middleware.ts`;
  la protección de ruta ya vivía también en el propio Server Component
  de `app/dashboard/page.tsx`, que sí corre en Node.js.
- 7 tests nuevos para `resolvePeriod` (70 en total en el proyecto).

## Lo que falta a propósito (fases posteriores)
- Wirear el Analytics Engine + Insights Engine a gráficos y tarjetas
  reales en el dashboard (Fase 2, ver `DEVELOPMENT_ROADMAP.md`).
- Wrapped Experience navegable, Sharing, Gamificación/Comparaciones
  (Fases 3-5).
- Repos privados opt-in, tiempo real (webhooks), notificaciones, i18n,
  seguridad/compliance, performance, testing E2E, CI/CD (Fases 6-13).

## Setup

```bash
cp .env.example .env
# completa DATABASE_URL, GITHUB_CLIENT_ID/SECRET, AUTH_SECRET,
# TOKEN_ENCRYPTION_KEY (openssl rand -hex 32), INNGEST_EVENT_KEY/SIGNING_KEY

npm install
npm run db:push     # o db:migrate si prefieres migraciones versionadas
npm run dev
```

En una segunda terminal, para procesar los jobs de sincronización en
desarrollo local:

```bash
npx inngest-cli@latest dev
```

### Crear la GitHub OAuth App
1. https://github.com/settings/developers → New OAuth App.
2. Homepage URL: `http://localhost:3000`
3. Callback URL: `http://localhost:3000/api/auth/callback/github`

Para correr los tests del Analytics Engine (no requieren DB ni red):

```bash
npm test
```

## Siguiente paso
Implementar Fase 3 del `DEVELOPMENT_ROADMAP.md` (Wrapped Experience): el
deck de slides navegable que sí popula `WrappedReport`, reutilizando los
insights ya persistidos por período.
