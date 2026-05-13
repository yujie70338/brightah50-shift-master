#!/usr/bin/env bash
# ============================================================
# dev-start.sh — 一鍵啟動本地開發環境 + 建立測試使用者
#
# 用法：
#   ./dev-start.sh          # 啟動 emulator + seed（預設）
#   ./dev-start.sh seed     # 只執行 seed（emulator 已在跑）
#   ./dev-start.sh kill     # 清除所有 emulator port
# ============================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JAVA_HOME_PATH="/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home"
EMULATOR_PORTS=(8080 9099 5002 4000 4400 4500 5001)

# ── 顏色輸出 ──────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'
log()   { echo -e "${CYAN}[dev-start]${NC} $*"; }
ok()    { echo -e "${GREEN}[  OK  ]${NC} $*"; }
warn()  { echo -e "${YELLOW}[ WARN ]${NC} $*"; }
error() { echo -e "${RED}[ FAIL ]${NC} $*"; }

# ── 清除 port ─────────────────────────────────────────────
kill_ports() {
  log "清除 emulator ports: ${EMULATOR_PORTS[*]}"
  for port in "${EMULATOR_PORTS[@]}"; do
    local pids
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      echo "$pids" | xargs kill -9 2>/dev/null || true
      warn "已清除 port $port"
    fi
  done
  ok "Port 清除完成"
}

# ── seed Firestore users ──────────────────────────────────
seed_firestore() {
  log "Seed Firestore 使用者..."
  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
    node "$PROJECT_ROOT/scripts/seed-users.js"
  ok "Firestore seed 完成"
}

# ── seed Auth emulator ────────────────────────────────────
seed_auth() {
  log "Seed Auth emulator 使用者..."
  node "$PROJECT_ROOT/scripts/seed-auth.js"
  ok "Auth seed 完成"
}

# ── 驗證 seed 結果 ────────────────────────────────────────
verify_seed() {
  log "驗證 seed 結果..."
  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node -e "
const admin = require('$PROJECT_ROOT/functions/node_modules/firebase-admin');
try { admin.app(); } catch { admin.initializeApp({ projectId: 'brightah50-shift-master' }); }
admin.firestore().collection('users').get().then(s => {
  const count = s.size;
  const managers = s.docs.filter(d => d.data().role === 'manager').length;
  const staff = s.docs.filter(d => d.data().role === 'staff').length;
  console.log('  使用者總數:', count, '（manager:', managers, '/ staff:', staff + '）');
  if (count === 9) {
    console.log('  ✅ Seed 驗證通過');
  } else {
    console.log('  ⚠️  預期 9 筆，實際', count, '筆');
  }
  process.exit(0);
});
"
}

# ── 等待 emulator 就緒 ────────────────────────────────────
wait_for_emulator() {
  log "等待 Firestore emulator 就緒（最多 30 秒）..."
  local retries=0
  until curl -sf http://127.0.0.1:8080 > /dev/null 2>&1; do
    retries=$((retries + 1))
    if [[ $retries -ge 30 ]]; then
      error "Firestore emulator 未能在 30 秒內啟動，請檢查輸出"
      return 1
    fi
    sleep 1
  done
  ok "Firestore emulator 已就緒"

  log "等待 Auth emulator 就緒..."
  retries=0
  until curl -sf http://127.0.0.1:9099 > /dev/null 2>&1; do
    retries=$((retries + 1))
    if [[ $retries -ge 30 ]]; then
      error "Auth emulator 未能在 30 秒內啟動"
      return 1
    fi
    sleep 1
  done
  ok "Auth emulator 已就緒"
}

