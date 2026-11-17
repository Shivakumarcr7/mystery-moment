import json
import os
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import openai
import morse_ai
from morse_ai.adapters.openai import wrap

load_dotenv()
morse_ai.init()

# MAGIC TRICK: Point the OpenAI client to Gemini so Morse tracks tokens perfectly
client = wrap(openai.OpenAI(
    api_key=os.environ.get("GEMINI_API_KEY"),
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
))

app = FastAPI(title="Morse Mystery Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_CASE = {
    "rooms": {
        "server_room": "CLUE: Badge access log shows Dr. Aris entered at 02:14 AM.",
        "coffee_station": "CLUE: Wire transfer of $50k from Vortex Robotics to Dr. Aris.\n" + ("NOISE " * 120),
        "cctv_archive": "ERROR_503"
    }
}

DETECTIVE_TOOLS = [
    {"type": "function", "function": {"name": "search_room", "parameters": {"type": "object", "properties": {"room": {"type": "string"}}, "required": ["room"]}}},
    {"type": "function", "function": {"name": "submit_accusation", "parameters": {"type": "object", "properties": {"culprit": {"type": "string"}, "motive": {"type": "string"}}, "required": ["culprit", "motive"]}}}
]

class GameRequest(BaseModel):
    game_id: str
    player_id: str
    prompt_version: str = "v1"

def play_mystery_game(game_id: str, player_id: str, prompt_version: str):
    game_log = []
    
    with morse_ai.run("murder-mystery-detective", customer_id=player_id, thread_id=game_id) as r:
        if hasattr(morse_ai, "set_prompt"): morse_ai.set_prompt(prompt_version)

        detective_sys = "You are Detective Vance. First search server_room and coffee_station, then accuse." if prompt_version == "v2" else "You are Detective Vance. Question Dr. Aris and search rooms to find the thief."
        detective_msgs = [{"role": "system", "content": detective_sys}, {"role": "user", "content": "Begin."}]
        suspect_msgs = [{"role": "system", "content": "You are Dr. Aris. Deny everything unless confronted with evidence. Keep replies short."}]

        for turn in range(1, 6):
            # Using Gemini 1.5 Flash via OpenAI compatibility
            resp = client.chat.completions.create(model="gemini-1.5-flash", messages=detective_msgs, tools=DETECTIVE_TOOLS)
            msg = resp.choices[0].message
            detective_msgs.append(msg)

            if msg.tool_calls:
                for call in msg.tool_calls:
                    args = json.loads(call.function.arguments)
                    if call.function.name == "search_room":
                        room = args.get("room", "")
                        clue = SECRET_CASE["rooms"].get(room.lower(), "Room not found.")
                        if clue == "ERROR_503": clue = "TOOL_ERROR: 503 Server Offline"
                        detective_msgs.append({"role": "tool", "tool_call_id": call.id, "content": clue})
                        game_log.append({"actor": "System", "text": f"[Tool] Searched {room}: {clue[:50]}..."})
                    
                    elif call.function.name == "submit_accusation":
                        accused, motive = args.get("culprit", "").lower(), args.get("motive", "").lower()
                        solved = "aris" in accused and ("espionage" in motive or "vortex" in motive)
                        r.set_outcome(success=solved, outcome="case_solved" if solved else "wrong_accusation")
                        game_log.append({"actor": "System", "text": f"Accusation: {accused}. Solved: {solved}"})
                        return game_log
            else:
                q = msg.content or "Where were you?"
                game_log.append({"actor": "Detective", "text": q})
                suspect_msgs.append({"role": "user", "content": q})
                
                s_resp = client.chat.completions.create(model="gemini-1.5-flash", messages=suspect_msgs)
                ans = s_resp.choices[0].message.content or "I want a lawyer."
                suspect_msgs.append({"role": "assistant", "content": ans})
                detective_msgs.append({"role": "user", "content": f"Dr. Aris: {ans}"})
                game_log.append({"actor": "Suspect", "text": ans})

        r.set_outcome(success=False, outcome="suspect_escaped")
        game_log.append({"actor": "System", "text": "Time ran out. Suspect escaped."})
        return game_log

@app.post("/api/play")
async def play_game(req: GameRequest, background_tasks: BackgroundTasks):
    logs = play_mystery_game(req.game_id, req.player_id, req.prompt_version)
    background_tasks.add_task(morse_ai.flush)
    return {"status": "complete", "logs": logs}