#!/bin/bash

# 数据库管理脚本
# 提供数据库备份、恢复、清理等功能

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 默认数据库路径
DB_PATH="${DB_PATH:-huas.sqlite}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 显示帮助信息
show_help() {
    echo "数据库管理脚本"
    echo ""
    echo "用法: $0 <命令> [选项]"
    echo ""
    echo "命令:"
    echo "  backup              备份数据库"
    echo "  restore <file>      从备份恢复"
    echo "  clean               清理过期数据"
    echo "  stats               显示数据库统计"
    echo "  vacuum              优化数据库"
    echo "  help                显示帮助信息"
    echo ""
    echo "环境变量:"
    echo "  DB_PATH             数据库文件路径 (默认: huas.sqlite)"
    echo "  BACKUP_DIR          备份目录 (默认: ./backups)"
    echo ""
}

# 备份数据库
backup_db() {
    if [ ! -f "$DB_PATH" ]; then
        echo -e "${RED}错误: 数据库文件不存在${NC}"
        exit 1
    fi
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/huas_${TIMESTAMP}.sqlite"
    
    echo -e "${YELLOW}开始备份数据库...${NC}"
    cp "$DB_PATH" "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ 备份成功: $BACKUP_FILE${NC}"
        
        # 显示备份文件大小
        SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        echo -e "  大小: $SIZE"
        
        # 清理超过7天的备份
        find "$BACKUP_DIR" -name "huas_*.sqlite" -mtime +7 -delete
        echo -e "${GREEN}✓ 已清理7天前的备份${NC}"
    else
        echo -e "${RED}✗ 备份失败${NC}"
        exit 1
    fi
}

# 恢复数据库
restore_db() {
    BACKUP_FILE=$1
    
    if [ -z "$BACKUP_FILE" ]; then
        echo -e "${RED}错误: 请指定备份文件${NC}"
        echo "用法: $0 restore <backup_file>"
        exit 1
    fi
    
    if [ ! -f "$BACKUP_FILE" ]; then
        echo -e "${RED}错误: 备份文件不存在${NC}"
        exit 1
    fi
    
    # 先备份当前数据库
    if [ -f "$DB_PATH" ]; then
        echo -e "${YELLOW}正在备份当前数据库...${NC}"
        backup_db
    fi
    
    echo -e "${YELLOW}开始恢复数据库...${NC}"
    cp "$BACKUP_FILE" "$DB_PATH"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ 恢复成功${NC}"
    else
        echo -e "${RED}✗ 恢复失败${NC}"
        exit 1
    fi
}

# 清理过期数据
clean_db() {
    if [ ! -f "$DB_PATH" ]; then
        echo -e "${RED}错误: 数据库文件不存在${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}开始清理过期数据...${NC}"
    
    # 计算时间戳
    NOW=$(date +%s)000  # 毫秒时间戳
    ZOMBIE_TIMEOUT=$((10 * 60 * 1000))  # 10分钟
    INACTIVE_TIMEOUT=$((90 * 24 * 60 * 60 * 1000))  # 90天
    CACHE_TIMEOUT=$((60 * 24 * 60 * 60 * 1000))  # 60天
    
    # 清理僵尸会话
    sqlite3 "$DB_PATH" "DELETE FROM sessions WHERE student_id IS NULL AND updated_at < $(($NOW - $ZOMBIE_TIMEOUT));"
    ZOMBIE_COUNT=$(sqlite3 "$DB_PATH" "SELECT changes();")
    echo -e "${GREEN}✓ 清理僵尸会话: $ZOMBIE_COUNT 条${NC}"
    
    # 清理不活跃会话
    sqlite3 "$DB_PATH" "DELETE FROM sessions WHERE updated_at < $(($NOW - $INACTIVE_TIMEOUT));"
    INACTIVE_COUNT=$(sqlite3 "$DB_PATH" "SELECT changes();")
    echo -e "${GREEN}✓ 清理不活跃会话: $INACTIVE_COUNT 条${NC}"
    
    # 清理过期缓存
    sqlite3 "$DB_PATH" "DELETE FROM data_cache WHERE updated_at < $(($NOW - $CACHE_TIMEOUT));"
    CACHE_COUNT=$(sqlite3 "$DB_PATH" "SELECT changes();")
    echo -e "${GREEN}✓ 清理过期缓存: $CACHE_COUNT 条${NC}"
    
    echo -e "${GREEN}清理完成${NC}"
}

# 显示数据库统计
show_stats() {
    if [ ! -f "$DB_PATH" ]; then
        echo -e "${RED}错误: 数据库文件不存在${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}数据库统计信息${NC}"
    echo "================================"
    
    # 数据库大小
    SIZE=$(du -h "$DB_PATH" | cut -f1)
    echo -e "数据库大小: ${GREEN}$SIZE${NC}"
    
    # 用户统计
    TOTAL_USERS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users;")
    echo -e "总用户数: ${GREEN}$TOTAL_USERS${NC}"
    
    # 会话统计
    TOTAL_SESSIONS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sessions;")
    ACTIVE_SESSIONS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sessions WHERE student_id IS NOT NULL;")
    TEMP_SESSIONS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sessions WHERE student_id IS NULL;")
    echo -e "总会话数: ${GREEN}$TOTAL_SESSIONS${NC}"
    echo -e "  - 活跃会话: ${GREEN}$ACTIVE_SESSIONS${NC}"
    echo -e "  - 临时会话: ${YELLOW}$TEMP_SESSIONS${NC}"
    
    # 缓存统计
    TOTAL_CACHE=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM data_cache;")
    SCHEDULE_CACHE=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM data_cache WHERE type='SCHEDULE';")
    ECARD_CACHE=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM data_cache WHERE type='ECARD';")
    USER_CACHE=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM data_cache WHERE type='USER_INFO';")
    echo -e "总缓存记录: ${GREEN}$TOTAL_CACHE${NC}"
    echo -e "  - 课表: ${GREEN}$SCHEDULE_CACHE${NC}"
    echo -e "  - 一卡通: ${GREEN}$ECARD_CACHE${NC}"
    echo -e "  - 用户信息: ${GREEN}$USER_CACHE${NC}"
    
    echo "================================"
}

# 优化数据库
vacuum_db() {
    if [ ! -f "$DB_PATH" ]; then
        echo -e "${RED}错误: 数据库文件不存在${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}开始优化数据库...${NC}"
    
    # 记录优化前大小
    SIZE_BEFORE=$(du -b "$DB_PATH" | cut -f1)
    
    # 执行 VACUUM
    sqlite3 "$DB_PATH" "VACUUM;"
    
    if [ $? -eq 0 ]; then
        # 记录优化后大小
        SIZE_AFTER=$(du -b "$DB_PATH" | cut -f1)
        SAVED=$((SIZE_BEFORE - SIZE_AFTER))
        SAVED_MB=$((SAVED / 1024 / 1024))
        
        echo -e "${GREEN}✓ 优化完成${NC}"
        echo -e "  节省空间: ${GREEN}${SAVED_MB}MB${NC}"
    else
        echo -e "${RED}✗ 优化失败${NC}"
        exit 1
    fi
}

# 主逻辑
case "$1" in
    backup)
        backup_db
        ;;
    restore)
        restore_db "$2"
        ;;
    clean)
        clean_db
        ;;
    stats)
        show_stats
        ;;
    vacuum)
        vacuum_db
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
