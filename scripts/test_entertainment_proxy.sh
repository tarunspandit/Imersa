#!/bin/bash

echo "Entertainment Proxy Test Script"
echo "================================"

# Check if proxy is listening on port 2100
echo ""
echo "1. Checking port 2100..."
lsof -i :2100
if [ $? -eq 0 ]; then
    echo "✓ Something is listening on port 2100"
else
    echo "✗ Nothing listening on port 2100"
fi

# Check for OpenSSL processes
echo ""
echo "2. Checking for OpenSSL processes..."
ps aux | grep -v grep | grep openssl
if [ $? -eq 0 ]; then
    echo "⚠ OpenSSL process found - might interfere with proxy"
else
    echo "✓ No OpenSSL processes running"
fi

# Test UDP connectivity to local proxy
echo ""
echo "3. Testing UDP connectivity to proxy..."
echo "test" | nc -u -w1 127.0.0.1 2100
echo "✓ UDP packet sent to proxy"

# Check DIYHue logs for proxy activity
echo ""
echo "4. Recent proxy-related log entries:"
tail -n 50 /var/log/diyhue.log 2>/dev/null | grep -i "dtls\|proxy\|entertainment" | tail -n 10

echo ""
echo "5. Running Python test script..."
python3 /Users/tarunpandit/Documents/DEV/Imersa/BridgeEmulator/services/entertainment_proxy_test.py

echo ""
echo "Test complete. Check DIYHue logs for proxy activity."