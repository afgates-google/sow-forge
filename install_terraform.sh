#!/bin/bash
#
# Installs the latest version of Terraform using the official HashiCorp repository.
# This script is intended for Debian/Ubuntu-based systems.
#
# USAGE:
# 1. Make the script executable: chmod +x install_terraform.sh
# 2. Run with sudo: sudo ./install_terraform.sh

echo "--- Installing Terraform ---"

# Ensure the script is run as root
if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run with sudo. Please run as: sudo $0" >&2
  exit 1
fi

set -e

# 1. Update package lists and install required dependencies
echo "[1/4] Updating package information and installing dependencies..."
apt-get update
apt-get install -y gnupg software-properties-common curl

# 2. Add the HashiCorp GPG key
echo "[2/4] Adding HashiCorp GPG key..."
curl -fsSL https://apt.releases.hashicorp.com/gpg | gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg

# 3. Add the official HashiCorp repository
echo "[3/4] Adding the HashiCorp repository..."
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" > /etc/apt/sources.list.d/hashicorp.list

# 4. Update package lists again and install Terraform
echo "[4/4] Installing Terraform..."
apt-get update
apt-get install -y terraform

set +e

# Verify the installation
echo ""
echo "--- Verification ---"
terraform -v
echo "--------------------"
echo "✔ Terraform installation complete."