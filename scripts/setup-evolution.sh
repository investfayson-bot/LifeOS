#!/bin/bash
set -e

EVOLUTION_URL="http://localhost:8080"
EVOLUTION_KEY="lifeos-evolution-key"
INSTANCE="lifeos"
WEBHOOK_URL="${WEBHOOK_URL:-http://host.docker.internal:3000}"

echo "⏳ Aguardando Evolution API..."
until curl -sf "$EVOLUTION_URL/" > /dev/null 2>&1; do
  sleep 2
done
echo "✅ Evolution API online"

echo "📱 Criando instância '$INSTANCE'..."
curl -sf -X POST "$EVOLUTION_URL/instance/create" \
  -H "apikey: $EVOLUTION_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"instanceName\": \"$INSTANCE\",
    \"qrcode\": true,
    \"integration\": \"WHATSAPP-BAILEYS\"
  }" | cat

echo ""
echo "🔗 Configurando webhook..."
curl -sf -X POST "$EVOLUTION_URL/webhook/set/$INSTANCE" \
  -H "apikey: $EVOLUTION_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"webhook\": {
      \"enabled\": true,
      \"url\": \"$WEBHOOK_URL/webhook/evolution\",
      \"events\": [\"messages.upsert\"]
    }
  }" | cat

echo ""
echo ""
echo "✅ Setup completo!"
echo "📷 Acesse http://localhost:8080/instance/connect/$INSTANCE para escanear o QR Code"
