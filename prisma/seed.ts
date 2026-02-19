import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { env } from '../src/config/env';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('admin123456', 12);
  const user = await prisma.user.upsert({
    where: { email: 'admin@soma.local' },
    update: {},
    create: {
      name: 'Soma Admin',
      email: 'admin@soma.local',
      password: passwordHash,
    },
  });

  console.log(`User created: ${user.email}`);

  // Generate an API key for the seed user
  const raw = crypto.randomBytes(32).toString('hex');
  const key = `${env?.API_KEY_PREFIX ?? 'sk_'}${raw}`;
  const prefix = key.slice(0, 12);

  await prisma.apiKey.upsert({
    where: { keyHash: await bcrypt.hash(key, 12) },
    update: {},
    create: {
      name: 'Seed Default Key',
      keyHash: await bcrypt.hash(key, 12),
      prefix,
      userId: user.id,
      permissions: [
        'email:send', 'email:read',
        'sms:send', 'sms:read',
        'template:read', 'template:write',
        'webhook:read', 'webhook:write',
        'domain:read', 'domain:write',
      ],
    },
  }).catch(() => {/* key already exists */});

  console.log('─────────────────────────────────────────');
  console.log('Seed API Key (save this!):');
  console.log(`  ${key}`);
  console.log('─────────────────────────────────────────');
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
