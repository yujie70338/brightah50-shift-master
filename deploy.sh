#!/usr/bin/env bash
# ============================================================
# deploy.sh — Firebase 生產環境部署腳本
#
# 用法：
#   ./deploy.sh               # 完整部署（functions + firestore + hosting）
#   ./deploy.sh functions     # 只部署 Cloud Functions
#   ./deploy.sh hosting       # 只部署 Hosting（含 webapp build）
#   ./deploy.sh firestore     # 只部署 Firestore rules + indexes
#
# 前置條件（手動操作，只需首次部署時執行）：
#   1. Firebase 已升級至 Blaze 方案
#   2. Firebase Auth 已升級至 Identity Platform
#   3. Firestore 資料庫已在 asia-northeast1 建立
#   4. Authentication → Sign-in method 已啟用 Google
#   5. 第一位 manager 用戶已手動新增至 Firestore users/{email}
# ============================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# ── 顏色輸出 ──────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'
log()   { echo -e "${CYAN}[deploy]${NC} $*"; }
ok()    { echo -e "${GREEN}[  OK  ]${NC} $*"; }
warn()  { echo -e "${YELLOW}[ WARN ]${NC} $*"; }
error() { echo -e "${RED}[ FAIL ]${NC} $*"; exit 1; }

# ── 確認 Firebase CLI 已登入 ──────────────────────────────
check_auth() {
  log "確認 Firebase 登入狀態..."
  if ! npx firebase-tools@latest projects:list --json > /dev/null 2>&1; then
    error "尚未登入 Firebase，請先執行：npx firebase-tools@latest login"
  fi
  ok "Firebase 已登入"
}

# ── 建置 functions ─────────────────────────────────────────
build_functions() {
  log "建置 Cloud Functions（TypeScript → JavaScript）..."
  cd "$PROJECT_ROOT/functions"
  npm run build
  cd "$PROJECT_ROOT"
  ok "Functions 建置完成"
}

# ── 建置 webapp ────────────────────────────────────────────
build_webapp() {
  log "建置 webapp（tsc + vite build）..."
  cd "$PROJECT_ROOT/webapp"
  npm run build
  cd "$PROJECT_ROOT"
  ok "Webapp 建置完成"
}

# ── 部署 Cloud Functions ──────────────────────────────────
deploy_functions() {
  log "部署 Cloud Functions..."
  npx -y firebase-tools@latest deploy --only functions
  ok "Cloud Functions 部署完成"
}

# ── 部署 Firestore rules + indexes ────────────────────────
deploy_firestore() {
  log "部署 Firestore rules 和 indexes..."
  npx -y firebase-tools@latest deploy --only firestore
  ok "Firestore 部署完成"
}

# ── 部署 Hosting ──────────────────────────────────────────
deploy_hosting() {
  log "部署 Firebase Hosting..."
  npx -y firebase-tools@latest deploy --only hosting
  ok "Hosting 部署完成"
}

# ── 完整部署 ──────────────────────────────────────────────
deploy_all() {
  check_auth
  log "開始完整部署至 Firebase 生產環境..."
  echo ""
  npx -y firebase-tools@latest deploy --only firestore,hosting,functions
  echo ""
  ok "✅ 部署完成！"
  echo ""
  echo "  生產網址：https://brightah50-shift-master.web.app"
  echo "  Firebase Console：https://console.firebase.google.com/project/brightah50-shift-master/overview"
  echo ""
}

# ── 主邏輯 ────────────────────────────────────────────────
TARGET="${1:-all}"

case "$TARGET" in
  all)
    deploy_all
    ;;
  functions)
    check_auth
    deploy_functions
    ;;
  hosting)
    check_auth
    deploy_hosting
    ;;
  firestore)
    check_auth
    deploy_firestore
    ;;
  *)
    echo "用法：$0 [all|functions|hosting|firestore]"
    echo ""
    echo "  all        完整部署（預設）"
    echo "  functions  只部署 Cloud Functions"
    echo "  hosting    只部署 Hosting"
    echo "  firestore  只部署 Firestore rules + indexes"
    exit 1
    ;;
esac
