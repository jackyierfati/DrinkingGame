#!/usr/bin/env bash
# 从转盘视频抽取「有效帧」，供人工/AI 逐帧抄词条用。
#
# 关键技巧：用 ffmpeg 的 mpdecimate 只保留画面明显变化的帧。
# 转盘每停在一个结果上会静止一小会儿 —— 正好每个结果留一张清晰图，
# 飞速旋转的模糊过程会被自动丢掉。
#
# 用法：
#   ./tools/extract_frames.sh 视频.mp4 [输出目录]
# 输出：
#   帧图片 frame_0001.png ... 到 输出目录（默认 ./frames）
#
# 之后把 frames/ 里的图片给我，我逐张把中文抄成词条。

set -e
VIDEO="$1"
OUT="${2:-frames}"

if [ -z "$VIDEO" ] || [ ! -f "$VIDEO" ]; then
  echo "用法: $0 视频文件.mp4 [输出目录]"
  echo "（没找到视频文件：$VIDEO）"
  exit 1
fi

mkdir -p "$OUT"
echo "▶ 抽帧中： $VIDEO -> $OUT/"

# mpdecimate 丢弃与前一帧几乎相同的帧；-vsync vfr 让保留下来的帧连续编号。
# hi/lo/frac 阈值可调：数值越小越敏感（保留更多帧）。
ffmpeg -y -i "$VIDEO" \
  -vf "mpdecimate=hi=64*12:lo=64*5:frac=0.33,setpts=N/FRAME_RATE/TB" \
  -vsync vfr \
  "$OUT/frame_%04d.png" \
  -hide_banner -loglevel error

COUNT=$(ls "$OUT" | wc -l | tr -d ' ')
echo "✔ 完成，共保留 $COUNT 张有效帧，在 $OUT/"
echo "  如果结果太多（含模糊旋转帧）：把 mpdecimate 的 hi/lo 调大。"
echo "  如果漏掉了词条：把 hi/lo 调小、frac 调小。"
