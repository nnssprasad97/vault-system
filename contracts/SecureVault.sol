// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./AuthorizationManager.sol";

/**
 * @title SecureVault
 * @notice Holds funds and allows withdrawals only with valid authorization.
 */
contract SecureVault is ReentrancyGuard {
    AuthorizationManager public immutable authManager;

    event Deposit(address indexed sender, uint256 amount);
    event Withdrawal(address indexed recipient, uint256 amount, bytes32 indexed nonce);

    constructor(address _authManager) {
        require(_authManager != address(0), "Invalid auth manager");
        authManager = AuthorizationManager(_authManager);
    }

    /**
     * @notice Allows anyone to deposit ETH.
     */
    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @notice Withdraws funds if authorization is valid.
     * @param recipient The address to receive funds.
     * @param amount The amount to withdraw.
     * @param nonce Unique identifier for the authorization.
     * @param deadline Expiration timestamp.
     * @param signature Validator signature.
     */
    function withdraw(
        address recipient,
        uint256 amount,
        bytes32 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant {
        require(amount > 0, "Invalid amount");
        require(address(this).balance >= amount, "Insufficient balance");

        // Verify authorization
        // We pass 'address(this)' as the vault address to bind authorization to this specific instance
        bool authorized = authManager.verifyAuthorization(
            address(this),
            recipient,
            amount,
            nonce,
            deadline,
            signature
        );

        require(authorized, "Authorization failed");

        // Transfer funds
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Transfer failed");

        emit Withdrawal(recipient, amount, nonce);
    }
}
