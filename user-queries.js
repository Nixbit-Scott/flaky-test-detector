#!/usr/bin/env node

/**
 * Different ways to query users in the database
 * Demonstrates various Prisma query patterns
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function demoUserQueries() {
  console.log('🔍 User Query Examples\n');

  try {
    // 1. Check if user exists by email (returns boolean)
    const email = 'test@example.com';
    const userExists = await prisma.user.count({
      where: { email }
    }) > 0;
    console.log(`1. User exists (${email}): ${userExists ? '✅ Yes' : '❌ No'}\n`);

    // 2. Find user by email (returns user object or null)
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      }
    });
    console.log('2. Find user by email:');
    console.log(user ? `   Found: ${user.name} (${user.email})` : '   Not found');
    console.log();

    // 3. Find users by partial email match
    const partialEmail = 'test';
    const matchingUsers = await prisma.user.findMany({
      where: {
        email: {
          contains: partialEmail,
          mode: 'insensitive' // Case insensitive search
        }
      },
      select: {
        email: true,
        name: true
      }
    });
    console.log(`3. Users with email containing "${partialEmail}":`);
    matchingUsers.forEach(u => console.log(`   - ${u.email} (${u.name || 'No name'})`));
    console.log();

    // 4. Find recent users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentUsers = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: sevenDaysAgo
        }
      },
      select: {
        email: true,
        name: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    console.log('4. Users created in last 7 days:');
    recentUsers.forEach(u => console.log(`   - ${u.email} (${u.createdAt.toISOString().split('T')[0]})`));
    console.log();

    // 5. Check user membership in organizations
    if (user) {
      const userWithOrgs = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          organizations: {
            include: {
              organization: {
                select: {
                  name: true,
                  plan: true
                }
              }
            }
          }
        }
      });
      
      console.log('5. User organizations:');
      if (userWithOrgs?.organizations.length > 0) {
        userWithOrgs.organizations.forEach(org => {
          console.log(`   - ${org.organization.name} (${org.organization.plan} plan, role: ${org.role})`);
        });
      } else {
        console.log('   - No organizations');
      }
      console.log();
    }

    // 6. Count users by creation date
    const userStats = await prisma.user.groupBy({
      by: ['createdAt'],
      _count: {
        id: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    console.log('6. User creation stats:');
    console.log(`   Total unique creation dates: ${userStats.length}`);
    console.log();

    // 7. Search users with complex conditions
    const complexSearch = await prisma.user.findMany({
      where: {
        AND: [
          {
            email: {
              contains: '@',
            }
          },
          {
            name: {
              not: null
            }
          },
          {
            createdAt: {
              gte: new Date('2020-01-01')
            }
          }
        ]
      },
      select: {
        email: true,
        name: true,
        createdAt: true
      }
    });
    console.log('7. Users with valid email, name set, created after 2020:');
    complexSearch.forEach(u => console.log(`   - ${u.email} (${u.name})`));
    console.log();

  } catch (error) {
    console.error('💥 Error running queries:', error.message);
  }
}

async function main() {
  await demoUserQueries();
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Script error:', error);
  process.exit(1);
});