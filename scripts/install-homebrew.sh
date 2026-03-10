#!/bin/bash
# Homebrew 安装脚本：优先使用国内镜像，避免 raw.githubusercontent.com 超时
set -e

echo "🦞 Homebrew 安装"
echo "  OS: $(uname -s)"
echo ""

# 国内镜像（Gitee）- 避免 GitHub 超时
HOMEBREW_CN_URL="https://gitee.com/cunkai/HomebrewCN/raw/master/Homebrew.sh"
# 官方
HOMEBREW_OFFICIAL_URL="https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh"

install_with_curl() {
  local url="$1"
  local name="$2"
  echo "[1/2] 尝试从 $name 下载安装脚本..."
  if curl -fsSL --connect-timeout 15 --max-time 60 "$url" -o /tmp/homebrew-install.sh 2>/dev/null; then
    echo "[2/2] 运行安装脚本（可能需要输入管理员密码）..."
    /bin/bash /tmp/homebrew-install.sh
    return 0
  else
    echo "  ✗ 下载失败或超时"
    return 1
  fi
}

if install_with_curl "$HOMEBREW_CN_URL" "国内镜像 (Gitee)"; then
  echo "✓ 安装流程已启动"
else
  echo ""
  echo "尝试官方源..."
  if install_with_curl "$HOMEBREW_OFFICIAL_URL" "官方 (GitHub)"; then
    echo "✓ 安装流程已启动"
  else
    echo "✗ 两个源均不可用，请检查网络或稍后重试。"
    echo "  也可在终端中手动执行："
    echo "  /bin/zsh -c \"\$(curl -fsSL $HOMEBREW_CN_URL)\""
    exit 1
  fi
fi
