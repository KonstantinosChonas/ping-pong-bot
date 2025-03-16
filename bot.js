const ethers = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

console.log("Loaded PRIVATE_KEY:", process.env.PRIVATE_KEY ? "Set" : "Not set"); // Debug private key
const CONTRACT_ADDRESS = "0xa7f42ff7433cb268dd7d59be62b00c30ded28d3d";
const SEPOLIA_RPC_URL =
  process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const STATE_FILE = path.join(__dirname, "state.json");

const ABI = ["event Ping()", "function pong(bytes32 txHash) public"];

console.log("Using RPC URL:", SEPOLIA_RPC_URL);
const provider = new ethers.providers.JsonRpcProvider(SEPOLIA_RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    const data = fs.readFileSync(STATE_FILE, "utf8");
    return JSON.parse(data);
  }
  return { startBlock: null, lastProcessedBlock: 0, processedTxs: [] };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function runBot() {
  console.log("Starting bot...");
  let state = loadState();
  console.log("State loaded:", state);

  if (!state.startBlock) {
    try {
      //   console.log("Fetching current block number...");
      //   state.startBlock = await provider.getBlockNumber();
      console.log("Setting start block to 7907600...");
      state.startBlock = 7907600;

      state.lastProcessedBlock = state.startBlock - 1;
      saveState(state);
      console.log("Initial state saved:", state);
    } catch (error) {
      console.error("Failed to fetch block number:", error);
      throw error;
    }
  }
  console.log(
    `Starting from block ${state.startBlock}, last processed: ${state.lastProcessedBlock}`
  );

  console.log("Bot Address:", wallet.address);
  console.log("Start Block:", state.startBlock);

  try {
    console.log("Fetching current block for catch-up...");
    const currentBlock = await provider.getBlockNumber();
    console.log("Current block:", currentBlock);
    if (state.lastProcessedBlock < currentBlock) {
      console.log(
        `Catching up from block ${
          state.lastProcessedBlock + 1
        } to ${currentBlock}`
      );
      await processPastEvents(
        state,
        state.lastProcessedBlock + 1,
        currentBlock
      );
    } else {
      console.log("No catch-up needed, listening for new events...");
    }
  } catch (error) {
    console.error("Error during catch-up:", error);
    throw error;
  }

  console.log("Setting up event listener for Ping()...");
  contract.on("Ping", async (event) => {
    const txHash = event.transactionHash;
    if (state.processedTxs.includes(txHash)) {
      console.log(`Skipping already processed tx: ${txHash}`);
      return;
    }
    await sendPong(txHash, event.blockNumber, state);
  });

  provider.on("error", (error) => {
    console.error("Provider error, restarting...", error);
    restartBot();
  });
}

async function processPastEvents(state, fromBlock, toBlock) {
  console.log(`Querying events from ${fromBlock} to ${toBlock}...`);
  const events = await contract.queryFilter("Ping", fromBlock, toBlock);
  console.log(`Found ${events.length} events`);
  for (const event of events) {
    const txHash = event.transactionHash;
    if (!state.processedTxs.includes(txHash)) {
      await sendPong(txHash, event.blockNumber, state);
    }
  }
  state.lastProcessedBlock = toBlock;
  saveState(state);
}

async function sendPong(txHash, blockNumber, state) {
  try {
    console.log(`Sending pong for tx ${txHash} at block ${blockNumber}`);
    const tx = await contract.pong(txHash, { gasLimit: 100000 });
    const receipt = await tx.wait();
    console.log(`Pong sent, tx: ${receipt.transactionHash}`);

    state.processedTxs.push(txHash);
    state.lastProcessedBlock = Math.max(state.lastProcessedBlock, blockNumber);
    saveState(state);
  } catch (error) {
    console.error(`Error sending pong for ${txHash}:`, error);
    if (error.code === "INSUFFICIENT_FUNDS") {
      console.error(
        "Bot out of Sepolia ETH. Get more from https://sepoliafaucet.com/"
      );
      process.exit(1);
    }
  }
}

function restartBot() {
  console.log("Restarting bot...");
  runBot().catch((err) => {
    console.error("Bot crashed:", err);
    setTimeout(restartBot, 5000);
  });
}

runBot().catch((err) => {
  console.error("Initial start failed:", err);
  restartBot();
});
