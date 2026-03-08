// Simple WebSocket connection test
const WebSocket = require("ws");

async function testBasicWebSocket() {
  console.log("Testing Basic WebSocket Server...");

  const ws = new WebSocket("ws://localhost:3001/ws");

  ws.on("open", () => {
    console.log("✅ Connected to Basic WebSocket server");

    // Send a ping message
    ws.send(
      JSON.stringify({
        id: "test-ping",
        type: "ping",
        payload: {},
        timestamp: Date.now(),
      })
    );
  });

  ws.on("message", (data) => {
    const message = JSON.parse(data.toString());
    console.log("📨 Received:", message.type, message.payload);

    if (message.type === "pong") {
      console.log("✅ Ping-pong test successful");
      ws.close();
    }
  });

  ws.on("close", () => {
    console.log("🔌 Connection closed");
  });

  ws.on("error", (error) => {
    console.error("❌ WebSocket error:", error.message);
  });
}

// Run test if this file is executed directly
if (require.main === module) {
  testBasicWebSocket().catch(console.error);
}

module.exports = { testBasicWebSocket };
