const dotenv = require('dotenv');
const Chat = require('../services/Chat');
const Documents = require('../services/Documents');
const Community = require('../services/Community');
const winston = require('winston');
const { combine, timestamp, json } = winston.format;
const { getAdminSetting } = require('../init/redisUtils');
const redis = require('redis');
const Users = require('../services/Users');
dotenv.config();

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

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp(), json()),
  transports: [
    new winston.transports.File({
      filename: process.env.LOG_FILE_PATH,
    }),
  ],
});

class ChatController {
  static async createNewChat(request, response) {
    const chat = new Chat(knex);

    if (request.body.communityId) {
      logger.info(`Creating new chat for user Id ${request.decoded.userId}`);
      const DEFAULT_CHAT_NAME = await getAdminSetting('DEFAULT_CHAT_NAME');
      chat
        .createNewChat(
          DEFAULT_CHAT_NAME,
          request.decoded.userId,
          request.body.communityId,
          request.body.type,
          request.body.fileId
        )
        .then((chatId) => {
          logger.info(`New chat created for user Id ${request.decoded.userId}`);
          logger.info(`Fetching updated chat histories for user Id ${request.decoded.userId}`);
          chat
            .getChatHistoriesForUserBySpecificScope(
              request.decoded.userId,
              request.body.communityId,
              request.body.fileId,
              request.body.type
            )
            .then((userChatHistories) => {
              logger.info(`Updated chat histories fetched for user Id ${request.decoded.userId}`);
              logger.debug(
                JSON.stringify({ success: true, userChatHistories, activeChatId: chatId })
              );
              return response
                .status(201)
                .send({ success: true, userChatHistories, activeChatId: chatId });
            })
            .catch((err) => {
              logger.warn(
                `Failed to fetch updated chat hsitories for user Id ${request.decoded.userId}`
              );
              logger.error(err);
              logger.debug(
                JSON.stringify({
                  success: false,
                  message: request.t('chatHistoryUpdateSuccessFetchFailed'),
                })
              );
              return response.status(201).send({
                success: false,
                message: request.t('chatHistoryUpdateSuccessFetchFailed'),
              });
            });
        })
        .catch((err) => {
          logger.warn(`Failed to create new chat for user Id ${request.decoded.userId}`);
          logger.debug(JSON.stringify({ success: false }));
          return response.status(201).send({ success: false });
        });
    } else {
      logger.debug(
        JSON.stringify({
          success: false,
          message: 'Missing parameters, fill all the required fields',
        })
      );
      return response
        .status(400)
        .send({ success: false, message: 'Missing parameters, fill all the required fields' });
    }
  }

  static getChatHistoriesForUserBySpecificScope(request, response) {
    console.log(request.body);
    const chat = new Chat(knex);

    if (request.body.userId && request.body.communityId) {
      logger.info(`Fetching chat histories for user Id ${request.body.userId}`);
      chat
        .getChatHistoriesForUserBySpecificScope(
          request.body.userId,
          request.body.communityId,
          request.body.fileId,
          request.body.type
        )
        .then((userChatHistories) => {
          logger.info(`Chat histories fetched successfully for user Id ${request.body.userId}`);
          logger.debug(JSON.stringify({ success: true, userChatHistories }));
          return response.status(201).send({ success: true, userChatHistories });
        })
        .catch((err) => {
          console.log(err);
          logger.warn(`Failed fecth chat histories for user Id ${request.body.userId}`);
          logger.error(err);
          logger.debug(JSON.stringify({ success: false }));
          return response.status(201).send({ success: false });
        });
    } else {
      logger.debug(
        JSON.stringify({
          success: false,
          message: 'Missing parameters, fill all the required fields',
        })
      );
      return response
        .status(400)
        .send({ success: false, message: 'Missing parameters, fill all the required fields' });
    }
  }

