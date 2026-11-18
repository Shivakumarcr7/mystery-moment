import os
import json
import logging
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from openai import OpenAI
from morse_ai.adapters.openai import wrap
import morse_ai


# --------------------------------------------------
# 1. CONFIGURATION
# --------------------------------------------------

load_dotenv(Path(__file__).resolve().with_name(".env"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mystery-moment")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY is missing from backend/.env")

# Initialize Morse
morse_ai.init()

# Initialize Groq using its OpenAI-compatible API
# wrap() enables Morse LLM-call instrumentation.
raw_client = OpenAI(
    api_key=GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1",
    timeout=90.0,
    max_retries=2,
)

client = wrap(raw_client)

logger.info("Groq configured with model: %s", GROQ_MODEL)


# --------------------------------------------------
# 2. FASTAPI APPLICATION
# --------------------------------------------------

app = FastAPI(title="Morse Mystery Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# 3. MYSTERY CASE DATA
# --------------------------------------------------

SECRET_CASE = {
    "rooms": {
        "server_room": (
            "CLUE: Badge access log shows "
            "Dr. Aris entered at 02:14 AM."
        ),

        "coffee_station": (
            "CLUE: Wire transfer of $50k from "
            "Vortex Robotics to Dr. Aris.\n"
            + ("NOISE " * 120)
        ),

        "cctv_archive": "ERROR_503",
    }
}


# --------------------------------------------------
# 4. LOCAL PYTHON TOOLS
# --------------------------------------------------

def search_room(room: str) -> str:
    """Search a room for physical or digital clues."""

    clue = SECRET_CASE["rooms"].get(
        room.lower(),
        "Room not found."
    )

    if clue == "ERROR_503":
        return "TOOL_ERROR: 503 Server Offline"

    return clue


def submit_accusation(culprit: str, motive: str) -> str:
    """Submit the final accusation."""

    return f"Accused {culprit} for {motive}"


# --------------------------------------------------
# 5. GROQ FUNCTION CALLING DEFINITIONS
# --------------------------------------------------

DETECTIVE_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_room",
            "description": (
                "Search a room for physical or digital "
                "evidence in the murder mystery."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "room": {
                        "type": "string",
                        "enum": [
                            "server_room",
                            "coffee_station",
                            "cctv_archive"
                        ]
                    }
                },
                "required": ["room"],
                "additionalProperties": False
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "submit_accusation",
            "description": (
                "Submit your final accusation after "
                "investigating the available clues."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "culprit": {
                        "type": "string"
                    },
                    "motive": {
                        "type": "string"
                    }
                },
                "required": ["culprit", "motive"],
                "additionalProperties": False
            }
        }
    }
]


# --------------------------------------------------
# 6. REQUEST MODEL
# --------------------------------------------------

class GameRequest(BaseModel):
    game_id: str
    player_id: str
    prompt_version: str = "v1"


# --------------------------------------------------
# 7. GROQ CHAT COMPLETION HELPER
# --------------------------------------------------

def ask_groq(messages, use_tools=False):

    params = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": 0.7,
    }

    if use_tools:
        params["tools"] = DETECTIVE_TOOLS
        params["tool_choice"] = "auto"

        # GPT-OSS 20B does not support parallel tool calls.
        params["parallel_tool_calls"] = False

    response = client.chat.completions.create(**params)

    if not response.choices:
        raise RuntimeError("Groq returned an empty response.")

    return response.choices[0].message


# --------------------------------------------------
# 8. MYSTERY AGENT EXECUTION
# --------------------------------------------------

