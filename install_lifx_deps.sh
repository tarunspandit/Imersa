#!/bin/bash
# LIFX High-Performance Dependencies Installation Script

echo "🚀 Installing LIFX High-Performance Dependencies..."
echo "================================================="

# Check Python version
python_version=$(python3 --version 2>&1 | grep -Po '(?<=Python )\d+\.\d+')
echo "✓ Python version: $python_version"

# Install numpy if not present
echo -n "📦 Checking numpy... "
if python3 -c "import numpy" 2>/dev/null; then
    numpy_version=$(python3 -c "import numpy; print(numpy.__version__)")
    echo "✓ Already installed (v$numpy_version)"
else
    echo "Installing..."
    pip3 install numpy>=1.19.0
    echo "✓ Installed"
fi

# Update lifxlan with numpy dependency
echo -n "📦 Updating lifxlan package... "
cd lifxlan-master 2>/dev/null || {
    echo "⚠️  lifxlan-master directory not found"
    echo "   Please ensure you're in the correct directory"
    exit 1
}

# Install with updated dependencies
pip3 install -e . --upgrade --user 2>/dev/null || pip3 install . --upgrade --user
echo "✓ Updated"

cd ..

# Verify installation
echo ""
echo "🔍 Verifying installation..."
echo "----------------------------"

# Test numpy
python3 -c "import numpy; print('✓ NumPy:', numpy.__version__)" 2>/dev/null || echo "❌ NumPy import failed"

# Test lifxlan
python3 -c "import lifxlan; print('✓ LIFXLAN imported successfully')" 2>/dev/null || echo "❌ LIFXLAN import failed"

# Test LIFX protocol
cd BridgeEmulator/lights/protocols 2>/dev/null && {
    python3 -c "import sys; sys.path.insert(0, '.'); import lifx; print('✓ LIFX protocol module loaded')" 2>/dev/null || echo "❌ LIFX protocol import failed"
    cd ../../..
}

echo ""
echo "✅ LIFX dependencies installation complete!"
echo ""
echo "To use the high-performance LIFX implementation:"
echo "1. Ensure BridgeEmulator is using Python 3.7+"
echo "2. The LIFX protocol files are in BridgeEmulator/lights/protocols/"
echo "3. Run: python BridgeEmulator/HueEmulator3.py"
echo ""
echo "For Docker installations, add to Dockerfile:"
echo "  RUN pip install numpy>=1.19.0"