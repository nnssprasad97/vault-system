import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("Secure Vault System", function () {
    let AuthorizationManager, SecureVault;
    let authManager, vault;
    let owner, user, other;

    beforeEach(async function () {
        [owner, user, other] = await ethers.getSigners();

        AuthorizationManager = await ethers.getContractFactory("AuthorizationManager");
        // Deploy AuthManager with owner as the signer
        authManager = await AuthorizationManager.deploy(owner.address);
        await authManager.waitForDeployment();

        SecureVault = await ethers.getContractFactory("SecureVault");
        vault = await SecureVault.deploy(await authManager.getAddress());
        await vault.waitForDeployment();
    });

    async function createSignature(signer, vaultAddress, recipient, amount, nonce, deadline) {
        const chainId = (await ethers.provider.getNetwork()).chainId;
        const authManagerAddress = await authManager.getAddress();

        const domain = {
            name: "SecureVaultSystem",
            version: "1",
            chainId: chainId,
            verifyingContract: authManagerAddress // EIP712 verifies at the AuthorizationManager
        };

        const types = {
            WithdrawalAuthorization: [
                { name: "vault", type: "address" },
                { name: "recipient", type: "address" },
                { name: "amount", type: "uint256" },
                { name: "nonce", type: "bytes32" },
                { name: "deadline", type: "uint256" }
            ]
        };

        const value = {
            vault: vaultAddress,
            recipient: recipient,
            amount: amount,
            nonce: nonce,
            deadline: deadline
        };

        return await signer.signTypedData(domain, types, value);
    }

    it("Should accept deposits", async function () {
        const depositAmount = ethers.parseEther("1.0");
        await expect(
            owner.sendTransaction({
                to: await vault.getAddress(),
                value: depositAmount
            })
        ).to.emit(vault, "Deposit")
            .withArgs(owner.address, depositAmount);

        expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(depositAmount);
    });

    it("Should allow withdrawal with valid authorization", async function () {
        // Deposit first
        const depositAmount = ethers.parseEther("2.0");
        await owner.sendTransaction({ to: await vault.getAddress(), value: depositAmount });

        const withdrawAmount = ethers.parseEther("1.0");
        const nonce = ethers.hexlify(ethers.randomBytes(32));
        const deadline = Math.floor(Date.now() / 1000) + 3600;

        const signature = await createSignature(
            owner,
            await vault.getAddress(),
            user.address,
            withdrawAmount,
            nonce,
            deadline
        );

        // Initial balance of user
        const initialBalance = await ethers.provider.getBalance(user.address);

        // Call withdraw
        await expect(
            vault.connect(other).withdraw(
                user.address,
                withdrawAmount,
                nonce,
                deadline,
                signature
            )
        ).to.emit(vault, "Withdrawal")
            .withArgs(user.address, withdrawAmount, nonce)
            .and.to.emit(authManager, "AuthorizationConsumed");

        // Check balances
        expect(await ethers.provider.getBalance(user.address)).to.equal(initialBalance + withdrawAmount);
        expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(depositAmount - withdrawAmount);
    });

    it("Should prevent replay attacks", async function () {
        const depositAmount = ethers.parseEther("2.0");
        await owner.sendTransaction({ to: await vault.getAddress(), value: depositAmount });

        const withdrawAmount = ethers.parseEther("1.0");
        const nonce = ethers.hexlify(ethers.randomBytes(32));
        const deadline = Math.floor(Date.now() / 1000) + 3600;

        const signature = await createSignature(
            owner,
            await vault.getAddress(),
            user.address,
            withdrawAmount,
            nonce,
            deadline
        );

        // First withdrawal
        await vault.withdraw(user.address, withdrawAmount, nonce, deadline, signature);

        // Replay
        await expect(
            vault.withdraw(user.address, withdrawAmount, nonce, deadline, signature)
        ).to.be.revertedWith("Authorization failed");
    });

    it("Should fail with invalid signer", async function () {
        // Deposit first to ensure balance check passes
        await owner.sendTransaction({ to: await vault.getAddress(), value: ethers.parseEther("2.0") });

        const withdrawAmount = ethers.parseEther("1.0");
        const nonce = ethers.hexlify(ethers.randomBytes(32));
        const deadline = Math.floor(Date.now() / 1000) + 3600;

        // Signed by 'user' instead of 'owner'
        const signature = await createSignature(
            user,
            await vault.getAddress(),
            user.address,
            withdrawAmount,
            nonce,
            deadline
        );

        await expect(
            vault.withdraw(user.address, withdrawAmount, nonce, deadline, signature)
        ).to.be.revertedWith("Authorization failed");
    });

    it("Should fail with manipulated parameters", async function () {
        // Deposit first
        await owner.sendTransaction({ to: await vault.getAddress(), value: ethers.parseEther("5.0") });

        const withdrawAmount = ethers.parseEther("1.0");
        const nonce = ethers.hexlify(ethers.randomBytes(32));
        const deadline = Math.floor(Date.now() / 1000) + 3600;

        const signature = await createSignature(
            owner,
            await vault.getAddress(),
            user.address,
            withdrawAmount,
            nonce,
            deadline
        );

        // Try to withdraw more
        await expect(
            vault.withdraw(user.address, ethers.parseEther("2.0"), nonce, deadline, signature)
        ).to.be.revertedWith("Authorization failed");

        // Try to steal to own address
        await expect(
            vault.connect(other).withdraw(other.address, withdrawAmount, nonce, deadline, signature)
        ).to.be.revertedWith("Authorization failed");
    });
});
