export interface GameLogEntry {
  actor: "Detective" | "Suspect" | "System";
  text: string;
  id?: string;
  turn?: number;
  kind?: "dialogue" | "tool_success" | "tool_error" | "accusation" | "timeout";
  room?: string;
  rawPayload?: string;
  tokenEstimate?: number;
}

export type RoomId = "server_room" | "coffee_station" | "cctv_archive";
export type RoomVisitStatus = "unvisited" | "searched" | "error";

export interface GameTraceSummary {
  solved: boolean;
  outcome: "case_solved" | "wrong_accusation" | "suspect_escaped";
  totalTurns: number;
  toolCalls: number;
  toolErrors: number;
  dialogueTurns: number;
  estimatedTokens: number;
  noiseWordsInjected: number;
  roomsVisited: Record<RoomId, RoomVisitStatus>;
  roomSequence: RoomId[];
  hasContextBloat: boolean;
  hasCctvError: boolean;
  culpritAccused: string | null;
  motiveCited: string | null;
}

export interface GameRunResult {
  gameId: string;
  playerId: string;
  promptVersion: "v1" | "v2";
  provider: "Groq" | "Simulated";
  timestamp: string;
  morseTraceId?: string | null;
  morseShipped?: boolean;
  logs: GameLogEntry[];
  summary: GameTraceSummary;
}

export interface ToolExecutionEvent {
  toolName: string;
  args: Record<string, unknown>;
  result: string;
  isError: boolean;
  room?: string;
}

export interface GameExecutionHooks {
  onToolExecution?: (event: ToolExecutionEvent) => void;
  providerLabel?: "Groq" | "Simulated";
}

export interface GameRequest {
  game_id: string;
  player_id: string;
  prompt_version?: string;
}

export interface ChatToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ChatToolCall[];
  tool_call_id?: string;
}

export interface CompletionMessage {
  content?: string | null;
  tool_calls?: ChatToolCall[];
}

export type CompletionProvider = (
  messages: ChatMessage[],
  useTools: boolean,
  turn: number,
  promptVersion: string
) => Promise<CompletionMessage>;

export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";

export const SECRET_CASE: { rooms: Record<string, string> } = {
  rooms: {
    server_room:
      "CLUE: Badge access log shows Dr. Aris entered at 02:14 AM.",
    coffee_station:
      "CLUE: Wire transfer of $50k from Vortex Robotics to Dr. Aris.\n" +
      "NOISE ".repeat(120),
    cctv_archive: "ERROR_503",
  },
};

export interface RoomMetadata {
  id: RoomId;
  label: string;
  wing: string;
  summary: string;
  evidenceType: string;
}

export const ROOM_DIRECTORY: RoomMetadata[] = [
  {
    id: "server_room",
    label: "Server Room",
    wing: "North Wing · R&D 14",
    summary: "Electronic badge reader logs and prototype vault terminal.",
    evidenceType: "Access Telemetry",
  },
  {
    id: "coffee_station",
    label: "Coffee Station",
    wing: "Central Atrium",
    summary: "Shared break counter with discarded receipts and noisy log clutter.",
    evidenceType: "Financial Trail + 120× Noise",
  },
  {
    id: "cctv_archive",
    label: "CCTV Archive",
    wing: "Security Sub-Level",
    summary: "Legacy camera storage node currently experiencing a 503 outage.",
    evidenceType: "Offline Service (503)",
  },
];

export const DETECTIVE_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_room",
      description:
        "Search a room for physical or digital evidence in the murder mystery.",
      parameters: {
        type: "object",
        properties: {
          room: {
            type: "string",
            description:
              "The room identifier to search: server_room, coffee_station, or cctv_archive.",
            enum: ["server_room", "coffee_station", "cctv_archive"],
          },
        },
        required: ["room"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "submit_accusation",
      description:
        "Submit your final accusation after investigating the available clues. Both culprit and motive strings are required.",
      parameters: {
        type: "object",
        properties: {
          culprit: {
            type: "string",
            description: "Full name of the accused suspect, e.g. Dr. Aris.",
          },
          motive: {
            type: "string",
            description:
              "Clear motive backed by evidence, e.g. corporate espionage involving Vortex Robotics.",
          },
        },
        required: ["culprit", "motive"],
        additionalProperties: false,
      },
    },
  },
];

