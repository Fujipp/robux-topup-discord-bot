#!/bin/bash
# Quick Deploy Script - ใช้สคริปต์นี้แทน deploy-azure.sh

set -e

RESOURCE_GROUP="kanom-roblox-rg"
APP_NAME="kanom-roblox"
LOCATION="southeastasia"
PLAN_NAME="kanom-plan"
RUNTIME="NODE:20-lts"

echo "🚀 Quick Deploy to Azure Web App: $APP_NAME"
echo ""

# Check Azure CLI
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI not found!"
    echo "📥 Install with: brew install azure-cli"
    exit 1
fi

# Login check
echo "🔐 Checking login..."
if ! az account show &> /dev/null; then
    echo "Please login to Azure:"
    az login
fi

## Ensure Resource Group exists
echo "📦 Ensuring resource group exists... ($RESOURCE_GROUP)"
if ! az group show --name "$RESOURCE_GROUP" &> /dev/null; then
  az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none
fi

## Ensure App Service Plan exists (Linux)
echo "🧱 Ensuring App Service Plan exists... ($PLAN_NAME)"
if ! az appservice plan show --name "$PLAN_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
  az appservice plan create \
    --name "$PLAN_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --sku B1 \
    --is-linux \
    --output none
fi

## Ensure Web App exists
echo "🌐 Ensuring Web App exists... ($APP_NAME)"
actual_rg="$(az webapp list --query "[?name=='$APP_NAME'].resourceGroup | [0]" -o tsv 2>/dev/null)"
if [ -n "$actual_rg" ]; then
  echo "ℹ️  Found existing app in resource group: $actual_rg"
  RESOURCE_GROUP="$actual_rg"
else
  az webapp create \
    --resource-group "$RESOURCE_GROUP" \
    --plan "$PLAN_NAME" \
    --name "$APP_NAME" \
    --runtime "$RUNTIME" \
    --output none || true
fi

## Configure Web App features
echo "⚙️  Configuring Web App settings..."
az webapp config set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --web-sockets-enabled true \
  --http20-enabled true \
  --always-on true \
  --output none

## Set startup command for Node.js
echo "🔧 Setting Node.js startup command..."
az webapp config appsettings set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --settings WEBSITES_PORT=8080 \
  --output none

## Push environment variables from .env if present
if [ -f .env ]; then
  echo "🔧 Applying environment variables from .env ..."
  # Convert KEY=VALUE lines to array for az (preserve spaces)
  settings=()
  while IFS= read -r line; do
    if [[ -z "$line" || "$line" =~ ^# ]]; then
      continue
    fi
    settings+=("$line")
  done < .env
  az webapp config appsettings set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_NAME" \
    --settings "${settings[@]}" PORT=8080 \
    --output none
else
  echo "⚠️  No .env found. Remember to set app settings later."
fi

## Create zip package
echo "📦 Creating deployment package..."
zip -r deploy.zip . \
  -x "*.git*" "node_modules/*" ".env" "deploy.zip" "*.log" ".DS_Store" \
  > /dev/null

## Deploy using new command
echo "🚀 Deploying package (az webapp deploy)..."
az webapp deploy \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --src-path deploy.zip \
  --type zip \
  --output none

## Cleanup
rm -f deploy.zip

echo ""
echo "✅ Deployed to: https://$APP_NAME.azurewebsites.net"
echo "📋 View logs: az webapp log tail -g $RESOURCE_GROUP -n $APP_NAME"
