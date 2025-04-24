// Import required modules
const ethers = require("ethers"); // For Ethereum blockchain interactions
const fs = require("fs"); // For file system operations
const path = require("path"); // For handling file paths
require("dotenv").config(); // Load environment variables from .env file

// Log whether the private key is set for debugging purposes
console.log("Loaded PRIVATE_KEY:", process.env.PRIVATE_KEY ? "Set" : "Not set");

// Define constants for the bot
const CONTRACT_ADDRESS = "0xa7f42ff7433cb268dd7d59be62b00c30ded28d3d"; // Smart contract address
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org"; // Sepolia testnet RPC URL, with a default fallback
const PRIVATE_KEY = process.env.PRIVATE_KEY || ""; // Wallet private key from environment
const STATE_FILE = path.join(__dirname, "state.json"); // Path to the state persistence file

// Define the contract's ABI (Application Binary Interface)
const ABI = [
  "event Ping()",              // Event emitted by the contract
  "function pong(bytes32 txHash) public" // Function to call in response
];

// Log the RPC URL being used
console.log("Using RPC URL:", SEPOLIA_RPC_URL);

// Initialize blockchain connection objects
const provider = new ethers.providers.JsonRpcProvider(SEPOLIA_RPC_URL); // Connect to Sepolia testnet
const wallet = new ethers.Wallet(PRIVATE_KEY, provider); // Create wallet from private key
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet); // Instantiate contract with ABI and wallet

// Load state from file or initialize a default state
function loadState() {
  if (fs.existsSync(STATE_FILE)) { // Check if state file exists
    const data = fs.readFileSync(STATE_FILE, "utf8"); // Read file contents
    return JSON.parse(data); // Parse JSON to object
  }
  // Return default state if no file exists
  return { startBlock: null, lastProcessedBlock: 0, processedTxs: [] };
}

// Save the current state to the state file
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); // Write state as formatted JSON
}

// Main bot execution function
async function runBot() {
  console.log("Starting bot...");
  let state = loadState(); // Load or initialize state
  console.log("State loaded:", state);

  // Set the starting block if not already set
  if (!state.startBlock) {
    try {
      console.log("Setting start block to 7907600...");
      state.startBlock = 7907600; // Hardcoded start block (could fetch current block instead)
      state.lastProcessedBlock = state.startBlock - 1; // Set last processed block
      saveState(state); // Persist initial state
      console.log("Initial state saved:", state);
    } catch (error) {
      console.error("Failed to fetch block number:", error);
      throw error;
    }
  }
  console.log(`Starting from block ${state.startBlock}, last processed: ${state.lastProcessedBlock}`);

  // Log bot's wallet address and start block
  console.log("Bot Address:", wallet.address);
  console.log("Start Block:", state.startBlock);

  // Catch up on missed events
  try {
    console.log("Fetching current block for catch-up...");
    const currentBlock = await provider.getBlockNumber(); // Get latest block number
    console.log("Current block:", currentBlock);
    if (state.lastProcessedBlock < currentBlock) {
      console.log(`Catching up from block ${state.lastProcessedBlock + 1} to ${currentBlock}`);
      await processPastEvents(state, state.lastProcessedBlock + 1, currentBlock); // Process missed events
    } else {
      console.log("No catch-up needed, listening for new events...");
    }
  } catch (error) {
    console.error("Error during catch-up:", error);
    throw error;
  }

  // Set up listener for new Ping events
  console.log("Setting up event listener for Ping()...");
  contract.on("Ping", async (event) => {
    const txHash = event.transactionHash; // Get transaction hash of the event
    if (state.processedTxs.includes(txHash)) { // Check if already processed
      console.log(`Skipping already processed tx: ${txHash}`);
      return;
    }
    await sendPong(txHash, event.blockNumber, state); // Send pong response
  });

  // Handle provider errors by restarting the bot
  provider.on("error", (error) => {
    console.error("Provider error, restarting...", error);
    restartBot();
  });
}

// Process past Ping events within a block range
async function processPastEvents(state, fromBlock, toBlock) {
  console.log(`Querying events from ${fromBlock} to ${toBlock}...`);
  const events = await contract.queryFilter("Ping", fromBlock, toBlock); // Fetch Ping events
  console.log(`Found ${events.length} events`);
  for (const event of events) {
    const txHash = event.transactionHash;
    if (!state.processedTxs.includes(txHash)) { // Process only unprocessed events
      await sendPong(txHash, event.blockNumber, state);
    }
  }
  state.lastProcessedBlock = toBlock; // Update last processed block
  saveState(state); // Save updated state
}

// Send a pong transaction in response to a Ping event
async function sendPong(txHash, blockNumber, state) {
  try {
    console.log(`Sending pong for tx ${txHash} at block ${blockNumber}`);
    const tx = await contract.pong(txHash, { gasLimit: 100000 }); // Call pong function
    const receipt = await tx.wait(); // Wait for transaction confirmation
    console.log(`Pong sent, tx: ${receipt.transactionHash}`);

    // Update state with processed transaction
    state.processedTxs.push(txHash);
    state.lastProcessedBlock = Math.max(state.lastProcessedBlock, blockNumber);
    saveState(state);
  } catch (error) {
    console.error(`Error sending pong for ${txHash}:`, error);
    if (error.code === "INSUFFICIENT_FUNDS") { // Handle insufficient funds error
      console.error("Bot out of Sepolia ETH. Get more from https://sepoliafaucet.com/");
      process.exit(1);
    }
  }
}

// Restart the bot in case of errors
function restartBot() {
  console.log("Restarting bot...");
  runBot().catch((err) => {
    console.error("Bot crashed:", err);
    setTimeout(restartBot, 5000); // Retry after 5 seconds
  });
}

// Start the bot and handle initial errors
runBot().catch((err) => {
  console.error("Initial start failed:", err);
  restartBot();
});
