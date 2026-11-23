#!/usr/bin/env bash
set -euo pipefail

open_prs() {
  gh api --paginate --slurp     "repos/$GH_REPO/pulls?state=open&base=main&per_page=100" |
    jq -c --arg repo "$GH_REPO"       'flatten | map(select(.head.repo.full_name == $repo))'
}

latest_validation() {
  gh api --paginate --slurp \
    "repos/$GH_REPO/actions/workflows/dev-deploy.yml/runs?event=pull_request&head_sha=$2&per_page=100" |
    jq -c --arg repo "$GH_REPO" --argjson number "$1" --arg sha "$2" '
      [.[].workflow_runs[] | select(
        .event == "pull_request" and
        .head_repository.full_name == $repo and .head_sha == $sha and
        any(.pull_requests[]?; .number == $number and .base.ref == "main")
      )] | .[0] // {}
    '
}

validation_passed() {
  jq -e '.status == "completed" and .conclusion == "success"' >/dev/null
}

select_preview() {
  local prs count number sha run run_id run_attempt artifacts artifact_id
  prs=$(open_prs)
  count=$(jq 'length' <<<"$prs")
  if (( count == 0 )); then
    echo 'mode=idle' >>"$GITHUB_OUTPUT"
    return
  fi
  if (( count > 1 )); then
    echo '::notice::More than one same-repository PR targets main. Keep the current dev site.'
    return
  fi

  number=$(jq -r '.[0].number' <<<"$prs")
  sha=$(jq -r '.[0].head.sha' <<<"$prs")
  run=$(latest_validation "$number" "$sha")
  if ! validation_passed <<<"$run"; then
    echo "::notice::The current revision of PR #$number has no passing validation."
    return
  fi

  run_id=$(jq -r '.id' <<<"$run")
  run_attempt=$(jq -r '.run_attempt' <<<"$run")
  artifacts=$(gh api "repos/$GH_REPO/actions/runs/$run_id/artifacts?name=site-pr-$number")
  artifact_id=$(jq -r --arg name "site-pr-$number" '
    [.artifacts[] | select(.name == $name and .expired == false)]
    | sort_by(.created_at, .id) | last | .id // empty
  ' <<<"$artifacts")
  if [[ -z "$artifact_id" ]]; then
    echo "::notice::PR #$number needs a new validation artifact."
    return
  fi

  printf 'mode=preview\nnumber=%s\nsha=%s\nrun_id=%s\nrun_attempt=%s\nartifact_id=%s\n' \
    "$number" "$sha" "$run_id" "$run_attempt" "$artifact_id" >>"$GITHUB_OUTPUT"
}

confirm_preview() {
  local prs run
  prs=$(open_prs)
  if [[ "$PREVIEW_MODE" == idle ]]; then
    if jq -e 'length == 0' >/dev/null <<<"$prs"; then
      echo 'publish=true' >>"$GITHUB_OUTPUT"
      return
    fi
  elif jq -e --argjson number "$PREVIEW_NUMBER" --arg sha "$PREVIEW_SHA"     'length == 1 and .[0].number == $number and .[0].head.sha == $sha' >/dev/null <<<"$prs"; then
    run=$(latest_validation "$PREVIEW_NUMBER" "$PREVIEW_SHA")
    if validation_passed <<<"$run" &&
      [[ $(jq -r '.id' <<<"$run") == "$PREVIEW_RUN_ID" &&
         $(jq -r '.run_attempt' <<<"$run") == "$PREVIEW_RUN_ATTEMPT" ]]; then
      echo 'publish=true' >>"$GITHUB_OUTPUT"
      return
    fi
  fi
  echo '::notice::The active PR or its validation changed before deployment. Keep the current dev site.'
}

case "$1" in
  select) select_preview ;;
  confirm) confirm_preview ;;
  *) echo "Unknown dev preview action: $1" >&2; exit 2 ;;
esac
