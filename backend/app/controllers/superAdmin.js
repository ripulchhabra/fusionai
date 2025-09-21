const SuperAdmin = require('../services/SuperAdmin');
const winston = require('winston');
const { combine, timestamp, json } = winston.format;
const dotenv = require('dotenv');
const { loadDataToRedis } = require('../init/redisUtils');
dotenv.config();
const { Storage } = require('@google-cloud/storage');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp(), json()),
  transports: [
    new winston.transports.File({
      filename: process.env.LOG_FILE_PATH,
    }),
  ],
});

let credentials;
try {
  credentials = require(process.env.GOOGLE_CREDENTIALS);
} catch (error) {
  logger.info('error getting credentials');
  logger.info(error);
}

const storage = new Storage({ credentials });

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

class SuperAdminController {
  static getRoles(request, response) {
    const superAdmins = new SuperAdmin(knex);
    superAdmins
      .getUserRole(request.body.userId)
      .then((res) => {
        if (res == 4) {
          logger.info('Fetching super admin role');
          response.status(200).send({ status: true });
        } else {
          logger.error('Error fetching super admin role');
          response.status(403).send({ status: false });
        }
      })
      .catch((err) => {
        logger.error('Error fetching user role:', err);
        response.status(500).send('Internal Server Error');
      });
  }

  static getENV(request, response) {
    const superAdmins = new SuperAdmin(knex);
    superAdmins
      .getAdminENV()
      .then((env) => {
        logger.info('Fetching super admin settings');
        return response.status(201).send({ success: true, env });
      })
      .catch((err) => {
        logger.error('Error fetching super admin settings', err);
        return response.status(201).send({ success: false });
      });
  }

  static getEmailTemplates(request, response) {
    const superAdmins = new SuperAdmin(knex);
    superAdmins
      .getAllEmailTemplates()
      .then((res) => {
        logger.info('Fetching email template');
        return response.status(201).send({ success: true, templates: res });
      })
      .catch((err) => {
        logger.error('Error fetching email template', err);
        return response.status(201).send({ success: false });
      });
  }

  static updateTemplate(request, response) {
    const superAdmins = new SuperAdmin(knex);
    superAdmins
      .updateEmailTemplate(
        request.body.id,
        request.body.subject,
        request.body.template,
        request.body.fileName
      )
      .then((res) => {
        logger.info('Updating email template');
        return response
          .status(200)
          .send({ success: true, message: 'Updated template successfully.' });
      })
      .catch((err) => {
        logger.error('Error epdating email template', err);
        return response.status(200).send({ success: false, message: err });
      });
  }

  static async deleteUser(request, response) {
    const userId = request.body.id;
    try {
      // Start a transaction to ensure all operations are atomic
      await knex.transaction(async (trx) => {
        // Check if the user exists
        const user = await trx('users').where({ id: userId }).first();

        if (!user) {
          logger.info(`User with ID ${userId} does not exist.`);
          return response.status(200).send({ success: false, message: 'Something went wrong' });
        }

        // Handle chat_histories where the userId matches
        const chatHistories = await trx('chat_histories').where({ userId });

        if (chatHistories.length > 0) {
          for (const chat_messages of chatHistories) {
            await trx('chat_messages').where({ chatId: chat_messages.id }).del();
            await trx('tokens_used').where({ chatId: chat_messages.id }).del();
          }

          await trx('chat_histories').where({ userId }).del();
        }

        // Handle documents where the communityId matches
        // (Assuming documents have communityId referencing communities)
        const communities = await trx('communities').where({ creator: userId });

        for (const community of communities) {
          const files = await trx('documents').where({ communityId: community.id, isFile: '1' });

          if (files.length > 0) {
            for (const file of files) {
              const ext = file.name.split('.').pop();
              const fileName = file.id + '.' + ext;

              let [exists] = '';
              if (process.env.GOOGLE_CLOUD_STORAGE == 1) {
                [exists] = await storage
                  .bucket(process.env.GOOGLE_STORAGE_BUCKET_NAME)
                  .file(fileName)
                  .exists();
              } else {
                exists = false;
              }
              logger.info(
                `FIleName: ${file.name} with ID: ${fileName} exists on cloud : ${exists}`
              );
              if (exists) {
                const res = await storage
                  .bucket(process.env.GOOGLE_STORAGE_BUCKET_NAME)
                  .file(fileName)
                  .delete();
                logger.info(`${fileName} deleted from cloud`);
              }

              await trx('file_embedding').where({ fileId: file.id }).del();
            }
          }

          await trx('documents').where({ communityId: community.id }).del();

          await trx('summary').where({ communityId: community.id }).del();
        }

        // Handle companies where the adminId matches
        const companies = await trx('companies').where({ adminId: userId });

        if (companies.length > 0) {
          for (const company of companies) {
            await trx('companies_meta').where({ companyId: company.id }).del();
          }

          await trx('companies').where({ adminId: userId }).del();
        }

        // Handle invitations where the userId or sender matches
        const invitations = await trx('invitations').where({ userId }).orWhere({ sender: userId });

        if (invitations.length > 0) {
          await trx('invitations').where({ userId }).orWhere({ sender: userId }).del();
        }

        // Handle subscriptions where the userId matches
        const subscriptions = await trx('subscriptions').where({ userId });

        if (subscriptions.length > 0) {
          await trx('subscriptions').where({ userId }).del();
        }

        // Handle users_meta where the userId matches
        const usersMeta = await trx('users_meta').where({ userId });

        if (usersMeta.length > 0) {
          await trx('users_meta').where({ userId }).del();
        }

        // Handle user_company_role_relationship where the userId matches
        const userCompanyRoleRelationship = await trx('user_company_role_relationship').where({
          userId,
        });

        if (userCompanyRoleRelationship.length > 0) {
          await trx('user_company_role_relationship').where({ userId }).del();
        }

        // Finally, delete the user
        await trx('users').where({ id: userId }).del();

        logger.info(`User with ID ${userId} deleted successfully.`);
        return response
          .status(200)
          .send({ success: true, message: `Successfully deleted User's account` });
      });
    } catch (error) {
      console.log(error);
      logger.error(`Error deleting user with ID ${userId}:`, error);
      return response.status(200).send({ success: false, message: 'Something went wrong' });
    }
  }

