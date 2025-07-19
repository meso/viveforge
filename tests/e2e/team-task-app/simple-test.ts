// Simple test to debug API connection
import { createClient } from '@vibebase/sdk';

const apiUrl = process.env.VIBEBASE_API_URL || 'http://localhost:8787';
const apiKey = process.env.VIBEBASE_API_KEY || 'test-admin-key-123456';

console.log('Testing connection to:', apiUrl);
console.log('Using API key:', apiKey.substring(0, 10) + '...');

const vibebase = createClient({
  apiUrl,
  apiKey
});

async function test() {
  try {
    console.log('Calling API...');
    const result = await vibebase.data.list('tasks');
    console.log('Result:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

test();