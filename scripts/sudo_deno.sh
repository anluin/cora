#!/bin/bash
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
CURRENT_DIR=$PWD
ARGS="$@"
pkexec $SCRIPT_DIR/cd_deno.sh $CURRENT_DIR $ARGS
