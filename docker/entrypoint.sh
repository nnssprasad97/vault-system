#!/bin/sh

# If we are the 'blockchain' service, we just run the node
if [ "$SERVICE_ROLE" = "blockchain" ]; then
    echo "Starting Hardhat Node..."
    exec npx hardhat node --hostname 0.0.0.0
fi

# If we are the 'deployer' service, we wait for the node and deploy
if [ "$SERVICE_ROLE" = "deployer" ]; then
    echo "Waiting for blockchain node at $BLOCKCHAIN_HOST..."
    
    # Simple wait loop
    until wget -qO- http://$BLOCKCHAIN_HOST:8545 > /dev/null; do
      echo "Waiting..."
      sleep 2
    done

    echo "Node is up. Deploying contracts..."
    npx hardhat run scripts/deploy.js --network localhost
fi
