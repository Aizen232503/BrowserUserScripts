#!/usr/bin/env bash
# 校验暂存区中用户脚本的发布信息是否已同步。
set -euo pipefail

root_dir="$(git rev-parse --show-toplevel)"
cd "$root_dir"

failed=0

while IFS= read -r script_path; do
  [[ -n "$script_path" ]] || continue

  # 内部脚本即使被强制加入暂存区，也不参与对外发布版本校验。
  if git check-ignore -q --no-index -- "$script_path"; then
    continue
  fi

  script_content="$(git show ":$script_path")"
  version="$(awk '$1 == "//" && $2 == "@version" { print $3; exit }' <<<"$script_content")"
  name="$(awk '$1 == "//" && $2 == "@name" { $1 = $2 = ""; sub(/^[[:space:]]+/, ""); print; exit }' <<<"$script_content")"
  script_dir="${script_path%/*}"
  changelog_path="$script_dir/CHANGELOG.md"

  if [[ -z "$version" || -z "$name" ]]; then
    echo "发布校验失败：$script_path 缺少 @name 或 @version。" >&2
    failed=1
    continue
  fi

  version_diff="$(git diff --cached -U0 -- "$script_path")"
  if ! grep -Eq '^[+-]// @version[[:space:]]' <<<"$version_diff"; then
    echo "发布校验失败：$script_path 已改动，但 @version 未递增。" >&2
    failed=1
  fi

  if ! git cat-file -e ":$changelog_path" 2>/dev/null; then
    echo "发布校验失败：缺少 $changelog_path。" >&2
    failed=1
  else
    changelog_version="$(git show ":$changelog_path" | awk '/^## / { sub(/^## /, ""); print; exit }')"
    if [[ "$changelog_version" != "$version" ]]; then
      echo "发布校验失败：$changelog_path 顶部版本应为 $version，实际为 ${changelog_version:-未找到}。" >&2
      failed=1
    fi
  fi

  if ! git cat-file -e :README.md 2>/dev/null \
    || ! git show :README.md | grep -Fq "| [$name](./$script_dir/) | $version |"; then
    echo "发布校验失败：根 README 未找到 $name 的 $version 版本记录。" >&2
    failed=1
  fi
done < <(git diff --cached --name-only --diff-filter=ACMR -- '*.user.js')

if ((failed)); then
  echo "请同步脚本版本、对应 CHANGELOG 顶部条目和根 README 后重新提交。" >&2
  exit 1
fi
