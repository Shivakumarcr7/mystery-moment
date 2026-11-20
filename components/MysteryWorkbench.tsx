"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import type { GameRunResult } from "@/lib/mysteryEngine";
import { CaseSidebar } from "@/components/CaseSidebar";
import { InterrogationView } from "@/components/InterrogationView";
import { EvidenceMapView } from "@/components/EvidenceMapView";
import { PromptCompareView } from "@/components/PromptCompareView";

type WorkspaceTab = "interrogation" | "evidence" | "compare";

export function MysteryWorkbench() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("interrogation");
  const [promptVersion, setPromptVersion] = useState<"v1" | "v2">("v1");
  const [runs, setRuns] = useState<GameRunResult[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const executeRun = async (version: "v1" | "v2"): Promise<GameRunResult | null> => {
    const res = await fetch("/api/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game_id: `game_${version}_${Date.now()}`,
        player_id: "player_tester",
        prompt_version: version,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data?.trace) {
      throw new Error(data?.detail || "Backend returned an invalid trace.");
    }

    return data.trace as GameRunResult;
  };

  const handleRunTestCase = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const trace = await executeRun(promptVersion);
      if (trace) {
        setRuns((prev) => [trace, ...prev]);
        setActiveRunId(trace.gameId);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to connect to backend."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRunBoth = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const v1Trace = await executeRun("v1");
      const v2Trace = await executeRun("v2");
      const added: GameRunResult[] = [];
      if (v2Trace) added.push(v2Trace);
      if (v1Trace) added.push(v1Trace);
      if (added.length > 0) {
        setRuns((prev) => [...added, ...prev]);
        setActiveRunId(added[0].gameId);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to run comparison."
      );
    } finally {
      setLoading(false);
    }
  };

  const activeRun =
    runs.find((r) => r.gameId === activeRunId) ?? runs[0] ?? null;
  const latestV1Run = runs.find((r) => r.promptVersion === "v1") ?? null;
  const latestV2Run = runs.find((r) => r.promptVersion === "v2") ?? null;

  return (
    <div className="min-h-screen bg-[#0D0F12] text-[#F3F4F6] flex flex-col">
      {/* Strict 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-30 h-14 px-5 lg:px-6 border-b border-zinc-800/80 bg-[#0D0F12]/95 backdrop-blur-sm flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Single text wordmark */}
        <a
          href="#interrogation"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab("interrogation");
          }}
          className="font-display text-lg font-semibold tracking-tight text-zinc-100 whitespace-nowrap shrink-0"
        >
          Morse Mystery
        </a>

        {/* Zone 2: Clean single-line navigation links (desktop/tablet) */}
        <nav
          aria-label="Workspace sections"
          className="hidden md:flex items-center gap-7"
        >
          {(
            [
              { id: "interrogation", label: "Interrogation" },
              { id: "evidence", label: "Evidence Map" },
              { id: "compare", label: "Prompt Diff" },
            ] as const
          ).map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`relative py-4 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded ${
                  isActive
                    ? "text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute left-0 right-0 bottom-0 h-[2px] bg-amber-500" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={handleRunTestCase}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <Play className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{loading ? "Simulating..." : "Run Test Case"}</span>
          </button>
        </div>
      </header>

      {/* Mobile workspace tabs (non-sticky so sticky height stays well under 15%) */}
      <nav
        aria-label="Mobile workspace sections"
        className="flex md:hidden items-center justify-around border-b border-zinc-800/80 bg-[#12151A] px-3"
      >
        {(
          [
            { id: "interrogation", label: "Interrogation" },
            { id: "evidence", label: "Evidence Map" },
            { id: "compare", label: "Prompt Diff" },
          ] as const
        ).map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`relative py-3 px-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                isActive ? "text-zinc-100" : "text-zinc-400"
              }`}
            >
              {item.label}
              {isActive && (
                <span className="absolute left-0 right-0 bottom-0 h-[2px] bg-amber-500" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Workspace Body: Sidebar + Main Viewport */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <CaseSidebar
          promptVersion={promptVersion}
          onSelectPromptVersion={setPromptVersion}
          runs={runs}
          activeRunId={activeRun?.gameId ?? null}
          onSelectRun={(gameId) => {
            setActiveRunId(gameId);
            setActiveTab("interrogation");
          }}
          loading={loading}
        />

        <main className="flex-1 min-w-0 p-5 lg:p-8 max-w-[1280px]">
          {activeTab === "interrogation" && (
            <InterrogationView
              activeRun={activeRun}
              latestV1Run={latestV1Run}
              latestV2Run={latestV2Run}
              loading={loading}
              errorMessage={errorMessage}
              promptVersion={promptVersion}
              onRunTestCase={handleRunTestCase}
            />
          )}

          {activeTab === "evidence" && (
            <EvidenceMapView activeRun={activeRun} />
          )}

          {activeTab === "compare" && (
            <PromptCompareView
              latestV1Run={latestV1Run}
              latestV2Run={latestV2Run}
              loading={loading}
              onRunBoth={handleRunBoth}
            />
          )}
        </main>
      </div>
    </div>
  );
}