  static addMessageToConversation(request, response) {
    const chat = new Chat(knex);
    const documents = new Documents(knex);
    const community = new Community(knex);
    const user = new Users(knex);

    if (
      request.body.message &&
      request.body.chatId &&
      request.body.communityId &&
      request.body.userId
    ) {
      user.getCompanyUserRole(request.body.companyId).then(async (userRole) => {
        logger.info('Fetching total user of comapny');
        const userIds = userRole.map((userId) => userId.userId);
        let queryDetails = [];
        logger.info('Fetching monthly used query by comapny');
        const queryDetailsPromises = userIds.map(async (userId) => {
          const chatDetails = await chat.getChatHistoriesByUser(userId);
          const queryIds = chatDetails.map((query) => query.id);
          const chatDetailsPromises = queryIds.map((chatId) => {
            return chat.getChatMessages(chatId).then((messages) => {
              const currentMonthMessages = messages.filter((message) => {
                const messageDate = new Date(message.created);
                const currentDate = new Date();
                return (
                  messageDate.getMonth() === currentDate.getMonth() &&
                  messageDate.getFullYear() === currentDate.getFullYear()
                );
              });
              return currentMonthMessages;
            });
          });

          let usedQueries = 0;
          await Promise.all(chatDetailsPromises)
            .then((query) => {
              usedQueries += Math.floor(query.flat().length / 2);
              queryDetails.push({
                userId,
                usedQueries,
              });
            })
            .catch((error) => {
              logger.error('Error fetching user query details:', error);
            });

          return userId;
        });

        await Promise.all(queryDetailsPromises).catch((error) => {
          logger.error('Error fetching user query details:', error);
        });

        const isQueriesMetaKeys = await user.checkMetaKeyExists(request.body.userId, 'queries');
        if (isQueriesMetaKeys?.length != 0) {
          logger.info('Queries meta Values are updated for user', request.body.userId);
          await user.updateUserMetaQueries(request.body.userId);
        } else {
          await queryDetails.forEach(async (item) => {
            const isMetaKeys = await user.checkMetaKeyExists(item?.userId, 'queries');
            if (isMetaKeys?.length == 0) {
              await user._addUserMeta(item?.userId, 'queries', item?.usedQueries);
            }
          });
        }

        let currentQueriesCount = 0;
        const metaQueriesPromise = userIds.map(async (userId) => {
          let userMetaQueryCount = await user.getUserMetaValue(userId, 'queries');
          currentQueriesCount = parseInt(currentQueriesCount) + parseInt(userMetaQueryCount);
          return currentQueriesCount;
        });

        await Promise.all(metaQueriesPromise)
          .then((result) => {
            logger.info('Total Meta Queries Count:', result);
          })
          .catch((error) => {
            logger.error('Error fetching user query details:', error);
          });

        const maxQuries = parseInt(process.env.MAX_QUERY);
        if (currentQueriesCount <= maxQuries) {
          logger.info(`Initiating new query for the question ${request.body.message}`);
          logger.info(`Adding user message to chat Id ${request.body.chatId} `);
          chat
            .addMessagesToTheChatHistory(request.body.chatId, request.body.message, 'user', null)
            .then((parentId) => {
              community
                .getCommunityUUID(request.body.communityId)
                .then((uuid) => {
                  logger.info(`User message added, querying the index`);
                  documents
                    .queryIndex(uuid, parentId, request.body.chatId, request.body.message)
                    .then(({ messageId, suggestedQuestions }) => {
                      chat
                        .getChatMessageById(messageId)
                        .then((_message) => {
                          logger.info(
                            `Query successful with the following answer ${_message.message}`
                          );
                          let message = _message;
                          message['showFullCitation'] = false;
                          logger.debug(
                            JSON.stringify({ success: true, message, suggestedQuestions })
                          );

                          knex('chat_scope')
                            .select('*')
                            .where({ chatId: request.body.chatId })
                            .then((chatScope) => {
                              chat
                                .getChatHistoriesForUserBySpecificScope(
                                  request.body.userId,
                                  request.body.communityId,
                                  chatScope[0].fileId,
                                  chatScope[0].type
                                )
                                .then((chatHistories) => {
                                  return response.status(201).send({
                                    success: true,
                                    message,
                                    userChatHistories: chatHistories,
                                    suggestedQuestions,
                                  });
                                })
                                .catch((err) => {
                                  logger.warn(`Query successful but failed to retrive AI answer`);
                                  logger.error(err);
                                  console.log(err);
                                  logger.debug(JSON.stringify({ success: false }));
                                  return response.status(201).send({ success: false });
                                });
                            })
                            .catch((err) => {
                              logger.warn(`Query successful but failed to retrive AI answer`);
                              logger.error(err);
                              console.log(err);
                              logger.debug(JSON.stringify({ success: false }));
                              return response.status(201).send({ success: false });
                            });
                        })
                        .catch((err) => {
                          logger.warn(`Query successful but failed to retrive AI answer`);
                          logger.error(err);
                          console.log(err);
                          logger.debug(JSON.stringify({ success: false }));
                          return response.status(201).send({ success: false });
                        });
                    })
                    .catch((err) => {
                      console.log(err);
                      logger.warn(`Failed to query the index`);
                      logger.error(err);
                      logger.debug(JSON.stringify({ success: false }));
                      return response.status(201).send({ success: false });
                    });
                })
                .catch((err) => {
                  console.log(err);
                  logger.warn(`Failed to query the index`);
                  logger.error(err);
                  logger.debug(JSON.stringify({ success: false }));
                  return response.status(201).send({ success: false });
                });
            })
            .catch((err) => {
              console.log(err);
              logger.warn(`Failed to add user message to chat Id ${request.body.chatId}`);
              logger.error(err);
              logger.debug(JSON.stringify({ success: false }));
              return response.status(201).send({ success: false });
            });
        } else {
          logger.info(`You have reached maximum number of queries for ${request.body.companyId}`);
          logger.debug(JSON.stringify({ success: false }));
          return response
            .status(201)
            .send({ success: false, message: `You have reached maximum number of queries.` });
        }
      });
    } else {
      logger.debug(
        JSON.stringify({
          success: false,
          message: 'Missing parameters, fill all the required fields',
        })
      );
      return response
        .status(400)
        .send({ success: false, message: 'Missing parameters, fill all the required fields' });
    }
  }

