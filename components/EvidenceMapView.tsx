"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, Check, Search } from "lucide-react";
import {
  ROOM_DIRECTORY,
  searchRoom,
  type GameRunResult,
  type RoomId,
} from "@/lib/mysteryEngine";

interface EvidenceMapViewProps {
  activeRun: GameRunResult | null;
}

export function EvidenceMapView({ activeRun }: EvidenceMapViewProps) {
  const [selectedRoom, setSelectedRoom] = useState<RoomId>("server_room");

  const roomMeta =
    ROOM_DIRECTORY.find((r) => r.id === selectedRoom) ?? ROOM_DIRECTORY[0];
  const rawClue = searchRoom(selectedRoom);
  const visitStatus = activeRun?.summary.roomsVisited[selectedRoom] ?? "unvisited";
  const noiseCount = (rawClue.match(/NOISE /g) ?? []).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Route Sequence */}
      <section className="border border-zinc-800/80 rounded-lg bg-[#14171C] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-zinc-100">
              Lab Sector 4 · Evidence Map
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Select any facility room to inspect its forensic payload, noise
              footprint, and status in the active run.
            </p>
          </div>
          {activeRun && activeRun.summary.roomSequence.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-zinc-300">
              <span className="text-zinc-500">Path:</span>
              {activeRun.summary.roomSequence.map((roomId, idx) => (
                <span key={`${roomId}_${idx}`} className="inline-flex items-center gap-2">
                  <span
                    className={
                      activeRun.summary.roomsVisited[roomId] === "error"
                        ? "text-red-400"
                        : "text-amber-400"
                    }
                  >
                    {roomId}
                  </span>
                  {idx < activeRun.summary.roomSequence.length - 1 && (
                    <ArrowRight
                      className="w-3.5 h-3.5 text-zinc-600"
                      aria-hidden="true"
                    />
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Interactive Blueprint Grid + Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {ROOM_DIRECTORY.map((room, index) => {
            const status =
              activeRun?.summary.roomsVisited[room.id] ?? "unvisited";
            const isSelected = selectedRoom === room.id;
            const stepOrder = activeRun
              ? activeRun.summary.roomSequence.indexOf(room.id) + 1
              : 0;

            return (
              <button
                key={room.id}
                type="button"
                onClick={() => setSelectedRoom(room.id)}
                className={`text-left p-5 rounded-lg border transition-colors flex flex-col justify-between min-h-[210px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                  isSelected
                    ? "bg-[#191D24] border-amber-500/70"
                    : "bg-[#14171C] border-zinc-800/80 hover:border-zinc-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs font-mono text-zinc-500">
                    <span className="tabular-nums">
                      0{index + 1}
                      {stepOrder > 0 && (
                        <span className="text-amber-400"> · Step {stepOrder}</span>
                      )}
                    </span>
                    <span
                      className={
                        status === "error"
                          ? "text-red-400"
                          : status === "searched"
                            ? "text-emerald-400"
                            : "text-zinc-500"
                      }
                    >
                      {status === "error"
                        ? "503 Error"
                        : status === "searched"
                          ? "Searched"
                          : "Unvisited"}
                    </span>
                  </div>

                  <h3 className="mt-3 font-display text-lg font-semibold text-zinc-100">
                    {room.label}
                  </h3>
                  <p className="mt-1 font-mono text-[11px] text-zinc-500">
                    {room.wing}
                  </p>
                  <p className="mt-3 text-xs text-zinc-400 leading-relaxed">
                    {room.summary}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-800/80 text-xs">
                  <span className="font-mono text-zinc-400">
                    {room.evidenceType}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Room Forensic Dossier */}
        <section
          aria-label="Selected room evidence dossier"
          className="xl:col-span-5 border border-zinc-800/80 rounded-lg bg-[#14171C] p-5"
        >
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-zinc-800/80">
            <div>
              <p className="font-mono text-xs text-zinc-500">{roomMeta.wing}</p>
              <h3 className="mt-1 font-display text-xl font-semibold text-zinc-100">
                {roomMeta.label}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-mono pt-1">
              {visitStatus === "error" ? (
                <>
                  <AlertTriangle
                    className="w-3.5 h-3.5 text-red-400"
                    aria-hidden="true"
                  />
                  <span className="text-red-400">Error 503</span>
                </>
              ) : visitStatus === "searched" ? (
                <>
                  <Check
                    className="w-3.5 h-3.5 text-emerald-400"
                    aria-hidden="true"
                  />
                  <span className="text-emerald-400">Searched</span>
                </>
              ) : (
                <>
                  <Search
                    className="w-3.5 h-3.5 text-zinc-500"
                    aria-hidden="true"
                  />
                  <span className="text-zinc-500">Unvisited</span>
                </>
              )}
            </div>
          </div>

          <dl className="mt-4 divide-y divide-zinc-800/80 text-xs">
            <div className="py-2 flex items-center justify-between gap-2">
              <dt className="text-zinc-400">Tool Identifier</dt>
              <dd className="font-mono text-zinc-200">
                search_room(&quot;{roomMeta.id}&quot;)
              </dd>
            </div>
            <div className="py-2 flex items-center justify-between gap-2">
              <dt className="text-zinc-400">Payload Size</dt>
              <dd className="font-mono text-zinc-200 tabular-nums">
                {rawClue.length} chars
              </dd>
            </div>
            <div className="py-2 flex items-center justify-between gap-2">
              <dt className="text-zinc-400">Noise Injection</dt>
              <dd
                className={`font-mono tabular-nums ${
                  noiseCount > 0 ? "text-amber-400" : "text-zinc-200"
                }`}
              >
                {noiseCount > 0 ? `${noiseCount}× NOISE tokens` : "None"}
              </dd>
            </div>
          </dl>

          <div className="mt-4">
            <p className="text-xs font-medium text-zinc-300 mb-2">
              Raw Tool Return Payload
            </p>
            <pre
              className={`p-3.5 rounded-md border font-mono text-xs leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap break-words ${
                rawClue.startsWith("TOOL_ERROR:")
                  ? "bg-red-950/30 border-red-900/60 text-red-300"
                  : "bg-[#0D0F12] border-zinc-800 text-zinc-300"
              }`}
            >
              {rawClue}
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
}
