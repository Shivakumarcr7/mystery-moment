import { NextResponse } from "next/server";
import { playMysteryGame, type GameRequest } from "@/lib/mysteryEngine";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<GameRequest>;
    const gameId =
      typeof body.game_id === "string" && body.game_id.trim()
        ? body.game_id
        : `game_${Date.now()}`;
    const playerId =
      typeof body.player_id === "string" && body.player_id.trim()
        ? body.player_id
        : "player_tester";
    const promptVersion =
      body.prompt_version === "v2" ? "v2" : "v1";

    const logs = await playMysteryGame(gameId, playerId, promptVersion);

    return NextResponse.json({
      status: "complete",
      logs,
    });
  } catch (exc) {
    const err = exc instanceof Error ? exc : new Error(String(exc));
    return NextResponse.json(
      {
        detail: `Groq agent execution failed: ${err.name}: ${err.message}`,
      },
      { status: 502 }
    );
  }
}
