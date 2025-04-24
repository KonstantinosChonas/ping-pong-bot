# Ping-Pong Bot

This bot listens for `Ping` events on a specified Ethereum smart contract deployed on the Sepolia testnet and responds by calling the `pong` function with the transaction hash of the `Ping` event.

## Features

- **Event Listening**: Monitors the contract for `Ping` events.
- **Automated Response**: Calls the `pong` function for each new `Ping` event.
- **State Persistence**: Uses a `state.json` file to track processed transactions and blocks, preventing duplicates.
- **Catch-Up Mechanism**: Processes missed events if the bot was offline.

## Prerequisites

- **Node.js**: Ensure Node.js is installed on your system.
- **Ethereum Wallet**: A wallet with Sepolia ETH for gas fees.
- **Sepolia Testnet Access**: An RPC URL to connect to the Sepolia network.

## Setup

1. **Clone the Repository** (if applicable):
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```


2. **Install Dependencies**:
   ```bash
   npm install
   ```


3. **Configure Environment Variables**:
   
   Create a `.env` file with your RPC URL and wallet private key.
   
    Example:
   ```env
   SEPOLIA_RPC_URL=<your-sepolia-rpc-url>
   PRIVATE_KEY=<your-private-key>
   ```
  - `SEPOLIA_RPC_URL`: Your Sepolia RPC endpoint (defaults to `https://rpc.sepolia.org` if not set).
  - `PRIVATE_KEY`: The private key of the wallet funding the transactions.
4. **Verify Contract Address**:
    
   The contract address is hardcoded as `0xa7f42ff7433cb268dd7d59be62b00c30ded28d3d`. Ensure this matches your target contract.





## Usage
  Run the bot with:
   ```bash
   node bot.js
   ```
The bot will:

- Load or initialize its state.
- Catch up on any missed `Ping` events from the last processed block.
- Listen for new `Ping` events and respond accordingly.

## State Management

The bot uses a `state.json` file to store:

- `startBlock`: The block number to begin processing from (defaults to `7907600` if unset).
- `lastProcessedBlock`: The most recent block processed.
- `processedTxs`: An array of transaction hashes already handled.

This ensures continuity and prevents reprocessing of events.

## Error Handling

- **Transaction Errors**: Logs errors when sending `pong` transactions.
- **Insufficient Funds**: Exits with a message if the wallet runs out of Sepolia ETH.
- **Provider Errors**: Automatically restarts the bot if the connection to the provider fails.

## Notes

- The starting block is hardcoded to `7907600`. Modify `runBot` in the code if you want to start from a different block (e.g., the current block).
- Ensure your wallet has sufficient Sepolia ETH for gas costs. Obtain more at [Sepolia Faucet](https://sepoliafaucet.com/).