  static retrieveChatMessages(request, response) {
    const chat = new Chat(knex);

    if (request.body.chatId) {
      logger.info(`Fetching chat messages for chat Id ${request.body.chatId}`);
      chat
        .getChatMessages(request.body.chatId)
        .then((_chatMessages) => {
          logger.info(`Chat messages fetched successfully for Id ${request.body.chatId}`);
          let chatMessages = [];
          for (const message of _chatMessages) {
            let temp = message;
            temp['showFullCitation'] = false;
            chatMessages.push(temp);
          }
          logger.debug(JSON.stringify({ success: true, chatMessages }));
          return response.status(201).send({ success: true, chatMessages });
        })
        .catch((err) => {
          logger.warn(`Failed to fetch chat messages for id ${request.body.chatId}`);
          logger.error(err);
          logger.debug(JSON.stringify({ success: false }));
          console.log(err);
          return response.status(201).send({ success: false });
        });
    } else {
      logger.debug(
        JSON.stringify({
          success: false,
          message: 'Missing parameters, fill all the required fields',
        })
      );
      return response
        .status(400)
        .send({ success: false, message: 'Missing parameters, fill all the required fields' });
    }
  }

  static getChatHistoriesForUserByCommunity(request, response) {
    const chat = new Chat(knex);

    if (request.body.userId && request.body.communityId) {
      logger.info(`Fetching chat histories for user Id ${request.body.userId}`);
      chat
        .getChatHistoriesForUserByCommunity(request.body.userId, request.body.communityId)
        .then((userChatHistories) => {
          logger.info(`Chat histories fetched successfully for user Id ${request.body.userId}`);
          logger.debug(JSON.stringify({ success: true, userChatHistories }));
          return response.status(201).send({ success: true, userChatHistories });
        })
        .catch((err) => {
          console.log(err);
          logger.warn(`Failed fecth chat histories for user Id ${request.body.userId}`);
          logger.error(err);
          logger.debug(JSON.stringify({ success: false }));
          return response.status(201).send({ success: false });
        });
    } else {
      logger.debug(
        JSON.stringify({
          success: false,
          message: 'Missing parameters, fill all the required fields',
        })
      );
      return response
        .status(400)
        .send({ success: false, message: 'Missing parameters, fill all the required fields' });
    }
  }