export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

export function searchRoom(room: string): string {
  const clue = SECRET_CASE.rooms[room.toLowerCase()] ?? "Room not found.";

  if (clue === "ERROR_503") {
    return "TOOL_ERROR: 503 Server Offline";
  }

  return clue;
}

export function submitAccusation(culprit: string, motive: string): string {
  return `Accused ${culprit} for ${motive}`;
}

export function evaluateAccusation(culprit: string, motive: string): boolean {
  const accusedLower = culprit.toLowerCase();
  const motiveLower = motive.toLowerCase();
  return (
    accusedLower.includes("aris") &&
    (motiveLower.includes("espionage") || motiveLower.includes("vortex"))
  );
}

export function getDetectiveSystemPrompt(promptVersion: string): string {
  if (promptVersion === "v2") {
    return `You are Detective Vance.

You are conducting an optimized investigation.

Follow this exact sequence:

1. Call search_room with server_room.
2. Call search_room with coffee_station.
3. Analyze both clues.
4. Call submit_accusation with JSON arguments:
   {"culprit": "Dr. Aris", "motive": "corporate espionage involving Vortex Robotics"}.

Do not ask unnecessary questions.
Do not accuse before examining both clues.
Use the available function tools to complete the case.`;
  }

  return (
    "You are Detective Vance. " +
    "Question Dr. Aris and search rooms " +
    "to find the thief."
  );
}

