#!/usr/bin/env bash
# MODBAY 一键停止（停掉占用 8321 端口的服务）
cd "$(dirname "$0")" || exit 1
PORT="${1:-8321}"

PIDS=$(netstat -ano 2>/dev/null | grep ":${PORT} " | grep LISTENING | awk '{print $NF}' | sort -u)
if [ -z "$PIDS" ]; then
  echo "[OK] ${PORT} 端口没有在跑的服务"
  exit 0
fi

for P in $PIDS; do
  echo "停止 PID ${P}"
  # Windows：taskkill；其他平台：kill
  if command -v taskkill >/dev/null 2>&1; then
    taskkill //PID "$P" //F 2>/dev/null
  else
    kill "$P" 2>/dev/null
  fi
done

sleep 1
if netstat -ano 2>/dev/null | grep -q ":${PORT} .*LISTENING"; then
  echo "[WARN] 仍被占用，请手动结束进程"
else
  echo "[OK] 已停止"
fi