  static renameChatHistory(request, response) {
    const chat = new Chat(knex);

    if (request.body.chatId && request.body.newChatName && request.body.communityId) {
      logger.info(`Renaming chat Id ${request.body.chatId}`);
      chat
        .renameChat(request.body.chatId, request.body.newChatName)
        .then((res) => {
          if (res == 1) {
            logger.info(`Chat history ${request.body.chatId} renamed`);
            logger.info(`Fetching updated chat histories.`);
            chat
              .getChatHistoriesForUserBySpecificScope(
                request.decoded.userId,
                request.body.communityId,
                request.body.fileId,
                request.body.type
              )
              .then((userChatHistories) => {
                logger.info(`Updated chat history fetched successfully`);
                logger.debug(
                  JSON.stringify({
                    success: true,
                    userChatHistories,
                    message: request.t('chatHistoryUpdateSuccess'),
                  })
                );
                return response.status(201).send({
                  success: true,
                  userChatHistories,
                  message: request.t('chatHistoryUpdateSuccess'),
                });
              })
              .catch((err) => {
                logger.warn(`Failed to fetch updated chat histories`);
                logger.error(err);
                logger.debug(
                  JSON.stringify({
                    success: false,
                    message: request.t('chatHistoryUpdateSuccessFetchFailed'),
                  })
                );
                return response.status(201).send({
                  success: false,
                  message: request.t('chatHistoryUpdateSuccessFetchFailed'),
                });
              });
          } else {
            logger.warn(`Failed to rename chat history`);
            logger.debug(
              JSON.stringify({ success: false, message: request.t('chatHistoryUpdateFailed') })
            );
            return response
              .status(201)
              .send({ success: false, message: request.t('chatHistoryUpdateFailed') });
          }
        })
        .catch((err) => {
          logger.warn(`Failed to rename chat history`);
          logger.error(err);
          logger.debug(
            JSON.stringify({ success: false, message: request.t('chatHistoryUpdateFailed') })
          );
          return response
            .status(201)
            .send({ success: false, message: request.t('chatHistoryUpdateFailed') });
        });
    } else {
      logger.debug(
        JSON.stringify({
          success: false,
          message: 'Missing parameters, fill all the required fields',
        })
      );
      return response
        .status(400)
        .send({ success: false, message: 'Missing parameters, fill all the required fields' });
    }
  }

  static deleteChatHistory(request, response) {
    const chat = new Chat(knex);

    if (request.body.chatId && request.body.communityId) {
      logger.info(`Deleting chat Id ${request.body.chatId}`);
      chat
        .deleteChatHistory(request.body.chatId)
        .then((res) => {
          logger.info(`Deleted chat Id ${request.body.chatId}`);
          logger.info(`Fetching updated chat histories`);
          chat
            .getChatHistoriesForUserBySpecificScope(
              request.decoded.userId,
              request.body.communityId,
              request.body.fileId,
              request.body.type
            )
            .then((userChatHistories) => {
              logger.info(`Updated chat history fetched successfully`);
              logger.debug(
                JSON.stringify({
                  success: true,
                  userChatHistories,
                  message: request.t('chatHistoryDeleteSuccess'),
                })
              );
              return response.status(201).send({
                success: true,
                userChatHistories,
                message: request.t('chatHistoryDeleteSuccess'),
              });
            })
            .catch((err) => {
              logger.warn(`Failed to fetch updated chat histories`);
              logger.error(err);
              logger.debug(
                JSON.stringify({
                  success: false,
                  message: request.t('chatHistoryDeleteSuccessFetchFailed'),
                })
              );
              return response.status(201).send({
                success: false,
                message: request.t('chatHistoryDeleteSuccessFetchFailed'),
              });
            });
        })
        .catch((err) => {
          logger.warn(`Failed to delete the chat Id ${request.body.chatId}`);
          logger.error(err);
          console.log(err);
          logger.debug(
            JSON.stringify({ success: false, message: request.t('chatHistoryDeleteSuccessFailed') })
          );
          return response
            .status(201)
            .send({ success: false, message: request.t('chatHistoryDeleteSuccessFailed') });
        });
    } else {
      logger.debug(
        JSON.stringify({
          success: false,
          message: 'Missing parameters, fill all the required fields',
        })
      );
      return response
        .status(400)
        .send({ success: false, message: 'Missing parameters, fill all the required fields' });
    }
  }
}

module.exports = ChatController;
