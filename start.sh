#!/usr/bin/env bash
# MODBAY 一键启动（Git Bash / Linux / macOS）
# 用法：./start.sh [端口]   （默认 8321，站点 + 支付网关同端口）
cd "$(dirname "$0")" || exit 1

PORT="${1:-8321}"

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] 未找到 node，请先安装 Node.js"; exit 1
fi

if netstat -ano 2>/dev/null | grep -q ":${PORT} .*LISTENING"; then
  echo "[WARN] ${PORT} 端口已被占用，先运行 ./stop.sh 释放端口"; exit 1
fi

PORT="${PORT}" node server/server.js &
SRV=$!
sleep 1.5

if curl -s -o /dev/null "http://127.0.0.1:${PORT}/index.html"; then
  echo "[OK] 服务已启动 → http://127.0.0.1:${PORT} （PID ${SRV}）"
  echo "     停止：./stop.sh  或 kill ${SRV}"
  # 能开浏览器就开
  command -v cmd >/dev/null 2>&1 && cmd /c start "" "http://127.0.0.1:${PORT}/index.html" 2>/dev/null
else
  echo "[ERROR] 启动失败，详见上方输出"; kill ${SRV} 2>/dev/null; exit 1
fi