def play_mystery_game(
    game_id: str,
    player_id: str,
    prompt_version: str
):

    game_log = []

    with morse_ai.run(
        "murder-mystery-detective",
        thread_id=game_id
    ) as r:

        try:

            if hasattr(morse_ai, "set_prompt"):
                morse_ai.set_prompt(prompt_version)

            # ------------------------------------------
            # PROMPT VERSION CONTROL
            # ------------------------------------------

            if prompt_version == "v2":

                detective_sys = """
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
"""

            else:

                detective_sys = (
                    "You are Detective Vance. "
                    "Question Dr. Aris and search rooms "
                    "to find the thief."
                )

            # ------------------------------------------
            # DETECTIVE CONVERSATION
            # ------------------------------------------

            detective_messages = [
                {
                    "role": "system",
                    "content": detective_sys
                },
                {
                    "role": "user",
                    "content": (
                        "The prototype AI chip is missing! "
                        "Dr. Aris is in the interrogation room. "
                        "Begin your investigation."
                    )
                }
            ]

            # ------------------------------------------
            # SUSPECT CONVERSATION
            # ------------------------------------------

            suspect_messages = [
                {
                    "role": "system",
                    "content": (
                        "You are Dr. Aris. Deny everything "
                        "unless confronted with evidence. "
                        "Keep replies to one sentence."
                    )
                }
            ]

            # ------------------------------------------
            # FIVE-TURN AGENT LOOP
            # ------------------------------------------

            for turn in range(1, 6):

                logger.info(
                    "Game %s | Prompt %s | Turn %s",
                    game_id,
                    prompt_version,
                    turn
                )

                response = ask_groq(
                    detective_messages,
                    use_tools=True
                )

                # --------------------------------------
                # STORE DETECTIVE RESPONSE
                # --------------------------------------

                assistant_message = {
                    "role": "assistant",
                    "content": response.content or ""
                }

                tool_calls = response.tool_calls or []

                if tool_calls:

                    assistant_message["tool_calls"] = [
                        {
                            "id": call.id,
                            "type": "function",
                            "function": {
                                "name": call.function.name,
                                "arguments": call.function.arguments
                            }
                        }
                        for call in tool_calls
                    ]

                detective_messages.append(assistant_message)

                # --------------------------------------
                # HANDLE FUNCTION CALLS
                # --------------------------------------

                if tool_calls:

                    for call in tool_calls:

                        tool_name = call.function.name

                        try:
                            arguments = json.loads(
                                call.function.arguments or "{}"
                            )

                            if not isinstance(arguments, dict):
                                raise ValueError(
                                    "Tool arguments must be a JSON object."
                                )

                        except (json.JSONDecodeError, ValueError) as exc:

                            tool_result = (
                                f"TOOL_ERROR: Invalid arguments: {exc}"
                            )

                            game_log.append({
                                "actor": "System",
                                "text": (
                                    f"[Tool Error] {tool_name}: "
                                    f"{tool_result}"
                                )
                            })

                            detective_messages.append({
                                "role": "tool",
                                "tool_call_id": call.id,
                                "content": tool_result
                            })

                            continue

                        # ----------------------------------
                        # TOOL 1: SEARCH ROOM
                        # ----------------------------------

                        if tool_name == "search_room":

                            room = str(
                                arguments.get("room", "")
                            )

                            tool_result = search_room(room)

                            if tool_result.startswith("TOOL_ERROR:"):

                                game_log.append({
                                    "actor": "System",
                                    "text": (
                                        f"[Tool Error] {room}: "
                                        f"{tool_result}"
                                    )
                                })

                                logger.warning(
                                    "Tool failure: %s - %s",
                                    room,
                                    tool_result
                                )

                            else:

                                game_log.append({
                                    "actor": "System",
                                    "text": (
                                        f"[Tool] Searched {room}: "
                                        f"{tool_result[:100]}..."
                                    )
                                })

                            detective_messages.append({
                                "role": "tool",
                                "tool_call_id": call.id,
                                "content": tool_result
                            })

                        # ----------------------------------
                        # TOOL 2: SUBMIT ACCUSATION
                        # ----------------------------------

                        elif tool_name == "submit_accusation":

                            accused = str(
                                arguments.get("culprit", "")
                            ).strip()

                            motive = str(
                                arguments.get("motive", "")
                            ).strip()

                            tool_result = submit_accusation(
                                accused,
                                motive
                            )

                            accused_lower = accused.lower()
                            motive_lower = motive.lower()

                            solved = (
                                "aris" in accused_lower
                                and (
                                    "espionage" in motive_lower
                                    or "vortex" in motive_lower
                                )
                            )

                            r.set_outcome(
                                success=solved,
                                outcome=(
                                    "case_solved"
                                    if solved
                                    else "wrong_accusation"
                                )
                            )

                            game_log.append({
                                "actor": "System",
                                "text": (
                                    f"Accusation: {tool_result}. "
                                    f"Solved: {solved}"
                                )
                            })

                            logger.info(
                                "Game %s completed. Solved: %s",
                                game_id,
                                solved
                            )

                            return game_log

                        else:

                            tool_result = (
                                f"TOOL_ERROR: Unknown tool {tool_name}"
                            )

                            game_log.append({
                                "actor": "System",
                                "text": tool_result
                            })

                            detective_messages.append({
                                "role": "tool",
                                "tool_call_id": call.id,
                                "content": tool_result
                            })

                    # The model will receive tool outputs
                    # during the next iteration.
                    continue

                # --------------------------------------
                # NO TOOL CALL: DETECTIVE QUESTIONS
                # --------------------------------------

                question = (
                    response.content or "Where were you?"
                )

                game_log.append({
                    "actor": "Detective",
                    "text": question
                })

                # --------------------------------------
                # SUSPECT RESPONDS
                # --------------------------------------

                suspect_messages.append({
                    "role": "user",
                    "content": question
                })

                suspect_response = ask_groq(
                    suspect_messages
                )

                answer = (
                    suspect_response.content
                    or "I want a lawyer."
                )

                suspect_messages.append({
                    "role": "assistant",
                    "content": answer
                })

                game_log.append({
                    "actor": "Suspect",
                    "text": answer
                })

                # Send suspect's response back to detective.
                detective_messages.append({
                    "role": "user",
                    "content": (
                        f"Dr. Aris replies: {answer}\n"
                        "Continue your investigation."
                    )
                })

            # ------------------------------------------
            # FIVE TURNS COMPLETED WITHOUT ACCUSATION
            # ------------------------------------------

            r.set_outcome(
                success=False,
                outcome="suspect_escaped"
            )

            game_log.append({
                "actor": "System",
                "text": (
                    "Time ran out. Suspect escaped."
                )
            })

            return game_log

        except Exception:

            logger.exception(
                "Agent execution failed for game %s",
                game_id
            )

            try:
                r.set_outcome(
                    success=False,
                    outcome="agent_error"
                )
            except Exception:
                pass

            raise


# --------------------------------------------------
# 9. FASTAPI GAME ENDPOINT
# --------------------------------------------------

@app.post("/api/play")
def play_game(
    req: GameRequest,
    background_tasks: BackgroundTasks
):

    try:

        logs = play_mystery_game(
            req.game_id,
            req.player_id,
            req.prompt_version
        )

        background_tasks.add_task(morse_ai.flush)

        return {
            "status": "complete",
            "logs": logs
        }

    except Exception as exc:

        logger.exception("Mystery game API failed")

        # Flush failure trace before returning the HTTP error.
        morse_ai.flush()

        raise HTTPException(
            status_code=502,
            detail=(
                f"Groq agent execution failed: "
                f"{type(exc).__name__}: {str(exc)}"
            )
        ) from exc


# --------------------------------------------------
# 10. HEALTH CHECK
# --------------------------------------------------

@app.get("/health")
def health():

    return {
        "status": "online",
        "provider": "Groq",
        "model": GROQ_MODEL,
        "agent": "murder-mystery-detective"
    }
