const { Sequelize, QueryTypes, Validator } = require('sequelize');

const promoteAdmin = async (database, email) => {
  if (typeof email !== 'string' || !Validator.isEmail(email)) {
    throw new Error('Provide the exact email address of an existing account');
  }

  // Use a dedicated connection: importing the app would also start services
  // and schema synchronization. Only this account's privilege is changed.
  const users = await database.query(
    'UPDATE "Users" SET "admin" = true, "updatedAt" = CURRENT_TIMESTAMP WHERE "email" = $email RETURNING "id", "email"',
    { bind: { email }, type: QueryTypes.SELECT }
  );
  if (!users.length) throw new Error('Account not found; register the account first');
  return users[0];
};

const main = async () => {
  if (process.argv.length !== 3) throw new Error('Usage: npm run admin:promote -- user@example.com');
  require('dotenv').config();
  const database = new Sequelize(
    process.env.POSTGRES_NAME,
    process.env.POSTGRES_USER,
    process.env.POSTGRES_PASSWORD,
    { host: process.env.POSTGRES_HOST || 'db', dialect: 'postgres', logging: false }
  );
  try {
    const user = await promoteAdmin(database, process.argv[2]);
    console.log(`Administrator enabled for ${user.email}`);
  } finally {
    await database.close();
  }
};

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { promoteAdmin };
