import test from "node:test";
import assert from "node:assert/strict";
import {
  searchRoom,
  evaluateAccusation,
  playMysteryGame,
  simulatedProvider,
} from "./mysteryEngine";

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
