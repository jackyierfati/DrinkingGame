#!/usr/bin/env bash
# 一键本地运行：起个静态服务器，浏览器打开就能玩。
# 用法：  ./serve.sh          （默认 8555 端口）
#         ./serve.sh 3000     （指定端口）
PORT="${1:-8555}"
URL="http://localhost:${PORT}"
echo "🍻 喝酒转盘运行中： ${URL}"
echo "   改完代码刷新浏览器即可看到效果，Ctrl+C 停止。"

# 尽量自动打开浏览器（各系统命令不同，失败也不影响）
( sleep 1
  if command -v open >/dev/null 2>&1; then open "$URL"            # macOS
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"  # Linux
  elif command -v start >/dev/null 2>&1; then start "$URL"        # Git Bash/Windows
  fi ) >/dev/null 2>&1 &

# 优先 python3，退而求其次 python
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server "$PORT"
elif command -v python >/dev/null 2>&1; then
  python -m http.server "$PORT"
else
  echo "没找到 python，请手动用任意静态服务器打开本目录，或直接双击 index.html"
  exit 1
fi
