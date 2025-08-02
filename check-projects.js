const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    // Check users
    const users = await prisma.user.findMany();
    console.log('All users in database:');
    console.log(JSON.stringify(users, null, 2));
    console.log(`\nTotal users: ${users.length}`);
    
    // Check projects
    const projects = await prisma.project.findMany({
      include: {
        _count: {
          select: {
            testRuns: true,
            flakyTests: true,
          },
        },
      },
    });
    
    console.log('\nAll projects in database:');
    console.log(JSON.stringify(projects, null, 2));
    console.log(`\nTotal projects: ${projects.length}`);
  } catch (error) {
    console.error('Error fetching data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();