import { useMemo, useState } from "react";
import {
  auditContext,
  compilePack,
  validateManifest,
} from "@handoffseal/core";
import type {
  ContextManifest,
  HandoffPack,
} from "@handoffseal/core";
import { sampleManifest, sampleObservations } from "./sample.js";

const stringify = (value: unknown) => JSON.stringify(value, null, 2);

function parse(text: string): { manifest?: ContextManifest; error?: string } {
  try {
    const value = JSON.parse(text) as unknown;
    const issues = validateManifest(value);
    if (issues.length > 0) {
      return {
        error: issues
          .map((entry) => `${entry.path}: ${entry.message}`)
          .join("\n"),
      };
    }
    return { manifest: value as ContextManifest };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export function App() {
  const [manifestText, setManifestText] = useState(stringify(sampleManifest));
  const [pack, setPack] = useState<HandoffPack>();
  const [packError, setPackError] = useState("");
  const parsed = useMemo(() => parse(manifestText), [manifestText]);
  const audit = useMemo(
    () =>
      parsed.manifest
        ? auditContext(
            parsed.manifest,
            sampleObservations,
            new Date("2026-07-29T03:00:00.000Z"),
          )
        : undefined,
    [parsed.manifest],
  );

  async function buildPack() {
    if (!parsed.manifest || !audit) return;
    try {
      const result = await compilePack({
        manifest: parsed.manifest,
        audit,
        observations: sampleObservations,
        now: new Date("2026-07-29T03:01:00.000Z"),
      });
      setPack(result);
      setPackError("");
    } catch (error) {
      setPack(undefined);
      setPackError(error instanceof Error ? error.message : String(error));
    }
  }

  function downloadPack() {
    if (!pack) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([pack.content], { type: "text/markdown" }),
    );
    link.download = "agent-handoff.md";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const selected = new Set(pack?.selectedSources.map((source) => source.sourceId));

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#">
          <span className="brand-mark">HS</span>
          <span>HandoffSeal</span>
          <small>Freshness Studio</small>
        </a>
        <div className="local">
          <span />
          Local analysis
        </div>
      </header>

      <section className="hero">
        <div>
          <span className="overline">CONTEXT HYGIENE FOR LONG-RUNNING AGENTS</span>
          <h1>Context can<br />go stale, too.</h1>
        </div>
        <p>
          Do not pass stale assumptions to the next agent. Audit freshness,
          conflicts, and token waste before creating a handoff.
        </p>
      </section>

      <section className="metrics">
        <div>
          <span>Context health</span>
          <strong>{audit?.healthScore ?? "—"}<small>/100</small></strong>
        </div>
        <div>
          <span>Fresh sources</span>
          <strong>
            {audit?.sources.filter((source) => source.status === "healthy").length ?? "—"}
            <small>/{audit?.sources.length ?? 0}</small>
          </strong>
        </div>
        <div>
          <span>Token pressure</span>
          <strong>
            {audit?.totalEstimatedTokens ?? "—"}
            <small>/{audit?.tokenBudget ?? 0}</small>
          </strong>
        </div>
        <div>
          <span>Contradictions</span>
          <strong>{audit?.contradictions.length ?? "—"}<small> found</small></strong>
        </div>
      </section>

      <section className="workspace">
        <section className="manifest-panel">
          <div className="panel-title">
            <div><span>01</span><h2>Context manifest</h2></div>
            <code>context.manifest.json</code>
          </div>
          <textarea
            aria-label="Context manifest JSON"
            value={manifestText}
            onChange={(event) => {
              setManifestText(event.target.value);
              setPack(undefined);
            }}
            spellCheck={false}
          />
          {parsed.error && <pre className="error">{parsed.error}</pre>}
        </section>

        <section className="audit-panel">
          <div className="panel-title">
            <div><span>02</span><h2>Freshness audit</h2></div>
            <b className={`audit-state state-${audit?.status ?? "unknown"}`}>
              {audit?.status ?? "invalid"}
            </b>
          </div>
          <div className="source-list">
            {parsed.manifest?.sources.map((source) => {
              const result = audit?.sources.find(
                (entry) => entry.sourceId === source.id,
              );
              return (
                <article className="source-card" key={source.id}>
                  <div className="source-head">
                    <span className={`status-dot status-${result?.status}`} />
                    <strong>{source.label}</strong>
                    <span className={`status-label status-${result?.status}`}>
                      {result?.status}
                    </span>
                  </div>
                  <p>{result?.issues[0] ?? "Hash and freshness checks passed."}</p>
                  <footer>
                    <span>A{source.authority}</span>
                    <span>P{source.priority}</span>
                    <span>{result?.estimatedTokens ?? 0} tok</span>
                    {source.required && <b>required</b>}
                  </footer>
                </article>
              );
            })}
          </div>
          {(audit?.contradictions.length ?? 0) > 0 && (
            <div className="conflict-card">
              <span className="eyebrow">CONFLICT RESOLUTION</span>
              {audit?.contradictions.map((conflict) => (
                <div key={conflict.key}>
                  <strong>{conflict.subject}.{conflict.predicate}</strong>
                  <span>
                    {conflict.unresolved
                      ? "unresolved"
                      : `resolved → ${JSON.stringify(conflict.resolvedValue)}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="pack-panel">
          <div className="panel-title">
            <div><span>03</span><h2>Handoff pack</h2></div>
          </div>
          <div className="budget-ring">
            <div>
              <strong>{pack?.estimatedTokens ?? 0}</strong>
              <span>/ {parsed.manifest?.tokenBudget ?? 0} tokens</span>
            </div>
          </div>
          <div className="selection">
            <span className="eyebrow">SOURCE SELECTION</span>
            {parsed.manifest?.sources.map((source) => (
              <div key={source.id}>
                <span>{source.id}</span>
                <b className={selected.has(source.id) ? "kept" : ""}>
                  {pack ? (selected.has(source.id) ? "KEEP" : "DROP") : "—"}
                </b>
              </div>
            ))}
          </div>
          <button className="compile-button" onClick={buildPack} disabled={!audit}>
            Compile fresh handoff
          </button>
          {pack && (
            <>
              <button className="download-button" onClick={downloadPack}>
                Download Markdown
              </button>
              <div className="pack-hash">
                <span>PACK SHA-256</span>
                <code>{pack.packHash}</code>
              </div>
            </>
          )}
          {packError && <p className="pack-error">{packError}</p>}
        </aside>
      </section>

      <footer className="site-footer">
        <span>HANDOFFSEAL / CONTEXT FRESHNESS PROTOCOL</span>
        <span>No model · no upload · deterministic selection</span>
      </footer>
    </main>
  );
}
