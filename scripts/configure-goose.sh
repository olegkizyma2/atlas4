#!/bin/bash

# =============================================================================
# ATLAS - Quick Goose Configuration Script
# =============================================================================
# Швидке налаштування Goose AI для роботи з GitHub Copilot або GitHub Models
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🦆 Goose AI Configuration for ATLAS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Створити директорію config
mkdir -p "$HOME/.config/goose"

# Перевірка існуючої конфігурації
if [ -f "$HOME/.config/goose/config.yaml" ]; then
    if grep -q "provider:" "$HOME/.config/goose/config.yaml" 2>/dev/null; then
        echo -e "${GREEN}✅ Goose вже налаштовано${NC}"
        echo ""
        echo "Поточна конфігурація:"
        cat "$HOME/.config/goose/config.yaml"
        echo ""
        read -p "Перезаписати конфігурацію? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Конфігурацію збережено. Вихід."
            exit 0
        fi
    fi
fi

# Створити Goose config з GitHub Models API
echo -e "${YELLOW}Створюємо конфігурацію Goose для GitHub Models...${NC}"

cat > "$HOME/.config/goose/config.yaml" << 'GOOSE_CONFIG'
# Goose AI Configuration for ATLAS
# Provider: GitHub Models API
# Generated: $(date)

provider: openai
model: gpt-4o

# GitHub Models API Configuration
openai:
  api_key: ${GITHUB_TOKEN}
  base_url: https://models.inference.ai.azure.com
  
# Available GitHub Models:
# - gpt-4o (recommended)
# - gpt-4o-mini
# - gpt-4-turbo
# - Llama-3.2-11B-Vision-Instruct
# - Llama-3.2-90B-Vision-Instruct
# - Phi-3.5-mini-instruct
# - Phi-3.5-MoE-instruct
# - Meta-Llama-3.1-405B-Instruct
# - Meta-Llama-3.1-70B-Instruct
# - Meta-Llama-3.1-8B-Instruct
# - Mistral-large
# - Mistral-large-2407
# - Mistral-Nemo
# - Mistral-small
# - Cohere-command-r-plus
# - Cohere-command-r
# - AI21-Jamba-1.5-Large
# - AI21-Jamba-1.5-Mini
GOOSE_CONFIG

echo -e "${GREEN}✅ Конфігурація створена: ${NC}$HOME/.config/goose/config.yaml"
echo ""

# Перевірка API ключів
echo -e "${YELLOW}Перевірка GitHub Token...${NC}"

if [ -n "$GITHUB_TOKEN" ]; then
    echo -e "${GREEN}✅ GITHUB_TOKEN знайдено в environment${NC}"
    echo "   Goose готовий до роботи з GitHub Models!"
    echo ""
    echo -e "${CYAN}📊 Доступні моделі через GitHub Models:${NC}"
    echo "   • gpt-4o (рекомендовано)"
    echo "   • gpt-4o-mini (швидка)"
    echo "   • Meta-Llama-3.1-405B-Instruct"
    echo "   • Mistral-large-2407"
    echo "   • та багато інших..."
else
    echo -e "${RED}❌ GITHUB_TOKEN НЕ знайдено в environment${NC}"
    echo ""
    echo "Налаштуйте GitHub Token для доступу до GitHub Models:"
    echo ""
    echo -e "${CYAN}📋 Як отримати GitHub Token:${NC}"
    echo ""
    echo "  1. Відкрийте: https://github.com/settings/tokens"
    echo "  2. Натисніть 'Generate new token' → 'Generate new token (classic)'"
    echo "  3. Виберіть scopes:"
    echo "     ✓ read:user"
    echo "     ✓ read:project"
    echo "  4. Generate token → скопіюйте (ghp_...)"
    echo ""
    
    # Інтерактивне додавання ключа
    read -p "Бажаєте додати GitHub Token зараз? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        read -p "Введіть GitHub Token (ghp_...): " github_token
        
        if [[ -n "$github_token" ]]; then
            # Додати до ~/.zshrc
            echo "export GITHUB_TOKEN='$github_token'" >> ~/.zshrc
            export GITHUB_TOKEN="$github_token"
            
            # Також додати до .env файлу проекту
            if [ -f ".env" ]; then
                # Перевірити чи вже є GITHUB_TOKEN
                if grep -q "^GITHUB_TOKEN=" .env; then
                    # Оновити існуючий
                    sed -i '' "s|^GITHUB_TOKEN=.*|GITHUB_TOKEN=$github_token|" .env
                else
                    # Додати новий
                    echo "GITHUB_TOKEN=$github_token" >> .env
                fi
            else
                # Створити .env
                echo "GITHUB_TOKEN=$github_token" > .env
            fi
            
            echo -e "${GREEN}✅ GITHUB_TOKEN додано до ~/.zshrc${NC}"
            echo -e "${GREEN}✅ GITHUB_TOKEN додано до .env${NC}"
            echo ""
            echo -e "${YELLOW}⚠️  Перезавантажте shell: source ~/.zshrc${NC}"
        else
            echo -e "${YELLOW}Пропущено - token порожній${NC}"
        fi
    fi
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Goose конфігурація завершена!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Наступні кроки:"
if [ -n "$GITHUB_TOKEN" ]; then
    echo "  1. ✅ GitHub Token налаштовано"
    echo "  2. Тестуйте Goose: goose run 'echo Hello from GitHub Models'"
    echo "  3. Запустіть ATLAS: ./restart_system.sh start"
else
    echo "  1. Додайте GitHub Token (якщо пропустили):"
    echo "     export GITHUB_TOKEN='ghp_...'"
    echo "     echo 'export GITHUB_TOKEN=\"ghp_...\"' >> ~/.zshrc"
    echo "  2. Перезавантажте shell: source ~/.zshrc"
    echo "  3. Тестуйте Goose: goose run 'echo Hello'"
    echo "  4. Запустіть ATLAS: ./restart_system.sh start"
fi
echo ""
echo -e "${CYAN}📚 Детальна документація:${NC}"
echo "   • Goose config: ~/.config/goose/config.yaml"
echo "   • GitHub Models: https://github.com/marketplace/models"
echo "   • ATLAS docs: docs/GOOSE_CONFIGURATION_FIX_2025-10-12.md"
echo ""

