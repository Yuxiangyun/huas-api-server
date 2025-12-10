#!/bin/bash

# 部署脚本
# 用于快速部署和重启服务

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 项目配置
PROJECT_NAME="huas-api"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/${PROJECT_NAME}}"
SERVICE_NAME="${PROJECT_NAME}.service"
LOG_DIR="/var/log/${PROJECT_NAME}"

# 显示帮助
show_help() {
    echo -e "${BLUE}部署脚本${NC}"
    echo ""
    echo "用法: $0 <命令>"
    echo ""
    echo "命令:"
    echo "  install        首次安装（创建目录、配置systemd）"
    echo "  deploy         部署代码到服务器"
    echo "  start          启动服务"
    echo "  stop           停止服务"
    echo "  restart        重启服务"
    echo "  status         查看服务状态"
    echo "  logs           查看日志"
    echo "  backup         备份数据库"
    echo "  help           显示帮助"
    echo ""
}

# 检查权限
check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}错误: 请使用 sudo 运行此脚本${NC}"
        exit 1
    fi
}

# 首次安装
install() {
    check_root
    
    echo -e "${YELLOW}开始安装 ${PROJECT_NAME}...${NC}"
    
    # 创建部署目录
    echo -e "${BLUE}创建部署目录...${NC}"
    mkdir -p "$DEPLOY_DIR"
    mkdir -p "$LOG_DIR"
    
    # 创建 systemd 服务文件
    echo -e "${BLUE}配置 systemd 服务...${NC}"
    cat > "/etc/systemd/system/${SERVICE_NAME}" <<EOF
[Unit]
Description=Huas API Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${DEPLOY_DIR}
ExecStart=/usr/local/bin/bun run src/server.ts
Restart=always
RestartSec=10
StandardOutput=append:${LOG_DIR}/stdout.log
StandardError=append:${LOG_DIR}/stderr.log

Environment=NODE_ENV=production
Environment=DB_PATH=${DEPLOY_DIR}/huas.sqlite
Environment=LOG_FILE_PATH=${LOG_DIR}/app.log

[Install]
WantedBy=multi-user.target
EOF
    
    # 重载 systemd
    systemctl daemon-reload
    
    echo -e "${GREEN}✓ 安装完成${NC}"
    echo -e "  部署目录: ${DEPLOY_DIR}"
    echo -e "  日志目录: ${LOG_DIR}"
    echo ""
    echo -e "${YELLOW}下一步: 运行 '$0 deploy' 部署代码${NC}"
}

# 部署代码
deploy() {
    check_root
    
    echo -e "${YELLOW}开始部署...${NC}"
    
    # 检查部署目录
    if [ ! -d "$DEPLOY_DIR" ]; then
        echo -e "${RED}错误: 部署目录不存在，请先运行 install${NC}"
        exit 1
    fi
    
    # 备份数据库
    if [ -f "${DEPLOY_DIR}/huas.sqlite" ]; then
        echo -e "${BLUE}备份数据库...${NC}"
        TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        cp "${DEPLOY_DIR}/huas.sqlite" "${DEPLOY_DIR}/huas_${TIMESTAMP}.sqlite"
        echo -e "${GREEN}✓ 数据库已备份${NC}"
    fi
    
    # 复制文件
    echo -e "${BLUE}复制项目文件...${NC}"
    rsync -av --exclude='node_modules' \
              --exclude='*.log' \
              --exclude='*.sqlite' \
              --exclude='.git' \
              --exclude='backups' \
              ./ "${DEPLOY_DIR}/"
    
    # 安装依赖
    echo -e "${BLUE}安装依赖...${NC}"
    cd "$DEPLOY_DIR"
    bun install --production
    
    echo -e "${GREEN}✓ 部署完成${NC}"
    echo ""
    echo -e "${YELLOW}下一步: 运行 '$0 restart' 重启服务${NC}"
}

# 启动服务
start_service() {
    check_root
    
    echo -e "${BLUE}启动服务...${NC}"
    systemctl start "$SERVICE_NAME"
    
    sleep 2
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        echo -e "${GREEN}✓ 服务启动成功${NC}"
        systemctl status "$SERVICE_NAME" --no-pager
    else
        echo -e "${RED}✗ 服务启动失败${NC}"
        echo -e "${YELLOW}查看日志: journalctl -u ${SERVICE_NAME} -n 50${NC}"
        exit 1
    fi
}

# 停止服务
stop_service() {
    check_root
    
    echo -e "${BLUE}停止服务...${NC}"
    systemctl stop "$SERVICE_NAME"
    
    sleep 2
    if ! systemctl is-active --quiet "$SERVICE_NAME"; then
        echo -e "${GREEN}✓ 服务已停止${NC}"
    else
        echo -e "${RED}✗ 服务停止失败${NC}"
        exit 1
    fi
}

# 重启服务
restart_service() {
    check_root
    
    echo -e "${BLUE}重启服务...${NC}"
    systemctl restart "$SERVICE_NAME"
    
    sleep 2
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        echo -e "${GREEN}✓ 服务重启成功${NC}"
        systemctl status "$SERVICE_NAME" --no-pager
    else
        echo -e "${RED}✗ 服务重启失败${NC}"
        echo -e "${YELLOW}查看日志: journalctl -u ${SERVICE_NAME} -n 50${NC}"
        exit 1
    fi
}

# 查看状态
show_status() {
    systemctl status "$SERVICE_NAME" --no-pager
}

# 查看日志
show_logs() {
    echo -e "${BLUE}实时日志 (Ctrl+C 退出)${NC}"
    journalctl -u "$SERVICE_NAME" -f
}

# 备份数据库
backup_db() {
    check_root
    
    if [ ! -f "${DEPLOY_DIR}/huas.sqlite" ]; then
        echo -e "${RED}错误: 数据库文件不存在${NC}"
        exit 1
    fi
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_DIR="${DEPLOY_DIR}/backups"
    mkdir -p "$BACKUP_DIR"
    
    BACKUP_FILE="${BACKUP_DIR}/huas_${TIMESTAMP}.sqlite"
    
    echo -e "${YELLOW}备份数据库...${NC}"
    cp "${DEPLOY_DIR}/huas.sqlite" "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ 备份成功: ${BACKUP_FILE}${NC}"
        
        # 清理超过30天的备份
        find "$BACKUP_DIR" -name "huas_*.sqlite" -mtime +30 -delete
        echo -e "${GREEN}✓ 已清理30天前的备份${NC}"
    else
        echo -e "${RED}✗ 备份失败${NC}"
        exit 1
    fi
}

# 主逻辑
case "$1" in
    install)
        install
        ;;
    deploy)
        deploy
        ;;
    start)
        start_service
        ;;
    stop)
        stop_service
        ;;
    restart)
        restart_service
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    backup)
        backup_db
        ;;
    help|--help|-h|"")
        show_help
        ;;
    *)
        echo -e "${RED}错误: 未知命令 '$1'${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
