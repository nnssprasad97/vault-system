// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AuthorizationManager
 * @notice Validates off-chain permissions for vault withdrawals.
 */
contract AuthorizationManager is EIP712, Ownable {
    // Defines the type hash for the WithdrawalAuthorization struct
    // keccak256("WithdrawalAuthorization(address vault,address recipient,uint256 amount,bytes32 nonce,uint256 deadline)")
    bytes32 private constant WITHDRAWAL_TYPEHASH = 
        keccak256("WithdrawalAuthorization(address vault,address recipient,uint256 amount,bytes32 nonce,uint256 deadline)");

    // Mapping to track used nonces to prevent replay attacks
    mapping(bytes32 => bool) public usedNonces;

    // Address that is authorized to sign permissions
    address public signer;

    event AuthorizationConsumed(bytes32 indexed nonce, address indexed vault, address indexed recipient, uint256 amount);
    event SignerUpdated(address indexed newSigner);

    constructor(address initialSigner) EIP712("SecureVaultSystem", "1") Ownable(msg.sender) {
        require(initialSigner != address(0), "Invalid signer");
        signer = initialSigner;
    }

    /**
     * @notice Updates the authorized signer.
     * @param newSigner New signer address.
     */
    function setSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "Invalid signer");
        signer = newSigner;
        emit SignerUpdated(newSigner);
    }

    /**
     * @notice Verifies and consumes a withdrawal authorization.
     * @param vault The vault contract address requesting verification.
     * @param recipient The address to receive funds.
     * @param amount The amount to withdraw.
     * @param nonce Unique identifier for this authorization.
     * @param deadline Timestamp after which authorization is invalid.
     * @param signature Cryptographic signature from the authorized signer.
     * @return bool True if valid and consumed successfully.
     */
    function verifyAuthorization(
        address vault,
        address recipient,
        uint256 amount,
        bytes32 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external returns (bool) {
        // 1. Check basic constraints
        if (block.timestamp > deadline) {
            return false;
        }
        if (usedNonces[nonce]) {
            return false;
        }

        // 2. Reconstruct the Typed Data digest
        bytes32 structHash = keccak256(
            abi.encode(
                WITHDRAWAL_TYPEHASH,
                vault,
                recipient,
                amount,
                nonce,
                deadline
            )
        );
        
        bytes32 digest = _hashTypedDataV4(structHash);

        // 3. Recover signer
        address recovered = ECDSA.recover(digest, signature);

        // 4. Validate signer
        if (recovered != signer) {
            return false;
        }

        // 5. Consume nonce
        usedNonces[nonce] = true;
        emit AuthorizationConsumed(nonce, vault, recipient, amount);

        return true;
    }
}
