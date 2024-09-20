#!/bin/bash
# make folder
mkdir -p ./processed_papers
# process papers
marker --min_length 500 ./papers ./processed_papers 