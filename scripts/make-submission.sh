#!/usr/bin/env bash
# 제출용 소스 폴더 만들기 (LMS 14주차 과제, PPT와 같이 낸다)
# 쓰는 법: bash scripts/make-submission.sh [만들 곳 폴더]  (기본: 저장소 바깥 ../)
# 들어가는 것: git이 관리하는 파일 전부(README 실행 방법 포함). 빠지는 것: node_modules, dist, .git, .env, .expo
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
out_dir="${1:-..}"
date_tag="$(date +%Y%m%d)"
name="babti_source_${date_tag}"
zip_path="$(cd "$out_dir" && pwd)/${name}.zip"
rm -f "$zip_path"
# git archive는 커밋된 파일만 담아서 .env, node_modules, dist가 자동으로 빠진다
git archive --format=zip --prefix="${name}/" -o "$zip_path" HEAD
echo "만든 파일: $zip_path"
echo "크기: $(du -h "$zip_path" | cut -f1)"
echo "파일 수: $(unzip -Z1 "$zip_path" | grep -v '/$' | wc -l | tr -d ' ')"
if unzip -Z1 "$zip_path" | grep -E '(^|/)(node_modules|dist|\.git|\.env)(/|$)'; then
  echo "빠져야 할 파일이 들어 있다" >&2; exit 1
fi
echo "실행 방법: 압축을 풀고 ${name}/README.md 3절"
