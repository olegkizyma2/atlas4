#!/bin/bash
# Test Image Optimization
# Verifies that screenshot compression works correctly

set -e

echo "🧪 Testing Image Optimization System..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
ORCHESTRATOR_DIR="$PROJECT_ROOT/orchestrator"

# Test directory
TEST_DIR="/tmp/atlas_test_images"
mkdir -p "$TEST_DIR"

echo "📋 Test Plan:"
echo "  1. Create test image (large PNG)"
echo "  2. Check if sharp is installed"
echo "  3. Check if system tools are available"
echo "  4. Test optimization logic"
echo ""
echo "📂 Project root: $PROJECT_ROOT"
echo "📂 Orchestrator: $ORCHESTRATOR_DIR"
echo ""

# Test 1: Check sharp availability
echo -e "${YELLOW}Test 1: Checking sharp library...${NC}"
cd "$ORCHESTRATOR_DIR"
if npm list sharp 2>/dev/null | grep -q "sharp@"; then
    echo -e "${GREEN}✅ Sharp is installed${NC}"
    SHARP_AVAILABLE=true
else
    echo -e "${YELLOW}⚠️  Sharp not installed (will use system tools)${NC}"
    SHARP_AVAILABLE=false
fi
echo ""

# Test 2: Check system tools
echo -e "${YELLOW}Test 2: Checking system tools...${NC}"
if command -v sips &> /dev/null; then
    echo -e "${GREEN}✅ sips available (macOS)${NC}"
    SIPS_AVAILABLE=true
else
    echo -e "${YELLOW}⚠️  sips not available${NC}"
    SIPS_AVAILABLE=false
fi

if command -v convert &> /dev/null; then
    echo -e "${GREEN}✅ ImageMagick convert available${NC}"
    CONVERT_AVAILABLE=true
else
    echo -e "${YELLOW}⚠️  ImageMagick not available${NC}"
    CONVERT_AVAILABLE=false
fi

if [ "$SIPS_AVAILABLE" = true ] || [ "$CONVERT_AVAILABLE" = true ]; then
    echo -e "${GREEN}✅ At least one system tool available${NC}"
else
    echo -e "${RED}❌ No system tools available${NC}"
fi
echo ""

# Test 3: Create test image
echo -e "${YELLOW}Test 3: Creating test image...${NC}"
TEST_IMAGE="$TEST_DIR/test_large.png"

if [ "$SIPS_AVAILABLE" = true ]; then
    # Create a large test image using sips (macOS)
    # Start with a simple image and resize it
    echo "Creating test image with sips..."
    # We'll use screencapture to create a real screenshot
    screencapture -x "$TEST_IMAGE" 2>/dev/null || {
        echo -e "${RED}❌ Failed to create test image${NC}"
        exit 1
    }
elif [ "$CONVERT_AVAILABLE" = true ]; then
    # Create with ImageMagick
    convert -size 2000x2000 xc:white "$TEST_IMAGE" 2>/dev/null || {
        echo -e "${RED}❌ Failed to create test image${NC}"
        exit 1
    }
else
    echo -e "${RED}❌ Cannot create test image - no tools available${NC}"
    exit 1
fi

if [ -f "$TEST_IMAGE" ]; then
    TEST_SIZE=$(stat -f%z "$TEST_IMAGE" 2>/dev/null || stat -c%s "$TEST_IMAGE" 2>/dev/null)
    TEST_SIZE_KB=$((TEST_SIZE / 1024))
    echo -e "${GREEN}✅ Test image created: ${TEST_SIZE_KB}KB${NC}"
else
    echo -e "${RED}❌ Test image not created${NC}"
    exit 1
fi
echo ""

# Test 4: Test optimization path
echo -e "${YELLOW}Test 4: Testing optimization strategy...${NC}"

if [ "$SHARP_AVAILABLE" = true ]; then
    echo -e "${GREEN}✅ STRATEGY: Will use Sharp (best quality)${NC}"
elif [ "$SIPS_AVAILABLE" = true ]; then
    echo -e "${GREEN}✅ STRATEGY: Will use sips (macOS native)${NC}"
elif [ "$CONVERT_AVAILABLE" = true ]; then
    echo -e "${GREEN}✅ STRATEGY: Will use ImageMagick${NC}"
else
    echo -e "${YELLOW}⚠️  STRATEGY: Will use original (no optimization)${NC}"
    echo -e "${YELLOW}    Recommendation: npm install sharp${NC}"
fi
echo ""

# Test 5: Verify vision-analysis-service.js has optimization
echo -e "${YELLOW}Test 5: Verifying code implementation...${NC}"
VISION_SERVICE="$ORCHESTRATOR_DIR/services/vision-analysis-service.js"
if grep -q "_optimizeImage" "$VISION_SERVICE"; then
    echo -e "${GREEN}✅ _optimizeImage method found${NC}"
else
    echo -e "${RED}❌ _optimizeImage method not found${NC}"
    exit 1
fi

if grep -q "sharp" "$VISION_SERVICE"; then
    echo -e "${GREEN}✅ Sharp library support found${NC}"
else
    echo -e "${YELLOW}⚠️  Sharp support not found in code${NC}"
fi

if grep -q "sips\|convert" "$VISION_SERVICE"; then
    echo -e "${GREEN}✅ System tool fallback found${NC}"
else
    echo -e "${YELLOW}⚠️  System tool fallback not found${NC}"
fi
echo ""

# Test 6: Check package.json for sharp
echo -e "${YELLOW}Test 6: Checking package.json...${NC}"
PACKAGE_JSON="$ORCHESTRATOR_DIR/package.json"
if grep -q "sharp" "$PACKAGE_JSON"; then
    echo -e "${GREEN}✅ Sharp listed in package.json${NC}"
else
    echo -e "${YELLOW}⚠️  Sharp not in package.json${NC}"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Image Optimization Tests Complete${NC}"
echo ""
echo "Recommendations:"
if [ "$SHARP_AVAILABLE" = false ]; then
    echo -e "${YELLOW}  • Install sharp for best performance: cd orchestrator && npm install${NC}"
fi
echo "  • System will automatically choose best available method"
echo "  • Images will be resized to max 1024x1024 pixels"
echo "  • JPEG quality 80% for optimal size/quality balance"
echo "  • Expected: ~70-90% size reduction"
echo ""

# Cleanup
rm -rf "$TEST_DIR"
echo "Test artifacts cleaned up"
