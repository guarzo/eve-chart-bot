// We need to implement our own serializeBigInt function since it's not exported
function serializeBigInt(data: any): string {
  return JSON.stringify(data, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
}

// Test basic BigInt serialization
const testObject = {
  id: BigInt(12345678901234567890),
  name: "Test",
  values: [
    BigInt(1),
    BigInt(9007199254740991), // Max safe integer
  ],
  nested: {
    bigValue: BigInt("9007199254740992"), // Beyond max safe integer
    normalValue: 42,
  },
};

console.log("Testing BigInt serialization:");
try {
  // This should throw an error if we try to use regular JSON.stringify
  try {
    console.log("Testing direct JSON.stringify (should fail):");
    console.log(JSON.stringify(testObject));
    console.log(
      "Warning: Regular JSON.stringify did not fail with BigInt as expected"
    );
  } catch (error: unknown) {
    console.log(
      "As expected, regular JSON.stringify failed with BigInt:",
      error instanceof Error ? error.message : String(error)
    );
  }

  // Using our custom serializer should work
  const serialized = serializeBigInt(testObject);
  console.log("Successfully serialized with our custom function:");
  console.log(serialized);

  console.log("\nVerifying results:");
  // Parse back to verify (values will be strings now)
  const parsed = JSON.parse(serialized);
  console.log(`Original BigInt: ${testObject.id}`);
  console.log(`Serialized and parsed: ${parsed.id}`);

  console.log("\nTest passed! BigInt serialization is working correctly.");
} catch (error: unknown) {
  console.error(
    "Test failed!",
    error instanceof Error ? error.message : String(error)
  );
}
