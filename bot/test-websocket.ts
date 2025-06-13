import { Socket } from "phoenix";

async function testConnection() {
  const url = process.env.WANDERER_KILLS_URL || 'ws://host.docker.internal:4004/socket';
  console.log(`Testing connection to: ${url}`);
  
  const socket = new Socket(url, {
    timeout: 10000,
    params: {
      client_identifier: "test-client",
    },
  });

  socket.onOpen(() => {
    console.log("Socket opened successfully!");
    console.log("Socket details:", {
      isConnected: socket.isConnected(),
      connectionState: socket.connectionState(),
      protocol: socket.protocol(),
      endPointURL: socket.endPointURL()
    });
  });

  socket.onError((error: any) => {
    console.error("Socket error:", error);
  });

  socket.onClose(() => {
    console.log("Socket closed");
  });

  console.log("Connecting...");
  socket.connect();

  // Wait a bit to see what happens
  setTimeout(() => {
    console.log("Final state:", {
      isConnected: socket.isConnected(),
      connectionState: socket.connectionState(),
    });
    socket.disconnect();
    process.exit(0);
  }, 5000);
}

testConnection().catch(console.error);