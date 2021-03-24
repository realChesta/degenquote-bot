import gpt_2_simple as gpt2
import sys

sess = gpt2.start_tf_sess()
gpt2.load_gpt2(sess)

inp = sys.argv[1] + "\n\n"

print("Generating GPT-2 for '" + inp.replace("\n", "\\n") + "'...", file=sys.stderr, flush=True)
list = gpt2.generate(sess, prefix=inp, return_as_list=True)
print("Generated GPT-2!", file=sys.stderr, flush=True)

for str in list:
  print("==== delimiter ====")
  print(str[len(inp):].lstrip())
