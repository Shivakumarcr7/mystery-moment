"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Play,
  RotateCcw,
  Scale,
  Search,
} from "lucide-react";
import detectivePortrait from "@/src/assets/images/detective_vance_portrait_1795106984092.jpg";
import suspectPortrait from "@/src/assets/images/suspect_aris_portrait_1795106851051.jpg";
import type { GameLogEntry, GameRunResult } from "@/lib/mysteryEngine";

type LogFilter = "all" | "dialogue" | "tools" | "errors";

interface InterrogationViewProps {
  activeRun: GameRunResult | null;
  latestV1Run: GameRunResult | null;
  latestV2Run: GameRunResult | null;
  loading: boolean;
  errorMessage: string | null;
  promptVersion: "v1" | "v2";
  onRunTestCase: () => void;
}

export function InterrogationView({
  activeRun,
  latestV1Run,
  latestV2Run,
  loading,
  errorMessage,
  promptVersion,
  onRunTestCase,
}: InterrogationViewProps) {
  const [filter, setFilter] = useState<LogFilter>("all");
  const [expandedPayloadIds, setExpandedPayloadIds] = useState<
    Record<string, boolean>
  >({});
  const [replayCount, setReplayCount] = useState<number | null>(null);

  const totalLogs = activeRun?.logs.length ?? 0;

  useEffect(() => {
    if (replayCount === null || !activeRun) return;
    if (replayCount >= activeRun.logs.length) {
      const doneTimer = setTimeout(() => setReplayCount(null), 250);
      return () => clearTimeout(doneTimer);
    }
    const timer = setTimeout(() => {
      setReplayCount((prev) => (prev === null ? null : prev + 1));
    }, 360);
    return () => clearTimeout(timer);
  }, [replayCount, activeRun]);

  const togglePayload = (id: string) => {
    setExpandedPayloadIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleStartReplay = () => {
    if (!activeRun || activeRun.logs.length === 0) return;
    setFilter("all");
    setReplayCount(1);
  };

  const visibleLogs: GameLogEntry[] = (() => {
    if (!activeRun) return [];
    const slice =
      replayCount !== null
        ? activeRun.logs.slice(0, replayCount)
        : activeRun.logs;

    if (filter === "all") return slice;
    if (filter === "dialogue") {
      return slice.filter(
        (entry) => entry.actor === "Detective" || entry.actor === "Suspect"
      );
    }
    if (filter === "tools") {
      return slice.filter(
        (entry) =>
          entry.kind === "tool_success" ||
          entry.kind === "tool_error" ||
          entry.kind === "accusation"
      );
    }
    return slice.filter((entry) => entry.kind === "tool_error");
  })();

  const v2BeatsV1 =
    latestV1Run &&
    latestV2Run &&
    latestV2Run.summary.solved &&
    latestV2Run.summary.totalTurns < latestV1Run.summary.totalTurns;

  const bloatVerified = Boolean(
    activeRun?.summary.hasContextBloat ||
      latestV1Run?.summary.hasContextBloat ||
      latestV2Run?.summary.hasContextBloat
  );

  const cctvErrorVerified = Boolean(
    activeRun?.summary.hasCctvError || latestV1Run?.summary.hasCctvError
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Confrontation Banner: Detective Vance vs. Dr. Aris + Live Run Metrics */}
      <section
        aria-label="Case participants and run metrics"
        className="border border-zinc-800/80 rounded-lg bg-[#14171C] p-5"
      >
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-center">
          {/* Detective Vance */}
          <div className="xl:col-span-4 flex items-center gap-4">
            <div className="relative w-16 h-16 shrink-0 rounded-md overflow-hidden border border-zinc-700/80 bg-zinc-900">
              <Image
                src={detectivePortrait}
                alt="Portrait of Detective Vance seated at an interrogation desk"
                fill
                sizes="64px"
                className="object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-zinc-400">Investigator Agent</p>
              <h2 className="font-display text-lg font-semibold text-zinc-100 truncate">
                Detective Vance
              </h2>
              <p className="font-mono text-xs text-amber-400/90 mt-0.5 truncate">
                {activeRun
                  ? `Active: Prompt ${activeRun.promptVersion}`
                  : `Ready: Prompt ${promptVersion}`}
              </p>
            </div>
          </div>

          {/* Center Quantitative Summary Strip */}
          <div className="xl:col-span-4 border-y xl:border-y-0 xl:border-x border-zinc-800/80 py-4 xl:py-0 xl:px-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[11px] text-zinc-500">Outcome</p>
                <p
                  className={`mt-1 font-mono text-sm font-medium ${
                    !activeRun
                      ? "text-zinc-400"
                      : activeRun.summary.solved
                        ? "text-emerald-400"
                        : "text-red-400"
                  }`}
                >
                  {!activeRun
                    ? "Pending"
                    : activeRun.summary.solved
                      ? "Solved"
                      : "Failed"}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-500">Turns</p>
                <p className="mt-1 font-mono text-sm font-medium text-zinc-100 tabular-nums">
                  {activeRun ? `${activeRun.summary.totalTurns} / 5` : "0 / 5"}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-500">Est. Context</p>
                <p className="mt-1 font-mono text-sm font-medium text-zinc-100 tabular-nums">
                  {activeRun ? `${activeRun.summary.estimatedTokens} tok` : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Suspect Dr. Aris */}
          <div className="xl:col-span-4 flex items-center gap-4 xl:justify-end">
            <div className="min-w-0 xl:text-right order-2 xl:order-1">
              <p className="text-xs text-zinc-400">Primary Suspect</p>
              <h2 className="font-display text-lg font-semibold text-zinc-100 truncate">
                Dr. Aris
              </h2>
              <p className="font-mono text-xs text-zinc-400 mt-0.5 truncate">
                {activeRun?.summary.solved
                  ? "Accused · Corporate Espionage"
                  : "Robotics Division · Lab 4"}
              </p>
            </div>
            <div className="relative w-16 h-16 shrink-0 rounded-md overflow-hidden border border-zinc-700/80 bg-zinc-900 order-1 xl:order-2">
              <Image
                src={suspectPortrait}
                alt="Portrait of Dr. Aris seated across a steel interrogation table"
                fill
                sizes="64px"
                className="object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Main Split: Transcript Feed + Evaluation Targets */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Transcript Panel */}
        <section
          aria-label="Interrogation transcript"
          className="xl:col-span-8 border border-zinc-800/80 rounded-lg bg-[#14171C] flex flex-col"
        >
          {/* Toolbar */}
          <div className="px-5 py-3.5 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label="Filter transcript entries"
              className="flex items-center gap-1 bg-[#0D0F12] p-1 rounded-md border border-zinc-800/80"
            >
              {(
                [
                  { id: "all", label: "All Events" },
                  { id: "dialogue", label: "Dialogue" },
                  { id: "tools", label: "Tools" },
                  { id: "errors", label: "Errors" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                    filter === tab.id
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {activeRun && totalLogs > 0 && (
                <button
                  type="button"
                  onClick={
                    replayCount !== null
                      ? () => setReplayCount(null)
                      : handleStartReplay
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-zinc-100 border border-zinc-800 hover:border-zinc-700 rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    {replayCount !== null ? "Show Full Log" : "Replay Steps"}
                  </span>
                </button>
              )}
              {activeRun && (
                <span className="font-mono text-xs text-zinc-500 tabular-nums whitespace-nowrap">
                  {visibleLogs.length} / {totalLogs} events
                </span>
              )}
            </div>
          </div>

          {/* Transcript Body */}
          <div className="p-5 min-h-[420px]">
            {errorMessage && (
              <div
                role="alert"
                className="mb-4 p-4 rounded-md border border-red-900/60 bg-red-950/30 text-red-200 text-sm flex items-start gap-3"
              >
                <AlertTriangle
                  className="w-4 h-4 text-red-400 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-medium text-red-200">Execution Failed</p>
                  <p className="mt-0.5 text-xs text-red-300/90 font-mono">
                    {errorMessage}
                  </p>
                </div>
              </div>
            )}

            {loading ? (
              <div className="space-y-4 py-4" aria-live="polite">
                <p className="text-sm text-amber-400 font-medium">
                  Running interrogation loop with Prompt {promptVersion}...
                </p>
                {[1, 2, 3].map((row) => (
                  <div
                    key={row}
                    className="h-20 rounded-md bg-zinc-800/40 animate-pulse border border-zinc-800/60"
                  />
                ))}
              </div>
            ) : !activeRun ? (
              <div className="py-16 px-4 text-center max-w-md mx-auto">
                <h3 className="font-display text-xl font-semibold text-zinc-100">
                  Interrogation Room Ready
                </h3>
                <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                  Launch a test run to watch Detective Vance question Dr. Aris,
                  call facility room tools, encounter the CCTV 503 outage, and
                  file an accusation.
                </p>
                <button
                  type="button"
                  onClick={onRunTestCase}
                  className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-amber-400 hover:text-amber-300 border border-amber-500/50 hover:bg-amber-500/10 rounded-md transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <Play className="w-4 h-4" aria-hidden="true" />
                  <span>Start Interrogation ({promptVersion})</span>
                </button>
              </div>
            ) : visibleLogs.length === 0 ? (
              <div className="py-14 text-center">
                <p className="text-sm text-zinc-400">
                  No transcript events match the{" "}
                  <span className="text-zinc-200 font-medium">{filter}</span>{" "}
                  filter in this run.
                </p>
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className="mt-3 text-xs font-medium text-amber-400 hover:text-amber-300 underline underline-offset-4"
                >
                  Show all events
                </button>
              </div>
            ) : (
              <ol className="divide-y divide-zinc-800/80">
                <AnimatePresence initial={false}>
                  {visibleLogs.map((log, idx) => {
                    const entryId = log.id ?? `entry_${idx}`;
                    const isToolError = log.kind === "tool_error";
                    const isAccusation = log.kind === "accusation";
                    const isDialogue =
                      log.actor === "Detective" || log.actor === "Suspect";
                    const hasExpandablePayload =
                      Boolean(log.rawPayload) &&
                      (log.rawPayload?.length ?? 0) > 100;
                    const isExpanded = Boolean(expandedPayloadIds[entryId]);

                    return (
                      <motion.li
                        key={entryId}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.18,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        className="py-4 first:pt-1 last:pb-1"
                      >
                        <div className="flex items-start gap-3.5">
                          {/* Avatar or Functional Icon */}
                          {log.actor === "Detective" ? (
                            <div className="relative w-9 h-9 shrink-0 rounded-md overflow-hidden border border-zinc-700/80 bg-zinc-900 mt-0.5">
                              <Image
                                src={detectivePortrait}
                                alt="Detective Vance"
                                fill
                                sizes="36px"
                                className="object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          ) : log.actor === "Suspect" ? (
                            <div className="relative w-9 h-9 shrink-0 rounded-md overflow-hidden border border-zinc-700/80 bg-zinc-900 mt-0.5">
                              <Image
                                src={suspectPortrait}
                                alt="Dr. Aris"
                                fill
                                sizes="36px"
                                className="object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          ) : (
                            <div
                              className={`w-9 h-9 shrink-0 rounded-md border flex items-center justify-center mt-0.5 ${
                                isToolError
                                  ? "bg-red-950/40 border-red-900/70 text-red-400"
                                  : isAccusation
                                    ? "bg-emerald-950/40 border-emerald-900/70 text-emerald-400"
                                    : "bg-zinc-900 border-zinc-800 text-zinc-400"
                              }`}
                            >
                              {isToolError ? (
                                <AlertTriangle
                                  className="w-4 h-4"
                                  aria-hidden="true"
                                />
                              ) : isAccusation ? (
                                <Scale
                                  className="w-4 h-4"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Search
                                  className="w-4 h-4"
                                  aria-hidden="true"
                                />
                              )}
                            </div>
                          )}

                          {/* Entry Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs">
                                <span
                                  className={`font-semibold ${
                                    log.actor === "Detective"
                                      ? "text-amber-400"
                                      : log.actor === "Suspect"
                                        ? "text-red-300"
                                        : isToolError
                                          ? "text-red-400"
                                          : isAccusation
                                            ? "text-emerald-400"
                                            : "text-zinc-200"
                                  }`}
                                >
                                  {log.actor === "Detective"
                                    ? "Detective Vance"
                                    : log.actor === "Suspect"
                                      ? "Dr. Aris"
                                      : isToolError
                                        ? "Tool Failure"
                                        : isAccusation
                                          ? "Final Verdict"
                                          : "Tool Output"}
                                </span>
                                {log.turn !== undefined && (
                                  <>
                                    <span
                                      className="text-zinc-600"
                                      aria-hidden="true"
                                    >
                                      ·
                                    </span>
                                    <span className="font-mono text-zinc-500 tabular-nums">
                                      Turn {log.turn}
                                    </span>
                                  </>
                                )}
                                {log.room && (
                                  <>
                                    <span
                                      className="text-zinc-600"
                                      aria-hidden="true"
                                    >
                                      ·
                                    </span>
                                    <span className="font-mono text-zinc-400">
                                      {log.room}
                                    </span>
                                  </>
                                )}
                              </div>

                              {log.tokenEstimate !== undefined && (
                                <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                                  ~{log.tokenEstimate} tok
                                </span>
                              )}
                            </div>

                            <p
                              className={`mt-1.5 leading-relaxed break-words ${
                                isDialogue
                                  ? "text-sm text-zinc-100"
                                  : isToolError
                                    ? "font-mono text-xs text-red-300"
                                    : isAccusation
                                      ? "text-sm font-medium text-emerald-200"
                                      : "font-mono text-xs text-zinc-300"
                              }`}
                            >
                              {log.text}
                            </p>

                            {hasExpandablePayload && (
                              <div className="mt-2.5">
                                <button
                                  type="button"
                                  onClick={() => togglePayload(entryId)}
                                  aria-expanded={isExpanded}
                                  className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
                                >
                                  <span>
                                    {isExpanded
                                      ? "Hide raw payload"
                                      : `Inspect full raw payload (${log.rawPayload?.length} chars)`}
                                  </span>
                                  {isExpanded ? (
                                    <ChevronUp
                                      className="w-3.5 h-3.5"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <ChevronDown
                                      className="w-3.5 h-3.5"
                                      aria-hidden="true"
                                    />
                                  )}
                                </button>
                                {isExpanded && (
                                  <pre className="mt-2 p-3 rounded-md bg-[#0D0F12] border border-zinc-800 font-mono text-[11px] leading-relaxed text-zinc-400 max-h-44 overflow-y-auto whitespace-pre-wrap break-words">
                                    {log.rawPayload}
                                  </pre>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ol>
            )}
          </div>
        </section>

        {/* Right Column: Live Evaluation Checklist & Trace Breakdown */}
        <aside
          aria-label="Evaluation targets and trace summary"
          className="xl:col-span-4 flex flex-col gap-6"
        >
          <div className="border border-zinc-800/80 rounded-lg bg-[#14171C] p-5">
            <h3 className="font-display text-base font-semibold text-zinc-100">
              Beta Evaluation Targets
            </h3>
            <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
              Targets update automatically from live run telemetry as you test
              v1 and v2 prompts.
            </p>

            <ul className="mt-4 divide-y divide-zinc-800/80">
              <li className="py-3 first:pt-0">
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 w-4 h-4 shrink-0 rounded-sm border flex items-center justify-center ${
                      bloatVerified
                        ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-400"
                        : "border-zinc-700 text-zinc-600"
                    }`}
                  >
                    {bloatVerified && (
                      <Check className="w-3 h-3" aria-hidden="true" />
                    )}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-zinc-200">
                      Context Bloat Detection
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400 leading-relaxed">
                      Verify <span className="font-mono">coffee_station</span>{" "}
                      injects 120× noise tokens into context.
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-zinc-500">
                      {bloatVerified
                        ? "Verified · 120 noise tokens observed"
                        : "Pending · Run v1 or v2"}
                    </p>
                  </div>
                </div>
              </li>

              <li className="py-3">
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 w-4 h-4 shrink-0 rounded-sm border flex items-center justify-center ${
                      cctvErrorVerified
                        ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-400"
                        : "border-zinc-700 text-zinc-600"
                    }`}
                  >
                    {cctvErrorVerified && (
                      <Check className="w-3 h-3" aria-hidden="true" />
                    )}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-zinc-200">
                      CCTV 503 Tool Failure
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400 leading-relaxed">
                      Ensure <span className="font-mono">cctv_archive</span> is
                      typed as a 503 service failure.
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-zinc-500">
                      {cctvErrorVerified
                        ? "Verified · TOOL_ERROR 503 recorded"
                        : "Pending · Run Prompt v1"}
                    </p>
                  </div>
                </div>
              </li>

              <li className="py-3 last:pb-0">
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 w-4 h-4 shrink-0 rounded-sm border flex items-center justify-center ${
                      v2BeatsV1
                        ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-400"
                        : "border-zinc-700 text-zinc-600"
                    }`}
                  >
                    {v2BeatsV1 && (
                      <Check className="w-3 h-3" aria-hidden="true" />
                    )}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-zinc-200">
                      Prompt v2 Efficiency Gain
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400 leading-relaxed">
                      Confirm v2 solves the case in fewer turns and lower
                      context cost than v1.
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-zinc-500 tabular-nums">
                      {v2BeatsV1 && latestV1Run && latestV2Run
                        ? `Verified · ${latestV1Run.summary.totalTurns} → ${latestV2Run.summary.totalTurns} turns`
                        : "Pending · Run both v1 and v2"}
                    </p>
                  </div>
                </div>
              </li>
            </ul>

            <div className="mt-4 pt-4 border-t border-zinc-800/80">
              <a
                href="https://app.morsehq.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-zinc-300 hover:text-zinc-100 border border-zinc-800 hover:border-zinc-700 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <span className="whitespace-nowrap">
                  View Traces in Morse Dashboard
                </span>
                <ExternalLink
                  className="w-3.5 h-3.5 text-zinc-500"
                  aria-hidden="true"
                />
              </a>
            </div>
          </div>

          {/* Active Run Breakdown */}
          {activeRun && (
            <div className="border border-zinc-800/80 rounded-lg bg-[#14171C] p-5">
              <h3 className="font-display text-base font-semibold text-zinc-100">
                Trace Telemetry
              </h3>
              <dl className="mt-3 divide-y divide-zinc-800/80 text-xs">
                <div className="py-2 flex items-center justify-between gap-2">
                  <dt className="text-zinc-400">Provider</dt>
                  <dd className="font-mono text-zinc-200">
                    {activeRun.provider}
                  </dd>
                </div>
                <div className="py-2 flex items-center justify-between gap-2">
                  <dt className="text-zinc-400">Morse Trace</dt>
                  <dd
                    className={`font-mono ${
                      activeRun.morseShipped
                        ? "text-emerald-400"
                        : "text-zinc-500"
                    }`}
                  >
                    {activeRun.morseShipped
                      ? activeRun.morseTraceId
                        ? `Shipped · ${activeRun.morseTraceId.slice(0, 8)}`
                        : "Shipped"
                      : "Not configured"}
                  </dd>
                </div>
                <div className="py-2 flex items-center justify-between gap-2">
                  <dt className="text-zinc-400">Tool Calls</dt>
                  <dd className="font-mono text-zinc-200 tabular-nums">
                    {activeRun.summary.toolCalls}
                  </dd>
                </div>
                <div className="py-2 flex items-center justify-between gap-2">
                  <dt className="text-zinc-400">Tool Errors</dt>
                  <dd
                    className={`font-mono tabular-nums ${
                      activeRun.summary.toolErrors > 0
                        ? "text-red-400"
                        : "text-zinc-200"
                    }`}
                  >
                    {activeRun.summary.toolErrors}
                  </dd>
                </div>
                <div className="py-2 flex items-center justify-between gap-2">
                  <dt className="text-zinc-400">Dialogue Exchanges</dt>
                  <dd className="font-mono text-zinc-200 tabular-nums">
                    {activeRun.summary.dialogueTurns}
                  </dd>
                </div>
                <div className="py-2 flex items-center justify-between gap-2">
                  <dt className="text-zinc-400">Noise Words Injected</dt>
                  <dd
                    className={`font-mono tabular-nums ${
                      activeRun.summary.noiseWordsInjected > 0
                        ? "text-amber-400"
                        : "text-zinc-200"
                    }`}
                  >
                    {activeRun.summary.noiseWordsInjected}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
