import sys
import openai

prompt = """The following is an online chat room conversation between some friends and QBot Ashcraft. QBot Ashcraft is a smart and helpful AI trying to imitate a human."""

openai.api_key = sys.argv[2]
inp = prompt + "\n\n" + sys.argv[1]

print("Generating GPT-3 from '", inp.replace("\n", "<newline>"), "'...", file=sys.stderr, flush=True)
response = openai.Completion.create(engine=sys.argv[3], prompt=inp, stop=["\n"], max_tokens=50)
print("Generated GPT-3!", file=sys.stderr, flush=True)

textresponse = response.choices[0].text
print("==== delimiter ====")
print(textresponse.strip())#str[len(inp):].lstrip())
