#!/bin/bash
sed -i 's/\[2, 3000, [0-9]*\]/[2, 2413, 51]/g' /evolution/node_modules/baileys/lib/Defaults/baileys-version.json
cat /evolution/node_modules/baileys/lib/Defaults/baileys-version.json | grep version
echo "Patch aplicado!"
