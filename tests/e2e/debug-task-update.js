import { createClient } from '@vibebase/sdk';
import fs from 'fs';
const setupInfo = JSON.parse(fs.readFileSync('.setup-info.json', 'utf-8'));

async function testTaskUpdate() {
  const client = createClient({ 
    apiUrl: 'http://localhost:8787', 
    userToken: setupInfo.testTokens.alice 
  });

  try {
    // Get current user info
    const usersResponse = await client.data.list('users', { 
      where: { email: 'alice@example.com' },
      limit: 1 
    });
    console.log('Users response success:', usersResponse.success);
    const currentUserId = usersResponse.success ? usersResponse.data[0]?.id : null;
    console.log('Current user ID:', currentUserId);
    
    // Get an existing project
    const projectsResponse = await client.data.list('projects', { limit: 1 });
    console.log('Projects response success:', projectsResponse.success);
    console.log('Projects count:', projectsResponse.data?.length || 0);
    
    if (projectsResponse.success && projectsResponse.data.length > 0) {
      const projectId = projectsResponse.data[0].id;
      console.log('Using project ID:', projectId);
      
      // Verify project exists first
      const projectCheckResponse = await client.data.get('projects', projectId);
      console.log('Project exists:', projectCheckResponse.success);
      
      // Create a task with valid project_id (created_by will be auto-set)
      console.log('Creating task with data:', {
        project_id: projectId,
        title: 'Test Task for Debug',
        status: 'todo'
      });
      
      // Let server automatically set created_by (should be current user)
      const createResponse = await client.data.create('tasks', {
        project_id: projectId,
        title: 'Test Task for Debug',
        status: 'todo'
      });
      
      console.log('Create response success:', createResponse.success);
      if (!createResponse.success) {
        console.log('Create error:', createResponse.error);
        return;
      }
      
      const taskId = createResponse.data.id;
      console.log('Created task ID:', taskId);
      
      // First update
      console.log('Attempting first update...');
      const update1 = await client.data.update('tasks', taskId, { status: 'in_progress' });
      console.log('First update success:', update1.success);
      if (!update1.success) {
        console.log('First update error:', update1.error);
        console.log('First update status:', update1.status);
      }
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Second update
      console.log('Attempting second update...');
      const update2 = await client.data.update('tasks', taskId, { status: 'done' });
      console.log('Second update success:', update2.success);
      if (!update2.success) {
        console.log('Second update error:', update2.error);
        console.log('Second update status:', update2.status);
      }
      
      // Cleanup
      await client.data.delete('tasks', taskId);
      console.log('Cleanup completed');
    } else {
      console.log('No projects found for testing');
    }
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

testTaskUpdate();