'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Loader2, RotateCw } from 'lucide-react';
import Confetti from '@/app/components/Confetti';

const SESSION_KEY = 'gd_auth_user';

// Base REST del backend. Reutilizamos la misma URL del GraphQL (que ya conecta
// bien) quitándole el sufijo `/graphql`; así no dependemos de otro puerto/env.
const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NEXT_PUBLIC_GRAPHQL_URL
    ? process.env.NEXT_PUBLIC_GRAPHQL_URL.replace(/\/graphql\/?$/, '')
    : 'http://localhost:8000')
).replace(/\/$/, '');

type TestItem = { id: string; name: string; description: string };
type Group = { id: string; name: string; file: string; description: string; tests: TestItem[] };
type Category = { key: string; label: string; suite: 'backend' | 'frontend'; groups: Group[] };
type Catalog = { backend: Category[]; frontend: Category[] };

type RunSummary = { passed?: number; failed?: number; errors?: number; skipped?: number };
type RunResult = { ok: boolean; output: string; summary: RunSummary; command?: string };

function getSession(): { role: string | null; token: string | null } {
  try {
    const stored = window.localStorage.getItem(SESSION_KEY);
    if (!stored) return { role: null, token: null };
    const parsed = JSON.parse(stored);
    return { role: parsed?.role ?? null, token: parsed?.token ?? null };
  } catch {
    return { role: null, token: null };
  }
}

