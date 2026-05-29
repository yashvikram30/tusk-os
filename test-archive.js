const { Workspace } = require('tusk-memory');
require('dotenv').config({ path: '.env.local' });

async function run() {
  console.log("MEMWAL_ACCOUNT_ID:", process.env.MEMWAL_ACCOUNT_ID);
  console.log("MEMWAL_PRIVATE_KEY:", process.env.MEMWAL_PRIVATE_KEY ? "SET" : "NOT SET");

  const wsId = "wallet_test_archive_address";
  const ws = new Workspace(wsId);

  try {
    console.log("Archiving test report...");
    const blobId = await ws.archiveReport("Test encrypted payload", "Test topic " + Date.now());
    console.log("Archived successfully! Blob ID:", blobId);

    console.log("Retrieving history...");
    const history = await ws.getHistory();
    console.log("History items count:", history.length);
    console.log("History items:", JSON.stringify(history, null, 2));
  } catch (err) {
    console.error("Error during test:", err);
  }
}

run();
