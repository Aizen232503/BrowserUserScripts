#!/usr/bin/env bash
# 显式同步单个用户脚本的补丁版本、更新日志和根 README。
set -euo pipefail

if (($# != 2)); then
  echo "用法：$0 <脚本目录> <更新说明>" >&2
  exit 2
fi

root_dir="$(git rev-parse --show-toplevel)"
script_dir="${1%/}"
release_note="$2"
cd "$root_dir"

if [[ ! -d "$script_dir" ]]; then
  echo "未找到脚本目录：$script_dir" >&2
  exit 1
fi

shopt -s nullglob
script_files=("$script_dir"/*.user.js)
shopt -u nullglob
if ((${#script_files[@]} != 1)); then
  echo "$script_dir 必须恰好包含一个 .user.js 文件。" >&2
  exit 1
fi

script_path="${script_files[0]}"
changelog_path="$script_dir/CHANGELOG.md"
if [[ ! -f "$changelog_path" || ! -f README.md ]]; then
  echo "缺少 $changelog_path 或根 README.md。" >&2
  exit 1
fi

old_version="$(awk '$1 == "//" && $2 == "@version" { print $3; exit }' "$script_path")"
script_name="$(awk '$1 == "//" && $2 == "@name" { $1 = $2 = ""; sub(/^[[:space:]]+/, ""); print; exit }' "$script_path")"
if [[ ! "$old_version" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]] || [[ -z "$script_name" ]]; then
  echo "$script_path 的 @name 或三段式 @version 无效。" >&2
  exit 1
fi

new_version="${BASH_REMATCH[1]}.${BASH_REMATCH[2]}.$((BASH_REMATCH[3] + 1))"

SCRIPT_PATH="$script_path" OLD_VERSION="$old_version" NEW_VERSION="$new_version" perl -0pi -e '
  my ($path, $old, $new) = @ENV{qw(SCRIPT_PATH OLD_VERSION NEW_VERSION)};
  s{^// \@version\s+\Q$old\E\s*$}{// \@version      $new}m
    or die "未能更新 $path 的 \@version\\n";
' "$script_path"

CHANGELOG_PATH="$changelog_path" NEW_VERSION="$new_version" RELEASE_NOTE="$release_note" perl -0pi -e '
  my ($path, $version, $note) = @ENV{qw(CHANGELOG_PATH NEW_VERSION RELEASE_NOTE)};
  s{\A# 更新日志\n}{$&\n## $version\n\n- $note\n\n}
    or die "未能更新 $path 的标题\\n";
' "$changelog_path"

ROOT_README=README.md SCRIPT_DIR="$script_dir" SCRIPT_NAME="$script_name" OLD_VERSION="$old_version" NEW_VERSION="$new_version" perl -0pi -e '
  my ($path, $dir, $name, $old, $new) = @ENV{qw(ROOT_README SCRIPT_DIR SCRIPT_NAME OLD_VERSION NEW_VERSION)};
  my $old_row = "| [$name](./$dir/) | $old |";
  my $new_row = "| [$name](./$dir/) | $new |";
  s{^\Q$old_row\E}{$new_row}m
    or die "根 README 未找到 $name 的 $old 版本记录\\n";
' README.md

echo "$script_name：$old_version -> $new_version"
echo "已同步：$script_path、$changelog_path、README.md"
