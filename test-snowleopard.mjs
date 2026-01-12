import { SnowLeopardPlaygroundClient } from '@snowleopard-ai/client';

const SNOWLEOPARD_API_KEY = '9f6d51635d78ef57d838b4333088d79c5a2522d6610c16fdb6c05bbbab70c5356089304e0d5222757a1a5e576b616286';
const DATAFILE_ID = 'e268b4be3026487b9c9631809431144c';

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