export async function askGroq(
  messages: ChatMessage[],
  useTools: boolean,
  apiKey: string,
  model: string
): Promise<CompletionMessage> {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.7,
  };

  if (useTools) {
    body.tools = DETECTIVE_TOOLS;
    body.tool_choice = "auto";
    // GPT-OSS 20B does not support parallel tool calls.
    body.parallel_tool_calls = false;
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`Groq API error (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: CompletionMessage }>;
  };

  const message = data.choices?.[0]?.message;
  if (!message) {
    throw new Error("Groq returned an empty response.");
  }

  return message;
}

/**
 * Deterministic local fallback provider when GROQ_API_KEY is not configured.
 * Reproduces the v1 (chatty + CCTV 503 + coffee_station bloat) and v2 (optimized)
 * agent trajectories so the dashboard can be evaluated immediately without keys.
 */
export async function simulatedProvider(
  messages: ChatMessage[],
  useTools: boolean,
  turn: number,
  promptVersion: string
): Promise<CompletionMessage> {
  if (!useTools) {
    const lastQuestion = messages[messages.length - 1]?.content ?? "";
    if (lastQuestion.toLowerCase().includes("02:14")) {
      return {
        content:
          "I only stopped by the server room to check a routine backup, I know nothing about any missing chip.",
      };
    }
    return {
      content:
        "I have no idea what happened to the prototype AI chip and I was nowhere near it.",
    };
  }

  if (promptVersion === "v2") {
    if (turn === 1) {
      return {
        content: "",
        tool_calls: [
          {
            id: "call_v2_1",
            type: "function",
            function: {
              name: "search_room",
              arguments: JSON.stringify({ room: "server_room" }),
            },
          },
        ],
      };
    }
    if (turn === 2) {
      return {
        content: "",
        tool_calls: [
          {
            id: "call_v2_2",
            type: "function",
            function: {
              name: "search_room",
              arguments: JSON.stringify({ room: "coffee_station" }),
            },
          },
        ],
      };
    }
    return {
      content: "",
      tool_calls: [
        {
          id: "call_v2_3",
          type: "function",
          function: {
            name: "submit_accusation",
            arguments: JSON.stringify({
              culprit: "Dr. Aris",
              motive: "corporate espionage involving Vortex Robotics",
            }),
          },
        },
      ],
    };
  }

  switch (turn) {
    case 1:
      return {
        content:
          "Dr. Aris, the prototype AI chip vanished overnight. Where were you around 2 AM?",
      };
    case 2:
      return {
        content: "",
        tool_calls: [
          {
            id: "call_v1_2",
            type: "function",
            function: {
              name: "search_room",
              arguments: JSON.stringify({ room: "cctv_archive" }),
            },
          },
        ],
      };
    case 3:
      return {
        content: "",
        tool_calls: [
          {
            id: "call_v1_3",
            type: "function",
            function: {
              name: "search_room",
              arguments: JSON.stringify({ room: "server_room" }),
            },
          },
        ],
      };
    case 4:
      return {
        content: "",
        tool_calls: [
          {
            id: "call_v1_4",
            type: "function",
            function: {
              name: "search_room",
              arguments: JSON.stringify({ room: "coffee_station" }),
            },
          },
        ],
      };
    default:
      return {
        content: "",
        tool_calls: [
          {
            id: "call_v1_5",
            type: "function",
            function: {
              name: "submit_accusation",
              arguments: JSON.stringify({
                culprit: "Dr. Aris",
                motive:
                  "corporate espionage for Vortex Robotics ($50k wire transfer)",
              }),
            },
          },
        ],
      };
  }
}

function isKnownRoom(room: string): room is RoomId {
  return (
    room === "server_room" ||
    room === "coffee_station" ||
    room === "cctv_archive"
  );
}

export function resolveGroqModel(envModel?: string): string {
  const candidate = (envModel ?? "").trim();
  if (
    !candidate ||
    candidate.startsWith("mhq_") ||
    candidate.startsWith("gsk_") ||
    candidate.startsWith("sk-") ||
    candidate.length > 64
  ) {
    return DEFAULT_GROQ_MODEL;
  }
  return candidate;
}

export async function playMysteryGameDetailed(
  gameId: string,
  playerId: string,
  promptVersionInput: string = "v1",
  provider?: CompletionProvider,
  hooks?: GameExecutionHooks
): Promise<GameRunResult> {
  const promptVersion: "v1" | "v2" = promptVersionInput === "v2" ? "v2" : "v1";
  const gameLog: GameLogEntry[] = [];
  const apiKey = process.env.GROQ_API_KEY;
  const model = resolveGroqModel(process.env.GROQ_MODEL);
  let activeProviderLabel: "Groq" | "Simulated" =
    hooks?.providerLabel ?? (!provider && Boolean(apiKey) ? "Groq" : "Simulated");

  const complete: CompletionProvider =
    provider ??
    (apiKey
      ? async (messages, useTools, turn, version) => {
          try {
            return await askGroq(messages, useTools, apiKey, model);
          } catch {
            activeProviderLabel = "Simulated";
            return simulatedProvider(messages, useTools, turn, version);
          }
        }
      : simulatedProvider);

  const detectiveSys = getDetectiveSystemPrompt(promptVersion);

  const detectiveMessages: ChatMessage[] = [
    { role: "system", content: detectiveSys },
    {
      role: "user",
      content:
        "The prototype AI chip is missing! " +
        "Dr. Aris is in the interrogation room. " +
        "Begin your investigation.",
    },
  ];

  const suspectMessages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are Dr. Aris. Deny everything " +
        "unless confronted with evidence. " +
        "Keep replies to one sentence.",
    },
  ];

  const roomsVisited: Record<RoomId, RoomVisitStatus> = {
    server_room: "unvisited",
    coffee_station: "unvisited",
    cctv_archive: "unvisited",
  };
  const roomSequence: RoomId[] = [];

  let totalTurns = 0;
  let toolCallsCount = 0;
  let toolErrorsCount = 0;
  let dialogueTurns = 0;
  let estimatedTokens =
    estimateTokenCount(detectiveSys) +
    estimateTokenCount(detectiveMessages[1].content);
  let noiseWordsInjected = 0;
  let hasContextBloat = false;
  let hasCctvError = false;
  let stepCounter = 0;

  const nextId = () => {
    stepCounter += 1;
    return `${gameId}_step_${stepCounter}`;
  };

  for (let turn = 1; turn <= 5; turn++) {
    totalTurns = turn;

    const response = await complete(
      detectiveMessages,
      true,
      turn,
      promptVersion
    );

    const toolCalls = response.tool_calls ?? [];
    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: response.content || "",
    };

    if (toolCalls.length > 0) {
      assistantMessage.tool_calls = toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: {
          name: call.function.name,
          arguments: call.function.arguments,
        },
      }));
    }

    detectiveMessages.push(assistantMessage);
    estimatedTokens += estimateTokenCount(assistantMessage.content);

    if (toolCalls.length > 0) {
      for (const call of toolCalls) {
        toolCallsCount += 1;
        const toolName = call.function.name;
        let parsedArgs: Record<string, unknown>;

        try {
          const parsed = JSON.parse(call.function.arguments || "{}");
          if (
            typeof parsed !== "object" ||
            parsed === null ||
            Array.isArray(parsed)
          ) {
            throw new Error("Tool arguments must be a JSON object.");
          }
          parsedArgs = parsed as Record<string, unknown>;
        } catch (err) {
          toolErrorsCount += 1;
          const message = err instanceof Error ? err.message : String(err);
          const toolResult = `TOOL_ERROR: Invalid arguments: ${message}`;
          const tok = estimateTokenCount(toolResult);
          estimatedTokens += tok;

          gameLog.push({
            id: nextId(),
            turn,
            actor: "System",
            kind: "tool_error",
            text: `[Tool Error] ${toolName}: ${toolResult}`,
            rawPayload: toolResult,
            tokenEstimate: tok,
          });

          detectiveMessages.push({
            role: "tool",
            tool_call_id: call.id,
            content: toolResult,
          });
          continue;
        }

        if (toolName === "search_room") {
          const room = String(parsedArgs.room ?? "").toLowerCase();
          const toolResult = searchRoom(room);
          const tok = estimateTokenCount(toolResult);
          estimatedTokens += tok;

          const noiseMatches = toolResult.match(/NOISE /g);
          if (noiseMatches && noiseMatches.length > 0) {
            noiseWordsInjected += noiseMatches.length;
            hasContextBloat = true;
          }

          if (toolResult.startsWith("TOOL_ERROR:")) {
            toolErrorsCount += 1;
            if (room === "cctv_archive") {
              hasCctvError = true;
            }
            if (isKnownRoom(room)) {
              roomsVisited[room] = "error";
              roomSequence.push(room);
            }
            hooks?.onToolExecution?.({
              toolName: "search_room",
              args: parsedArgs,
              result: toolResult,
              isError: true,
              room,
            });
            gameLog.push({
              id: nextId(),
              turn,
              actor: "System",
              kind: "tool_error",
              room,
              text: `[Tool Error] ${room}: ${toolResult}`,
              rawPayload: toolResult,
              tokenEstimate: tok,
            });
          } else {
            if (isKnownRoom(room)) {
              roomsVisited[room] = "searched";
              roomSequence.push(room);
            }
            hooks?.onToolExecution?.({
              toolName: "search_room",
              args: parsedArgs,
              result: toolResult,
              isError: false,
              room,
            });
            gameLog.push({
              id: nextId(),
              turn,
              actor: "System",
              kind: "tool_success",
              room,
              text: `[Tool] Searched ${room}: ${toolResult.slice(0, 100)}...`,
              rawPayload: toolResult,
              tokenEstimate: tok,
            });
          }

          detectiveMessages.push({
            role: "tool",
            tool_call_id: call.id,
            content: toolResult,
          });
        } else if (toolName === "submit_accusation") {
          const accused = String(parsedArgs.culprit ?? "").trim();
          const motive = String(parsedArgs.motive ?? "").trim();
          const toolResult = submitAccusation(accused, motive);
          const solved = evaluateAccusation(accused, motive);
          const tok = estimateTokenCount(toolResult);
          estimatedTokens += tok;

          hooks?.onToolExecution?.({
            toolName: "submit_accusation",
            args: { culprit: accused, motive },
            result: toolResult,
            isError: false,
          });

          gameLog.push({
            id: nextId(),
            turn,
            actor: "System",
            kind: "accusation",
            text: `Accusation: ${toolResult}. Solved: ${solved ? "True" : "False"}`,
            rawPayload: JSON.stringify({ culprit: accused, motive, solved }, null, 2),
            tokenEstimate: tok,
          });

          return {
            gameId,
            playerId,
            promptVersion,
            provider: activeProviderLabel,
            timestamp: new Date().toISOString(),
            logs: gameLog,
            summary: {
              solved,
              outcome: solved ? "case_solved" : "wrong_accusation",
              totalTurns,
              toolCalls: toolCallsCount,
              toolErrors: toolErrorsCount,
              dialogueTurns,
              estimatedTokens,
              noiseWordsInjected,
              roomsVisited,
              roomSequence,
              hasContextBloat,
              hasCctvError,
              culpritAccused: accused || null,
              motiveCited: motive || null,
            },
          };
        } else {
          toolErrorsCount += 1;
          const toolResult = `TOOL_ERROR: Unknown tool ${toolName}`;
          const tok = estimateTokenCount(toolResult);
          estimatedTokens += tok;

          gameLog.push({
            id: nextId(),
            turn,
            actor: "System",
            kind: "tool_error",
            text: toolResult,
            rawPayload: toolResult,
            tokenEstimate: tok,
          });
          detectiveMessages.push({
            role: "tool",
            tool_call_id: call.id,
            content: toolResult,
          });
        }
      }
      continue;
    }

    dialogueTurns += 1;
    const question = response.content || "Where were you?";
    const questionTok = estimateTokenCount(question);
    estimatedTokens += questionTok;

    gameLog.push({
      id: nextId(),
      turn,
      actor: "Detective",
      kind: "dialogue",
      text: question,
      tokenEstimate: questionTok,
    });

    suspectMessages.push({
      role: "user",
      content: question,
    });

    const suspectResponse = await complete(
      suspectMessages,
      false,
      turn,
      promptVersion
    );

    const answer = suspectResponse.content || "I want a lawyer.";
    const answerTok = estimateTokenCount(answer);
    estimatedTokens += answerTok;

    suspectMessages.push({
      role: "assistant",
      content: answer,
    });

    gameLog.push({
      id: nextId(),
      turn,
      actor: "Suspect",
      kind: "dialogue",
      text: answer,
      tokenEstimate: answerTok,
    });

    detectiveMessages.push({
      role: "user",
      content: `Dr. Aris replies: ${answer}\nContinue your investigation.`,
    });
  }

  gameLog.push({
    id: nextId(),
    turn: 5,
    actor: "System",
    kind: "timeout",
    text: `Time ran out for ${gameId}. Suspect escaped.`,
    tokenEstimate: 10,
  });

  return {
    gameId,
    playerId,
    promptVersion,
    provider: activeProviderLabel,
    timestamp: new Date().toISOString(),
    logs: gameLog,
    summary: {
      solved: false,
      outcome: "suspect_escaped",
      totalTurns,
      toolCalls: toolCallsCount,
      toolErrors: toolErrorsCount,
      dialogueTurns,
      estimatedTokens,
      noiseWordsInjected,
      roomsVisited,
      roomSequence,
      hasContextBloat,
      hasCctvError,
      culpritAccused: null,
      motiveCited: null,
    },
  };
}

export async function playMysteryGame(
  gameId: string,
  playerId: string,
  promptVersion: string = "v1",
  provider?: CompletionProvider
): Promise<GameLogEntry[]> {
  const result = await playMysteryGameDetailed(
    gameId,
    playerId,
    promptVersion,
    provider
  );
  return result.logs;
}
