import sys
import openai
openai.api_key = sys.argv[2]
inp = sys.argv[1] + "\n\n"
response = openai.Completion.create(engine="davinci", prompt=inp, max_tokens=50)

print("Generated GPT-3!", file=sys.stderr, flush=True)

textresponse = response.choices[0].text
print("==== delimiter ====")
print(textresponse.strip())#str[len(inp):].lstrip())
