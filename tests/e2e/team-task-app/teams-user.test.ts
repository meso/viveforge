/**
 * User Authentication Team Management E2E Tests
 * ユーザー認証でのチーム管理機能のE2Eテスト
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type VibebaseClient } from '@vibebase/sdk';
import type { Team, Member, User } from './fixtures/types';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// セットアップ情報を読み込み
const setupInfo = JSON.parse(
  readFileSync(resolve(__dirname, '../.setup-info.json'), 'utf-8')
);

const API_URL = setupInfo.apiUrl;
const testTokens = setupInfo.testTokens;

describe('User Auth Team Management E2E Tests', () => {
  // 各ユーザーのクライアント
  let aliceClient: VibebaseClient;
  let bobClient: VibebaseClient;
  let charlieClient: VibebaseClient;
  
  let testTeam: Team;
  let createdTeamIds: string[] = [];

  beforeAll(async () => {
    // ユーザー認証クライアントを初期化
    aliceClient = createClient({ apiUrl: API_URL, userToken: testTokens.alice });
    bobClient = createClient({ apiUrl: API_URL, userToken: testTokens.bob });
    charlieClient = createClient({ apiUrl: API_URL, userToken: testTokens.charlie });
  });

  afterAll(async () => {
    // 作成したテストチームをクリーンアップ
    for (const teamId of createdTeamIds) {
      try {
        await aliceClient.data!.delete('teams', teamId);
      } catch (error) {
        // エラーは無視（既に削除済みの可能性）
      }
    }
  });

  describe('Team CRUD Operations with User Auth', () => {
    
    it('should create a team as user (Alice)', async () => {
      const teamData = {
        name: 'User Auth Test Team',
        description: 'Team created with user authentication',
        created_by: 'V1StGXR8_Z5jdHi6B-myT' // Alice
      };

      const result = await aliceClient.data!.create<Team>('teams', teamData);
      
      expect(result.success).toBe(true);
      expect(result.data!.name).toBe(teamData.name);
      expect(result.data!.created_by).toBe('V1StGXR8_Z5jdHi6B-myT');
      
      testTeam = result.data!;
      createdTeamIds.push(result.data!.id);
    });

    it('should read teams as user', async () => {
      const result = await aliceClient.data!.list<Team>('teams');
      
      expect(result.success).toBe(true);
      expect(result.data!.length).toBeGreaterThan(0);
      
      // 自分が作成したチームが含まれることを確認
      const myTeam = result.data!.find(team => team.id === testTeam.id);
      expect(myTeam).toBeDefined();
    });

    it('should update own team (Alice)', async () => {
      const updateData = {
        description: 'Updated description by team owner'
      };
      
      const result = await aliceClient.data!.update<Team>('teams', testTeam.id, updateData);
      
      expect(result.success).toBe(true);
      expect(result.data!.description).toBe(updateData.description);
    });

    it('should allow other users to see public teams', async () => {
      // Bob と Charlie もチームを見ることができる（public table）
      const bobTeams = await bobClient.data!.list<Team>('teams');
      const charlieTeams = await charlieClient.data!.list<Team>('teams');
      
      expect(bobTeams.success).toBe(true);
      expect(charlieTeams.success).toBe(true);
      
      // 同じチーム数が見える
      expect(bobTeams.data!.length).toBe(charlieTeams.data!.length);
      
      // Aliceのチームが見える
      const bobSeeAliceTeam = bobTeams.data!.find(team => team.id === testTeam.id);
      const charlieSeeAliceTeam = charlieTeams.data!.find(team => team.id === testTeam.id);
      expect(bobSeeAliceTeam).toBeDefined();
      expect(charlieSeeAliceTeam).toBeDefined();
    });
  });

  describe('Team Membership with User Auth', () => {
    
    it('should add owner as first member (Alice)', async () => {
      const memberData = {
        team_id: testTeam.id,
        user_id: 'V1StGXR8_Z5jdHi6B-myT', // Alice
        role: 'owner' as const,
        display_name: 'Alice Johnson (Owner)',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice-owner',
        bio: 'Team creator and project lead',
        job_title: 'Engineering Manager',
        timezone: 'America/New_York',
        invited_by: 'V1StGXR8_Z5jdHi6B-myT'
      };

      const result = await aliceClient.data!.create<Member>('members', memberData);
      
      expect(result.success).toBe(true);
      expect(result.data!.role).toBe('owner');
      expect(result.data!.display_name).toBe('Alice Johnson (Owner)');
    });

    it('should add team members (Alice invites Bob)', async () => {
      const memberData = {
        team_id: testTeam.id,
        user_id: '3ZjkQ2mN8pX9vC7bA-wEr', // Bob
        role: 'member' as const,
        display_name: 'Bob Smith (Dev)',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob-dev',
        bio: 'Full-stack developer with React expertise',
        job_title: 'Senior Developer',
        timezone: 'America/Los_Angeles',
        invited_by: 'V1StGXR8_Z5jdHi6B-myT' // Alice
      };

      const result = await aliceClient.data!.create<Member>('members', memberData);
      
      expect(result.success).toBe(true);
      expect(result.data!.user_id).toBe('3ZjkQ2mN8pX9vC7bA-wEr');
      expect(result.data!.invited_by).toBe('V1StGXR8_Z5jdHi6B-myT');
    });

    it('should list team members', async () => {
      const members = await aliceClient.data!.list<Member>('members', {
        where: { team_id: testTeam.id }
      });
      
      expect(members.success).toBe(true);
      expect(members.data!.length).toBeGreaterThanOrEqual(2); // Alice + Bob
      
      // Owner が含まれることを確認
      const owner = members.data!.find(m => m.role === 'owner');
      expect(owner).toBeDefined();
      expect(owner!.user_id).toBe('V1StGXR8_Z5jdHi6B-myT');
    });

    it('should allow team members to view member profiles', async () => {
      // Bob も同じチームメンバー情報を見ることができる
      const bobViewMembers = await bobClient.data!.list<Member>('members', {
        where: { team_id: testTeam.id }
      });
      
      expect(bobViewMembers.success).toBe(true);
      expect(bobViewMembers.data!.length).toBeGreaterThanOrEqual(2);
      
      // Alice のプロフィール情報が見える
      const aliceProfile = bobViewMembers.data!.find(m => m.user_id === 'V1StGXR8_Z5jdHi6B-myT');
      expect(aliceProfile).toBeDefined();
      expect(aliceProfile!.display_name).toBe('Alice Johnson (Owner)');
      expect(aliceProfile!.job_title).toBe('Engineering Manager');
    });

    it('should update member role (Alice promotes Bob to admin)', async () => {
      // Bob のメンバーシップを取得
      const members = await aliceClient.data!.list<Member>('members', {
        where: { 
          team_id: testTeam.id,
          user_id: '3ZjkQ2mN8pX9vC7bA-wEr' // Bob
        }
      });
      
      expect(members.data!.length).toBe(1);
      const bobMembership = members.data![0];
      
      // Role を admin に変更
      const updated = await aliceClient.data!.update<Member>('members', bobMembership.id, {
        role: 'admin' as const,
        display_name: 'Bob Smith (Admin)' // 役職変更に伴いdisplay_nameも更新
      });
      
      expect(updated.success).toBe(true);
      expect(updated.data!.role).toBe('admin');
      expect(updated.data!.display_name).toBe('Bob Smith (Admin)');
    });
  });

  describe('Team Collaboration Scenarios', () => {
    
    it('should simulate team creation and member invitation flow', async () => {
      // 1. Bob が新しいチームを作成
      const newTeam = await bobClient.data!.create<Team>('teams', {
        name: 'Bob\'s Innovation Team',
        description: 'Team for innovative projects',
        created_by: '3ZjkQ2mN8pX9vC7bA-wEr' // Bob
      });
      
      expect(newTeam.success).toBe(true);
      createdTeamIds.push(newTeam.data!.id);
      
      // 2. Bob が自分をオーナーとして追加
      const bobOwner = await bobClient.data!.create<Member>('members', {
        team_id: newTeam.data!.id,
        user_id: '3ZjkQ2mN8pX9vC7bA-wEr',
        role: 'owner' as const,
        display_name: 'Bob Smith (Founder)',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob-founder',
        bio: 'Innovation team founder with startup experience',
        job_title: 'CTO & Founder',
        timezone: 'America/Los_Angeles',
        invited_by: '3ZjkQ2mN8pX9vC7bA-wEr'
      });
      
      expect(bobOwner.success).toBe(true);
      
      // 3. Bob が Alice を招待
      const inviteAlice = await bobClient.data!.create<Member>('members', {
        team_id: newTeam.data!.id,
        user_id: 'V1StGXR8_Z5jdHi6B-myT',
        role: 'admin' as const,
        display_name: 'Alice Johnson (Tech Advisor)',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice-advisor',
        bio: 'Senior engineering leader and technical advisor',
        job_title: 'Chief Technology Advisor',
        timezone: 'America/New_York',
        invited_by: '3ZjkQ2mN8pX9vC7bA-wEr' // Bob
      });
      
      expect(inviteAlice.success).toBe(true);
      
      // 4. Bob が Charlie も招待
      const inviteCharlie = await bobClient.data!.create<Member>('members', {
        team_id: newTeam.data!.id,
        user_id: 'LpH9mKj2nQ4vX8cD-zFgR',
        role: 'member' as const,
        display_name: 'Charlie Brown (Designer)',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=charlie-designer',
        bio: 'Creative designer focused on user experience',
        job_title: 'Lead UX Designer',
        timezone: 'Europe/London',
        invited_by: '3ZjkQ2mN8pX9vC7bA-wEr' // Bob
      });
      
      expect(inviteCharlie.success).toBe(true);
      
      // 5. 全メンバーがチーム情報を確認できる
      const aliceViewTeam = await aliceClient.data!.get<Team>('teams', newTeam.data!.id);
      const charlieViewTeam = await charlieClient.data!.get<Team>('teams', newTeam.data!.id);
      
      expect(aliceViewTeam.success).toBe(true);
      expect(charlieViewTeam.success).toBe(true);
      expect(aliceViewTeam.data!.name).toBe('Bob\'s Innovation Team');
      expect(charlieViewTeam.data!.name).toBe('Bob\'s Innovation Team');
      
      // 6. 各メンバーが異なる role を持つことを確認
      const teamMembers = await aliceClient.data!.list<Member>('members', {
        where: { team_id: newTeam.data!.id }
      });
      
      expect(teamMembers.data!.length).toBe(3);
      
      const bobRole = teamMembers.data!.find(m => m.user_id === '3ZjkQ2mN8pX9vC7bA-wEr');
      const aliceRole = teamMembers.data!.find(m => m.user_id === 'V1StGXR8_Z5jdHi6B-myT');
      const charlieRole = teamMembers.data!.find(m => m.user_id === 'LpH9mKj2nQ4vX8cD-zFgR');
      
      expect(bobRole!.role).toBe('owner');
      expect(aliceRole!.role).toBe('admin');
      expect(charlieRole!.role).toBe('member');
    });

    it('should handle team member persona variations', async () => {
      // 同じユーザーが異なるチームで異なるペルソナを持つテスト
      const members = await aliceClient.data!.list<Member>('members', {
        where: { user_id: 'V1StGXR8_Z5jdHi6B-myT' } // Alice's memberships
      });
      
      expect(members.success).toBe(true);
      expect(members.data!.length).toBeGreaterThanOrEqual(2); // At least 2 teams
      
      // Alice が異なるチームで異なる display_name を持つことを確認
      const displayNames = members.data!.map(m => m.display_name);
      const uniqueNames = [...new Set(displayNames)];
      
      // 少なくとも2つの異なるペルソナがある
      expect(uniqueNames.length).toBeGreaterThanOrEqual(2);
      
      // 具体的なペルソナ確認
      expect(displayNames).toContain('Alice Johnson (Owner)');
      expect(displayNames).toContain('Alice Johnson (Tech Advisor)');
    });

    it('should filter members by team', async () => {
      // 特定チームのメンバーのみを取得
      const team1Members = await aliceClient.data!.list<Member>('members', {
        where: { team_id: testTeam.id }
      });
      
      const team2Id = createdTeamIds[createdTeamIds.length - 1]; // Bob's innovation team
      const team2Members = await aliceClient.data!.list<Member>('members', {
        where: { team_id: team2Id }
      });
      
      expect(team1Members.success).toBe(true);
      expect(team2Members.success).toBe(true);
      
      // 異なるチームのメンバー数
      expect(team1Members.data!.length).not.toBe(team2Members.data!.length);
      
      // 全て指定されたチームのメンバーであることを確認
      team1Members.data!.forEach(member => {
        expect(member.team_id).toBe(testTeam.id);
      });
      
      team2Members.data!.forEach(member => {
        expect(member.team_id).toBe(team2Id);
      });
    });

    it('should handle team member removal', async () => {
      // テスト用の追加メンバーを作成
      const tempMember = await aliceClient.data!.create<Member>('members', {
        team_id: testTeam.id,
        user_id: 'LpH9mKj2nQ4vX8cD-zFgR', // Charlie
        role: 'member' as const,
        display_name: 'Charlie Brown (Temp)',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=charlie-temp',
        bio: 'Temporary team member',
        job_title: 'Consultant',
        invited_by: 'V1StGXR8_Z5jdHi6B-myT' // Alice
      });
      
      expect(tempMember.success).toBe(true);
      
      // メンバー削除
      const deleteResult = await aliceClient.data!.delete('members', tempMember.data!.id);
      expect(deleteResult.success).toBe(true);
      
      // 削除確認
      const remainingMembers = await aliceClient.data!.list<Member>('members', {
        where: {
          team_id: testTeam.id,
          user_id: 'LpH9mKj2nQ4vX8cD-zFgR'
        }
      });
      
      // Charlie が team から削除されていることを確認
      expect(remainingMembers.data!.length).toBe(0);
    });
  });

  describe('User-Specific Team Features', () => {
    
    it('should track team creation by different users', async () => {
      // 各ユーザーがチームを作成
      const charlieTeam = await charlieClient.data!.create<Team>('teams', {
        name: 'Charlie\'s Design Studio',
        description: 'Creative design team',
        created_by: 'LpH9mKj2nQ4vX8cD-zFgR' // Charlie
      });
      
      expect(charlieTeam.success).toBe(true);
      expect(charlieTeam.data!.created_by).toBe('LpH9mKj2nQ4vX8cD-zFgR');
      createdTeamIds.push(charlieTeam.data!.id);
      
      // Charlie が自分をオーナーとして追加
      const charlieOwner = await charlieClient.data!.create<Member>('members', {
        team_id: charlieTeam.data!.id,
        user_id: 'LpH9mKj2nQ4vX8cD-zFgR',
        role: 'owner' as const,
        display_name: '🎨 Charlie (Creative Director)',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=charlie-creative',
        bio: 'Creative director with 10+ years in design',
        job_title: 'Creative Director',
        timezone: 'Europe/London',
        invited_by: 'LpH9mKj2nQ4vX8cD-zFgR'
      });
      
      expect(charlieOwner.success).toBe(true);
      expect(charlieOwner.data!.display_name).toBe('🎨 Charlie (Creative Director)');
    });

    it('should filter teams by creator', async () => {
      const aliceCreatedTeams = await aliceClient.data!.list<Team>('teams', {
        where: { created_by: 'V1StGXR8_Z5jdHi6B-myT' }
      });
      
      const bobCreatedTeams = await bobClient.data!.list<Team>('teams', {
        where: { created_by: '3ZjkQ2mN8pX9vC7bA-wEr' }
      });
      
      const charlieCreatedTeams = await charlieClient.data!.list<Team>('teams', {
        where: { created_by: 'LpH9mKj2nQ4vX8cD-zFgR' }
      });
      
      expect(aliceCreatedTeams.success).toBe(true);
      expect(bobCreatedTeams.success).toBe(true);
      expect(charlieCreatedTeams.success).toBe(true);
      
      // 各自が作成したチームのみが返される
      aliceCreatedTeams.data!.forEach(team => {
        expect(team.created_by).toBe('V1StGXR8_Z5jdHi6B-myT');
      });
      
      bobCreatedTeams.data!.forEach(team => {
        expect(team.created_by).toBe('3ZjkQ2mN8pX9vC7bA-wEr');
      });
      
      charlieCreatedTeams.data!.forEach(team => {
        expect(team.created_by).toBe('LpH9mKj2nQ4vX8cD-zFgR');
      });
    });

    it('should show user participation across multiple teams', async () => {
      // Alice が参加している全チームを確認
      const aliceMemberships = await aliceClient.data!.list<Member>('members', {
        where: { user_id: 'V1StGXR8_Z5jdHi6B-myT' }
      });
      
      expect(aliceMemberships.success).toBe(true);
      expect(aliceMemberships.data!.length).toBeGreaterThan(1); // 複数チームに参加
      
      // 各チームでの役割を確認
      const roles = aliceMemberships.data!.map(m => ({ team_id: m.team_id, role: m.role }));
      
      // 少なくとも1つのチームでownerであることを確認
      const ownerRoles = roles.filter(r => r.role === 'owner');
      expect(ownerRoles.length).toBeGreaterThan(0);
      
      // Alice のチーム固有のペルソナを確認
      const personas = aliceMemberships.data!.map(m => m.display_name);
      const uniquePersonas = [...new Set(personas)];
      expect(uniquePersonas.length).toBeGreaterThanOrEqual(2); // 複数のペルソナ
    });
  });

  describe('Team Deletion and Cleanup', () => {
    
    it('should handle team deletion with cascade', async () => {
      // テスト用チームを作成
      const cascadeTeam = await aliceClient.data!.create<Team>('teams', {
        name: 'Cascade Test Team',
        description: 'Team for cascade deletion testing',
        created_by: 'V1StGXR8_Z5jdHi6B-myT'
      });
      
      expect(cascadeTeam.success).toBe(true);
      
      // メンバーを追加
      const cascadeMember = await aliceClient.data!.create<Member>('members', {
        team_id: cascadeTeam.data!.id,
        user_id: 'V1StGXR8_Z5jdHi6B-myT',
        role: 'owner' as const,
        display_name: 'Alice (Cascade Test)',
        invited_by: 'V1StGXR8_Z5jdHi6B-myT'
      });
      
      expect(cascadeMember.success).toBe(true);
      
      // チーム削除
      const deleteResult = await aliceClient.data!.delete('teams', cascadeTeam.data!.id);
      expect(deleteResult.success).toBe(true);
      
      // 関連データが削除されていることを確認
      const remainingMembers = await aliceClient.data!.list<Member>('members', {
        where: { team_id: cascadeTeam.data!.id }
      });
      
      expect(remainingMembers.data!.length).toBe(0);
    });
  });
});