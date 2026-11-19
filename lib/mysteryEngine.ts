export interface GameLogEntry {
  actor: "Detective" | "Suspect" | "System";
  text: string;
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
        "Submit your final accusation after investigating the available clues.",
      parameters: {
        type: "object",
        properties: {
          culprit: { type: "string" },
          motive: { type: "string" },
        },
        required: ["culprit", "motive"],
        additionalProperties: false,
      },
    },
  },
];

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
    return `
You are Detective Vance.

You are conducting an optimized investigation.

Follow this exact sequence:

1. Call search_room with server_room.
2. Call search_room with coffee_station.
3. Analyze both clues.
4. Call submit_accusation with Dr. Aris as the culprit
   and corporate espionage involving Vortex Robotics
   as the motive.

Do not ask unnecessary questions.
Do not accuse before examining both clues.
Use the available function tools to complete the case.
`;
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

  // Prompt v1 (Chatty Detective): interrogates suspect, hits CCTV 503 tool error,
  // inspects server_room and coffee_station (with 120-token noise injection), then accuses.
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
                motive: "corporate espionage for Vortex Robotics ($50k wire transfer)",
              }),
            },
          },
        ],
      };
  }
}

export async function playMysteryGame(
  gameId: string,
  _playerId: string,
  promptVersion: string = "v1",
  provider?: CompletionProvider
): Promise<GameLogEntry[]> {
  const gameLog: GameLogEntry[] = [];
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;

  const complete: CompletionProvider =
    provider ??
    (apiKey
      ? (messages, useTools) => askGroq(messages, useTools, apiKey, model)
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

  for (let turn = 1; turn <= 5; turn++) {
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

    if (toolCalls.length > 0) {
      for (const call of toolCalls) {
        const toolName = call.function.name;
        let parsedArgs: Record<string, unknown>;

        try {
          const parsed = JSON.parse(call.function.arguments || "{}");
          if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            throw new Error("Tool arguments must be a JSON object.");
          }
          parsedArgs = parsed as Record<string, unknown>;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const toolResult = `TOOL_ERROR: Invalid arguments: ${message}`;

          gameLog.push({
            actor: "System",
            text: `[Tool Error] ${toolName}: ${toolResult}`,
          });

          detectiveMessages.push({
            role: "tool",
            tool_call_id: call.id,
            content: toolResult,
          });
          continue;
        }

        if (toolName === "search_room") {
          const room = String(parsedArgs.room ?? "");
          const toolResult = searchRoom(room);

          if (toolResult.startsWith("TOOL_ERROR:")) {
            gameLog.push({
              actor: "System",
              text: `[Tool Error] ${room}: ${toolResult}`,
            });
          } else {
            gameLog.push({
              actor: "System",
              text: `[Tool] Searched ${room}: ${toolResult.slice(0, 100)}...`,
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

          gameLog.push({
            actor: "System",
            text: `Accusation: ${toolResult}. Solved: ${solved ? "True" : "False"}`,
          });

          return gameLog;
        } else {
          const toolResult = `TOOL_ERROR: Unknown tool ${toolName}`;
          gameLog.push({
            actor: "System",
            text: toolResult,
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

    const question = response.content || "Where were you?";
    gameLog.push({
      actor: "Detective",
      text: question,
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
    suspectMessages.push({
      role: "assistant",
      content: answer,
    });

    gameLog.push({
      actor: "Suspect",
      text: answer,
    });

    detectiveMessages.push({
      role: "user",
      content: `Dr. Aris replies: ${answer}\nContinue your investigation.`,
    });
  }

  gameLog.push({
    actor: "System",
    text: `Time ran out for ${gameId}. Suspect escaped.`,
  });

  return gameLog;
}
