#!/bin/bash

# Demo Setup Script for Flaky Test Detector
# This script sets up sample data and demonstrates the platform functionality

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL=${API_URL:-"http://localhost:3001/api"}
FRONTEND_URL=${FRONTEND_URL:-"http://localhost:5173"}
DEMO_EMAIL=${DEMO_EMAIL:-"demo@flakytest-detector.com"}
DEMO_PASSWORD=${DEMO_PASSWORD:-"demo123456"}
DEMO_PROJECT_NAME=${DEMO_PROJECT_NAME:-"Demo Project"}
DEMO_REPO=${DEMO_REPO:-"demo-org/demo-app"}

echo -e "${BLUE}🚀 Flaky Test Detector Demo Setup${NC}"
echo "=================================="
echo ""
echo "This script will:"
echo "1. Create a demo user account"
echo "2. Create a sample project"
echo "3. Generate realistic test data"
echo "4. Simulate webhook events"
echo "5. Run flaky test analysis"
echo ""

# Check if servers are running
echo -e "${YELLOW}Checking server status...${NC}"

if ! curl -s "$API_URL/health" > /dev/null; then
    echo -e "${RED}❌ Backend server not running at $API_URL${NC}"
    echo "Please start the backend server with: npm run dev:backend"
    exit 1
fi

if ! curl -s "$FRONTEND_URL" > /dev/null; then
    echo -e "${YELLOW}⚠️  Frontend server not running at $FRONTEND_URL${NC}"
    echo "Please start the frontend server with: npm run dev:frontend"
    echo "Continuing with backend-only demo..."
fi

echo -e "${GREEN}✅ Backend server is running${NC}"

# Function to make API requests
make_api_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local auth_header=$4
    
    local curl_cmd="curl -s -X $method"
    
    if [ ! -z "$auth_header" ]; then
        curl_cmd="$curl_cmd -H 'Authorization: Bearer $auth_header'"
    fi
    
    curl_cmd="$curl_cmd -H 'Content-Type: application/json'"
    
    if [ ! -z "$data" ]; then
        curl_cmd="$curl_cmd -d '$data'"
    fi
    
    curl_cmd="$curl_cmd $API_URL$endpoint"
    
    eval $curl_cmd
}

# Step 1: Create demo user
echo ""
echo -e "${YELLOW}Step 1: Creating demo user...${NC}"

register_response=$(make_api_request "POST" "/auth/register" "{
    \"name\": \"Demo User\",
    \"email\": \"$DEMO_EMAIL\",
    \"password\": \"$DEMO_PASSWORD\"
}")

if echo "$register_response" | grep -q "error"; then
    echo -e "${YELLOW}⚠️  User may already exist, trying to login...${NC}"
fi

# Login to get token
login_response=$(make_api_request "POST" "/auth/login" "{
    \"email\": \"$DEMO_EMAIL\",
    \"password\": \"$DEMO_PASSWORD\"
}")

if echo "$login_response" | grep -q "error"; then
    echo -e "${RED}❌ Login failed: $login_response${NC}"
    exit 1
fi

