import os
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(Path(__file__).resolve().parent / ".env")

api_key = os.getenv("GROQ_API_KEY")
model = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

if not api_key:
    raise RuntimeError("GROQ_API_KEY missing from backend/.env")

client = OpenAI(
    api_key=api_key,
    base_url="https://api.groq.com/openai/v1"
)

tools = [
    {
        "type": "function",
        "function": {
            "name": "search_room",
            "description": "Search a room for mystery clues.",
            "parameters": {
                "type": "object",
                "properties": {
                    "room": {
                        "type": "string",
                        "enum": ["server_room", "coffee_station"]
                    }
                },
                "required": ["room"],
                "additionalProperties": False
            }
        }
    }
]

print("=" * 50)
print("MYSTERY MOMENT - GROQ CONNECTION TEST")
print("=" * 50)
print("Model:", model)
print("Connecting to Groq...")

try:
    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": "You are Detective Vance. Use the available tools to investigate."
            },
            {
                "role": "user",
                "content": "Investigate the server room. You must call search_room."
            }
        ],
        tools=tools,
        tool_choice="required",
        temperature=0.2
    )

    message = response.choices[0].message

    print("\nSUCCESS: Groq API connection established!")

    if message.tool_calls:
        for call in message.tool_calls:
            print("\nFUNCTION CALLED:", call.function.name)
            print("ARGUMENTS:", call.function.arguments)
    else:
        print("\nNo tool call was returned.")
        print("Response:", message.content)

    if response.usage:
        print("\nTOKEN USAGE:")
        print(response.usage.model_dump())

    print("\nGROQ TEST FINISHED.")

except Exception as error:
    print("\nGROQ TEST FAILED!")
    print("Error type:", type(error).__name__)
    print("Error:", str(error))
