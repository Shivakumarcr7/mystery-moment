"use client";

import { Play } from "lucide-react";
import {
  getDetectiveSystemPrompt,
  type GameRunResult,
} from "@/lib/mysteryEngine";

interface PromptCompareViewProps {
  latestV1Run: GameRunResult | null;
  latestV2Run: GameRunResult | null;
  loading: boolean;
  onRunBoth: () => void;
}

export function PromptCompareView({
  latestV1Run,
  latestV2Run,
  loading,
  onRunBoth,
}: PromptCompareViewProps) {
  const turnSavings =
    latestV1Run && latestV2Run
      ? latestV1Run.summary.totalTurns - latestV2Run.summary.totalTurns
      : null;

  const tokenSavings =
    latestV1Run && latestV2Run
      ? latestV1Run.summary.estimatedTokens - latestV2Run.summary.estimatedTokens
      : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Compare Action */}
      <section className="border border-zinc-800/80 rounded-lg bg-[#14171C] p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-zinc-100">
            Prompt v1 vs. Prompt v2 Benchmark
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Compare system instructions and real execution footprints side by
            side.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={onRunBoth}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <Play className="w-4 h-4" aria-hidden="true" />
          <span>{loading ? "Running Benchmark..." : "Run v1 & v2 Comparison"}</span>
        </button>
      </section>

      {/* Quantitative Comparison Table */}
      <section
        aria-label="Prompt benchmark metrics table"
        className="border border-zinc-800/80 rounded-lg bg-[#14171C] overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800/80 text-xs text-zinc-400 bg-[#12151A]">
                <th className="py-3 px-5 font-medium">Metric</th>
                <th className="py-3 px-5 font-medium text-right">
                  Prompt v1 (Chatty)
                </th>
                <th className="py-3 px-5 font-medium text-right">
                  Prompt v2 (Optimized)
                </th>
                <th className="py-3 px-5 font-medium text-right">Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 text-sm">
              <tr className="hover:bg-zinc-800/20">
                <td className="py-3 px-5 text-zinc-200">Case Outcome</td>
                <td
                  className={`py-3 px-5 text-right font-mono text-xs ${
                    !latestV1Run
                      ? "text-zinc-500"
                      : latestV1Run.summary.solved
                        ? "text-emerald-400"
                        : "text-red-400"
                  }`}
                >
                  {latestV1Run
                    ? latestV1Run.summary.solved
                      ? "Solved"
                      : "Unsolved"
                    : "Not run"}
                </td>
                <td
                  className={`py-3 px-5 text-right font-mono text-xs ${
                    !latestV2Run
                      ? "text-zinc-500"
                      : latestV2Run.summary.solved
                        ? "text-emerald-400"
                        : "text-red-400"
                  }`}
                >
                  {latestV2Run
                    ? latestV2Run.summary.solved
                      ? "Solved"
                      : "Unsolved"
                    : "Not run"}
                </td>
                <td
                  className={`py-3 px-5 text-right font-mono text-xs ${
                    latestV1Run &&
                    latestV2Run &&
                    latestV2Run.summary.solved &&
                    !latestV1Run.summary.solved
                      ? "text-emerald-400"
                      : "text-zinc-400"
                  }`}
                >
                  {!latestV1Run || !latestV2Run
                    ? "—"
                    : latestV2Run.summary.solved && !latestV1Run.summary.solved
                      ? "v2 solved"
                      : latestV1Run.summary.solved && !latestV2Run.summary.solved
                        ? "v1 solved"
                        : latestV1Run.summary.solved
                          ? "Both solved"
                          : "Both failed"}
                </td>
              </tr>

              <tr className="hover:bg-zinc-800/20">
                <td className="py-3 px-5 text-zinc-200">Total Turns</td>
                <td className="py-3 px-5 text-right font-mono tabular-nums text-zinc-300">
                  {latestV1Run ? latestV1Run.summary.totalTurns : "—"}
                </td>
                <td className="py-3 px-5 text-right font-mono tabular-nums text-zinc-100">
                  {latestV2Run ? latestV2Run.summary.totalTurns : "—"}
                </td>
                <td className="py-3 px-5 text-right font-mono tabular-nums text-emerald-400">
                  {turnSavings !== null
                    ? turnSavings > 0
                      ? `-${turnSavings} turns`
                      : `${turnSavings} turns`
                    : "—"}
                </td>
              </tr>

              <tr className="hover:bg-zinc-800/20">
                <td className="py-3 px-5 text-zinc-200">Tool Calls</td>
                <td className="py-3 px-5 text-right font-mono tabular-nums text-zinc-300">
                  {latestV1Run ? latestV1Run.summary.toolCalls : "—"}
                </td>
                <td className="py-3 px-5 text-right font-mono tabular-nums text-zinc-100">
                  {latestV2Run ? latestV2Run.summary.toolCalls : "—"}
                </td>
                <td className="py-3 px-5 text-right font-mono tabular-nums text-zinc-400">
                  {latestV1Run && latestV2Run
                    ? `${latestV2Run.summary.toolCalls - latestV1Run.summary.toolCalls} calls`
                    : "—"}
                </td>
              </tr>

              <tr className="hover:bg-zinc-800/20">
                <td className="py-3 px-5 text-zinc-200">Tool Errors (503)</td>
                <td
                  className={`py-3 px-5 text-right font-mono tabular-nums ${
                    latestV1Run && latestV1Run.summary.toolErrors > 0
                      ? "text-red-400"
                      : "text-zinc-300"
                  }`}
                >
                  {latestV1Run ? latestV1Run.summary.toolErrors : "—"}
                </td>
                <td className="py-3 px-5 text-right font-mono tabular-nums text-emerald-400">
                  {latestV2Run ? latestV2Run.summary.toolErrors : "—"}
                </td>
                <td className="py-3 px-5 text-right font-mono tabular-nums text-emerald-400">
                  {latestV1Run && latestV2Run
                    ? `${latestV2Run.summary.toolErrors - latestV1Run.summary.toolErrors} err`
                    : "—"}
                </td>
              </tr>

              <tr className="hover:bg-zinc-800/20">
                <td className="py-3 px-5 text-zinc-200">
                  Estimated Context Footprint
                </td>
                <td className="py-3 px-5 text-right font-mono tabular-nums text-zinc-300">
                  {latestV1Run ? `${latestV1Run.summary.estimatedTokens} tok` : "—"}
                </td>
                <td className="py-3 px-5 text-right font-mono tabular-nums text-zinc-100">
                  {latestV2Run ? `${latestV2Run.summary.estimatedTokens} tok` : "—"}
                </td>
                <td className="py-3 px-5 text-right font-mono tabular-nums text-zinc-300">
                  {tokenSavings !== null
                    ? tokenSavings > 0
                      ? `-${tokenSavings} tok`
                      : `+${Math.abs(tokenSavings)} tok`
                    : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Side-by-Side System Prompt Diff */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <section className="border border-zinc-800/80 rounded-lg bg-[#14171C] p-5 flex flex-col">
          <div className="flex items-baseline justify-between gap-2 pb-3 border-b border-zinc-800/80">
            <h3 className="font-display text-base font-semibold text-zinc-100">
              Prompt v1 · Chatty Detective
            </h3>
            <span className="font-mono text-xs text-zinc-500">Baseline</span>
          </div>
          <pre className="mt-4 flex-1 p-4 rounded-md bg-[#0D0F12] border border-zinc-800 font-mono text-xs leading-relaxed text-zinc-300 whitespace-pre-wrap break-words">
            {getDetectiveSystemPrompt("v1")}
          </pre>
        </section>

        <section className="border border-zinc-800/80 rounded-lg bg-[#14171C] p-5 flex flex-col">
          <div className="flex items-baseline justify-between gap-2 pb-3 border-b border-zinc-800/80">
            <h3 className="font-display text-base font-semibold text-zinc-100">
              Prompt v2 · Optimized Detective
            </h3>
            <span className="font-mono text-xs text-emerald-400">
              Deterministic Sequence
            </span>
          </div>
          <pre className="mt-4 flex-1 p-4 rounded-md bg-[#0D0F12] border border-zinc-800 font-mono text-xs leading-relaxed text-zinc-300 whitespace-pre-wrap break-words">
            {getDetectiveSystemPrompt("v2")}
          </pre>
        </section>
      </div>
    </div>
  );
}
