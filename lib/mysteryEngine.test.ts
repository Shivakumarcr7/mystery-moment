import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GROQ_MODEL,
  DETECTIVE_TOOLS,
  searchRoom,
  evaluateAccusation,
  playMysteryGame,
  playMysteryGameDetailed,
  resolveGroqModel,
  simulatedProvider,
} from "./mysteryEngine";

test("DETECTIVE_TOOLS defines explicit descriptions for required parameters", () => {
  const searchTool = DETECTIVE_TOOLS.find((t) => t.function.name === "search_room");
  const accuseTool = DETECTIVE_TOOLS.find((t) => t.function.name === "submit_accusation");
  assert.ok(searchTool?.function.parameters.properties.room?.description);
  assert.ok(accuseTool?.function.parameters.properties.culprit?.description);
  assert.ok(accuseTool?.function.parameters.properties.motive?.description);
});

test("resolveGroqModel rejects malformed API keys and falls back to default model", () => {
  assert.equal(resolveGroqModel("mhq_prod_12345"), DEFAULT_GROQ_MODEL);
  assert.equal(resolveGroqModel("gsk_secret_key"), DEFAULT_GROQ_MODEL);
  assert.equal(resolveGroqModel(""), DEFAULT_GROQ_MODEL);
  assert.equal(resolveGroqModel("llama-3.3-70b-versatile"), "llama-3.3-70b-versatile");
});

test("searchRoom returns expected clues and tool error for cctv_archive", () => {
  const serverClue = searchRoom("server_room");
  assert.match(serverClue, /Dr\. Aris entered at 02:14 AM/);

  const coffeeClue = searchRoom("coffee_station");
  assert.match(coffeeClue, /Vortex Robotics/);
  assert.equal((coffeeClue.match(/NOISE /g) ?? []).length, 120);

  assert.equal(searchRoom("cctv_archive"), "TOOL_ERROR: 503 Server Offline");
  assert.equal(searchRoom("unknown_room"), "Room not found.");
});

test("evaluateAccusation validates culprit and motive", () => {
  assert.equal(
    evaluateAccusation("Dr. Aris", "corporate espionage involving Vortex Robotics"),
    true
  );
  assert.equal(evaluateAccusation("Dr. Aris", "Vortex payout"), true);
  assert.equal(evaluateAccusation("Dr. Aris", "jealousy"), false);
  assert.equal(evaluateAccusation("Someone Else", "espionage"), false);
});

test("playMysteryGame v1 exercises interrogation, CCTV 503 error, coffee_station noise, and solves case", async () => {
  const logs = await playMysteryGame("game_v1", "player_1", "v1", simulatedProvider);

  assert.ok(logs.some((l) => l.actor === "Detective"));
  assert.ok(logs.some((l) => l.actor === "Suspect"));
  assert.ok(
    logs.some(
      (l) =>
        l.actor === "System" &&
        l.text.includes("[Tool Error] cctv_archive: TOOL_ERROR: 503 Server Offline")
    )
  );
  assert.ok(
    logs.some(
      (l) =>
        l.actor === "System" && l.text.includes("[Tool] Searched coffee_station:")
    )
  );
  assert.ok(logs[logs.length - 1]?.text.includes("Solved: True"));
});

test("playMysteryGame v2 runs optimized 3-step sequence without unnecessary questioning", async () => {
  const logs = await playMysteryGame("game_v2", "player_1", "v2", simulatedProvider);

  assert.equal(logs.length, 3);
  assert.equal(logs.some((l) => l.actor === "Detective"), false);
  assert.equal(logs.some((l) => l.actor === "Suspect"), false);
  assert.ok(logs[0]?.text.includes("Searched server_room"));
  assert.ok(logs[1]?.text.includes("Searched coffee_station"));
  assert.ok(logs[2]?.text.includes("Solved: True"));
});

test("playMysteryGameDetailed tracks telemetry, room visits, and v2 efficiency vs v1", async () => {
  const v1 = await playMysteryGameDetailed("game_v1_detail", "player_1", "v1", simulatedProvider);
  const v2 = await playMysteryGameDetailed("game_v2_detail", "player_1", "v2", simulatedProvider);

  assert.equal(v1.summary.solved, true);
  assert.equal(v1.summary.hasCctvError, true);
  assert.equal(v1.summary.hasContextBloat, true);
  assert.equal(v1.summary.noiseWordsInjected, 120);
  assert.equal(v1.summary.roomsVisited.cctv_archive, "error");
  assert.equal(v1.summary.roomsVisited.server_room, "searched");
  assert.equal(v1.summary.roomsVisited.coffee_station, "searched");
  assert.equal(v1.summary.toolErrors, 1);

  assert.equal(v2.summary.solved, true);
  assert.equal(v2.summary.hasCctvError, false);
  assert.equal(v2.summary.roomsVisited.cctv_archive, "unvisited");
  assert.equal(v2.summary.toolErrors, 0);
  assert.ok(v2.summary.totalTurns < v1.summary.totalTurns);
  assert.ok(v2.summary.toolCalls < v1.summary.toolCalls);
});
