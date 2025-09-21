const dotenv = require('dotenv');
const Users = require('../services/Users');
const winston = require('winston');
const { combine, timestamp, json } = winston.format;
dotenv.config();

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp(), json()),
  transports: [
    new winston.transports.File({
      filename: process.env.LOG_FILE_PATH,
    }),
  ],
});

const knex = require('knex')({
  client: 'mysql',
  connection: {
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT,
    user: process.env.DATABASE_USER_NAME,
    password: process.env.DATABASE_PASSWORD ? process.env.DATABASE_PASSWORD : '',
    database: process.env.DATABASE_NAME,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
  },
});

class AppdataController {
  static async appData(request, response) {
    const user = new Users(knex);
    const currentDate = new Date();
    const isStartOfMonth = currentDate.getDate() === 1;

    if (isStartOfMonth) {
      user
        .resetQueriesMetaValueForNewMonth()
        .then((res) => {
          if (res == 1) {
            logger.info(`Queries meta Values are updated for ${currentDate}`);
          }
        })
        .catch((error) => {
          console.log(error);
        });
    }

    try {
      const appLogo = `app-logo/logo.png`;
      const appIcon = `app-icon/favicon.png`;
      const appName = process.env.APPLICATION_NAME || 'AI Bot';
      const appTagline = process.env.APPLICATION_TAGLINE || 'Tagline';
      const appBotName = process.env.APPLICATION_BOTNAME || 'Bot';
      const chatMessages = process.env.CHAT_MESSAGES.split('|') || '';
      const embeddingData = process.env.EMBEDDING_MODEL || '';
      const maxUsers = process.env.MAX_USERS;
      const maxQuery = process.env.MAX_QUERY;
      const maxStorage = process.env.MAX_STORAGE;
      const defaultResponseSuffix = process.env.DEFAULT_CHAT_RESPONSE_FORMAT;
      const isDeleteAccount = process.env.SUPER_ADMIN_DELETE_ACCOUNT;
      const settings = await knex('super-admin-settings')
        .select('meta_value')
        .where({ meta_key: 'CHAT_OUTPUT_TOKEN' });
      const maxFileUploads = await knex('super-admin-settings')
        .select('meta_value')
        .where({ meta_key: 'MAX_FILE_UPLOADS' });
      const activeCurrencies = await knex('super-admin-settings')
        .select('meta_value')
        .where({ meta_key: 'ACTIVE_PAYMENT_CURRENCIES' });
      const paymentCurrencies = process.env.PAYMENT_CURRENCIES;

      const appData = {
        appLogo,
        appIcon,
        appName,
        appTagline,
        appBotName,
        signUpMode: process.env.SIGN_UP_MODE == 1 ? 'enabled' : 'disabled',
        chatMessages,
        embeddingData,
        token: settings[0]['meta_value'],
        maxUsers,
        maxQuery,
        maxStorage,
        defaultResponseSuffix,
        isDeleteAccount,
        maxFileUploads,
      };
      logger.debug(
        JSON.stringify({ success: true, message: 'App data fetched successfully', appData })
      );
      response
        .status(200)
        .json({ success: true, message: 'App data fetched successfully', appData });
    } catch (error) {
      console.error('Error in getAppData:', error);
      logger.error('Error in getAppData:', error);
      response.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = AppdataController;
