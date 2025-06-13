import "./src/lib/websocket-polyfill";

console.log("Testing Phoenix import...");
console.log("Global WebSocket type:", typeof (global as any).WebSocket);

try {
  const phoenix = require("phoenix");
  console.log("Phoenix module loaded:", Object.keys(phoenix));
  
  const { Socket } = phoenix;
  console.log("Socket constructor:", typeof Socket);
  
  // Try to create a Socket instance
  const socket = new Socket("ws://test:4000/socket", {
    timeout: 10000
  });
  
  console.log("Socket created successfully!");
  console.log("Socket methods:", Object.getOwnPropertyNames(socket.constructor.prototype));
  
} catch (error: any) {
  console.error("Error:", error);
  console.error("Error message:", error.message);
  console.error("Error stack:", error.stack);
}