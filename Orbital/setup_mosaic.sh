#!/bin/bash

# Clone the MOSAIC repository (using the URL from the README)
if [ ! -d "MOSAIC" ]; then
  echo "Cloning MOSAIC repository..."
  git clone https://github.com/haoteli/MOSAIC.git
else
  echo "MOSAIC repository already exists."
fi

# Install Python dependencies
echo "Installing Python dependencies for MOSAIC..."
# Ensure you have python/pip installed and accessible
pip install -r MOSAIC/requirement.txt

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install