export default function DevTestPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<'checking' | 'denied' | 'ok'>('checking');
  const [token, setToken] = useState<string | null>(null);

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, RunResult>>({});
  const [openOutputs, setOpenOutputs] = useState<Record<string, boolean>>({});
  const [confettiKey, setConfettiKey] = useState(0);

  // Guard de administrador (mismo patrón que el resto de la app).
  useEffect(() => {
    const { role, token: tk } = getSession();
    if (role !== 'admin') {
      setAuthState('denied');
      router.replace('/');
      return;
    }
    setToken(tk);
    setAuthState('ok');
  }, [router]);

  const loadCatalog = useCallback(async () => {
    if (!token) return;
    setLoadError(null);
    try {
      const res = await fetch(`${API_BASE}/api/dev/tests`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Error ${res.status}`);
      }
      setCatalog(await res.json());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo de pruebas.');
    }
  }, [token]);

  useEffect(() => {
    if (authState === 'ok') void loadCatalog();
  }, [authState, loadCatalog]);

  const runTests = useCallback(
    async (suite: 'backend' | 'frontend', ids: string[], runKey: string) => {
      if (!token || ids.length === 0) return;
      setRunning((prev) => ({ ...prev, [runKey]: true }));
      setResults((prev) => {
        const next = { ...prev };
        delete next[runKey];
        return next;
      });
      try {
        const res = await fetch(`${API_BASE}/api/dev/tests/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ suite, ids }),
          cache: 'no-store',
        });
        const data: RunResult = await res.json();
        setResults((prev) => ({ ...prev, [runKey]: data }));
        setOpenOutputs((prev) => ({ ...prev, [runKey]: !data.ok }));
        return data;
      } catch (err) {
        const failed: RunResult = {
          ok: false,
          output: err instanceof Error ? err.message : 'Error de red al ejecutar las pruebas.',
          summary: {},
        };
        setResults((prev) => ({ ...prev, [runKey]: failed }));
        return failed;
      } finally {
        setRunning((prev) => ({ ...prev, [runKey]: false }));
      }
    },
    [token],
  );

  const allCategories = useMemo<Category[]>(
    () => (catalog ? [...catalog.backend, ...catalog.frontend] : []),
    [catalog],
  );

  const totals = useMemo(() => {
    let groups = 0;
    let tests = 0;
    for (const cat of allCategories) {
      groups += cat.groups.length;
      for (const g of cat.groups) tests += g.tests.length;
    }
    return { categories: allCategories.length, groups, tests };
  }, [allCategories]);

  const runEverything = useCallback(async () => {
    if (!catalog) return;
    const backendIds = catalog.backend.flatMap((c) => c.groups.map((g) => g.id));
    const frontendIds = catalog.frontend.flatMap((c) => c.groups.map((g) => g.id));
    const tasks: Promise<RunResult | undefined>[] = [];
    if (backendIds.length) tasks.push(runTests('backend', backendIds, 'all:backend'));
    if (frontendIds.length) tasks.push(runTests('frontend', frontendIds, 'all:frontend'));
    if (!tasks.length) return;
    const settled = await Promise.all(tasks);
    // 🎉 Solo si TODO salió en verde.
    if (settled.every((r) => r?.ok)) setConfettiKey((k) => k + 1);
  }, [catalog, runTests]);

  const runningAll = !!running['all:backend'] || !!running['all:frontend'];

  if (authState !== 'ok') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black font-mono text-sm text-green-400">
        <span className="mr-2 animate-pulse">$</span>
        {authState === 'denied' ? 'acceso denegado — se requiere admin' : 'verificando permisos…'}
        <span className="ml-1 animate-pulse">_</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black bg-[radial-gradient(circle_at_50%_-20%,rgba(34,197,94,0.08),transparent_60%)] px-2 py-4 font-mono text-green-400 sm:px-4 sm:py-8">
      <Confetti fireKey={confettiKey} />
      <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-xl border border-green-500/25 bg-[#04070a] shadow-[0_0_60px_-15px_rgba(34,197,94,0.35)]">
        {/* Barra de título estilo terminal */}
        <div className="flex items-center gap-2 border-b border-green-500/15 bg-[#0a0f0a] px-4 py-2.5">
          <span className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-500/80" />
            <span className="h-3 w-3 rounded-full bg-amber-400/80" />
            <span className="h-3 w-3 rounded-full bg-green-500/80" />
          </span>
          <span className="ml-2 flex-1 truncate text-center text-xs text-green-500/70">
            dev@gemelo-digital: ~/tests — pruebas del sistema
          </span>
          <Link
            href="/ajustes"
            className="text-xs text-green-500/60 transition hover:text-green-300"
            title="Volver a ajustes"
          >
            [ exit ]
          </Link>
        </div>

        {/* Cuerpo */}
        <div className="px-3 py-5 text-[13px] leading-relaxed sm:px-6">
          <Line prompt>
            <span className="text-cyan-400">pytest</span> --collect &amp;&amp;{' '}
            <span className="text-cyan-400">vitest</span> --list
          </Line>
          <p className="mt-2 text-green-600">
            <span className="select-none text-green-700"># </span>
            Ejecute las pruebas del proyecto sin salir de la app. Corra una categoría completa, una
            clase o un caso puntual. Pase el cursor sobre cada clase para ver qué verifica.
          </p>

          {loadError && (
            <div className="mt-4 rounded border border-red-500/40 bg-red-950/30 p-3 text-xs text-red-300">
              <p>
                <span className="text-red-500">error:</span> {loadError}
              </p>
              <button
                onClick={() => void loadCatalog()}
                className="mt-2 rounded border border-red-500/40 px-2 py-0.5 text-red-200 transition hover:bg-red-500/20"
              >
                [ retry ]
              </button>
            </div>
          )}

          {!catalog && !loadError && (
            <p className="mt-4 flex items-center gap-2 text-green-500">
              <Loader2 className="h-4 w-4 animate-spin" /> cargando catálogo<span className="animate-pulse">_</span>
            </p>
          )}

          {catalog && (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <p className="text-xs text-green-700">
                  <span className="select-none"># </span>
                  {totals.categories} categorías · {totals.groups} clases · {totals.tests} casos
                </p>
                <button
                  onClick={runEverything}
                  disabled={runningAll}
                  className="inline-flex items-center gap-1.5 rounded border border-green-400 bg-green-500/10 px-3 py-1 text-xs font-bold text-green-300 transition hover:bg-green-500 hover:text-black disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-green-500/10 disabled:hover:text-green-300"
                >
                  {runningAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span>▶▶</span>}
                  run all — todas las pruebas
                </button>
                <button
                  onClick={() => {
                    setCatalog(null);
                    void loadCatalog();
                  }}
                  className="inline-flex items-center gap-1.5 rounded border border-green-500/40 px-2.5 py-1 text-xs text-green-400 transition hover:bg-green-500 hover:text-black"
                  title="Volver a descubrir las pruebas desde el disco"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  recargar
                </button>
                {results['all:backend'] && (
                  <span className="text-xs">
                    <span className="text-cyan-400">backend</span> <ResultBadge result={results['all:backend']} />
                  </span>
                )}
                {results['all:frontend'] && (
                  <span className="text-xs">
                    <span className="text-fuchsia-400">frontend</span> <ResultBadge result={results['all:frontend']} />
                  </span>
                )}
                {(results['all:backend'] || results['all:frontend']) &&
                  (results['all:backend']?.ok ?? true) &&
                  (results['all:frontend']?.ok ?? true) &&
                  !runningAll && (
                    <span className="text-xs font-bold text-green-300">🎉 ¡todo en verde!</span>
                  )}
              </div>

              {(results['all:backend'] || results['all:frontend']) && (
                <div className="mt-2 space-y-1 rounded border border-green-500/15 bg-black/40 p-2">
                  {results['all:backend'] && (
                    <OutputPanel
                      runKey="all:backend"
                      result={results['all:backend']}
                      open={!!openOutputs['all:backend']}
                      setOpenOutputs={setOpenOutputs}
                    />
                  )}
                  {results['all:frontend'] && (
                    <OutputPanel
                      runKey="all:frontend"
                      result={results['all:frontend']}
                      open={!!openOutputs['all:frontend']}
                      setOpenOutputs={setOpenOutputs}
                    />
                  )}
                </div>
              )}

              <Suite
                title="backend"
                subtitle="pytest"
                accent="text-cyan-400"
                categories={catalog.backend}
                running={running}
                results={results}
                openOutputs={openOutputs}
                setOpenOutputs={setOpenOutputs}
                runTests={runTests}
              />
              <Suite
                title="frontend"
                subtitle="vitest"
                accent="text-fuchsia-400"
                categories={catalog.frontend}
                running={running}
                results={results}
                openOutputs={openOutputs}
                setOpenOutputs={setOpenOutputs}
                runTests={runTests}
              />
            </>
          )}

          <Line prompt className="mt-6 text-green-600">
            <span className="animate-pulse">_</span>
          </Line>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Primitivas de UI
// ---------------------------------------------------------------------------
function Line({
  children,
  prompt,
  className = '',
}: {
  children: React.ReactNode;
  prompt?: boolean;
  className?: string;
}) {
  return (
    <p className={className}>
      {prompt && <span className="select-none text-green-500">$&nbsp;</span>}
      {children}
    </p>
  );
}

/** Tooltip estilo terminal que aparece al pasar el cursor. */
function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  if (!content) return <>{children}</>;
  return (
    <span className="group/tt relative inline-flex items-center">
      {children}
      <span className="pointer-events-none absolute left-0 top-full z-50 mt-1.5 hidden w-72 max-w-[80vw] whitespace-normal rounded border border-green-500/30 bg-black px-3 py-2 text-xs font-normal leading-relaxed text-green-300 shadow-lg shadow-green-500/10 group-hover/tt:block">
        <span className="select-none text-green-700"># </span>
        {content}
      </span>
    </span>
  );
}

