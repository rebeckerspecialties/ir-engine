#!/bin/bash

# Iterates over all AWS Device Farm artifacts, unzips screenshot test results,
# and exports results to a target directory

#### Arguments
## $1: path to archive containing AWS device farm results
## $2: output directory for unzipped result files
####

for dir in $1/*
do
  artifactPath=$(find "$dir" -name "*Customer Artifacts.zip" | head -n 1)
  deviceType=${dir##*/}
  echo $deviceType

  mkdir -p "$2/$deviceType"
  unzip "$artifactPath" -d "$2/$deviceType/output" -x *.zip

  find "$2/$deviceType/output" -name '*.png' | while read screenshot; do
    echo "$screenshot"
    magick "$screenshot" -crop 1178x2400+0+156 "$screenshot"
    mv "$screenshot" "$2/$deviceType"
  done

  rm -rf "$2/$deviceType/output"
done;
