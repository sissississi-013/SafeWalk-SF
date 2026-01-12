import { SnowLeopardPlaygroundClient } from '@snowleopard-ai/client';

// Load from environment variables
const SNOWLEOPARD_API_KEY = process.env.SNOWLEOPARD_API_KEY;
const DATAFILE_ID = process.env.SNOWLEOPARD_DATAFILE_ID || 'e268b4be3026487b9c9631809431144c';

if (!SNOWLEOPARD_API_KEY) {
  console.error('Error: SNOWLEOPARD_API_KEY environment variable not set');
  process.exit(1);
}

async function testSnowLeopard() {
  const client = new SnowLeopardPlaygroundClient({
    apiKey: SNOWLEOPARD_API_KEY
  });

  try {
    console.log('Testing SnowLeopard API...\n');

    // Test query for danger data near Union Square
    const query = `Find all dangerous places, crime hotspots, and unsafe areas within 2 kilometers of coordinates (37.7879, -122.4074) in San Francisco. Include coordinates, category of danger, and description.`;

    console.log('Query:', query);
    console.log('\n--- Fetching data ---\n');

    const response = await client.retrieve(DATAFILE_ID, query);

    console.log('Response type:', typeof response);
    console.log('Response:', JSON.stringify(response, null, 2));

    await client.close();
  } catch (error) {
    console.error('Error:', error.message);
    await client.close();
  }
}

testSnowLeopard();
