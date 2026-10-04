#!/bin/bash
# Run each 25-tree project on i-Tree Stormwater, one at a time, retrying up to 3 times.
cd /home/sprite/project
for set in largest-100 smallest-100; do
  for part in 1 2 3 4; do
    name="$set-part$part"
    [ -s "/tmp/sw-$name-tables.json" ] && { echo "$name already done"; continue; }
    for try in 1 2 3; do
      out=$(timeout 420 node scripts/itree-stormwater/run-project.mjs "$name" 2>&1)
      res=$(echo "$out" | grep -o "RESULT [a-z]*" | tail -1)
      echo "$name try $try: ${res:-RESULT crashed}"
      [ "$res" = "RESULT ok" ] && break
      echo "$out" | grep -E "failed|Error|error" | head -3
      sleep 30
    done
    sleep 15
  done
done
echo "ALL DONE"
