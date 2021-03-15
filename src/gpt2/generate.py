import gpt_2_simple as gpt2
import sys

sess = gpt2.start_tf_sess()
gpt2.load_gpt2(sess)

list = gpt2.generate(sess, prefix=sys.argv[1] + "\n\n", include_prefix=False, truncate="\n\n", return_as_list=True)

for str in list:
  print("==== delimiter ====")
  print(str)
