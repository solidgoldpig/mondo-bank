_mondoCompletion() {
  COMPREPLY=()
  local word="${COMP_WORDS[COMP_CWORD]}"
  #args=$(printf "%s " "${COMP_WORDS[@]}")
  local args=${COMP_WORDS[1]}
  local completions="$(mondo $args --completions)"
  COMPREPLY=( $(compgen -W '$completions' -- $word) )
}

complete -F _mondoCompletion mondo
