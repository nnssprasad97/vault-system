import "@nomicfoundation/hardhat-toolbox";

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";

/** @type import('hardhat/config').HardhatUserConfig */
export default {
    solidity: "0.8.24",
    networks: {
        hardhat: {
            chainId: 31337
        },
        // Keep localhost for docker-compose / explicit node run
        localhost: {
            url: RPC_URL,
            chainId: 31337
        }
    },
    gasReporter: {
        enabled: false
    },
    sourcify: {
        enabled: false
    }
};