  static async deleteTeamAccount(request, response) {
    const companyId = request.body.companyId;
    logger.info(`Deleting team account with Id ${companyId}`);
    try {
      // Start a transaction to ensure all operations are atomic
      await knex.transaction(async (trx) => {
        // Check if the user exists
        const companiess = await trx('user_company_role_relationship').where({
          company: companyId,
        });

        let userIds = [];
        companiess.map((company) => {
          userIds.push(company.userId);
        });

        for (const userId of userIds) {
          const user = await trx('users').where({ id: userId }).first();

          if (!user) {
            console.log(`User with ID ${userId} does not exist.`);
            return response.status(200).send({ success: false, message: 'Something went wrong' });
          }

          // Handle chat_histories where the userId matches
          const chatHistories = await trx('chat_histories').where({ userId });

          if (chatHistories.length > 0) {
            for (const chat_messages of chatHistories) {
              await trx('chat_messages').where({ chatId: chat_messages.id }).del();
              await trx('tokens_used').where({ chatId: chat_messages.id }).del();
            }

            await trx('chat_histories').where({ userId }).del();
          }

          // Handle documents where the communityId matches
          // (Assuming documents have communityId referencing communities)
          const communities = await trx('communities').where({ creator: userId });

          for (const community of communities) {
            await trx('chat_histories').where({ communityId: community.id }).del();

            const files = await trx('documents').where({ communityId: community.id, isFile: '1' });

            if (files.length > 0) {
              for (const file of files) {
                const ext = file.name.split('.').pop();
                const fileName = file.id + '.' + ext;

                let [exists] = '';
                if (process.env.GOOGLE_CLOUD_STORAGE == 1) {
                  [exists] = await storage
                    .bucket(process.env.GOOGLE_STORAGE_BUCKET_NAME)
                    .file(fileName)
                    .exists();
                } else {
                  exists = false;
                }
                logger.info(
                  `FIleName: ${file.name} with ID: ${fileName} exists on cloud : ${exists}`
                );
                if (exists) {
                  const res = await storage
                    .bucket(process.env.GOOGLE_STORAGE_BUCKET_NAME)
                    .file(fileName)
                    .delete();
                  logger.info(`${fileName} deleted from cloud`);
                }
                await trx('file_embedding').where({ fileId: file.id }).del();
              }
            }

            await trx('documents').where({ communityId: community.id }).del();

            await trx('summary').where({ communityId: community.id }).del();
          }

          // Handle companies where the adminId matches
          const companies = await trx('companies').where({ adminId: userId });

          if (companies.length > 0) {
            for (const company of companies) {
              await trx('companies_meta').where({ companyId: company.id }).del();
            }

            await trx('companies').where({ adminId: userId }).del();
          }

          // Handle invitations where the userId or sender matches
          const invitations = await trx('invitations')
            .where({ userId })
            .orWhere({ sender: userId });

          if (invitations.length > 0) {
            await trx('invitations').where({ userId }).orWhere({ sender: userId }).del();
          }

          // Handle subscriptions where the userId matches
          const subscriptions = await trx('subscriptions').where({ userId });

          if (subscriptions.length > 0) {
            await trx('subscriptions').where({ userId }).del();
          }

          // Handle users_meta where the userId matches
          const usersMeta = await trx('users_meta').where({ userId });

          if (usersMeta.length > 0) {
            await trx('users_meta').where({ userId }).del();
          }

          // Handle user_company_role_relationship where the userId matches
          const userCompanyRoleRelationship = await trx('user_company_role_relationship').where({
            userId,
          });

          if (userCompanyRoleRelationship.length > 0) {
            await trx('user_company_role_relationship').where({ userId }).del();
          }

          // Finally, delete the user
          await trx('users').where({ id: userId }).del();

          logger.info(`User with ID ${userId} deleted successfully.`);
        }

        logger.info(`Successfully Deleted team account of Id ${companyId}`);
        return response
          .status(200)
          .send({ success: true, message: `Successfully deleted Team account` });
      });
    } catch (error) {
      console.log(error);
      logger.error(`Error deleting team account with ID ${request.body.companyId}`);
      logger.error(error);
      return response.status(200).send({ success: false, message: 'Something went wrong' });
    }
  }

  static updateENV(request, response) {
    const superAdmins = new SuperAdmin(knex);
    superAdmins
      .updateAdminENV(request.body)
      .then(async (env) => {
        if (process.env.CACHE_MODE == '1') {
          console.log('Resetting cache');
          logger.info('Resetting cache, Update super admin settings');
          await loadDataToRedis();
        }
        logger.info('Updating super admin settings');
        return response
          .status(200)
          .send({ success: true, message: 'Environment variables updated successfully' });
      })
      .catch((err) => {
        logger.error('Error updating super admin settings', err);
        return response
          .status(201)
          .send({ success: false, message: 'Failed to update environment variables' });
      });
  }
}

module.exports = SuperAdminController;
