#!/bin/bash
###############################################################################
# HUAS API 部署脚本
# 用于在生产服务器上部署和更新应用
###############################################################################

set -e  # 遇到错误立即退出

# 配置变量
APP_NAME="huas-api"
APP_DIR="/opt/${APP_NAME}"
DATA_DIR="/var/lib/${APP_NAME}"
LOG_DIR="/var/log/${APP_NAME}"
SERVICE_USER="www-data"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then 
    log_error "请使用 sudo 运行此脚本"
    exit 1
fi

log_info "开始部署 ${APP_NAME}..."

# 1. 创建必要的目录
log_info "创建应用目录..."
mkdir -p "${APP_DIR}"
mkdir -p "${DATA_DIR}"
mkdir -p "${LOG_DIR}"

# 2. 复制应用文件
log_info "复制应用文件..."
rsync -av --exclude='node_modules' --exclude='.git' --exclude='*.sqlite*' \
    ./ "${APP_DIR}/"

# 3. 安装依赖
log_info "安装依赖..."
cd "${APP_DIR}"
bun install --production

# 4. 复制环境配置
if [ ! -f "${APP_DIR}/.env.production" ]; then
    log_warn ".env.production 不存在，从示例文件创建"
    if [ -f "${APP_DIR}/.env.production.example" ]; then
        cp "${APP_DIR}/.env.production.example" "${APP_DIR}/.env.production"
    else
        cp "${APP_DIR}/.env.example" "${APP_DIR}/.env.production"
    fi
    log_warn "请编辑 ${APP_DIR}/.env.production 配置生产环境参数"
fi

# 5. 设置文件权限
log_info "设置文件权限..."
chown -R ${SERVICE_USER}:${SERVICE_USER} "${APP_DIR}"
chown -R ${SERVICE_USER}:${SERVICE_USER} "${DATA_DIR}"
chown -R ${SERVICE_USER}:${SERVICE_USER} "${LOG_DIR}"
chmod 640 "${APP_DIR}/.env.production"

# 6. 安装 systemd 服务
log_info "安装 systemd 服务..."
cp "${APP_DIR}/deploy/${APP_NAME}.service" "${SERVICE_FILE}"
systemctl daemon-reload

# 7. 启用并启动服务
log_info "启动服务..."
systemctl enable ${APP_NAME}
systemctl restart ${APP_NAME}

# 8. 检查服务状态
sleep 2
if systemctl is-active --quiet ${APP_NAME}; then
    log_info "✅ ${APP_NAME} 部署成功并正在运行"
    systemctl status ${APP_NAME} --no-pager
else
    log_error "❌ ${APP_NAME} 启动失败"
    journalctl -u ${APP_NAME} -n 50 --no-pager
    exit 1
fi

# 9. 显示有用的命令
log_info "常用命令:"
echo "  查看日志: journalctl -u ${APP_NAME} -f"
echo "  重启服务: systemctl restart ${APP_NAME}"
echo "  查看状态: systemctl status ${APP_NAME}"
echo "  停止服务: systemctl stop ${APP_NAME}"
echo "  健康检查: curl http://localhost:12103/health"
echo "  监控状态: curl http://localhost:13001/status.json"
echo "  监控面板: http://<主机>:13001/dashboard （如仅本机开放可改 MONITOR_HOST=127.0.0.1）"

log_info "部署完成！"
