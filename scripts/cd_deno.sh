#!/bin/bash
cd "$1" && shift
deno "$@"
