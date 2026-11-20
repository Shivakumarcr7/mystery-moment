"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp } from "lucide-react";
import evidenceDeskImg from "@/src/assets/images/case_evidence_desk_1795106984097.jpg";
import {
  getDetectiveSystemPrompt,
  type GameRunResult,
} from "@/lib/mysteryEngine";

interface CaseSidebarProps {
  promptVersion: "v1" | "v2";
  onSelectPromptVersion: (version: "v1" | "v2") => void;
  runs: GameRunResult[];
  activeRunId: string | null;
  onSelectRun: (gameId: string) => void;
  loading: boolean;
}

export function CaseSidebar({
  promptVersion,
  onSelectPromptVersion,
  runs,
  activeRunId,
  onSelectRun,
  loading,
}: CaseSidebarProps) {
  const [showPromptText, setShowPromptText] = useState(false);

  return (
    <aside className="w-full lg:w-[280px] shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-800/80 bg-[#12151A] flex flex-col">
      {/* Case File Visual Header */}
      <div className="p-5 border-b border-zinc-800/80">
        <div className="relative aspect-video w-full overflow-hidden rounded-md bg-zinc-900 border border-zinc-800/80 mb-4">
          <Image
            src={evidenceDeskImg}
            alt="Forensic evidence tray showing an empty prototype microchip cutout beside a lab access keycard and coffee receipt"
            fill
            sizes="240px"
            className="object-cover"
            referrerPolicy="no-referrer"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D0F12]/90 via-[#0D0F12]/25 to-transparent" />
          <div className="absolute bottom-2.5 left-3 right-3">
            <p className="font-mono text-[11px] text-amber-400/90 tabular-nums">
              Case 04 · Lab Sector R&amp;D 14
            </p>
          </div>
        </div>

        <h1 className="font-display text-lg font-semibold text-zinc-100 leading-snug text-balance">
          The Missing Prototype Chip
        </h1>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
          Detective Vance interrogates Dr. Aris and inspects three facility
          nodes to isolate the thief within five turns.
        </p>
      </div>

      {/* Prompt Strategy Selection */}
      <div className="p-5 border-b border-zinc-800/80">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-zinc-300 tracking-wide">
            Prompt Strategy
          </h2>
          <button
            type="button"
            onClick={() => setShowPromptText((prev) => !prev)}
            aria-expanded={showPromptText}
            className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
          >
            <span>{showPromptText ? "Hide" : "Inspect"}</span>
            {showPromptText ? (
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>
        </div>

        <div
          role="radiogroup"
          aria-label="Prompt version"
          className="grid grid-cols-1 gap-2"
        >
          <button
            type="button"
            role="radio"
            aria-checked={promptVersion === "v1"}
            disabled={loading}
            onClick={() => onSelectPromptVersion("v1")}
            className={`text-left px-3 py-2.5 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-50 ${
              promptVersion === "v1"
                ? "bg-amber-500/10 border-amber-500/60 text-zinc-100"
                : "bg-transparent border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium whitespace-nowrap">
                Prompt v1
              </span>
              <span className="font-mono text-[11px] text-zinc-400">
                Chatty
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-400 leading-snug">
              Open-ended questioning; hits offline CCTV and full room noise.
            </p>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={promptVersion === "v2"}
            disabled={loading}
            onClick={() => onSelectPromptVersion("v2")}
            className={`text-left px-3 py-2.5 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-50 ${
              promptVersion === "v2"
                ? "bg-amber-500/10 border-amber-500/60 text-zinc-100"
                : "bg-transparent border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium whitespace-nowrap">
                Prompt v2
              </span>
              <span className="font-mono text-[11px] text-emerald-400/90">
                Optimized
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-400 leading-snug">
              Direct two-room sequence skipping dead services and banter.
            </p>
          </button>
        </div>

        {showPromptText && (
          <div className="mt-3 p-3 rounded-md bg-[#0D0F12] border border-zinc-800/80">
            <p className="text-[11px] text-zinc-500 mb-1.5 font-mono">
              System instructions · {promptVersion}
            </p>
            <pre className="font-mono text-[11px] leading-relaxed text-zinc-300 whitespace-pre-wrap break-words">
              {getDetectiveSystemPrompt(promptVersion)}
            </pre>
          </div>
        )}
      </div>

      {/* Run History */}
      <div className="p-5 flex-1 flex flex-col min-h-0">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-xs font-semibold text-zinc-300 tracking-wide">
            Session Runs
          </h2>
          <span className="font-mono text-xs text-zinc-500 tabular-nums">
            {runs.length}
          </span>
        </div>

        {runs.length === 0 ? (
          <p className="text-xs text-zinc-500 leading-relaxed">
            Completed interrogations will appear here so you can switch between
            v1 and v2 traces.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800/80 overflow-y-auto -mx-2 px-2">
            {runs.map((run, index) => {
              const isSelected = run.gameId === activeRunId;
              const runNumber = runs.length - index;
              return (
                <li key={run.gameId} className="py-1.5">
                  <button
                    type="button"
                    onClick={() => onSelectRun(run.gameId)}
                    className={`w-full text-left px-2.5 py-2 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                      isSelected
                        ? "bg-zinc-800/80 text-zinc-100"
                        : "hover:bg-zinc-800/40 text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium truncate">
                        Run #{runNumber} · {run.promptVersion}
                      </span>
                      <span
                        className={`font-mono text-[11px] whitespace-nowrap ${
                          run.summary.solved
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}
                      >
                        {run.summary.solved ? "Solved" : "Unsolved"}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-zinc-500 tabular-nums">
                      <span>{run.summary.totalTurns} turns</span>
                      <span aria-hidden="true">·</span>
                      <span>{run.summary.estimatedTokens} tok</span>
                      {run.summary.toolErrors > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-red-400/90">
                            {run.summary.toolErrors} err
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
