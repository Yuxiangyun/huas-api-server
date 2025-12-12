#!/bin/bash
# 测试运行脚本
# 提供各种测试场景的快捷命令

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  HUAS API 测试套件${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 解析参数
TEST_TYPE="${1:-all}"

case "$TEST_TYPE" in
    "all")
        echo -e "${YELLOW}运行所有测试...${NC}"
        echo -e "${YELLOW}注意: 将跳过 E2E 测试（需要服务器运行）${NC}"
        echo -e "${YELLOW}请使用 './scripts/test.sh e2e' 单独运行 E2E 测试${NC}"
        echo ""
        bun test src/test/unit/ src/test/integration/ src/test/security/ src/test/performance/
        ;;
    
    "unit")
        echo -e "${YELLOW}运行单元测试...${NC}"
        bun test src/test/unit/
        ;;
    
    "integration")
        echo -e "${YELLOW}运行集成测试...${NC}"
        bun test src/test/integration/
        ;;
    
    "e2e")
        echo -e "${YELLOW}运行 E2E 测试...${NC}"
        echo -e "${YELLOW}注意: E2E 测试需要服务器运行在 http://localhost:3000${NC}"
        echo -e "${YELLOW}请先运行: bun run dev${NC}"
        echo ""
        read -p "服务器是否已启动？(y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            bun test src/test/e2e/
        else
            echo -e "${RED}已取消 E2E 测试${NC}"
            exit 1
        fi
        ;;
    
    "security")
        echo -e "${YELLOW}运行安全测试...${NC}"
        bun test src/test/security/
        ;;
    
    "performance")
        echo -e "${YELLOW}运行性能测试...${NC}"
        bun test src/test/performance/
        ;;
    
    "coverage")
        echo -e "${YELLOW}运行测试并生成覆盖率报告...${NC}"
        bun test --coverage src/test/
        ;;
    
    "watch")
        echo -e "${YELLOW}监听模式运行测试...${NC}"
        bun test --watch src/test/
        ;;
    
    "ci")
        echo -e "${YELLOW}CI 模式：运行所有测试（无彩色输出）...${NC}"
        bun test --no-color src/test/
        ;;
    
    "quick")
        echo -e "${YELLOW}快速测试：仅运行单元测试和集成测试...${NC}"
        bun test src/test/unit/ src/test/integration/
        ;;
    
    "smoke")
        echo -e "${YELLOW}烟雾测试：运行关键接口测试...${NC}"
        bun test src/test/e2e/auth-captcha.test.ts src/test/e2e/auth-login.test.ts src/test/e2e/system-health.test.ts
        ;;
    
    *)
        echo -e "${RED}未知的测试类型: $TEST_TYPE${NC}"
        echo ""
        echo "用法: $0 [test-type]"
        echo ""
        echo "可用的测试类型:"
        echo "  all          - 运行所有测试（默认）"
        echo "  unit         - 单元测试"
        echo "  integration  - 集成测试"
        echo "  e2e          - 端到端测试"
        echo "  security     - 安全测试"
        echo "  performance  - 性能测试"
        echo "  coverage     - 测试覆盖率"
        echo "  watch        - 监听模式"
        echo "  ci           - CI 模式"
        echo "  quick        - 快速测试（单元+集成）"
        echo "  smoke        - 烟雾测试（关键接口）"
        exit 1
        ;;
esac

TEST_EXIT_CODE=$?

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ 所有测试通过！${NC}"
else
    echo -e "${RED}❌ 测试失败（退出码: $TEST_EXIT_CODE）${NC}"
fi

echo -e "${GREEN}========================================${NC}"

exit $TEST_EXIT_CODE
