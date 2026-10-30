// SPDX-License-Identifier: MIT
import { PepkioClient } from "../dist/index.js";

async function main() {
  const apiKey = process.env.PEPKIO_API_KEY || "your-api-key";
  const client = new PepkioClient({ apiKey });

  const examples = await client.listExamples();
  console.log(`Found ${examples.length} test configurations for batch execution:`);

  const batchResults = [];
  for (const name of examples.slice(0, 3)) {
    console.log(`-> Processing batch item: ${name}`);
    try {
      const input = await client.getExampleInput(name);
      const res = await client.run(input, { label: `batch_${name}` });
      batchResults.push({
        example: name,
        status: res.status,
        runId: res.run_id,
        permalink: res.permalink,
      });
    } catch (err) {
      console.error(`   Failed to run ${name}:`, err.message);
    }
  }

  console.log("\nBatch execution summary:");
  for (const item of batchResults) {
    console.log(` - [${item.status}] ${item.example}: ${item.permalink}`);
  }
}

main().catch(console.error);
