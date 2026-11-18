"use client";

import { useState } from "react";

export default function MysteryDashboard() {
  const [logs, setLogs] = useState<{ actor: string; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [promptVer, setPromptVer] = useState("v1");

  const runGame = async () => {
    setLoading(true);
    setLogs([]);
    try {
     const res = await fetch("http://127.0.0.1:8000/api/play",  {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game_id: `game_${Date.now()}`,
          player_id: "player_tester",
          prompt_version: promptVer,
        }),
      });
      const data = await res.json();
      setLogs(data.logs);
    } catch (error) {
      console.error(error);
      setLogs([{ actor: "System", text: "Failed to connect to backend." }]);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8 flex gap-8 font-mono">
      <div className="w-2/3 flex flex-col bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-blue-400 mb-4">Interrogation Log</h2>
        
        <div className="flex-1 overflow-y-auto space-y-4 mb-6 p-4 bg-black rounded border border-gray-800 h-[600px]">
          {logs.length === 0 && !loading && <p className="text-gray-600">Awaiting interrogation start...</p>}
          {loading && <p className="text-yellow-500 animate-pulse">Running agent loop. Awaiting Morse trace...</p>}
          
          {logs.map((log, i) => (
            <div key={i} className={`p-3 rounded ${
              log.actor === "Detective" ? "bg-blue-900/30 text-blue-200 border border-blue-900/50" :
              log.actor === "Suspect" ? "bg-red-900/30 text-red-200 border border-red-900/50" :
              "bg-gray-800 text-gray-400 border border-gray-700 text-sm"
            }`}>
              <strong className="block mb-1">{log.actor}</strong>
              {log.text}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <select 
            className="bg-gray-800 border border-gray-700 rounded p-2 text-white"
            value={promptVer} 
            onChange={(e) => setPromptVer(e.target.value)}
          >
            <option value="v1">Prompt v1 (Chatty Detective)</option>
            <option value="v2">Prompt v2 (Optimized Detective)</option>
          </select>
          <button 
            onClick={runGame} 
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded disabled:opacity-50"
          >
            {loading ? "Simulating..." : "Run Test Case"}
          </button>
        </div>
      </div>

      <div className="w-1/3 flex flex-col gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-green-400 mb-2">Morse Telemetry</h2>
          <p className="text-sm text-gray-400 mb-4">
            Every run automatically ships a nested trace to your Morse dashboard, calculating Cost Per Successful Outcome.
          </p>
          <a 
            href="https://app.morsehq.dev" 
            target="_blank" 
            rel="noopener noreferrer"
            className="block text-center bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded py-3 text-white transition"
          >
            View Traces in Morse Dashboard ↗
          </a>
        </div>
        
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="font-bold text-gray-300 mb-2">Beta Testing Targets:</h3>
          <ul className="list-disc pl-5 text-sm text-gray-400 space-y-2">
            <li>Verify <strong>Context Bloat</strong> catches the 120-line noise injection in coffee_station.</li>
            <li>Ensure the <strong>CCTV 503 Error</strong> is correctly typed as a tool failure.</li>
            <li>Confirm <strong>v2 prompt</strong> lowers your CPSO in the weekly brief.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}