function ResultBadge({ result }: { result?: RunResult }) {
  if (!result) return null;
  const { passed = 0, failed = 0, errors = 0, skipped = 0 } = result.summary ?? {};
  const fails = failed + errors;
  return (
    <span className={`text-xs font-bold ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
      {result.ok ? `PASS ${passed}✓` : `FAIL ${fails}✗·${passed}✓`}
      {skipped ? <span className="text-amber-400/80"> {skipped}⊘</span> : ''}
    </span>
  );
}

function RunButton({
  label,
  isRunning,
  onClick,
}: {
  label: string;
  isRunning: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={isRunning}
      className="inline-flex items-center gap-1 rounded border border-green-500/40 px-2 py-0.5 text-xs text-green-400 transition hover:bg-green-500 hover:text-black disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-green-400"
    >
      {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>▶</span>}
      {label}
    </button>
  );
}

function OutputPanel({
  runKey,
  result,
  open,
  setOpenOutputs,
}: {
  runKey: string;
  result: RunResult;
  open: boolean;
  setOpenOutputs: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpenOutputs((prev) => ({ ...prev, [runKey]: !prev[runKey] }))}
        className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-300"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {open ? 'ocultar stdout' : 'ver stdout'}
      </button>
      {open && (
        <pre className="mt-1.5 max-h-80 overflow-auto rounded border border-green-500/15 bg-black p-3 text-[11px] leading-relaxed text-green-300/90">
          {result.output || '(sin salida)'}
        </pre>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suites / categorías / grupos
// ---------------------------------------------------------------------------
type SuiteProps = {
  title: string;
  subtitle: string;
  accent: string;
  categories: Category[];
  running: Record<string, boolean>;
  results: Record<string, RunResult>;
  openOutputs: Record<string, boolean>;
  setOpenOutputs: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  runTests: (suite: 'backend' | 'frontend', ids: string[], runKey: string) => void;
};

function Suite({ title, subtitle, accent, categories, ...rest }: SuiteProps) {
  if (categories.length === 0) return null;
  return (
    <section className="mt-6">
      <p className="mb-3 border-b border-green-500/15 pb-1.5 text-sm">
        <span className="select-none text-green-700">{'//'} </span>
        <span className={`font-bold ${accent}`}>{title}</span>
        <span className="text-green-700"> ({subtitle})</span>
      </p>
      <div className="space-y-1.5">
        {categories.map((cat) => (
          <CategoryBlock key={`${cat.suite}:${cat.key}`} category={cat} {...rest} />
        ))}
      </div>
    </section>
  );
}

function CategoryBlock({
  category,
  running,
  results,
  openOutputs,
  setOpenOutputs,
  runTests,
}: { category: Category } & Omit<SuiteProps, 'title' | 'subtitle' | 'accent' | 'categories'>) {
  const [expanded, setExpanded] = useState(false);
  const catKey = `cat:${category.suite}:${category.key}`;
  const allIds = category.groups.map((g) => g.id);

  return (
    <div className="rounded border border-green-500/15 bg-green-500/[0.02]">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <button onClick={() => setExpanded((v) => !v)} className="flex min-w-0 items-center gap-2 text-left">
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-green-600" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-green-600" />
          )}
          <span className="select-none text-green-600">▸</span>
          <span className="truncate font-bold text-green-300">{category.label}</span>
          <span className="shrink-0 text-xs text-green-700">[{category.groups.length}]</span>
        </button>
        <div className="flex items-center gap-3">
          <ResultBadge result={results[catKey]} />
          <RunButton
            label="run all"
            isRunning={!!running[catKey]}
            onClick={() => runTests(category.suite, allIds, catKey)}
          />
        </div>
      </div>

      {results[catKey] && (
        <div className="px-3 pb-2">
          <OutputPanel runKey={catKey} result={results[catKey]} open={!!openOutputs[catKey]} setOpenOutputs={setOpenOutputs} />
        </div>
      )}

      {expanded && (
        <div className="space-y-1 border-t border-green-500/10 px-2 py-2">
          {category.groups.map((group) => (
            <GroupRow
              key={group.id}
              suite={category.suite}
              group={group}
              running={running}
              results={results}
              openOutputs={openOutputs}
              setOpenOutputs={setOpenOutputs}
              runTests={runTests}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupRow({
  suite,
  group,
  running,
  results,
  openOutputs,
  setOpenOutputs,
  runTests,
}: {
  suite: 'backend' | 'frontend';
  group: Group;
} & Omit<SuiteProps, 'title' | 'subtitle' | 'accent' | 'categories'>) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded bg-black/40 px-2 py-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={() => setOpen((v) => !v)} className="flex min-w-0 items-center gap-2 text-left">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-green-700" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-green-700" />
          )}
          <Tooltip content={group.description}>
            <span className="truncate text-sm text-yellow-300">
              {group.name}
              {group.description && <span className="ml-1 select-none text-green-600">ⓘ</span>}
            </span>
          </Tooltip>
          <span className="hidden truncate text-xs text-green-800 sm:inline">{group.file}</span>
        </button>
        <div className="flex items-center gap-3">
          <ResultBadge result={results[group.id]} />
          <span className="text-xs text-green-700">{group.tests.length} casos</span>
          <RunButton
            label="run"
            isRunning={!!running[group.id]}
            onClick={() => runTests(suite, [group.id], group.id)}
          />
        </div>
      </div>

      {results[group.id] && (
        <OutputPanel runKey={group.id} result={results[group.id]} open={!!openOutputs[group.id]} setOpenOutputs={setOpenOutputs} />
      )}

      {open && (
        <ul className="mt-1.5 space-y-1 border-l border-green-500/15 pl-3">
          {group.tests.map((test) => (
            <li key={test.id} className="py-0.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="select-none text-green-700">- </span>
                  <span className="text-xs text-green-300">{test.name}</span>
                  {test.description && (
                    <span className="ml-2 text-xs text-green-700">
                      <span className="select-none"># </span>
                      {test.description}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <ResultBadge result={results[test.id]} />
                  <RunButton
                    label="run"
                    isRunning={!!running[test.id]}
                    onClick={() => runTests(suite, [test.id], test.id)}
                  />
                </div>
              </div>
              {results[test.id] && (
                <OutputPanel runKey={test.id} result={results[test.id]} open={!!openOutputs[test.id]} setOpenOutputs={setOpenOutputs} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
