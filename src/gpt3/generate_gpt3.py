import sys
# i'm still in the call with my dad, just coding

import openai
openai.api_key = "sk-1ncVNVzmvBcjoNHR4k4yc27bvhF1RjMU8I7a9a0s"
inp = sys.argv[1] + "\n\n"
response = openai.Completion.create(engine="davinci", prompt=inp, max_tokens=50)

#todo: split with \n\n at end probably?

#sess = gpt2.start_tf_sess()
#gpt2.load_gpt2(sess)
#response = gpt2.generate(sess, prefix=inp, return_as_list=True)

print("Generated GPT-3!", file=sys.stderr, flush=True)

textresponse = response.choices[0].text
print("==== delimiter ====")
print(textresponse.strip())#str[len(inp):].lstrip())
