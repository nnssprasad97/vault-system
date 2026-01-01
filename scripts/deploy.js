/**
 * Vault System Deployment Script
 * Deploys AuthorizationManager and SecureVault contracts
 * Usage: npx hardhat run scripts/deploy.js --network [network]
 */

import hre from "hardhat";

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // 1. Deploy AuthorizationManager
    console.log("Deploying AuthorizationManager...");
    const AuthorizationManager = await hre.ethers.getContractFactory("AuthorizationManager");
    // Pass deployer as initial signer
    const authManager = await AuthorizationManager.deploy(deployer.address);
    await authManager.waitForDeployment();
    const authManagerAddress = await authManager.getAddress();
    console.log("AuthorizationManager deployed to:", authManagerAddress);

    // 2. Deploy SecureVault
    console.log("Deploying SecureVault...");
    const SecureVault = await hre.ethers.getContractFactory("SecureVault");
    const vault = await SecureVault.deploy(authManagerAddress);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log("SecureVault deployed to:", vaultAddress);

    // Output for Docker/Logs
    console.log("Network:", hre.network.name);
    console.log("DEPLOYMENT_COMPLETE");
    console.log(JSON.stringify({
        authManager: authManagerAddress,
        vault: vaultAddress,
        network: hre.network.name
    }));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
