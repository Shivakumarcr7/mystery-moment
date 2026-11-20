import OpenAI from "openai";
import * as morse from "@morsehq-dev/sdk";
import { wrapOpenAI, type OpenAiClientLike } from "@morsehq-dev/sdk/openai";
import {
  DETECTIVE_TOOLS,
  playMysteryGameDetailed,
  resolveGroqModel,
  simulatedProvider,
  type ChatMessage,
  type CompletionMessage,
  type CompletionProvider,
  type GameRunResult,
  type ToolExecutionEvent,
} from "@/lib/mysteryEngine";

let morseInitializedKey: string | null = null;

function ensureMorseInitialized(): boolean {
  const morseKey = process.env.MORSE_API_KEY?.trim();
  if (!morseKey) return false;

  if (morseInitializedKey !== morseKey) {
    morse.init({ apiKey: morseKey });
    morseInitializedKey = morseKey;
  }
  return true;
}

function createGroqClient(apiKey: string): OpenAI {
  const rawClient = new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
    timeout: 90_000,
    maxRetries: 2,
  });
  return wrapOpenAI(rawClient as unknown as OpenAiClientLike) as unknown as OpenAI;
}

function recordToolSpan(event: ToolExecutionEvent) {
  const spanHandle = morse.startSpan({
    name: event.toolName,
    type: "tool",
    metadata: {
      ...(event.room ? { room: event.room } : {}),
      tool_error: event.isError,
    },
  });

  if (!spanHandle) return;

  spanHandle.span.input_data = event.args;
  spanHandle.span.output_data = event.result;

  if (event.isError) {
    spanHandle.span.status = "failed";
    spanHandle.span.error_message = event.result;
    spanHandle.span.exception_type = event.result.includes("503")
      ? "ToolError503"
      : "ToolError";
    spanHandle.end(new Error(event.result));
  } else {
    spanHandle.end();
  }
}

export async function runTracedMysteryGame(
  gameId: string,
  playerId: string,
  promptVersionInput: string = "v1"
): Promise<GameRunResult> {
  const promptVersion: "v1" | "v2" = promptVersionInput === "v2" ? "v2" : "v1";
  const morseEnabled = ensureMorseInitialized();
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const model = resolveGroqModel(process.env.GROQ_MODEL);

  let usedLiveGroq = Boolean(groqKey);
  const client = groqKey ? createGroqClient(groqKey) : null;

  const callGroqOnce = async (
    messages: ChatMessage[],
    useTools: boolean,
    temperature: number
  ): Promise<CompletionMessage> => {
    if (!client) {
      throw new Error("Groq client not configured");
    }

    const response = await client.chat.completions.create({
      model,
      messages:
        messages as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      temperature,
      ...(useTools
        ? {
            tools:
              DETECTIVE_TOOLS as unknown as OpenAI.Chat.Completions.ChatCompletionTool[],
            tool_choice: "auto" as const,
            parallel_tool_calls: false,
          }
        : {}),
    });

    const msg = response.choices?.[0]?.message;
    if (!msg) {
      throw new Error("Groq returned an empty response.");
    }

    return {
      content: msg.content ?? "",
      tool_calls: msg.tool_calls
        ?.filter((c) => c.type === "function")
        .map((c) => ({
          id: c.id,
          type: "function" as const,
          function: {
            name: c.function.name,
            arguments: c.function.arguments,
          },
        })),
    };
  };

  const provider: CompletionProvider = client
    ? async (
        messages: ChatMessage[],
        useTools: boolean,
        turn: number,
        version: string
      ): Promise<CompletionMessage> => {
        try {
          return await callGroqOnce(messages, useTools, useTools ? 0.2 : 0.7);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          const isToolValidationError =
            useTools &&
            (errMsg.includes("tool call validation failed") ||
              errMsg.includes("tool_use_failed") ||
              errMsg.includes("missing properties"));

          if (isToolValidationError) {
            try {
              const retryMessages: ChatMessage[] = [
                ...messages,
                {
                  role: "user",
                  content:
                    'Your previous tool call was missing required JSON properties. Provide all required fields: for search_room pass {"room": "server_room" | "coffee_station" | "cctv_archive"}; for submit_accusation pass {"culprit": "...", "motive": "..."}.',
                },
              ];
              return await callGroqOnce(retryMessages, true, 0);
            } catch {
              usedLiveGroq = false;
              return simulatedProvider(messages, useTools, turn, version);
            }
          }

          usedLiveGroq = false;
          return simulatedProvider(messages, useTools, turn, version);
        }
      }
    : simulatedProvider;

  if (!morseEnabled) {
    const result = await playMysteryGameDetailed(
      gameId,
      playerId,
      promptVersion,
      provider,
      { providerLabel: usedLiveGroq ? "Groq" : "Simulated" }
    );
    return {
      ...result,
      provider: usedLiveGroq ? "Groq" : "Simulated",
      morseTraceId: null,
      morseShipped: false,
    };
  }

  let capturedTraceId: string | null = null;

  const result = await morse.runTraced(
    {
      agentName: "murder-mystery-detective",
      threadId: gameId,
      userId: playerId,
      userMetadata: {
        prompt_version: promptVersion,
        model,
      },
    },
    async (handle) => {
      capturedTraceId = handle._state.traceId ?? null;
      morse.setPrompt("murder-mystery-detective", promptVersion);

      try {
        const gameResult = await playMysteryGameDetailed(
          gameId,
          playerId,
          promptVersion,
          provider,
          {
            providerLabel: usedLiveGroq ? "Groq" : "Simulated",
            onToolExecution: recordToolSpan,
          }
        );

        handle.setOutcome(gameResult.summary.solved, gameResult.summary.outcome);
        return gameResult;
      } catch (err) {
        handle.setOutcome(false, "agent_error");
        throw err;
      }
    }
  );

  await morse.flush();

  if (!result) {
    throw new Error("Morse traced execution returned no result.");
  }

  return {
    ...result,
    provider: usedLiveGroq ? "Groq" : "Simulated",
    morseTraceId: capturedTraceId,
    morseShipped: true,
  };
}