# ── 只執行 seed（emulator 已在跑）─────────────────────────
do_seed_only() {
  log "僅執行 seed（emulator 應已在 8080/9099 運行）"
  seed_firestore
  seed_auth
  verify_seed
  echo ""
  ok "Seed 完成！前端：http://localhost:5002"
  echo ""
  echo "  測試帳號（在 http://localhost:5002/login 以 Email/Password 登入）："
  echo "  ┌─────────────────────────────┬──────────────┬──────────┐"
  echo "  │ Email                       │ 名稱         │ 角色     │"
  echo "  ├─────────────────────────────┼──────────────┼──────────┤"
  echo "  │ manager@brightah50.com      │ 陳經理       │ manager  │"
  echo "  │ staff1@brightah50.com       │ 王小明       │ staff    │"
  echo "  │ staff2@brightah50.com       │ 李小華       │ staff    │"
  echo "  │ staff3@brightah50.com       │ 張小美       │ staff    │"
  echo "  │ staff4@brightah50.com       │ 吳大山       │ staff    │"
  echo "  │ staff5@brightah50.com       │ 林小雨       │ staff    │"
  echo "  │ staff6@brightah50.com       │ 趙志明       │ staff    │"
  echo "  │ staff7@brightah50.com       │ 黃美玲       │ staff    │"
  echo "  │ staff8@brightah50.com       │ 周大偉       │ 停用     │"
  echo "  └─────────────────────────────┴──────────────┴──────────┘"
  echo "  密碼統一：test1234"
}

# ── 啟動 emulator + seed ──────────────────────────────────
do_start() {
  # 設定 Java 21
  export JAVA_HOME="$JAVA_HOME_PATH"
  if ! java -version 2>&1 | grep -q "21"; then
    warn "JAVA_HOME 指向的 Java 版本可能不是 21，若 emulator 啟動失敗請確認"
  fi

  # 清除可能衝突的 port
  kill_ports

  log "啟動 Firebase Emulator（背景執行）..."
  cd "$PROJECT_ROOT"
  npx firebase-tools@latest emulators:start \
    --project brightah50-shift-master \
    > /tmp/firebase-emulator.log 2>&1 &
  EMULATOR_PID=$!
  echo "$EMULATOR_PID" > /tmp/firebase-emulator.pid
  log "Emulator PID: $EMULATOR_PID（log：/tmp/firebase-emulator.log）"

  # 等待就緒
  if ! wait_for_emulator; then
    error "Emulator 啟動失敗。查看 log："
    tail -30 /tmp/firebase-emulator.log
    exit 1
  fi

  # 等額外 2 秒讓 hosting server 完全就緒
  sleep 2

  # 執行 seed
  seed_firestore
  seed_auth
  verify_seed

  echo ""
  ok "=== 環境就緒！==="
  echo ""
  echo "  前端（排班系統）： http://localhost:5002"
  echo "  Emulator UI：    http://127.0.0.1:4000"
  echo "  Firestore：      http://127.0.0.1:8080"
  echo "  Auth：           http://127.0.0.1:9099"
  echo ""
  echo "  測試帳號（Email/Password 登入）："
  echo "  ┌─────────────────────────────┬──────────────┬──────────┐"
  echo "  │ Email                       │ 名稱         │ 角色     │"
  echo "  ├─────────────────────────────┼──────────────┼──────────┤"
  echo "  │ manager@brightah50.com      │ 陳經理       │ manager  │"
  echo "  │ staff1@brightah50.com       │ 王小明       │ staff    │"
  echo "  │ staff2@brightah50.com       │ 李小華       │ staff    │"
  echo "  │ staff3@brightah50.com       │ 張小美       │ staff    │"
  echo "  │ staff4@brightah50.com       │ 吳大山       │ staff    │"
  echo "  │ staff5@brightah50.com       │ 林小雨       │ staff    │"
  echo "  │ staff6@brightah50.com       │ 趙志明       │ staff    │"
  echo "  │ staff7@brightah50.com       │ 黃美玲       │ staff    │"
  echo "  │ staff8@brightah50.com       │ 周大偉       │ 停用     │"
  echo "  └─────────────────────────────┴──────────────┴──────────┘"
  echo "  密碼統一：test1234"
  echo ""
  echo "  停止 emulator：kill \$(cat /tmp/firebase-emulator.pid)"
  echo "  查看 emulator log：tail -f /tmp/firebase-emulator.log"
}

# ── 主入口 ────────────────────────────────────────────────
case "${1:-start}" in
  seed)
    do_seed_only
    ;;
  kill)
    kill_ports
    ;;
  start|"")
    do_start
    ;;
  *)
    echo "用法：$0 [start|seed|kill]"
    echo "  start（預設）— 啟動 emulator + seed 使用者"
    echo "  seed          — 只執行 seed（emulator 需已在跑）"
    echo "  kill          — 清除所有 emulator port"
    exit 1
    ;;
esac
