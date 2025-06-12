#!/bin/bash

# Build dashboard first
echo "Building dashboard..."
cd ../dashboard
pnpm build

# Return to core directory
cd ../core

echo "Dashboard build complete!"