# Extract token (basic JSON parsing)
TOKEN=$(echo "$login_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Failed to extract auth token${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Demo user created/logged in successfully${NC}"

# Step 2: Create demo project
echo ""
echo -e "${YELLOW}Step 2: Creating demo project...${NC}"

project_response=$(make_api_request "POST" "/projects" "{
    \"name\": \"$DEMO_PROJECT_NAME\",
    \"repository\": \"$DEMO_REPO\",
    \"branch\": \"main\"
}" "$TOKEN")

if echo "$project_response" | grep -q "error"; then
    echo -e "${RED}❌ Project creation failed: $project_response${NC}"
    exit 1
fi

# Extract project ID
PROJECT_ID=$(echo "$project_response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ Failed to extract project ID${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Demo project created with ID: $PROJECT_ID${NC}"

# Step 3: Generate sample test data
echo ""
echo -e "${YELLOW}Step 3: Generating sample test data...${NC}"

# Check if Node.js is available
if ! command -v node > /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js to generate sample data.${NC}"
    exit 1
fi

# Install node-fetch if not available
if ! node -e "require('node-fetch')" 2>/dev/null; then
    echo "Installing node-fetch..."
    npm install node-fetch
fi

export PROJECT_ID="$PROJECT_ID"
export BEARER_TOKEN="$TOKEN"
export NUM_RUNS=20

echo "Generating 20 test runs with flaky patterns..."
node scripts/generate-sample-data.js

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Sample data generation failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Sample test data generated${NC}"

# Step 4: Simulate webhook events
echo ""
echo -e "${YELLOW}Step 4: Simulating CI/CD webhook events...${NC}"

export WEBHOOK_URL="$API_URL/webhooks"
export PROJECT_REPO="$DEMO_REPO"

echo "Sending sample webhooks from different CI systems..."
node scripts/test-webhooks.js scenarios

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Some webhook tests may have failed (this is expected for demo)${NC}"
fi

echo -e "${GREEN}✅ Webhook simulation completed${NC}"

# Step 5: Run flaky test analysis
echo ""
echo -e "${YELLOW}Step 5: Running flaky test analysis...${NC}"

analysis_response=$(make_api_request "POST" "/flaky-tests/analyze" "{
    \"projectId\": \"$PROJECT_ID\"
}" "$TOKEN")

if echo "$analysis_response" | grep -q "error"; then
    echo -e "${RED}❌ Flaky test analysis failed: $analysis_response${NC}"
else
    # Extract analysis results
    flaky_count=$(echo "$analysis_response" | grep -o '"total":[0-9]*' | cut -d':' -f2)
    echo -e "${GREEN}✅ Flaky test analysis completed - Found $flaky_count flaky tests${NC}"
fi

# Step 6: Display demo information
echo ""
echo -e "${BLUE}🎉 Demo Setup Complete!${NC}"
echo "=================================="
echo ""
echo -e "${GREEN}Demo Credentials:${NC}"
echo "Email: $DEMO_EMAIL"
echo "Password: $DEMO_PASSWORD"
echo "Project ID: $PROJECT_ID"
echo ""
echo -e "${GREEN}What to do next:${NC}"
echo "1. Open the frontend at: $FRONTEND_URL"
echo "2. Login with the demo credentials"
echo "3. Navigate to the '$DEMO_PROJECT_NAME' project"
echo "4. Explore the following tabs:"
echo "   - 📊 Overview: Project statistics and quick setup"
echo "   - 📋 Test Results: View generated test runs"
echo "   - ⚠️  Flaky Tests: See detected flaky test patterns"
echo "   - 🔄 Retry Logic: Configure automatic retry settings"
echo "   - 🔗 CI/CD Setup: Webhook configuration"
echo ""
echo -e "${GREEN}API Endpoints to test:${NC}"
echo "• GET $API_URL/flaky-tests/$PROJECT_ID"
echo "• GET $API_URL/test-results/$PROJECT_ID"
echo "• GET $API_URL/retry-logic/$PROJECT_ID/stats"
echo ""
echo -e "${GREEN}Sample API calls:${NC}"
echo "# Get flaky tests"
echo "curl -H 'Authorization: Bearer $TOKEN' $API_URL/flaky-tests/$PROJECT_ID"
echo ""
echo "# Get retry statistics"
echo "curl -H 'Authorization: Bearer $TOKEN' $API_URL/retry-logic/$PROJECT_ID/stats"
echo ""
echo "# Run new analysis"
echo "curl -X POST -H 'Authorization: Bearer $TOKEN' -H 'Content-Type: application/json' \\"
echo "  -d '{\"projectId\":\"$PROJECT_ID\"}' $API_URL/flaky-tests/analyze"
echo ""

# Step 7: Optional - Start continuous webhook simulation
read -p "Start continuous webhook simulation? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Starting 2-minute continuous webhook simulation...${NC}"
    node scripts/test-webhooks.js continuous 2 &
    WEBHOOK_PID=$!
    
    echo "Webhook simulation running in background (PID: $WEBHOOK_PID)"
    echo "This will generate webhooks every 5-30 seconds for 2 minutes"
    echo ""
    echo "To stop manually: kill $WEBHOOK_PID"
fi

echo -e "${BLUE}Demo setup is complete! Enjoy exploring the Flaky Test Detector! 🚀${NC}"