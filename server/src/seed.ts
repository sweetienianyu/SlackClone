import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 创建测试用户
  const passwordHash = await bcrypt.hash('123456', 10);

  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      username: 'test',
      displayName: 'Test User',
      password: passwordHash,
      status: 'online',
    },
  });

  const user1 = await prisma.user.upsert({
    where: { email: 'user1@example.com' },
    update: {},
    create: {
      email: 'user1@example.com',
      username: 'user1',
      displayName: 'User One',
      password: passwordHash,
      status: 'online',
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'user2@example.com' },
    update: {},
    create: {
      email: 'user2@example.com',
      username: 'user2',
      displayName: 'User Two',
      password: passwordHash,
      status: 'away',
    },
  });

  // 创建工作区
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Test Workspace',
      ownerId: testUser.id,
      inviteCode: 'TEST123',
      members: {
        create: [
          { userId: testUser.id, role: 'admin' },
          { userId: user1.id, role: 'member' },
          { userId: user2.id, role: 'member' },
        ],
      },
    },
  });

  // 创建频道
  const generalChannel = await prisma.channel.create({
    data: {
      workspaceId: workspace.id,
      name: 'general',
      type: 'public',
      topic: '通用频道',
      createdBy: testUser.id,
      members: {
        create: [
          { userId: testUser.id, role: 'admin' },
          { userId: user1.id, role: 'member' },
          { userId: user2.id, role: 'member' },
        ],
      },
    },
  });

  const randomChannel = await prisma.channel.create({
    data: {
      workspaceId: workspace.id,
      name: 'random',
      type: 'public',
      topic: '闲聊',
      createdBy: testUser.id,
      members: {
        create: [
          { userId: testUser.id, role: 'admin' },
          { userId: user1.id, role: 'member' },
        ],
      },
    },
  });

  // 创建私信频道
  const dmChannel = await prisma.channel.create({
    data: {
      workspaceId: workspace.id,
      name: `dm-${testUser.id}-${user1.id}`,
      type: 'dm',
      createdBy: testUser.id,
      members: {
        create: [
          { userId: testUser.id, role: 'member' },
          { userId: user1.id, role: 'member' },
        ],
      },
    },
  });

  // 创建一些消息
  await prisma.message.create({
    data: {
      channelId: generalChannel.id,
      userId: user1.id,
      content: '欢迎来到 SlackApp！大家好！',
    },
  });

  await prisma.message.create({
    data: {
      channelId: generalChannel.id,
      userId: testUser.id,
      content: '你好！@user1 这个项目看起来不错 👍',
    },
  });

  await prisma.message.create({
    data: {
      channelId: randomChannel.id,
      userId: user2.id,
      content: '今天天气真好 ☀️',
    },
  });

  console.log('Seed data created successfully!');
  console.log(`Workspace: ${workspace.id}`);
  console.log(`Users: test, user1, user2 (password: 123456)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
