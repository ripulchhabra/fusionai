const express = require('express');
const app = express();
const parser = require('body-parser');
const useragent = require('express-useragent');
const multer = require('multer');
const usersRoute = require('./app/routes/user');
const communityRoute = require('./app/routes/community');
const documentRoute = require('./app/routes/document');
const chatRoute = require('./app/routes/chat');
const superAdminRoute = require('./app/routes/superAdmin');
const appdataRoute = require('./app/routes/appdata');
const auth = require('./app/middleware/authenticate');
const Users = require('./app/services/Users');
const Documents = require('./app/services/Documents');
const Community = require('./app/services/Community');
const Notification = require('./app/services/Notification');
const Chat = require('./app/services/Chat');
const PDFExtractor = require('./app/services/PDFExtractor');
const { loadDataToRedis, getAdminSetting } = require('./app/init/redisUtils');
const { emailTransporter } = require('./app/init/emailTransporter');
const path = require('path');
const fs = require('fs');
var fs2 = require('fs').promises;
const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const i18nextMiddleware = require('i18next-http-middleware');
const nfetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const mime = require('mime-types');
const winston = require('winston');
const stripe = require('stripe');
const { summarizer } = require('./app/init/summarizer');
const { combine, timestamp, json } = winston.format;
const { imageSummary, audioSummary, videoSummary } = require('./app/init/description');
const dotenv = require('dotenv');
const axios = require('axios');
const Redis = require('ioredis');
const Bull = require('bull');
const cron = require('node-cron');
const querystring = require('querystring');
const rateLimit = require('express-rate-limit');
const { google } = require('googleapis');
const { Storage } = require('@google-cloud/storage');
dotenv.config();

i18next
  .use(Backend)
  .use(i18nextMiddleware.LanguageDetector)
  .init({
    backend: {
      loadPath: __dirname + '/resources/locales/{{lng}}/{{ns}}.json',
    },
    fallbackLng: 'en',
    preload: ['en'],
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

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp(), json()),
  transports: [
    new winston.transports.File({
      filename: process.env.LOG_FILE_PATH,
    }),
  ],
});

const fileUploadRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1-minute window
  max: process.env.FILE_UPLOAD_RATE_LIMIT || 10, // Limit each user requests per windowMs
  keyGenerator: (req) => req.decoded.userId, // Use user ID from verified token
  message: {
    status: 429,
    error: 'Too many requests, please wait and try again later.',
  },
  standardHeaders: true, // Include rate limit headers in responses
  legacyHeaders: false, // Disable the deprecated X-RateLimit-* headers
  handler: (req, res) => {
    // Custom handler for rate limit exceeded
    console.log('limiter file upload');
    return res.status(429).json({
      success: false,
      message: `Rate limit exceeded. Only ${process.env.FILE_UPLOAD_RATE_LIMIT} uploads allowed per minute.`,
    });
  },
});

const userAvatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, `${process.env.BACKEND_PATH}/uploads/userAvatars`);
  },
  filename: function (req, file, cb) {
    const fileName =
      req.body.userId + '-' + Math.round(Math.random() * 1e5) + path.extname(file.originalname);
    req.fileName = fileName;
    cb(null, fileName);
  },
});

const userAvatarUpload = multer({ storage: userAvatarStorage });

const companyLogosStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, `${process.env.BACKEND_PATH}/uploads/companyLogos`);
  },
  filename: function (req, file, cb) {
    const fileName =
      req.body.companyId + '-' + Math.round(Math.random() * 1e5) + path.extname(file.originalname);
    req.fileName = fileName;
    cb(null, fileName);
  },
});

const companyLogoUpload = multer({ storage: companyLogosStorage });

const documentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const community = new Community(knex);
    const documents = new Documents(knex);
    community.getCommunityUUID(req.query.communityId).then((uuid) => {
      req.uuid = uuid;
      req.filePath = path.resolve(`${process.env.DOCUMENT_PATH}/${uuid}`);
      cb(null, `${process.env.BACKEND_PATH}/documents/${uuid}`);
    });
  },
  filename: function (req, file, cb) {
    const documents = new Documents(knex);
    documents
      .createFile(
        file.originalname,
        req.query.parentId,
        req.query.communityId,
        req.query.source || 'Upload'
      )
      .then((fileId) => {
        const fileName = fileId + path.extname(file.originalname);
        req.originalName = file.originalname;
        req.fileName = fileId;
        req.fileFullName = fileName;
        cb(null, fileName);
      });
  },
});

const documentUpload = multer({ storage: documentStorage });

const audioStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const community = new Community(knex);
    community.getCommunityUUID(req.query.communityId).then((uuid) => {
      req.filePath = path.resolve(`${process.env.DOCUMENT_PATH}/${uuid}`);
      cb(null, `${process.env.BACKEND_PATH}/documents/${uuid}`);
    });
  },
  filename: function (req, file, cb) {
    const documents = new Documents(knex);
    documents
      .createFile(
        req.query.fileName,
        req.query.parentId,
        req.query.communityId,
        (req.body.source = 'Upload')
      )
      .then((fileId) => {
        const fileName = fileId + path.extname(req.query.fileName);
        req.fileName = fileId;
        req.fileFullName = fileName;
        cb(null, fileName);
      });
  },
});

const audioUpload = multer({ storage: audioStorage });

app.use(i18nextMiddleware.handle(i18next));
app.use(useragent.express());

let credentials;
try {
  credentials = require(process.env.GOOGLE_CREDENTIALS);
} catch (error) {
  console.log(error);
  logger.info('error getting credentials');
  logger.info(error);
}

let storage;
try {
  storage = new Storage({ credentials });
} catch (error) {
  console.log(error);
  logger.info('error initializing storage');
  logger.info(error);
}

const sanitizeForLog = (value) => {
  if (typeof value === 'string') {
    // Remove line breaks & unwanted characters
    return value.replace(/[\r\n]/g, '').replace(/[^a-zA-Z0-9-_.@ ]/g, '');
  }
  if (typeof value === 'object' && value !== null) {
    const sanitized = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        sanitized[key] = sanitizeForLog(value[key]); // Recursively sanitize
      }
    }
    return sanitized;
  }
  return value ?? ''; // Return empty string if null/undefined
};

app.post(
  '/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (request, response) => {
    const sig = request.headers['stripe-signature'];

    let event;

    try {
      event = stripe.webhooks.constructEvent(request.body, sig, process.env.STRIPE_ENDPOINT_SECRET);
    } catch (err) {
      response.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    response.send();

    const metadata = event.data.object.metadata;
    const user = new Users(knex);

    switch (event.type) {
      case 'checkout.session.completed':
        if (metadata.accountType == 'solo' && metadata.signUpMethod == 'email') {
          user
            .createNewUser(
              metadata.firstname,
              metadata.lastname,
              metadata.email,
              metadata.countryCode,
              metadata.mobileNumber,
              metadata.password,
              metadata.accountType,
              '1',
              metadata.signUpMethod
            )
            .then((res) => {
              const { userId, token } = res;
              logger.info(`User account creation successful for ${metadata.email}`);
              logger.info(`Creating company account for ${metadata.email}`);
              user
                .createNewCompany(
                  userId,
                  null,
                  null,
                  null,
                  null,
                  null,
                  null,
                  null,
                  null,
                  null,
                  null,
                  null,
                  null,
                  null
                )
                .then(async (res) => {
                  logger.info(`Adding subscription for ${metadata.email}`);
                  user
                    .addSubscriptionData(
                      userId,
                      event.id,
                      'Solo',
                      parseInt(event.data.object.amount_total) / 100,
                      '1',
                      event.data.object.subscription,
                      event.data.object.customer,
                      event.data.object.currency.toUpperCase()
                    )
                    .then(async (res) => {
                      user.getMailTemplate(1).then(async (data) => {
                        let subject = data[0].subject;
                        subject = subject.replace('{{name}}', metadata.firstname);
                        let html = data[0].template;
                        html = html.replace('{{name}}', metadata.firstname);
                        var { transporter, mailingAddress } = await emailTransporter();

                        var mailOptions2 = {
                          from: mailingAddress,
                          to: metadata.email,
                          subject: subject,
                          html,
                        };

                        transporter.sendMail(mailOptions2, function (error, info) {
                          if (error) {
                            logger.error(error.message);
                          }
                          logger.info(`Welcome message successfully sent to ${metadata.email}`);

                          user.getMailTemplate(2).then(async (data) => {
                            let subject = data[0].subject;
                            let html = data[0].template;
                            html = html.replace('{{name}}', metadata.firstname);
                            html = html.replace(
                              '{{link}}',
                              `${process.env.FRONTEND_BASE_URL}/verify-account?id=${userId}&token=${token}`
                            );
                            var mailOptions = {
                              from: mailingAddress,
                              to: metadata.email,
                              subject: subject,
                              html,
                            };

                            transporter.sendMail(mailOptions, function (error, info) {
                              if (error) {
                                logger.error(error.message);
                              }
                              logger.info(
                                `Verification email successfully sent to ${metadata.email}`
                              );
                            });
                            logger.info(
                              `Company account creation successful for ${metadata.email}`
                            );
                          });
                        });
                      });
                    })
                    .catch((err) => {
                      logger.warn(`Failed to add subscription data for ${metadata.email}`);
                      logger.error(err);
                      logger.debug(
                        JSON.stringify({
                          success: false,
                          message: request.t('accountCreationFailed'),
                        })
                      );
                    });
                })
                .catch((err) => {
                  logger.warn(`Company account creation failed for ${metadata.email}`);
                  logger.error(err);
                  logger.debug(
                    JSON.stringify({
                      success: false,
                      message: request.t('accountCreationFailed'),
                    })
                  );
                });
            })
            .catch((err) => {
              logger.warn(`User account creation failed for ${metadata.email}`);
              logger.error(err);
              logger.debug(JSON.stringify({ success: false, message: err }));
            });
        } else if (metadata.accountType == 'solo' && metadata.signUpMethod != 'email') {
          logger.info(`Creating new account for ${metadata.email}`);

          user
            .createNewUserGoogle(
              metadata.firstname,
              metadata.lastname,
              metadata.email,
              metadata.accountType,
              metadata.signUpMethod
            )
            .then(async (res) => {
              const { userId } = res;
              logger.info(`User account creation successful for ${metadata.email}`);

              logger.info(`User account creation successful for ${metadata.email}`);
              logger.info(`Creating company account for ${metadata.email}`);
              user
                .createNewCompany(
                  userId,
                  null,
                  null,
                  null,
                  null,
                  null,
                  null,
                  null,
                  null,
                  null,
                  null,
                  null,
                  null,
                  null
                )
                .then(async (res) => {
                  logger.info(`Adding subscription for ${metadata.email}`);
                  user
                    .addSubscriptionData(
                      userId,
                      event.id,
                      'Solo',
                      parseInt(event.data.object.amount_total) / 100,
                      '1',
                      event.data.object.subscription,
                      event.data.object.customer,
                      event.data.object.currency.toUpperCase()
                    )
                    .then(async (res) => {
                      user.getMailTemplate(1).then(async (data) => {
                        let subject = data[0].subject;
                        subject = subject.replace('{{name}}', metadata.firstname);
                        let html = data[0].template;
                        html = html.replace('{{name}}', metadata.firstname);
                        var { transporter, mailingAddress } = await emailTransporter();

                        var mailOptions2 = {
                          from: mailingAddress,
                          to: metadata.email,
                          subject: subject,
                          html,
                        };

                        transporter.sendMail(mailOptions2, function (error, info) {
                          if (error) {
                            logger.error(error.message);
                          }
                          logger.info(`Welcome message successfully sent to ${metadata.email}`);
                        });
                        logger.info(`Company account creation successful for ${metadata.email}`);
                      });
                    })
                    .catch((err) => {
                      logger.warn(`Failed to add subscription data for ${metadata.email}`);
                      logger.error(err);
                      logger.debug(
                        JSON.stringify({
                          success: false,
                          message: request.t('accountCreationFailed'),
                        })
                      );
                    });
                })
                .catch((err) => {
                  logger.warn(`Company account creation failed for ${metadata.email}`);
                  logger.error(err);
                  logger.debug(
                    JSON.stringify({
                      success: false,
                      message: request.t('accountCreationFailed'),
                    })
                  );
                });
            })
            .catch((err) => {
              console.log(err);
              logger.warn(`User account creation failed for ${metadata.email}`);
              logger.error(err);
              logger.debug(JSON.stringify({ success: false, message: err }));
            });
        } else if (metadata.accountType == 'team' && metadata.signUpMethod !== 'email') {
          logger.info(`Creating user account for ${metadata.email}`);

          user
            .createNewUserGoogle(
              metadata.firstname,
              metadata.lastname,
              metadata.email,
              metadata.accountType,
              metadata.signUpMethod
            )
            .then((res) => {
              const { userId } = res;
              logger.info(`User account creation successful for ${metadata.email}`);
              logger.info(`Creating company account for ${metadata.email}`);
              user
                .createNewCompany(
                  userId,
                  metadata.companyName,
                  metadata.phoneNumberCountryCode,
                  metadata.phoneNumber,
                  metadata.orgType,
                  metadata.mailingAddStreetName,
                  metadata.mailingAddCountryName,
                  metadata.mailingAddCityName,
                  metadata.mailingAddStateName,
                  metadata.mailingAddZip,
                  metadata.billingAddStreetName,
                  metadata.billingAddCountryName,
                  metadata.billingAddCityName,
                  metadata.billingAddStateName,
                  metadata.billingAddZip,
                  metadata.isMailAndBillAddressSame
                )
                .then((res) => {
                  logger.info(`Adding subscription for ${metadata.email}`);
                  user
                    .addSubscriptionData(
                      userId,
                      event.id,
                      'Team',
                      parseInt(event.data.object.amount_total) / 100,
                      '1',
                      event.data.object.subscription,
                      event.data.object.customer,
                      event.data.object.currency.toUpperCase()
                    )
                    .then(async (res) => {
                      user.getMailTemplate(1).then(async (data) => {
                        let subject = data[0].subject;
                        subject = subject.replace('{{name}}', metadata.firstname);
                        let html = data[0].template;
                        html = html.replace('{{name}}', metadata.firstname);
                        var { transporter, mailingAddress } = await emailTransporter();

                        var mailOptions2 = {
                          from: mailingAddress,
                          to: metadata.email,
                          subject: subject,
                          html,
                        };

                        transporter.sendMail(mailOptions2, function (error, info) {
                          if (error) {
                            logger.error(error.message);
                            return;
                          }
                          logger.info(`Welcome message successfully sent to ${metadata.email}`);
                        });

                        logger.debug(
                          JSON.stringify({
                            success: true,
                            message: request.t('accountCreationSuccess'),
                            userData: data,
                          })
                        );
                      });
                    })
                    .catch((err) => {
                      logger.warn(`Company account creation failed for ${metadata.email}`);
                      logger.error(err);
                      logger.debug(
                        JSON.stringify({
                          success: false,
                          message: request.t('accountCreationFailed'),
                        })
                      );
                    });
                })
                .catch((err) => {
                  logger.warn(`User account creation failed for ${metadata.email}`);
                  logger.error(err);
                  logger.debug(JSON.stringify({ success: false, message: err }));
                });
            })
            .catch((err) => {
              logger.warn(`User account creation failed for ${metadata.email}`);
              logger.error(err);
              logger.debug(JSON.stringify({ success: false, message: err }));
            });
        } else {
          user
            .createNewUser(
              metadata.firstname,
              metadata.lastname,
              metadata.email,
              metadata.countryCode,
              metadata.mobileNumber,
              metadata.password,
              metadata.accountType,
              '1',
              metadata.signUpMethod
            )
            .then((res) => {
              const { userId, token } = res;
              logger.info(`User account creation successful for ${metadata.email}`);
              logger.info(`Creating company account for ${metadata.email}`);
              user
                .createNewCompany(
                  userId,
                  metadata.companyName,
                  metadata.phoneNumberCountryCode,
                  metadata.phoneNumber,
                  metadata.orgType,
                  metadata.mailingAddStreetName,
                  metadata.mailingAddCountryName,
                  metadata.mailingAddCityName,
                  metadata.mailingAddStateName,
                  metadata.mailingAddZip,
                  metadata.billingAddStreetName,
                  metadata.billingAddCountryName,
                  metadata.billingAddCityName,
                  metadata.billingAddStateName,
                  metadata.billingAddZip,
                  metadata.isMailAndBillAddressSame
                )
                .then(async (res) => {
                  logger.info(`Adding subscription for ${metadata.email}`);
                  user
                    .addSubscriptionData(
                      userId,
                      event.id,
                      'Team',
                      parseInt(event.data.object.amount_total) / 100,
                      '1',
                      event.data.object.subscription,
                      event.data.object.customer,
                      event.data.object.currency.toUpperCase()
                    )
                    .then(async (res) => {
                      user.getMailTemplate(1).then(async (data) => {
                        let subject = data[0].subject;
                        subject = subject.replace('{{name}}', metadata.firstname);
                        let html = data[0].template;
                        html = html.replace('{{name}}', metadata.firstname);
                        var { transporter, mailingAddress } = await emailTransporter();

                        var mailOptions2 = {
                          from: mailingAddress,
                          to: metadata.email,
                          subject: subject,
                          html,
                        };

                        transporter.sendMail(mailOptions2, function (error, info) {
                          if (error) {
                            logger.error(error.message);
                            console.log(error);
                          }
                          console.log(`Message sent ${info}`);
                          logger.info(`Welcome message successfully sent to ${metadata.email}`);

                          user.getMailTemplate(2).then(async (data) => {
                            let subject = data[0].subject;
                            let html = data[0].template;
                            html = html.replace('{{name}}', metadata.firstname);
                            html = html.replace(
                              '{{link}}',
                              `${process.env.FRONTEND_BASE_URL}/verify-account?id=${userId}&token=${token}`
                            );
                            var mailOptions = {
                              from: mailingAddress,
                              to: metadata.email,
                              subject: subject,
                              html,
                            };

                            transporter.sendMail(mailOptions, function (error, info) {
                              if (error) {
                                console.log(error);
                                logger.error(error.message);
                              }
                              console.log(`Message sent ${info}`);
                              logger.info(
                                `Verification email successfully sent to ${metadata.email}`
                              );
                            });
                            logger.info(
                              `Company account creation successful for ${metadata.email}`
                            );
                          });
                        });
                      });
                    })
                    .catch((err) => {
                      logger.warn(`Failed to add subscription data for ${metadata.email}`);
                      logger.error(err);
                      logger.debug(
                        JSON.stringify({
                          success: false,
                          message: request.t('accountCreationFailed'),
                        })
                      );
                    });
                })
                .catch((err) => {
                  logger.warn(`Company account creation failed for ${metadata.email}`);
                  logger.error(err);
                  logger.debug(
                    JSON.stringify({
                      success: false,
                      message: request.t('accountCreationFailed'),
                    })
                  );
                });
            })
            .catch((err) => {
              logger.warn(`User account creation failed for ${metadata.email}`);
              logger.error(err);
              logger.debug(JSON.stringify({ success: false, message: err }));
            });
        }
        break;

      case 'invoice.payment_succeeded':
        try {
          const customerId = event.data.object.customer;
          const customer = await stripe.customers.retrieve(customerId);
          const email = customer.email;
          logger.info(`Updating subscription for ${email}`);
          user.checkIfUserExist(email).then(async (res) => {
            if (res.length > 0) {
              logger.info(`Fetiching subscription user for ${email}`);
              user
                .getUserIdByEmail(email)
                .then((res) => {
                  user
                    .updateSubscriptionData(res, '0')
                    .then(async (resp) => {
                      if (resp == 1) {
                        logger.info(`Updating subscription for ${email}`);
                        user
                          .addSubscriptionData(
                            res,
                            event.id,
                            'Renewal',
                            parseInt(event.data.object.amount_total) / 100,
                            '1',
                            event.data.object.subscription,
                            event.data.object.customer,
                            event.data.object.currency.toUpperCase()
                          )
                          .then(async (res) => {
                            user.getMailTemplate(1).then(async (data) => {
                              let subject = data[0].subject;
                              let html = data[0].template;
                              html = html.replace('{{name}}', email);
                              var { transporter, mailingAddress } = await emailTransporter();

                              var mailOptions2 = {
                                from: mailingAddress,
                                to: email,
                                subject: subject,
                                html,
                              };

                              transporter.sendMail(mailOptions2, function (error, info) {
                                if (error) {
                                  logger.error(error.message);
                                }
                                logger.info(`Updated subscription successfully sent to ${email}`);
                              });
                            });
                          });
                      }
                    })
                    .catch((err) => {
                      logger.warn(`Failed to update subscription data for ${email}`);
                      logger.error(err);
                      logger.debug(
                        JSON.stringify({
                          success: false,
                          message: 'Failed to update subscription.',
                        })
                      );
                    });
                })
                .catch((err) => {
                  logger.warn(`Failed to user Id for ${email}`);
                  logger.error(err);
                  logger.debug(
                    JSON.stringify({
                      success: false,
                      message: 'Failed to update subscription.',
                    })
                  );
                });
              logger.info(`Payment succeeded for customer ${customerId}`);
            } else {
              logger.info(`Successfully generate Invoice for ${email}`);
            }
          });
        } catch (err) {
          logger.warn(`Error handling payment success: ${err.message}`);
        }
        break;

      case 'customer.subscription.deleted':
        try {
          logger.info(`Subscription Cancel Successfully.`);
        } catch (err) {
          logger.warn(`Error handling payment failure: ${err.message}`);
        }
        break;

      case 'invoice.payment_failed':
        try {
          const customerId = event.data.object.customer;
          const customer = await stripe.customers.retrieve(customerId);
          const email = customer.email;
          logger.info(`Updating subscription for ${email} invoice failed`);
          user.checkIfUserExist(email).then(async (res) => {
            if (res.length > 0) {
              logger.info(`Fetiching subscription user for ${email} invoice failed`);
              user
                .getUserIdByEmail(email)
                .then((res) => {
                  logger.info(`Updating subscription for ${email} invoice failed`);
                  user
                    .updateSubscriptionData(res, '0')
                    .then(async (res) => {
                      user.getMailTemplate(1).then(async (data) => {
                        let subject = data[0].subject;
                        let html = data[0].template;
                        html = html.replace('{{name}}', email);
                        var { transporter, mailingAddress } = await emailTransporter();

                        var mailOptions2 = {
                          from: mailingAddress,
                          to: email,
                          subject: subject,
                          html,
                        };

                        transporter.sendMail(mailOptions2, function (error, info) {
                          if (error) {
                            logger.error(error.message);
                          }
                          logger.info(
                            `Updation message successfully sent to ${email} invoice failed`
                          );
                        });
                      });
                    })
                    .catch((err) => {
                      logger.warn(`Failed to update subscription data for ${email}`);
                      logger.error(err);
                      logger.debug(
                        JSON.stringify({
                          success: false,
                          message: 'Failed to update subscription.',
                        })
                      );
                    });
                })
                .catch((err) => {
                  logger.warn(`Failed to get user Id for ${email}`);
                  logger.error(err);
                  logger.debug(
                    JSON.stringify({
                      success: false,
                      message: 'Failed to update subscription.',
                    })
                  );
                });
              logger.info(`Payment Failed for customer ${customerId}`);
            } else {
              logger.info(`Failed to generate Invoice for ${email}`);
            }
          });
        } catch (err) {
          logger.warn(`Error handling subscription deletion: ${err.message}`);
        }
        break;

      default:
        break;
    }
  }
);

const cors = require('cors');

const allowedOrigins = [
  process.env.FRONTEND_BASE_URL,
  process.env.BACKEND_URL,
  'https://accounts.google.com',
  'https://login.microsoftonline.com',
  'https://login.live.com',
];

app.use(
  cors({
    origin: function (origin, callback) {
      console.log('CORS request from:', origin);
      if (!origin || origin === 'null' || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  })
);

app.use(parser.urlencoded({ extended: true }));
app.use(parser.json());
app.use('/user-avatars', express.static(`${process.env.BACKEND_PATH}/uploads/userAvatars`));
app.use('/company-logos', express.static(`${process.env.BACKEND_PATH}/uploads/companyLogos`));
app.use('/app-logo', express.static(`${process.env.BACKEND_PATH}/uploads/appLogo`));
app.use('/app-icon', express.static(`${process.env.BACKEND_PATH}/uploads/appIcon`));

app.use(usersRoute());
app.use(communityRoute());
app.use(documentRoute());
app.use(chatRoute());
app.use(superAdminRoute());
app.use(appdataRoute());

// Google authentication
const session = require('express-session');

app.use(
  session({
    secret: process.env.TOKEN_SECRET,
    resave: true,
    saveUninitialized: true,
  })
);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Internal Server Error');
});

app.get('/auth/sso/failure', (req, res) => {
  const errorMessage = {
    stautsRes: false,
    statusMessage: 'Authentication failed. Please try again.',
  };
  res.send(`
    <script>
      const targetOrigin = '${process.env.FRONTEND_BASE_URL}';
      window.opener.postMessage(${JSON.stringify(errorMessage)}, targetOrigin);
      window.close();
    </script>
  `);
});

async function listDriveFiles(accessToken) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  try {
    const res = await drive.files.list({
      fields: 'files(id, name, mimeType, size, createdTime)',
    });

    return res.data.files; // Array of files
  } catch (err) {
    logger.error('Error fetching files from Google Drive:', err.message);
    return [];
  }
}

app.post(
  '/google/profile/update',
  userAvatarUpload.single('image'),
  async function (request, response) {
    const user = new Users(knex);

    if (request.body.email && request.body.profilePic) {
      logger.info(`Uploading Image for ${sanitizeForLog(request.body.email)}`);

      const imageResponse = await axios.get(request.body.profilePic, {
        responseType: 'arraybuffer',
      });
      const imageBuffer = Buffer.from(imageResponse.data, 'binary');

      const fileName = `${request.body.email}_${Date.now()}.jpg`;

      fs.writeFileSync(`${process.env.BACKEND_PATH}/uploads/userAvatars/${fileName}`, imageBuffer);

      if (fileName != '') {
        user
          .getUserIdByEmail(request.body.email)
          .then(async (res) => {
            const userId = res[0][0]?.id;
            logger.info(`Uploading Image for ${userId}`);
            await user
              .updateUserMeta(userId, 'profilePic', fileName)
              .then((response) => {
                if (response[0].affectedRows == 1) {
                  return response.status(200).send({
                    success: true,
                    message: 'Image upload successful!',
                  });
                }
              })
              .catch((err) => {
                console.log(err);
                logger.warn(`Image upload failed for ${userId}`);
                logger.error(err);
                logger.debug(
                  JSON.stringify({
                    success: false,
                    message: 'Image upload failed!',
                  })
                );
                return response
                  .status(200)
                  .send({ success: false, message: 'Image upload failed!' });
              });
            logger.info(`Image upload successful for ${sanitizeForLog(request.body.email)}`);
          })
          .catch((err) => {
            console.log(err);
            logger.warn(`Image upload failed for ${request.body.email}`);
            logger.error(err);
            logger.debug(
              JSON.stringify({
                success: false,
                message: 'Image upload failed!',
              })
            );
            // return response.status(200)
            // .send({ success: false, message: "Image upload failed!" });
          });
      }
    } else {
      logger.debug(
        JSON.stringify({
          success: false,
          message: 'Missing parameters, fill all the required fields',
        })
      );
      return response.status(400).send({
        success: false,
        message: 'Missing parameters, fill all the required fields',
      });
    }
  }
);

async function listOneDriveFiles(accessToken) {
  const endpoint = 'https://graph.microsoft.com/v1.0/me/drive/root/children';

  try {
    const response = await axios.get(endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const files = response.data.value;

    return files; // Array of files like [{ id, name, mimeType }]
  } catch (err) {
    console.error('Error fetching files from OneDrive:', err.response?.data || err.message);
    return [];
  }
}

app.post(
  '/profile/update',
  auth.verifyToken,
  userAvatarUpload.single('image'),
  auth.userExists,
  auth.isSenderOwner,
  function (request, response) {
    const user = new Users(knex);

    if (
      request.body.userId &&
      request.body.firstname &&
      request.body.lastname &&
      request.body.mobileNumber &&
      request.body.countryCode
    ) {
      logger.info(`Updating profile for user Id ${request.body.userId}`);
      if (request.file) {
        logger.info(`Update request include new profile picture`);
        logger.info(`Deleting old profile picture`);
        user.getUserMetaValue(request.body.userId, 'profilePic').then((oldImageName) => {
          if (oldImageName && oldImageName != 'default.png') {
            const filePath = `${process.env.BACKEND_PATH}/uploads/userAvatars/${oldImageName}`;
            fs.unlinkSync(filePath);
          }
        });
        logger.info(`Old profile picture deleted successfully`);
        user
          .updateUser(
            request.body.userId,
            request.body.firstname,
            request.body.lastname,
            request.body.countryCode,
            request.body.mobileNumber,
            request.fileName ? request.fileName : 'default.png'
          )
          .then((res) => {
            if (res == 1) {
              logger.info(`Profile updated successfully`);
              logger.info(
                `Fetching updated user details for user ${sanitizeForLog(request.body.userId)}`
              );
              user.getUserDetailsById(request.body.userId).then((data) => {
                logger.info(`Updated user data fetched successfully`);
                let userData = data;

                logger.debug(
                  JSON.stringify({
                    success: true,
                    message: request.t('userProfileUpdateSuccess'),
                    userData,
                  })
                );
                return response.status(200).send({
                  success: true,
                  message: request.t('userProfileUpdateSuccess'),
                  userData,
                });
              });
            } else {
              logger.warn(`Failed to fetch updated user details`);
              logger.debug(
                JSON.stringify({
                  success: false,
                  message: request.t('userProfileUpdateFailed'),
                })
              );
              return response.status(200).send({
                success: false,
                message: request.t('userProfileUpdateFailed'),
              });
            }
          })
          .catch((err) => {
            console.log(err);
            logger.warn(`Profile updated failed for ${request.body.userId}`);
            logger.error(err);
            logger.debug(
              JSON.stringify({
                success: false,
                message: request.t('userProfileUpdateFailed'),
              })
            );
            return response.status(200).send({
              success: false,
              message: request.t('userProfileUpdateFailed'),
            });
          });
      } else {
        logger.info(`Update request does not contain profile picture`);
        user
          .updateUser(
            request.body.userId,
            request.body.firstname,
            request.body.lastname,
            request.body.countryCode,
            request.body.mobileNumber,
            ''
          )
          .then((res) => {
            if (res == 1) {
              logger.info(`Profile updated successfully`);
              logger.info(
                `Fetching updated user details for user ${sanitizeForLog(request.body.userId)}`
              );
              user.getUserDetailsById(request.body.userId).then((data) => {
                logger.info(`Updated user data fetched successfully`);
                let userData = data;

                logger.debug(
                  JSON.stringify({
                    success: true,
                    message: request.t('userProfileUpdateSuccess'),
                    userData,
                  })
                );
                return response.status(200).send({
                  success: true,
                  message: request.t('userProfileUpdateSuccess'),
                  userData,
                });
              });
            } else {
              logger.warn(`Failed to fetch updated user details`);
              logger.debug(
                JSON.stringify({
                  success: false,
                  message: request.t('userProfileUpdateFailed'),
                })
              );
              return response.status(200).send({
                success: false,
                message: request.t('userProfileUpdateFailed'),
              });
            }
          })
          .catch((err) => {
            console.log(err);
            logger.warn(`Profile updated failed for ${sanitizeForLog(request.body.userId)}`);
            logger.error(err);
            logger.debug(
              JSON.stringify({
                success: false,
                message: request.t('userProfileUpdateFailed'),
              })
            );
            return response.status(200).send({
              success: false,
              message: request.t('userProfileUpdateFailed'),
            });
          });
      }
    } else {
      logger.debug(
        JSON.stringify({
          success: false,
          message: 'Missing parameters, fill all the required fields',
        })
      );
      return response.status(400).send({
        success: false,
        message: 'Missing parameters, fill all the required fields',
      });
    }
  }
);

app.post(
  '/admin/update-profile',
  auth.verifyToken,
  auth.adminAccess,
  userAvatarUpload.single('image'),
  auth.userExists,
  auth.companyExist,
  auth.isUserBelongsToCompany,
  auth.isCompanyUser,
  auth.hasUserEditAccess,
  auth.isValidRole,
  function (request, response) {
    const user = new Users(knex);

    if (
      request.body.userId &&
      request.body.firstname &&
      request.body.lastname &&
      request.body.email &&
      request.body.countryCode &&
      request.body.mobileNumber &&
      request.body.companyId &&
      request.body.role
    ) {
      logger.info(`Updating profile for user Id ${sanitizeForLog(request.body.userId)} by admin`);
      if (request.file) {
        logger.info(`Update request include new profile picture`);
        logger.info(`Deleting old profile picture`);
        user.getUserMetaValue(request.body.userId, 'profilePic').then((oldImageName) => {
          if (oldImageName && oldImageName != 'default.png') {
            const filePath = `${process.env.BACKEND_PATH}/uploads/userAvatars/${oldImageName}`;
            fs.unlinkSync(filePath);
          }
        });
        logger.info(`Old profile picture deleted successfully`);
        user
          .adminUserUpdate(
            request.body.userId,
            request.body.firstname,
            request.body.lastname,
            request.body.email,
            request.body.countryCode,
            request.body.mobileNumber,
            request.fileName ? request.fileName : 'default.png'
          )
          .then((res) => {
            if (res == 1) {
              logger.info(`Profile updated successfully by admin`);
              logger.info(`Updating user role`);
              user
                .adminRoleUpdateForUser(
                  request.body.userId,
                  request.body.companyId,
                  request.body.role
                )
                .then((res) => {
                  if (res == 1) {
                    logger.info(`User role updated successfully`);
                    logger.info(
                      `Fetching updated user details for user ${sanitizeForLog(request.body.userId)}`
                    );
                    user
                      .getUserDetailsById(request.body.userId)
                      .then((data) => {
                        logger.info(`Updated user data fetched successfully`);
                        let userData = data;
                        userData = { ...userData, role: request.body.role };

                        logger.debug(
                          JSON.stringify({
                            success: true,
                            message: request.t('adminAserProfileUpdateSuccess'),
                            userData,
                          })
                        );
                        return response.status(200).send({
                          success: true,
                          message: request.t('adminAserProfileUpdateSuccess'),
                          userData,
                        });
                      })
                      .catch((err) => {
                        console.log(err);
                        logger.warn(`Failed to fetch updated user details`);
                        logger.error(err);
                        logger.debug(
                          JSON.stringify({
                            success: true,
                            message: request.t('adminAserProfileUpdateSuccessFetchFailed'),
                            userData,
                          })
                        );
                        return response.status(200).send({
                          success: true,
                          message: request.t('adminAserProfileUpdateSuccessFetchFailed'),
                          userData,
                        });
                      });
                  } else {
                    logger.warn(`Failed to update role by admin`);
                    logger.debug(
                      JSON.stringify({
                        success: false,
                        message: request.t('adminAserProfileUpdateSuccessRoleFailed'),
                        userData,
                      })
                    );
                    return response.status(200).send({
                      success: false,
                      message: request.t('adminAserProfileUpdateSuccessRoleFailed'),
                      userData,
                    });
                  }
                })
                .catch((err) => {
                  console.log(err);
                  logger.warn(`Failed to update role by admin`);
                  logger.error(err);
                  logger.debug(
                    JSON.stringify({
                      success: false,
                      message: request.t('adminAserProfileUpdateSuccessRoleFailed'),
                      userData,
                    })
                  );
                  return response.status(200).send({
                    success: false,
                    message: request.t('adminAserProfileUpdateSuccessRoleFailed'),
                    userData,
                  });
                });
            } else {
              logger.warn(`Profile update by admin failed`);
              logger.debug(
                JSON.stringify({
                  success: false,
                  message: request.t('adminAserProfileUpdateFailed'),
                })
              );
              return response.status(200).send({
                success: false,
                message: request.t('adminAserProfileUpdateFailed'),
              });
            }
          })
          .catch((err) => {
            console.log(err);
            logger.warn(`Profile update by admin failed`);
            logger.error(err);
            logger.debug(
              JSON.stringify({
                success: false,
                message: request.t('adminAserProfileUpdateFailed'),
              })
            );
            return response.status(200).send({
              success: false,
              message: request.t('adminAserProfileUpdateFailed'),
            });
          });
      } else {
        logger.info(`Update request does not contain profile picture`);
        user
          .adminUserUpdate(
            request.body.userId,
            request.body.firstname,
            request.body.lastname,
            request.body.email,
            request.body.countryCode,
            request.body.mobileNumber,
            ''
          )
          .then((res) => {
            if (res == 1) {
              logger.info(`Profile updated successfully by admin`);
              logger.info(`Updating user role`);
              user
                .adminRoleUpdateForUser(
                  request.body.userId,
                  request.body.companyId,
                  request.body.role
                )
                .then((res) => {
                  if (res == 1) {
                    logger.info(`User role updated successfully`);
                    logger.info(
                      `Fetching updated user details for user ${sanitizeForLog(request.body.userId)}`
                    );
                    user
                      .getUserDetailsById(request.body.userId)
                      .then((data) => {
                        logger.info(`Updated user data fetched successfully`);
                        let userData = data;
                        userData = { ...userData, role: request.body.role };

                        logger.debug(
                          JSON.stringify({
                            success: true,
                            message: request.t('adminAserProfileUpdateSuccess'),
                            userData,
                          })
                        );
                        return response.status(200).send({
                          success: true,
                          message: request.t('adminAserProfileUpdateSuccess'),
                          userData,
                        });
                      })
                      .catch((err) => {
                        console.log(err);
                        logger.warn(`Failed to fetch updated user details`);
                        logger.error(err);
                        logger.debug(
                          JSON.stringify({
                            success: true,
                            message: request.t('adminAserProfileUpdateSuccessFetchFailed'),
                            userData,
                          })
                        );
                        return response.status(200).send({
                          success: true,
                          message: request.t('adminAserProfileUpdateSuccessFetchFailed'),
                          userData,
                        });
                      });
                  } else {
                    logger.warn(`Failed to update role by admin`);
                    logger.debug(
                      JSON.stringify({
                        success: false,
                        message: request.t('adminAserProfileUpdateSuccessRoleFailed'),
                        userData,
                      })
                    );
                    return response.status(200).send({
                      success: false,
                      message: request.t('adminAserProfileUpdateSuccessRoleFailed'),
                      userData,
                    });
                  }
                })
                .catch((err) => {
                  console.log(err);
                  logger.warn(`Failed to update role by admin`);
                  logger.error(err);
                  logger.debug(
                    JSON.stringify({
                      success: false,
                      message: request.t('adminAserProfileUpdateSuccessRoleFailed'),
                      userData,
                    })
                  );
                  return response.status(200).send({
                    success: false,
                    message: request.t('adminAserProfileUpdateSuccessRoleFailed'),
                    userData,
                  });
                });
            } else {
              logger.warn(`Profile update by admin failed`);
              logger.debug(
                JSON.stringify({
                  success: false,
                  message: request.t('adminAserProfileUpdateFailed'),
                })
              );
              return response.status(200).send({
                success: false,
                message: request.t('adminAserProfileUpdateFailed'),
              });
            }
          })
          .catch((err) => {
            console.log(err);
            logger.warn(`Profile update by admin failed`);
            logger.error(err);
            logger.debug(
              JSON.stringify({
                success: false,
                message: request.t('adminAserProfileUpdateFailed'),
              })
            );
            return response.status(200).send({
              success: false,
              message: request.t('adminAserProfileUpdateFailed'),
            });
          });
      }
    } else {
      logger.debug(
        JSON.stringify({
          success: false,
          message: 'Missing parameters, fill all the required fields',
        })
      );
      return response.status(400).send({
        success: false,
        message: 'Missing parameters, fill all the required fields',
      });
    }
  }
);

app.post(
  '/company/update-profile',
  auth.verifyToken,
  auth.adminAccess,
  companyLogoUpload.single('image'),
  auth.companyExist,
  auth.isCompanyUser,
  function (request, response) {
    const user = new Users(knex);

    if (
      request.body.companyId &&
      request.body.phoneNumber &&
      request.body.phoneNumberCountryCode &&
      request.body.companyName &&
      request.body.orgType &&
      request.body.mailingAddStreetName &&
      request.body.mailingAddCountryName &&
      request.body.mailingAddCityName &&
      request.body.mailingAddStateName &&
      request.body.mailingAddZip &&
      request.body.billingAddStreetName &&
      request.body.billingAddCountryName &&
      request.body.billingAddCityName &&
      request.body.billingAddStateName &&
      request.body.billingAddZip &&
      request.body.isMailAndBillAddressSame
    ) {
      logger.info(`Updating company profile for id ${sanitizeForLog(request.body.companyId)}`);
      if (request.file) {
        logger.info(`Update request contain company profile picture`);
        logger.info(`Deleting old profile picture`);
        user.getCompanyMetaValue(request.body.companyId, 'companyLogo').then((oldImageName) => {
          if (oldImageName && oldImageName != 'default.png') {
            const filePath = `${process.env.BACKEND_PATH}/uploads/companyLogos/${oldImageName}`;
            fs.unlinkSync(filePath);
          }
        });
        logger.info(`Old profile picture deleted successfully`);
        user
          .updateCompany(
            request.body.companyId,
            request.body.phoneNumber,
            request.body.phoneNumberCountryCode,
            request.body.companyName,
            request.body.orgType,
            request.body.mailingAddStreetName,
            request.body.mailingAddCountryName,
            request.body.mailingAddCityName,
            request.body.mailingAddStateName,
            request.body.mailingAddZip,
            request.body.billingAddStreetName,
            request.body.billingAddCountryName,
            request.body.billingAddCityName,
            request.body.billingAddStateName,
            request.body.billingAddZip,
            request.body.isMailAndBillAddressSame,
            request.fileName ? request.fileName : 'default.png'
          )
          .then((res) => {
            if (res == 1) {
              logger.info(`Company profile updated successfully`);
              logger.info(`Fetching updated company details`);
              user.getCompanyDetails(request.body.companyId).then((data) => {
                logger.info(`Updated company details fetched successfully`);
                let companyData = data;

                logger.debug(
                  JSON.stringify({
                    success: true,
                    message: request.t('companyProfileUpdateSuccess'),
                    companyData,
                  })
                );
                return response.status(200).send({
                  success: true,
                  message: request.t('companyProfileUpdateSuccess'),
                  companyData,
                });
              });
            } else {
              logger.warn(`Company profile update failed `);
              logger.debug(
                JSON.stringify({
                  success: false,
                  message: request.t('companyProfileUpdateFailed'),
                })
              );
              return response.status(200).send({
                success: false,
                message: request.t('companyProfileUpdateFailed'),
              });
            }
          })
          .catch((err) => {
            logger.warn(`Company profile update failed `);
            logger.error(err);
            console.log(err);
            logger.debug(
              JSON.stringify({
                success: false,
                message: request.t('companyProfileUpdateFailed'),
              })
            );
            return response.status(200).send({
              success: false,
              message: request.t('companyProfileUpdateFailed'),
            });
          });
      } else {
        logger.info(`Update request does not contain profile picture`);
        user
          .updateCompany(
            request.body.companyId,
            request.body.phoneNumber,
            request.body.phoneNumberCountryCode,
            request.body.companyName,
            request.body.orgType,
            request.body.mailingAddStreetName,
            request.body.mailingAddCountryName,
            request.body.mailingAddCityName,
            request.body.mailingAddStateName,
            request.body.mailingAddZip,
            request.body.billingAddStreetName,
            request.body.billingAddCountryName,
            request.body.billingAddCityName,
            request.body.billingAddStateName,
            request.body.billingAddZip,
            request.body.isMailAndBillAddressSame,
            ''
          )
          .then((res) => {
            if (res == 1) {
              logger.info(`Company profile updated successfully`);
              logger.info(`Fetching updated company details`);
              user.getCompanyDetails(request.body.companyId).then((data) => {
                logger.info(`Updated company details fetched successfully`);
                let companyData = data;

                logger.debug(
                  JSON.stringify({
                    success: true,
                    message: request.t('companyProfileUpdateSuccess'),
                    companyData,
                  })
                );
                return response.status(200).send({
                  success: true,
                  message: request.t('companyProfileUpdateSuccess'),
                  companyData,
                });
              });
            } else {
              logger.warn(`Company profile update failed `);
              logger.debug(
                JSON.stringify({
                  success: false,
                  message: request.t('companyProfileUpdateFailed'),
                })
              );
              return response.status(200).send({
                success: false,
                message: request.t('companyProfileUpdateFailed'),
              });
            }
          })
          .catch((err) => {
            console.log(err);
            logger.warn(`Company profile update failed `);
            logger.error(err);
            logger.debug(
              JSON.stringify({
                success: false,
                message: request.t('companyProfileUpdateFailed'),
              })
            );
            return response.status(200).send({
              success: false,
              message: request.t('companyProfileUpdateFailed'),
            });
          });
      }
    } else {
      logger.debug(
        JSON.stringify({
          success: false,
          message: 'Missing parameters, fill all the required fields',
        })
      );
      return response.status(400).send({
        success: false,
        message: 'Missing parameters, fill all the required fields',
      });
    }
  }
);

app.get('/notifications', auth.verifyToken, (request, response) => {
  knex('notification')
    .where({ userId: request.decoded.userId })
    .orderBy('id', 'desc')
    .then((res) => {
      return response.json(res);
    })
    .catch((err) => {
      logger.error(err);
      return response.status(500).send({ success: false, message: 'database error' });
    });
});

app.delete('/notification/:id', auth.verifyToken, async (request, response) => {
  try {
    const id = request.params.id;
    await knex('notification').where({ id: id }).del();

    return response.json({ message: 'Notification deleted' });
  } catch (err) {
    logger.error(err);
    return response.status(500).send({ success: false, message: 'database error' });
  }
});

app.put('/notifications/viewed', auth.verifyToken, (request, response) => {
  knex('notification')
    .where({ userId: request.decoded.userId })
    .update({ isViewed: true })
    .then(() => {
      return response.send({
        success: true,
        message: 'All notifications marked as viewed',
      });
    })
    .catch((err) => {
      logger.info(err);
      return response.status(500).send({ success: false, message: 'database error' });
    });
});
let fileUploadQueue;
if (process.env.SEPERATE_FILE_UPLOAD_SERVER === '0') {
  logger.info('Same file upload server used.');
  fileUploadQueue = new Bull('myQueue', {
    redis: {
      host: '127.0.0.1',
      port: 6379,
    },
    concurrency: 1,
  });
}

const deleteFileUpload = async () => {
  try {
    const fileUploadExpiry = await getAdminSetting('FILE_UPLOAD_EXPIRY');
    const now = new Date();
    const filesToDelete = await knex('file_deletions').whereRaw(
      `DATE_ADD(created, INTERVAL ${fileUploadExpiry} HOUR) <= ?`,
      [now]
    );
    logger.info('Files to delete list');
    logger.info(filesToDelete);
    if (filesToDelete[0]) {
      filesToDelete.forEach(async (file) => {
        try {
          const document = await knex('documents').where('id', file.fileId);
          if (document[0].isNotAnalyzed) {
            await knex('notification').where('id', file.notificationId).del();
            fs.access(`${process.env.DOCUMENT_PATH}/${file.uuid}/${file.fileFullName}`, (err) => {
              if (err === null) {
                logger.info(`Delete unanalyzed file ${file.fileFullName}`);
                fs2.unlink(
                  path.resolve(`${process.env.DOCUMENT_PATH}/${file.uuid}/${file.fileFullName}`)
                );
              }
            });
            await knex('file_deletions')
              .whereRaw(`DATE_ADD(created, INTERVAL ${fileUploadExpiry} HOUR) <= ?`, [now])
              .del();
            await knex('documents').where('id', file.fileId).del();
          }
        } catch (err) {
          logger.error(err);
        }
      });
    }
  } catch (e) {
    logger.error(e);
  }
};

cron.schedule('0 * * * *', () => {
  // checks every hour
  deleteFileUpload();
});

if (process.env.SEPERATE_FILE_UPLOAD_SERVER === '0') {
  fileUploadQueue.process(async (job, done) => {
    const created = new Date();
    const year = created.getUTCFullYear();
    const month = String(created.getUTCMonth() + 1).padStart(2, '0');
    const day = String(created.getUTCDate()).padStart(2, '0');
    const hours = String(created.getUTCHours()).padStart(2, '0');
    const minutes = String(created.getUTCMinutes()).padStart(2, '0');
    const seconds = String(created.getUTCSeconds()).padStart(2, '0');

    const mysqlTimestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    const newNotification = await knex('notification').insert({
      userId: job.data.jobData.userId,
      name:
        job.data.jobData.file.originalname +
        ' (' +
        ((job.data.jobData.size / 1000).toFixed(2) + 'kb') +
        ')',
      message: 'uploading',
      type: 'file',
      jobId: job.id,
      created: mysqlTimestamp,
    });
    logger.info(`Job Id: ${job.id} - Notification Id: ${newNotification[0]}`);
    await knex('file_deletions').insert({
      fileId: job.data.jobData.fileName[0],
      uuid: job.data.jobData.uuid,
      fileFullName: job.data.jobData.fileFullName,
      created: mysqlTimestamp,
      notificationId: newNotification[0],
    });
    // uncomment to test for error

    // await knex('notification')
    // .where({ jobId: job.id })
    // .update({ message: 'failed' })
    // done(new Error('Testing the error'))
    // return

    const request = job.data.jobData;
    const documents = new Documents(knex);
    const community = new Community(knex);
    const extractor = new PDFExtractor();
    const storageDetails = await documents.getStorageOccupationDetail(request.company);
    function convertToKilobytes(formattedSize) {
      const sizes = ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
      const [value, unit] = formattedSize.split(' ');
      const index = sizes.indexOf(unit);

      return parseFloat(value) * Math.pow(1000, index);
    }
    const usedStorage = convertToKilobytes(storageDetails) || 0;
    const maxStorage = parseFloat(process.env.MAX_STORAGE * 1024 * 1024);

    if (usedStorage <= maxStorage) {
      logger.info(`Uploading new document on collection Id ${request.communityId}`);

      let Summary = '';
      let Overview = '';

      try {
        job.progress(25);
        if (request.file.mimetype == 'image/jpeg' || request.file.mimetype == 'image/jpg') {
          const { summary } = await imageSummary(request.file.filename);
          Summary = summary;
        } else if (request.file.mimetype == 'video/mp4') {
          const { summary } = await videoSummary(request.file.filename);
          Summary = summary;
        } else if (request.file.mimetype == 'audio/mpeg') {
          const { summary } = await audioSummary(request.file.filename);
          Summary = summary;
        } else if (request.file.mimetype == 'image/png' || request.file.mimetype == 'image/mov') {
          const { summary } = await imageSummary(request.file.filename);
          Summary = summary;
        } else if (request.file.mimetype == 'video/quicktime') {
          const { summary } = await videoSummary(request.file.filename);
          Summary = summary;
        }
      } catch (error) {
        logger.error(`Error generating description of the multimedia ${request.fileName}`);
        logger.error(error);
        console.log(error);
        const document = await knex('documents').where('id', request.fileName[0]).del();
        await knex('notification').where({ jobId: job.id }).update({ message: 'failed' });
        done(new Error(error));
        return;
      }

      if (request.file) {
        logger.info(`Checking if the file uploaded on server`);
        documents
          .checkIfFileExists(request.fileName[0])
          .then(async (res) => {
            if (res == 1) {
              if (
                request.file.mimetype != 'image/png' &&
                request.file.mimetype != 'audio/mpeg' &&
                request.file.mimetype != 'video/mp4' &&
                request.file.mimetype != 'image/jpeg' &&
                request.file.mimetype != 'image/jpg' &&
                request.file.mimetype != 'video/quicktime' &&
                request.file.mimetype != 'image/mov'
              ) {
                const summary = await summarizer(
                  path.join(request.filePath, request.fileFullName),
                  request.fileName[0],
                  request.file.originalname,
                  request.userId
                );
                if (summary.success === true) {
                  Summary = summary.outputText;
                  Overview = summary.overviewOutputText;
                  const dateTime = new Date();
                  await knex('summary')
                    .where({
                      fileId: request.fileName[0],
                      fileName: request.file.originalname,
                      communityId: request.communityId,
                    })
                    .then((existingData) => {
                      if (existingData.length === 0) {
                        return knex('summary')
                          .insert({
                            fileId: request.fileName[0],
                            communityId: request.communityId,
                            fileName: request.file.originalname,
                            notes: Summary,
                            overview: Overview,
                            created: dateTime,
                          })
                          .then(() => {
                            logger.info({
                              message: 'Summary insertion completed',
                            });
                          })
                          .catch(async (error) => {
                            logger.info({
                              error: 'Internal Server Error',
                              error: error,
                            });
                            const document = await knex('documents')
                              .where('id', request.fileName[0])
                              .del();
                            await knex('notification')
                              .where({ jobId: job.id })
                              .update({ message: 'failed' });
                            done(new Error(error));
                            return;
                          });
                      } else {
                        logger.info('Data already exists.');
                      }
                    })
                    .catch(async (error) => {
                      logger.error('Error checking data:', error);
                      const document = await knex('documents')
                        .where('id', request.fileName[0])
                        .del();
                      await knex('notification')
                        .where({ jobId: job.id })
                        .update({ message: 'failed' });
                      done(new Error(error));
                      return;
                    });
                }
              } else if (Summary.length > 0) {
                const dateTime = new Date();
                await knex('summary')
                  .where({
                    fileId: request.fileName[0],
                    fileName: request.file.originalname,
                    communityId: request.communityId,
                  })
                  .then((existingData) => {
                    if (existingData.length === 0) {
                      return knex('summary')
                        .insert({
                          fileId: request.fileName[0],
                          communityId: request.communityId,
                          fileName: request.file.originalname,
                          notes: Summary,
                          overview: '',
                          created: dateTime,
                        })
                        .then(() => {
                          logger.info({
                            message: 'Summary insertion completed',
                          });
                        })
                        .catch(async (error) => {
                          logger.info({
                            error: 'Internal Server Error',
                            error: error,
                          });
                          const document = await knex('documents')
                            .where('id', request.fileName[0])
                            .del();
                          await knex('notification')
                            .where({ jobId: job.id })
                            .update({ message: 'failed' }); // response.end()
                          done(new Error(error));
                          return;
                        });
                    } else {
                      logger.info('Data already exists.');
                    }
                  })
                  .catch(async (error) => {
                    logger.error('Error checking data:', error);
                    const document = await knex('documents').where('id', request.fileName[0]).del();
                    await knex('notification')
                      .where({ jobId: job.id })
                      .update({ message: 'failed' });
                    done(new Error(error));
                    return;
                  });
              }
              if (fs.existsSync(request.filePath + '/' + request.fileFullName)) {
                logger.info(`File uploaded successfully, splitting the document into chunks`);
                let docs = [];
                if (
                  request.file.mimetype ==
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                ) {
                  job.progress(75);
                  logger.info(`DOCX File uploaded successfully`);
                  docs = await documents.createDocumentFromDocx(
                    path.join(request.filePath, request.fileFullName),
                    request.fileName[0],
                    request.file.originalname,
                    Summary,
                    Overview
                  );
                } else if (request.file.mimetype == 'application/pdf') {
                  docs = await documents.createDocumentFromPDF(
                    path.join(request.filePath, request.fileFullName),
                    request.fileName[0],
                    request.file.originalname,
                    Summary,
                    Overview
                  );
                  if (docs.length > 0) {
                    job.progress(50);
                    logger.info(`PDF File uploaded successfully`);
                  } else {
                    job.progress(50);
                    const textURL = await extractor.convertPDFToText(
                      path.join(request.filePath, request.fileFullName),
                      request.userId,
                      request.fileName[0]
                    );
                    docs = await documents.createDocumentFromText(
                      textURL,
                      request.fileName[0],
                      request.file.originalname,
                      Summary,
                      Overview
                    );
                    job.progress(75);
                    logger.info(`PDF_LOW File uploaded successfully`);
                  }
                } else if (request.file.mimetype == 'text/plain') {
                  logger.info(`TEXT File uploaded successfully`);
                  job.progress(75);
                  docs = await documents.createDocumentFromText(
                    path.join(request.filePath, request.fileFullName),
                    request.fileName[0],
                    request.file.originalname,
                    Summary,
                    Overview
                  );
                } else if (
                  request.file.mimetype ==
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                ) {
                  job.progress(75);
                  logger.info(`XLSX File uploaded successfully`);
                  let isCsvFileCreated = await documents.createTempCSVFileForXLSXFile(
                    request.filePath,
                    request.fileName,
                    'xlsx'
                  );
                  if (isCsvFileCreated == 1) {
                    docs = await documents.createDocumentFromCSV(
                      path.join(
                        path.resolve(`${process.env.TMP_CSV_PATH}`),
                        `${request.fileName[0]}.csv`
                      ),
                      request.fileName[0],
                      request.file.originalname,
                      Summary,
                      Overview
                    );
                  }
                } else if (request.file.mimetype == 'application/vnd.ms-excel') {
                  job.progress(75);
                  logger.info(`XLS File uploaded successfully`);
                  let isCsvFileCreated = await documents.createTempCSVFileForXLSXFile(
                    request.filePath,
                    request.fileName,
                    'xls'
                  );
                  if (isCsvFileCreated == 1) {
                    docs = await documents.createDocumentFromCSV(
                      path.join(
                        path.resolve(`${process.env.TMP_CSV_PATH}`),
                        `${request.fileName[0]}.csv`
                      ),
                      request.fileName[0],
                      request.file.originalname,
                      Summary,
                      Overview
                    );
                  }
                } else if (request.file.mimetype == 'application/msword') {
                  job.progress(75);
                  logger.info(`DOC File uploaded successfully`);
                  const textFilePath = await documents.extractTextFromDocAndCreateTextFile(
                    path.join(request.filePath, request.fileFullName),
                    request.userId,
                    request.fileName[0]
                  );
                  docs = await documents.createDocumentFromText(
                    textFilePath,
                    request.fileName[0],
                    request.file.originalname,
                    Summary,
                    Overview
                  );
                } else if (
                  request.file.mimetype ==
                  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                ) {
                  job.progress(75);
                  logger.info(`PPTX File uploaded successfully`);
                  const textFilePath = await documents.extractTextFromPPTXAndCreateTextFile(
                    path.join(request.filePath, request.fileFullName),
                    request.userId,
                    request.fileName[0]
                  );
                  docs = await documents.createDocumentFromText(
                    textFilePath,
                    request.fileName[0],
                    request.file.originalname,
                    Summary,
                    Overview
                  );
                } else if (
                  request.file.mimetype == 'image/jpeg' ||
                  request.file.mimetype == 'image/jpg' ||
                  request.file.mimetype == 'image/png'
                ) {
                  job.progress(75);
                  logger.info(`Image File uploaded successfully`);
                  docs = await documents.createDocumentFromImage(
                    path.join(request.filePath, request.fileFullName),
                    request.fileName[0],
                    request.file.originalname,
                    Summary
                  );
                } else if (request.file.mimetype == 'video/mp4') {
                  job.progress(75);
                  logger.info(`Video File uploaded successfully`);
                  docs = await documents.createDocumentFromVideo(
                    path.join(request.filePath, request.fileFullName),
                    request.fileName[0],
                    request.file.originalname,
                    Summary
                  );
                } else if (request.file.mimetype == 'audio/mpeg') {
                  logger.info(`Audio File uploaded successfully`);
                  job.progress(75);
                  docs = await documents.createDocumentFromAudio(
                    path.join(request.filePath, request.fileFullName),
                    request.fileName[0],
                    request.file.originalname,
                    Summary
                  );
                } else if (request.file.mimetype == 'video/quicktime') {
                  logger.info(`Video File uploaded successfully`);
                  job.progress(75);
                  docs = await documents.createDocumentFromVideo(
                    path.join(request.filePath, request.fileFullName),
                    request.fileName[0],
                    request.file.originalname,
                    Summary
                  );
                } else {
                  logger.info(`File updated failed`);
                  const document = await knex('documents').where('id', request.fileName[0]).del();
                  await knex('summary').where('fileId', request.fileName[0]).del();
                  await knex('notification').where({ jobId: job.id }).update({ message: 'failed' });
                  done(new Error('File updated failed'));
                  return;
                }

                if (docs.length > 0) {
                  logger.info(`Document split successfully`);
                  logger.info(`Creating and storing embeddings on vector database`);
                  community
                    .getCommunityUUID(request.communityId)
                    .then((uuid) => {
                      documents
                        .createAndStoreEmbeddingsOnIndex(
                          docs,
                          uuid,
                          request.fileName[0],
                          request.originalname.split('.').pop()
                        )
                        .then(async (res) => {
                          documents
                            .checkIfFileExists(request.fileName[0])
                            .then(async (res) => {
                              if (res == 1) {
                                if (fs.existsSync(request.filePath + '/' + request.fileFullName)) {
                                  if (process.env.GOOGLE_CLOUD_STORAGE == 1) {
                                    await fs2.unlink(
                                      path.join(request.filePath, request.fileFullName)
                                    );
                                  }
                                  if (
                                    request.file.mimetype ==
                                      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                                    request.file.mimetype == 'application/vnd.ms-excel'
                                  ) {
                                    documents.removeTempCSVFile(request.fileName[0]);
                                  }
                                  if (request.file.mimetype == 'application/pdf') {
                                    extractor.clearTempFiles(request.userId);
                                  }
                                  if (
                                    request.file.mimetype == 'application/msword' ||
                                    request.file.mimetype ==
                                      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                                  ) {
                                    documents.deleteTempTextFile(request.userId);
                                  }

                                  logger.info(`Embeddings created and stored on vector database`);
                                  await knex('documents')
                                    .where('id', request.fileName[0])
                                    .update({ isNotAnalyzed: false });
                                  await knex('notification')
                                    .where({ jobId: job.id })
                                    .update({ message: 'successfull' });
                                  done();
                                } else {
                                  logger.warn(`Failed to create embeddings`);
                                  const document = await knex('documents')
                                    .where('id', request.fileName[0])
                                    .del();
                                  await knex('summary').where('fileId', request.fileName[0]).del();
                                  await knex('notification')
                                    .where({ jobId: job.id })
                                    .update({ message: 'failed' });
                                  done(new Error('Failed to create embeddings'));
                                  return;
                                }
                              } else {
                                logger.warn(`Failed to create embeddings`);
                                const document = await knex('documents')
                                  .where('id', request.fileName[0])
                                  .del();
                                await knex('summary').where('fileId', request.fileName[0]).del();
                                await knex('notification')
                                  .where({ jobId: job.id })
                                  .update({ message: 'failed' });
                                done(new Error('Failed to create embeddings'));
                                return;
                              }
                            })
                            .catch(async (err) => {
                              console.log(err);
                              logger.warn(`Failed to create embeddings`);
                              logger.error(err);
                              const document = await knex('documents')
                                .where('id', request.fileName[0])
                                .del();
                              await knex('summary').where('fileId', request.fileName[0]).del();
                              await knex('notification')
                                .where({ jobId: job.id })
                                .update({ message: 'failed' });
                              one(new Error('Failed to create embeddings'));
                              return;
                            });
                        })
                        .catch(async (err) => {
                          console.log(err);
                          logger.warn(`Failed to create embeddings`);
                          logger.error(err);
                          const document = await knex('documents')
                            .where('id', request.fileName[0])
                            .del();
                          await knex('summary').where('fileId', request.fileName[0]).del();
                          await knex('notification')
                            .where({ jobId: job.id })
                            .update({ message: 'failed' });
                          done(new Error(err));
                          return;
                        });
                    })
                    .catch(async (err) => {
                      console.log(err);
                      logger.warn(`Failed to create embeddings`);
                      logger.error(err);
                      const document = await knex('documents')
                        .where('id', request.fileName[0])
                        .del();
                      await knex('summary').where('fileId', request.fileName[0]).del();
                      await knex('notification')
                        .where({ jobId: job.id })
                        .update({ message: 'failed' });
                      done(new Error(err));
                      return;
                    });
                } else {
                  logger.warn(`File upload failed`);
                  const document = await knex('documents').where('id', request.fileName[0]).del();
                  await knex('summary').where('fileId', request.fileName[0]).del();
                  await knex('notification').where({ jobId: job.id }).update({ message: 'failed' });
                  done(new Error(`File upload failed`));
                  return;
                }
              } else {
                logger.warn(`File upload failed`);
                const document = await knex('documents').where('id', request.fileName[0]).del();
                await knex('summary').where('fileId', request.fileName[0]).del();
                await knex('notification').where({ jobId: job.id }).update({ message: 'failed' });
                done(new Error(`File upload failed`));
                return;
              }
            } else {
              logger.warn(`File upload failed, unable to find the file on server`);
              const document = await knex('documents').where('id', request.fileName[0]).del();
              await knex('summary').where('fileId', request.fileName[0]).del();
              await knex('notification').where({ jobId: job.id }).update({ message: 'failed' });
              done(new Error(`File upload failed, unable to find the file on server`));
              return;
            }
          })
          .catch(async (err) => {
            console.log(err);
            logger.warn(`File upload failed, unable to find the file on server`);
            logger.error(err);
            const document = await knex('documents').where('id', request.fileName[0]).del();

            done(new Error(err));
            return;
          });
      }
    } else {
      if (process.env.GOOGLE_CLOUD_STORAGE == 1) {
        await fs2.unlink(path.join(request.filePath, request.fileFullName));
      }
      logger.info(`You have reached maximum storage capacity`);
      const document = await knex('documents').where('id', request.fileName[0]).del();
      await knex('notification').where({ jobId: job.id }).update({ message: 'failed' });
      done(new Error(`You have reached maximum storage capacity`));
    }
  });
}

const fileUpload = async ({ jobData, response, retry = false }) => {
  const created = new Date();
  const year = created.getUTCFullYear();
  const month = String(created.getUTCMonth() + 1).padStart(2, '0');
  const day = String(created.getUTCDate()).padStart(2, '0');
  const hours = String(created.getUTCHours()).padStart(2, '0');
  const minutes = String(created.getUTCMinutes()).padStart(2, '0');
  const seconds = String(created.getUTCSeconds()).padStart(2, '0');

  response.status(200).send({ fileId: jobData.fileName[0] });
  const mysqlTimestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  if (!retry) {
    const newNotification = await knex('notification').insert({
      userId: jobData.userId,
      name: jobData.file.originalname + ' (' + ((jobData.size / 1000).toFixed(2) + 'kb') + ')',
      message: 'uploading',
      type: 'file',
      jobId: jobData.fileName[0],
      created: mysqlTimestamp,
    });
    logger.info(`Job Id: ${jobData.fileName[0]} - Notification Id: ${newNotification[0]}`);
    await knex('file_deletions').insert({
      fileId: jobData.fileName[0],
      uuid: jobData.uuid,
      fileFullName: jobData.fileFullName,
      created: mysqlTimestamp,
      notificationId: newNotification[0],
    });
  }

  // await knex('notification')
  //   .where({ jobId: jobData.fileName[0] })
  //   .update({ message: 'failed' })

  // new Error('Testing the error')
  // return;

  const request = jobData;
  const documents = new Documents(knex);
  const community = new Community(knex);
  const extractor = new PDFExtractor();
  const storageDetails = await documents.getStorageOccupationDetail(request.company);
  function convertToKilobytes(formattedSize) {
    const sizes = ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const [value, unit] = formattedSize.split(' ');
    const index = sizes.indexOf(unit);

    return parseFloat(value) * Math.pow(1000, index);
  }
  const usedStorage = convertToKilobytes(storageDetails) || 0;
  const maxStorage = parseFloat(process.env.MAX_STORAGE * 1024 * 1024);

  if (usedStorage <= maxStorage) {
    logger.info(`Uploading new document on collection Id ${request.communityId}`);

    let Summary = '';
    let Overview = '';

    try {
      await knex('notification')
        .where({ jobId: jobData.fileName[0] })
        .update({ message: 'Generating Summary' });
      if (request.file.mimetype == 'image/jpeg' || request.file.mimetype == 'image/jpg') {
        const { summary } = await imageSummary(request.file.filename);
        Summary = summary;
      } else if (request.file.mimetype == 'video/mp4') {
        const { summary } = await videoSummary(request.file.filename);
        Summary = summary;
      } else if (request.file.mimetype == 'audio/mpeg') {
        const { summary } = await audioSummary(request.file.filename);
        Summary = summary;
      } else if (request.file.mimetype == 'image/png' || request.file.mimetype == 'image/mov') {
        const { summary } = await imageSummary(request.file.filename);
        Summary = summary;
      } else if (request.file.mimetype == 'video/quicktime') {
        const { summary } = await videoSummary(request.file.filename);
        Summary = summary;
      }
    } catch (error) {
      logger.error(`Error generating description of the multimedia ${request.fileName}`);
      logger.error(error);
      console.log(error);
      const document = await knex('documents').where('id', request.fileName[0]).del();
      await knex('notification')
        .where({ jobId: jobData.fileName[0] })
        .update({ message: 'failed' });

      response.write('0&%&Generating Summary of the file failed...$');
      return;
    }

    if (request.file) {
      logger.info(`Checking if the file uploaded on server`);
      documents
        .checkIfFileExists(request.fileName[0])
        .then(async (res) => {
          if (res == 1) {
            if (
              request.file.mimetype != 'image/png' &&
              request.file.mimetype != 'audio/mpeg' &&
              request.file.mimetype != 'video/mp4' &&
              request.file.mimetype != 'image/jpeg' &&
              request.file.mimetype != 'image/jpg' &&
              request.file.mimetype != 'video/quicktime' &&
              request.file.mimetype != 'image/mov'
            ) {
              const summary = await summarizer(
                path.join(request.filePath, request.fileFullName),
                request.fileName[0],
                request.file.originalname,
                request.userId
              );
              if (summary.success === true) {
                Summary = summary.outputText;
                Overview = summary.overviewOutputText;
                const dateTime = new Date();
                await knex('summary')
                  .where({
                    fileId: request.fileName[0],
                    fileName: request.file.originalname,
                    communityId: request.communityId,
                  })
                  .then((existingData) => {
                    if (existingData.length === 0) {
                      return knex('summary')
                        .insert({
                          fileId: request.fileName[0],
                          communityId: request.communityId,
                          fileName: request.file.originalname,
                          notes: Summary,
                          overview: Overview,
                          created: dateTime,
                        })
                        .then(() => {
                          logger.info({
                            message: 'Summary insertion completed',
                          });
                        })
                        .catch(async (error) => {
                          logger.info({
                            error: 'Internal Server Error',
                            error: error,
                          });
                          const document = await knex('documents')
                            .where('id', request.fileName[0])
                            .del();
                          await knex('notification')
                            .where({ jobId: jobData.fileName[0] })
                            .update({ message: 'failed' });

                          response.write('0&%&Summary insertion failed...$');
                          return;
                        });
                    } else {
                      logger.info('Data already exists.');
                    }
                  })
                  .catch(async (error) => {
                    logger.error('Error checking data:', error);
                    const document = await knex('documents').where('id', request.fileName[0]).del();
                    await knex('notification')
                      .where({ jobId: jobData.fileName[0] })
                      .update({ message: 'failed' });

                    response.write('0&%&Generating Summary of the file failed...$');
                    return;
                  });
              }
            } else if (Summary.length > 0) {
              const dateTime = new Date();
              await knex('summary')
                .where({
                  fileId: request.fileName[0],
                  fileName: request.file.originalname,
                  communityId: request.communityId,
                })
                .then((existingData) => {
                  if (existingData.length === 0) {
                    return knex('summary')
                      .insert({
                        fileId: request.fileName[0],
                        communityId: request.communityId,
                        fileName: request.file.originalname,
                        notes: Summary,
                        overview: '',
                        created: dateTime,
                      })
                      .then(() => {
                        logger.info({
                          message: 'Summary insertion completed',
                        });
                      })
                      .catch(async (error) => {
                        logger.info({
                          error: 'Internal Server Error',
                          error: error,
                        });
                        const document = await knex('documents')
                          .where('id', request.fileName[0])
                          .del();
                        await knex('notification')
                          .where({ jobId: jobData.fileName[0] })
                          .update({ message: 'failed' }); // response.end()

                        response.write('0&%&Generating Summary of the file failed...$');
                        return;
                      });
                  } else {
                    logger.info('Data already exists.');
                  }
                })
                .catch(async (error) => {
                  logger.error('Error checking data:', error);
                  const document = await knex('documents').where('id', request.fileName[0]).del();
                  await knex('notification')
                    .where({ jobId: jobData.fileName[0] })
                    .update({ message: 'failed' });

                  response.write('0&%&Generating Summary of the file failed...$');
                  return;
                });
            }
            if (fs.existsSync(request.filePath + '/' + request.fileFullName)) {
              logger.info(`File uploaded successfully, splitting the document into chunks`);
              let docs = [];
              if (
                request.file.mimetype ==
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              ) {
                await knex('notification')
                  .where({ jobId: jobData.fileName[0] })
                  .update({ message: 'Analyzing Document' });

                response.write('1&%&Analyzing Document...$');

                logger.info(`DOCX File uploaded successfully`);
                docs = await documents.createDocumentFromDocx(
                  path.join(request.filePath, request.fileFullName),
                  request.fileName[0],
                  request.file.originalname,
                  Summary,
                  Overview
                );
              } else if (request.file.mimetype == 'application/pdf') {
                docs = await documents.createDocumentFromPDF(
                  path.join(request.filePath, request.fileFullName),
                  request.fileName[0],
                  request.file.originalname,
                  Summary,
                  Overview
                );
                if (docs.length > 0) {
                  await knex('notification')
                    .where({ jobId: jobData.fileName[0] })
                    .update({ message: 'Extracting Data' });

                  response.write('1&%&Extracting Data...$');

                  logger.info(`PDF File uploaded successfully`);
                } else {
                  await knex('notification')
                    .where({ jobId: jobData.fileName[0] })
                    .update({ message: 'Extracting Data' });

                  response.write('1&%&Extracting Data...$');

                  const textURL = await extractor.convertPDFToText(
                    path.join(request.filePath, request.fileFullName),
                    request.userId,
                    request.fileName[0]
                  );
                  docs = await documents.createDocumentFromText(
                    textURL,
                    request.fileName[0],
                    request.file.originalname,
                    Summary,
                    Overview
                  );
                  await knex('notification')
                    .where({ jobId: jobData.fileName[0] })
                    .update({ message: 'Analyzing Document' });

                  response.write('1&%&Analyzing Document...$');

                  logger.info(`PDF_LOW File uploaded successfully`);
                }
              } else if (request.file.mimetype == 'text/plain') {
                logger.info(`TEXT File uploaded successfully`);
                await knex('notification')
                  .where({ jobId: jobData.fileName[0] })
                  .update({ message: 'Analyzing Document' });

                response.write('1&%&Analyzing Document...$');

                docs = await documents.createDocumentFromText(
                  path.join(request.filePath, request.fileFullName),
                  request.fileName[0],
                  request.file.originalname,
                  Summary,
                  Overview
                );
              } else if (
                request.file.mimetype ==
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              ) {
                await knex('notification')
                  .where({ jobId: jobData.fileName[0] })
                  .update({ message: 'Analyzing Document' });

                response.write('1&%&Analyzing Document...$');

                logger.info(`XLSX File uploaded successfully`);
                let isCsvFileCreated = await documents.createTempCSVFileForXLSXFile(
                  request.filePath,
                  request.fileName,
                  'xlsx'
                );
                if (isCsvFileCreated == 1) {
                  docs = await documents.createDocumentFromCSV(
                    path.join(
                      path.resolve(`${process.env.TMP_CSV_PATH}`),
                      `${request.fileName[0]}.csv`
                    ),
                    request.fileName[0],
                    request.file.originalname,
                    Summary,
                    Overview
                  );
                }
              } else if (request.file.mimetype == 'application/vnd.ms-excel') {
                await knex('notification')
                  .where({ jobId: jobData.fileName[0] })
                  .update({ message: 'Analyzing Document' });

                response.write('1&%&Analyzing Document...$');

                logger.info(`XLS File uploaded successfully`);
                let isCsvFileCreated = await documents.createTempCSVFileForXLSXFile(
                  request.filePath,
                  request.fileName,
                  'xls'
                );
                if (isCsvFileCreated == 1) {
                  docs = await documents.createDocumentFromCSV(
                    path.join(
                      path.resolve(`${process.env.TMP_CSV_PATH}`),
                      `${request.fileName[0]}.csv`
                    ),
                    request.fileName[0],
                    request.file.originalname,
                    Summary,
                    Overview
                  );
                }
              } else if (request.file.mimetype == 'application/msword') {
                await knex('notification')
                  .where({ jobId: jobData.fileName[0] })
                  .update({ message: 'Analyzing Document' });

                response.write('1&%&Analyzing Document...$');

                logger.info(`DOC File uploaded successfully`);
                const textFilePath = await documents.extractTextFromDocAndCreateTextFile(
                  path.join(request.filePath, request.fileFullName),
                  request.userId,
                  request.fileName[0]
                );
                docs = await documents.createDocumentFromText(
                  textFilePath,
                  request.fileName[0],
                  request.file.originalname,
                  Summary,
                  Overview
                );
              } else if (
                request.file.mimetype ==
                'application/vnd.openxmlformats-officedocument.presentationml.presentation'
              ) {
                await knex('notification')
                  .where({ jobId: jobData.fileName[0] })
                  .update({ message: 'Analyzing Document' });

                response.write('1&%&Analyzing Document...$');

                logger.info(`PPTX File uploaded successfully`);
                const textFilePath = await documents.extractTextFromPPTXAndCreateTextFile(
                  path.join(request.filePath, request.fileFullName),
                  request.userId,
                  request.fileName[0]
                );
                docs = await documents.createDocumentFromText(
                  textFilePath,
                  request.fileName[0],
                  request.file.originalname,
                  Summary,
                  Overview
                );
              } else if (
                request.file.mimetype == 'image/jpeg' ||
                request.file.mimetype == 'image/jpg' ||
                request.file.mimetype == 'image/png'
              ) {
                await knex('notification')
                  .where({ jobId: jobData.fileName[0] })
                  .update({ message: 'Analyzing Document' });

                response.write('1&%&Analyzing Document...$');

                logger.info(`Image File uploaded successfully`);
                docs = await documents.createDocumentFromImage(
                  path.join(request.filePath, request.fileFullName),
                  request.fileName[0],
                  request.file.originalname,
                  Summary
                );
              } else if (request.file.mimetype == 'video/mp4') {
                await knex('notification')
                  .where({ jobId: jobData.fileName[0] })
                  .update({ message: 'Analyzing Document' });

                response.write('1&%&Analyzing Document...$');

                logger.info(`Video File uploaded successfully`);
                docs = await documents.createDocumentFromVideo(
                  path.join(request.filePath, request.fileFullName),
                  request.fileName[0],
                  request.file.originalname,
                  Summary
                );
              } else if (request.file.mimetype == 'audio/mpeg') {
                logger.info(`Audio File uploaded successfully`);
                await knex('notification')
                  .where({ jobId: jobData.fileName[0] })
                  .update({ message: 'Analyzing Document' });

                response.write('1&%&Analyzing Document...$');

                docs = await documents.createDocumentFromAudio(
                  path.join(request.filePath, request.fileFullName),
                  request.fileName[0],
                  request.file.originalname,
                  Summary
                );
              } else if (request.file.mimetype == 'video/quicktime') {
                logger.info(`Video File uploaded successfully`);
                await knex('notification')
                  .where({ jobId: jobData.fileName[0] })
                  .update({ message: 'Analyzing Document' });

                response.write('1&%&Analyzing Document...$');

                docs = await documents.createDocumentFromVideo(
                  path.join(request.filePath, request.fileFullName),
                  request.fileName[0],
                  request.file.originalname,
                  Summary
                );
              } else {
                logger.info(`File updated failed`);
                const document = await knex('documents').where('id', request.fileName[0]).del();
                await knex('summary').where('fileId', request.fileName[0]).del();
                await knex('notification')
                  .where({ jobId: jobData.fileName[0] })
                  .update({ message: 'failed' });

                response.write('0&%&Analyzing document failed...$');
                return;
              }

              if (docs.length > 0) {
                logger.info(`Document split successfully`);
                logger.info(`Creating and storing embeddings on vector database`);
                community
                  .getCommunityUUID(request.communityId)
                  .then((uuid) => {
                    documents
                      .createAndStoreEmbeddingsOnIndex(
                        docs,
                        uuid,
                        parseInt(request.fileName[0]),
                        request.file.originalname.split('.').pop()
                      )
                      .then(async (res) => {
                        documents
                          .checkIfFileExists(request.fileName[0])
                          .then(async (res) => {
                            if (res == 1) {
                              if (fs.existsSync(request.filePath + '/' + request.fileFullName)) {
                                if (process.env.GOOGLE_CLOUD_STORAGE == 1) {
                                  await fs2.unlink(
                                    path.join(request.filePath, request.fileFullName)
                                  );
                                }
                                if (
                                  request.file.mimetype ==
                                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                                  request.file.mimetype == 'application/vnd.ms-excel'
                                ) {
                                  documents.removeTempCSVFile(request.fileName[0]);
                                }
                                if (request.file.mimetype == 'application/pdf') {
                                  extractor.clearTempFiles(request.userId);
                                }
                                if (
                                  request.file.mimetype == 'application/msword' ||
                                  request.file.mimetype ==
                                    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                                ) {
                                  documents.deleteTempTextFile(request.userId);
                                }

                                logger.info(`Embeddings created and stored on vector database`);
                                await knex('documents')
                                  .where('id', request.fileName[0])
                                  .update({ isNotAnalyzed: false });
                                await knex('notification')
                                  .where({ jobId: jobData.fileName[0] })
                                  .update({ message: 'successfull' });
                                response.write('1&%&Analyzed file...$');
                                if (process.env.CACHE_MODE == 0) {
                                  await knex('file_metadata_retries')
                                    .where({ jid: jobData.fileName[0] })
                                    .del();
                                }
                                return 100;
                              } else {
                                logger.warn(`Failed to create embeddings`);
                                const document = await knex('documents')
                                  .where('id', request.fileName[0])
                                  .del();
                                await knex('summary').where('fileId', request.fileName[0]).del();
                                await knex('notification')
                                  .where({ jobId: jobData.fileName[0] })
                                  .update({ message: 'failed' });

                                response.write('0&%&Analyzing document failed...$');
                                return;
                              }
                            } else {
                              logger.warn(`Failed to create embeddings`);
                              const document = await knex('documents')
                                .where('id', request.fileName[0])
                                .del();
                              await knex('summary').where('fileId', request.fileName[0]).del();
                              await knex('notification')
                                .where({ jobId: jobData.fileName[0] })
                                .update({ message: 'failed' });

                              return;
                            }
                          })
                          .catch(async (err) => {
                            console.log(err);
                            logger.warn(`Failed to create embeddings`);
                            logger.error(err);
                            const document = await knex('documents')
                              .where('id', request.fileName[0])
                              .del();
                            await knex('summary').where('fileId', request.fileName[0]).del();
                            await knex('notification')
                              .where({ jobId: jobData.fileName[0] })
                              .update({ message: 'failed' });
                            response.write('0&%&Generating embedding of the file failed...$');
                            return;
                          });
                      })
                      .catch(async (err) => {
                        console.log(err);
                        logger.warn(`Failed to create embeddings`);
                        logger.error(err);
                        const document = await knex('documents')
                          .where('id', request.fileName[0])
                          .del();
                        await knex('summary').where('fileId', request.fileName[0]).del();
                        await knex('notification')
                          .where({ jobId: jobData.fileName[0] })
                          .update({ message: 'failed' });

                        response.write('0&%&Generating embedding of the file failed...$');
                        return;
                      });
                  })
                  .catch(async (err) => {
                    console.log(err);
                    logger.warn(`Failed to create embeddings`);
                    logger.error(err);
                    const document = await knex('documents').where('id', request.fileName[0]).del();
                    await knex('summary').where('fileId', request.fileName[0]).del();
                    await knex('notification')
                      .where({ jobId: jobData.fileName[0] })
                      .update({ message: 'failed' });

                    response.write('0&%&Generating embedding of the file failed...$');
                    return;
                  });
              } else {
                logger.warn(`File upload failed`);
                const document = await knex('documents').where('id', request.fileName[0]).del();
                await knex('summary').where('fileId', request.fileName[0]).del();
                await knex('notification')
                  .where({ jobId: jobData.fileName[0] })
                  .update({ message: 'failed' });

                response.write('0&%&File upload failed...$');
                return;
              }
            } else {
              logger.warn(`File upload failed`);
              const document = await knex('documents').where('id', request.fileName[0]).del();
              await knex('summary').where('fileId', request.fileName[0]).del();
              await knex('notification')
                .where({ jobId: jobData.fileName[0] })
                .update({ message: 'failed' });

              response.write('0&%&File upload failed...$');
              return;
            }
          } else {
            logger.warn(`File upload failed, unable to find the file on server`);
            const document = await knex('documents').where('id', request.fileName[0]).del();
            await knex('summary').where('fileId', request.fileName[0]).del();
            await knex('notification')
              .where({ jobId: jobData.fileName[0] })
              .update({ message: 'failed' });

            response.write('0&%&File upload failed...$');
            return;
          }
        })
        .catch(async (err) => {
          console.log(err);
          logger.warn(`File upload failed, unable to find the file on server`);
          logger.error(err);
          const document = await knex('documents').where('id', request.fileName[0]).del();

          await knex('notification')
            .where({ jobId: jobData.fileName[0] })
            .update({ message: 'failed' });

          response.write('0&%&File upload failed...$');
          return;
        });
    }
  } else {
    if (process.env.GOOGLE_CLOUD_STORAGE == 1) {
      await fs2.unlink(path.join(request.filePath, request.fileFullName));
    }
    logger.info(`You have reached maximum storage capacity`);
    const document = await knex('documents').where('id', request.fileName[0]).del();
    await knex('notification').where({ jobId: job.id }).update({ message: 'failed' });
    response.write('0&%&You have reached maximum storage capacity...$');
  }
};

// dropbox

app.get('/dropbox/auth', (req, res) => {
  req.session.userId = req.query.userId;
  const clientId = process.env.DROPBOX_APP_KEY;
  const redirectUri = `${process.env.BACKEND_URL}/dropbox/callback`;
  const dropboxAuthUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&token_access_type=offline`;

  res.redirect(dropboxAuthUrl);
});

async function getDropboxFiles(accessToken, path = '') {
  try {
    // Step 1: List files from the given path
    const response = await axios.post(
      'https://api.dropboxapi.com/2/files/list_folder',
      {
        path,
        recursive: true,
        include_media_info: true,
        include_deleted: false,
        include_has_explicit_shared_members: false,
        include_mounted_folders: true,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const entries = response.data.entries;

    // Step 2: For each file, fetch a temporary download link
    const enrichedFiles = await Promise.all(
      entries
        .filter((file) => file['.tag'] === 'file')
        .map(async (file) => {
          try {
            const tempLinkRes = await axios.post(
              'https://api.dropboxapi.com/2/files/get_temporary_link',
              { path: file.path_lower },
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
              }
            );

            return {
              ...file,
              downloadUrl: tempLinkRes.data.link, // Add download link
            };
          } catch (err) {
            logger.error(
              `Error getting temp link for ${file.name}:`,
              err.response?.data || err.message
            );
            return null;
          }
        })
    );

    return enrichedFiles.filter(Boolean); // Remove any nulls
  } catch (error) {
    logger.error('Error fetching Dropbox files:', error.response?.data || error.message);
    throw error;
  }
}

app.get('/dropbox/callback', async (req, res) => {
  const code = req.query.code;
  const userId = req.session.userId;
  const CLIENT_ID = process.env.DROPBOX_APP_KEY;
  const CLIENT_SECRET = process.env.DROPBOX_APP_SECRET;
  const REDIRECT_URI = `${process.env.BACKEND_URL}/dropbox/callback`;

  try {
    // Exchange code for access and refresh tokens
    const tokenResponse = await axios.post(
      'https://api.dropboxapi.com/oauth2/token',
      querystring.stringify({
        code,
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, refresh_token, account_id } = tokenResponse.data;

    // Get Dropbox user profile
    const userInfoRes = await axios.post(
      'https://api.dropboxapi.com/2/users/get_current_account',
      null, // no body
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const user = userInfoRes.data;

    const source = req.useragent;
    const existing = await knex('user_integrations')
      .where({ userId: userId, integrationId: 'integration_2' })
      .first();

    if (existing) {
      // Update existing record
      await knex('user_integrations')
        .where({ userId: userId, integrationId: 'integration_2' })
        .update({
          integrationId: 'integration_2',
          name: 'Dropbox',
          accessToken: access_token,
          refreshToken: refresh_token,
          account: user.email,
          source: source.isMobile ? 'Mobile' : 'Web',
          time: new Date(),
          login: true,
        });
    } else {
      // Insert new record
      await knex('user_integrations').insert({
        userId: userId,
        integrationId: 'integration_2',
        name: 'Dropbox',
        accessToken: access_token,
        refreshToken: refresh_token,
        account: user.email,
        source: source.isMobile ? 'Mobile' : 'Web',
        time: new Date(),
        login: true,
      });
    }

    const files = await getDropboxFiles(access_token);

    if (access_token) {
      res.send(`
        <script>
          const targetOrigin = '${process.env.FRONTEND_BASE_URL}';
          const dropboxData = {
            statusRes: true,
            accessToken: '${access_token}',
            refreshToken: '${refresh_token}',
            profile: ${JSON.stringify(user)},
            files: '${JSON.stringify(files)}',
            source: '${source.isMobile ? 'Mobile' : 'Web'}',
            dropbox: true,
          };
          window.opener.postMessage(dropboxData, targetOrigin);
          window.close();
        </script>
      `);
    } else {
      res.send(`
        <script>
          const targetOrigin = '${process.env.FRONTEND_BASE_URL}';
          const errorData = {
            statusRes: false,
            statusMessage: 'Authentication failed. Please try again.',
          };
          window.opener.postMessage(errorData, targetOrigin);
          window.close();
        </script>
      `);
    }
  } catch (error) {
    logger.error(error);
    res.send(`
      <script>
        const targetOrigin = '${process.env.FRONTEND_BASE_URL}';
        const errorData = {
          statusRes: false,
          statusMessage: 'Error during authentication. Please try again.',
        };
        window.opener.postMessage(errorData, targetOrigin);
        window.close();
      </script>
    `);
  }
});

app.get('/fetch-dropbox-file', async (req, res) => {
  const dropboxUrl = req.query.url; // Get the Dropbox URL from the query parameter

  try {
    const response = await nfetch(dropboxUrl);
    logger.info('Fetching file from dropbox');

    // Check if the response is successful
    if (!response.ok) {
      logger.error(response.statusText);
      logger.error(response);
    }

    // Get the data as a stream, so it is not fully loaded into memory
    const dataStream = response.body;

    // Extract the file name from the URL
    const url = new URL(dropboxUrl);
    const fileName = path.basename(url.pathname); // Get the file name
    const extension = path.extname(fileName).toLowerCase(); // Get the file extension

    // Determine the MIME type based on the file extension
    const contentType = mime.lookup(extension) || 'application/octet-stream'; // Fallback to octet-stream if not found

    // Set the correct content type and disposition headers
    res.set('Content-Type', contentType);
    res.set('Content-Disposition', `attachment; filename="${fileName}"`);

    // Pipe the data stream directly to the response
    dataStream.pipe(res);
  } catch (error) {
    logger.error('Error fetching file from Dropbox:', error);
    res.status(500).send('Error fetching file');
  }
});

// slack

app.get('/fetch-slack-file', async (req, res) => {
  const slackUrl = req.query.url; // Get the Slack URL from the query parameter
  const fileAccessToken = req.query.accessToken;

  try {
    // Download the file
    const fileResponse = await axios({
      url: slackUrl,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${fileAccessToken}`,
      },
      responseType: 'stream',
    });

    // Extract the file name from the URL
    const url = new URL(slackUrl);
    const fileName = path.basename(url.pathname); // Get the file name
    const extension = path.extname(fileName).toLowerCase(); // Get the file extension

    // Determine the MIME type based on the file extension
    const contentType = mime.lookup(extension) || 'application/octet-stream';
    // Set the correct content type and disposition headers
    res.set('Content-Type', contentType);
    res.set('Content-Disposition', `attachment; filename="${fileName}"`);

    // Write the file to the local filesystem
    fileResponse.data.pipe(res);
  } catch (error) {
    console.error('Error downloading file from Slack:', error.message);
  }
});

app.get('/slack/files', async (req, res) => {
  const accessToken = req.headers['authorization']; // Ensure to pass the access token in the headers
  try {
    const response = await axios.get('https://slack.com/api/files.list', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        types: 'all', // Ensure this includes all file types (you can customize this)
        user: req.query.user,
      },
    });

    if (response.data.ok) {
      const files = response.data.files; // This will contain the list of files
      res.json({ statusRes: true, files });
    } else {
      logger.error('Failed to retrieve files:', response.data.error);
      res.status(400).json({ statusRes: false, statusMessage: response.data.error });
    }
  } catch (error) {
    logger.error('Error fetching files from Slack:', error);
    res.status(500).json({ statusRes: false, statusMessage: 'Error fetching files.' });
  }
});

app.get('/slack/auth', (req, res) => {
  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = `${process.env.BACKEND_URL}/slack/callback`;
  const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&user_scope=files:read,users:read,users:read.email&redirect_uri=${redirectUri}&state=${req.query.userId}`;

  res.redirect(slackAuthUrl);
});

app.get('/slack/callback', async (req, res) => {
  const code = req.query.code;
  const CLIENT_ID = process.env.SLACK_CLIENT_ID;
  const CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
  const REDIRECT_URI = `${process.env.BACKEND_URL}/slack/callback`;
  const userId = req.query.state;

  try {
    // Exchange the authorization code for an access token
    const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
      params: {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
      },
    });

    const { authed_user } = response.data;
    const userInfoResponse = await axios.get('https://slack.com/api/users.info', {
      headers: {
        Authorization: `Bearer ${authed_user.access_token}`, // This must be a user token, not bot token
      },
      params: {
        user: authed_user.id,
      },
    });

    const slackUser = userInfoResponse.data.user;

    const source = req.useragent;
    const existing = await knex('user_integrations')
      .where({ userId: userId, integrationId: 'integration_4' })
      .first();

    if (existing) {
      // Update existing record
      await knex('user_integrations')
        .where({ userId: userId, integrationId: 'integration_4' })
        .update({
          integrationId: 'integration_4',
          name: 'Slack',
          accessToken: authed_user.access_token,
          refreshToken: authed_user.id,
          account: slackUser.profile.email,
          source: source.isMobile ? 'Mobile' : 'Web',
          time: new Date(),
          login: true,
        });
    } else {
      // Insert new record
      await knex('user_integrations').insert({
        userId: userId,
        integrationId: 'integration_4',
        name: 'Wordpress',
        accessToken: authed_user.access_token,
        refreshToken: authed_user.id,
        account: slackUser.profile.email,
        source: source.isMobile ? 'Mobile' : 'Web',
        time: new Date(),
        login: true,
      });
    }

    if (authed_user.access_token) {
      // Send data back to the client in a script
      res.send(`
        <script>
          const targetOrigin = '${process.env.FRONTEND_BASE_URL}';
          const slackData = {
            statusRes: true,
            accessToken: '${authed_user.access_token}',
            profile: '${slackUser.profile.email}',
            source: '${source.isMobile ? 'Mobile' : 'Web'}',
            user: '${authed_user.id}',
            slack: true,
          };
          window.opener.postMessage(slackData, targetOrigin);
          window.close();
        </script>
      `);
    } else {
      // Handle authentication failure
      res.send(`
        <script>
          const targetOrigin = '${process.env.FRONTEND_BASE_URL}';
          const errorData = {
            statusRes: false,
            statusMessage: 'Authentication failed. Please try again.',
          };
          window.opener.postMessage(errorData, targetOrigin);
          window.close();
        </script>
      `);
    }
  } catch (error) {
    logger.error(error);
    // Handle error during the request
    res.send(`
      <script>
        const targetOrigin = '${process.env.FRONTEND_BASE_URL}';
        const errorData = {
          statusRes: false,
          statusMessage: 'Error during authentication. Please try again.',
        };
        window.opener.postMessage(errorData, targetOrigin);
        window.close();
      </script>
    `);
  }
});

// wordpress

app.get('/wordpress/auth', (req, res) => {
  req.session.userId = req.query.userId;
  const clientId = process.env.WORDPRESS_CLIENT_ID;
  const redirectUri = `${process.env.BACKEND_URL}/wordpress/callback`;
  const wordpressAuthUrl = `https://public-api.wordpress.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=global`;

  res.redirect(wordpressAuthUrl);
});

app.get('/wordpress/callback', async (req, res) => {
  const code = req.query.code;
  const CLIENT_ID = process.env.WORDPRESS_CLIENT_ID;
  const CLIENT_SECRET = process.env.WORDPRESS_CLIENT_SECRET;
  const REDIRECT_URI = `${process.env.BACKEND_URL}/wordpress/callback`;
  const userId = req.session.userId;
  try {
    // Exchange the authorization code for an access token
    const response = await axios.post(
      'https://public-api.wordpress.com/oauth2/token',
      querystring.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token } = response.data;

    const userResponse = await axios.get('https://public-api.wordpress.com/rest/v1.1/me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const source = req.useragent;
    const existing = await knex('user_integrations')
      .where({ userId: userId, integrationId: 'integration_5' })
      .first();

    if (existing) {
      // Update existing record
      await knex('user_integrations')
        .where({ userId: userId, integrationId: 'integration_5' })
        .update({
          integrationId: 'integration_5',
          name: 'WordPress',
          accessToken: access_token,
          refreshToken: '',
          account: userResponse.data.email,
          source: source.isMobile ? 'Mobile' : 'Web',
          time: new Date(),
          login: true,
        });
    } else {
      // Insert new record
      await knex('user_integrations').insert({
        userId: userId,
        integrationId: 'integration_5',
        name: 'WordPress',
        accessToken: access_token,
        refreshToken: '',
        account: userResponse.data.email,
        source: source.isMobile ? 'Mobile' : 'Web',
        time: new Date(),
        login: true,
      });
    }

    if (access_token) {
      // Send data back to the client in a script
      res.send(`
        <script>
          const targetOrigin = '${process.env.FRONTEND_BASE_URL}';
          const slackData = {
            statusRes: true,
            accessToken: '${access_token}',
            profile: '${userResponse.data.email}',
            source: '${source.isMobile ? 'Mobile' : 'Web'}',
            wordpress: true,
          };
          window.opener.postMessage(slackData, targetOrigin);
          window.close();
        </script>
      `);
    } else {
      // Handle authentication failure
      res.send(`
        <script>
          const targetOrigin = '${process.env.FRONTEND_BASE_URL}';
          const errorData = {
            statusRes: false,
            statusMessage: 'Authentication failed. Please try again.',
          };
          window.opener.postMessage(errorData, targetOrigin);
          window.close();
        </script>
      `);
    }
  } catch (error) {
    logger.error(error);
    // Handle error during the request
    res.send(`
      <script>
        const targetOrigin = '${process.env.FRONTEND_BASE_URL}';
        const errorData = {
          statusRes: false,
          statusMessage: 'Error during authentication. Please try again.',
        };
        window.opener.postMessage(errorData, targetOrigin);
        window.close();
      </script>
    `);
  }
});

app.get('/wordpress/files', async (req, res) => {
  const ACCESS_TOKEN = req.headers['authorization'];

  const response = await axios.get('https://public-api.wordpress.com/rest/v1.1/me/sites', {
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`, // Use the user's access token
    },
  });

  // Extract the list of sites from the response
  let sites = response.data.sites[0]?.URL?.replace('https://', '') || '';
  try {
    let response = '';
    try {
      response = await axios.get(`https://public-api.wordpress.com/wp/v2/sites/${sites}/media`, {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`, // Set the access token in the Authorization header
        },
      });
    } catch (error) {
      logger.error(error);
    }

    // Handle the response data (media files)
    const mediaFiles = response.data;
    logger.info('fetched wordpress files successfully');
    // Optionally, you can return or process the media files as needed
    res.json({ statusRes: true, files: mediaFiles });
  } catch (error) {
    console.log('error');
    logger.error(
      'Error fetching media files:',
      error.response ? error.response.data : error.message
    );
    res.status(400).json({ statusRes: false, statusMessage: error });
  }
});

app.get('/fetch-wordpress-file', async (req, res) => {
  const wordpressUrl = req.query.url; // Get the URL from the query parameter
  const fileAccessToken = req.query.accessToken;

  try {
    // Download the file
    const fileResponse = await axios({
      url: wordpressUrl,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${fileAccessToken}`,
      },
      responseType: 'stream',
    });

    // Extract the file name from the URL
    const url = new URL(wordpressUrl);
    const fileName = path.basename(url.pathname); // Get the file name
    const extension = path.extname(fileName).toLowerCase(); // Get the file extension

    // Determine the MIME type based on the file extension
    const contentType = mime.lookup(extension) || 'application/octet-stream';
    // Set the correct content type and disposition headers
    res.set('Content-Type', contentType);
    res.set('Content-Disposition', `attachment; filename="${fileName}"`);

    // Write the file to the local filesystem
    fileResponse.data.pipe(res);
  } catch (error) {
    logger.error(error);
    console.error('Error downloading file from Wordpress:', error.message);
  }
});

app.post(
  '/file-manager/upload-file',
  auth.verifyToken,
  fileUploadRateLimiter,
  auth.checkForDuplicateFile,
  auth.onlyAdminOrUser,
  auth.isMemberOfCommunityOrSharedMemberV2,
  documentUpload.single('file'),
  async function (request, response) {
    if (process.env.GOOGLE_CLOUD_STORAGE == 1) {
      try {
        let filePath = path.join(request.filePath, request.fileFullName);
        logger.info(
          `Uploading file on cloud: FileName: ${sanitizeForLog(request.originalName)} FileId: ${sanitizeForLog(request.fileName[0])}`
        );
        await storage.bucket(process.env.GOOGLE_STORAGE_BUCKET_NAME).upload(filePath, {
          destination: request.fileName[0],
        });
        logger.info('Successfully uploaded file on cloud');
      } catch (error) {
        logger.error('Error uploading file on cloud');
        logger.error(error);
        return response.status(500).json({
          message: 'Error uploading file on cloud',
        });
      }
    }
    try {
      const jobData = {
        filePath: request.filePath,
        fileFullName: request.fileFullName,
        mimetype: request.file.mimetype,
        fileName: request.fileName,
        originalname: request.file.originalname,
        communityId: request.query.communityId,
        userId: request.decoded.userId,
        company: request.decoded.company,
        uuid: request.uuid,
        file: request.file,
        size: request.file.size,
      };
      if (process.env.CACHE_MODE == 0) {
        logger.info('cache mode off so inserting data in file_metadata_retries table');
        await knex('file_metadata_retries').insert({
          jid: request.fileName[0],
          filePath: request.filePath,
          fileFullName: request.fileFullName,
          mimetype: request.file.mimetype,
          fileName: request.fileName,
          originalname: request.file.originalname,
          communityId: request.query.communityId,
          userId: request.decoded.userId,
          company: request.decoded.company,
          uuid: request.uuid,
          size: request.file.size,
        });
      }
      await knex('documents')
        .where({ id: jobData.fileName[0] })
        .update({
          size: (jobData.size / 1000).toFixed(2) + ' kb',
          creator: request.decoded.userId,
        });
      // throw new Error("testing the error")
      if (process.env.SEPERATE_FILE_UPLOAD_SERVER === '1') {
        logger.info(`Passing request to different server for file upload`);
        const seperateServerResponse = await axios({
          method: 'post',
          url: `${process.env.SEPERATE_FILE_UPLOAD_SERVER_URL + request.url}`,
          data: jobData,
          headers: { 'Content-Type': 'application/json' },
        });
        return response.status(200).json({
          message: seperateServerResponse.data.message,
        });
      } else {
        logger.info(`Processing file upload in main server`);
        if (process.env.CACHE_MODE == 1) {
          const job = await fileUploadQueue.add({ jobData });
          return response.status(200).json({
            message: `Job ${job.id} added to the queue File upload and analysis initiated`,
            fileId: job.id,
          });
        } else {
          const nrjob = await fileUpload({ jobData, response });
        }
      }
    } catch (error) {
      console.log(error);
      if (error.code === 'ECONNREFUSED') {
        logger.error('Error connecting with seperate file upload server');
      }
      return response.status(500).json({
        message: 'Error initiating file upload',
      });
    }
  }
);

app.get('/file-manager/retry-job/:id', async function (req, res, next) {
  try {
    if (process.env.CACHE_MODE == 1) {
      if (process.env.SEPERATE_FILE_UPLOAD_SERVER === '1') {
        logger.info('Sending retry job request to seperate file upload server');
        const serverResponse = await axios({
          method: 'get',
          url: `${
            process.env.SEPERATE_FILE_UPLOAD_SERVER_URL + '/file-manager/retry-job/' + req.params.id
          }`,
        });
        return res.status(200).json({ message: 'Retrying' });
      } else {
        logger.info('retrying file upload job in main server');
        const jobId = req.params.id;
        const job = await fileUploadQueue.getJob(jobId);
        await knex('notification').where({ jobId: jobId }).update({ message: 'uploading' });

        if (job) {
          await job.retry();
          // console.log(job)
          res.status(200).json({ message: 'Retrying' });
        } else {
          res.status(200).json({ error: 'Job not found' });
        }
      }
    } else {
      logger.info('retrying file upload job without chache in main server');
      const jobId = req.params.id;
      const rawJobData = await knex('file_metadata_retries').select('*').where('jid', jobId);
      rawJobData[0].fileName = [parseInt(rawJobData[0].fileName)];
      const jobData = {
        ...rawJobData[0],
        file: { mimetype: rawJobData[0].mimetype, originalname: rawJobData[0].originalname },
      };
      await knex('notification').where({ jobId: jobId }).update({ message: 'uploading' });

      if (rawJobData.length > 0) {
        logger.info(`File data exists of ${sanitizeForLog(jobId)}, checking file existence`);
        let fileExists = fs.existsSync(path.resolve(jobData.filePath, jobData.fileFullName));
        // return;
        if (fileExists) {
          logger.info('file exists trying to process');
          const nrjob = await fileUpload({ jobData, response: res, retry: true });
        } else {
          res.status(200).json({ error: 'Job not found' });
        }
      } else {
        logger.error(`file data of jid: ${jobId} not found`);
        res.status(200).json({ error: 'Job not found' });
      }
    }
  } catch (e) {
    logger.error(e);
    return res.status(500).json('Error while retrying job in Bull queue');
  }
});

// Route to get job status
app.get('/file-manager/get-job-status/:id', async function (req, res, next) {
  try {
    if (process.env.SEPERATE_FILE_UPLOAD_SERVER === '1') {
      logger.info('Getting job status from seperate file upload server');
      const serverResponse = await axios({
        method: 'get',
        url: `${
          process.env.SEPERATE_FILE_UPLOAD_SERVER_URL +
          '/file-manager/get-job-status/' +
          req.params.id
        }`,
      });
      return res.status(200).json({
        state: serverResponse.data.state,
        progress: serverResponse.data.progress,
      });
    } else {
      if (process.env.CACHE_MODE == 1) {
        logger.info('Getting job status from main server');
        const jobId = req.params.id;
        const job = await fileUploadQueue.getJob(jobId);
        if (job) {
          const state = await job.getState();
          const progress = await job.progress();
          // console.log(job)
          res.status(200).json({ state, progress });
        } else {
          logger.warn('Job not found');
          res.status(200).json({ error: 'Job not found' });
        }
      } else {
        logger.info('Getting job status from server');
        const jobId = req.params.id;
        const job = await knex('notification').select('*').where({ jobId: jobId });
        if (job) {
          let state = await job[0].message;
          let progress = 0;
          if (state == 'Generating Summary') {
            progress = 25;
          } else if (state == 'Extracting Data') {
            progress = 50;
          } else if (state == 'Analyzing Document') {
            progress = 75;
          } else if (state == 'successfull') {
            state = 'completed';
            progress = 100;
          }
          res.status(200).json({ state, progress });
        } else {
          logger.warn('Job not found');
          res.status(200).json({ error: 'Job not found' });
        }
      }
    }
  } catch (e) {
    logger.error(e);
    console.log(e);
    return res.status(500).json('Error while fetching job status from Bull queue');
  }
});

app.get('/file-manager/get-max-file-uploads', async function (req, res, next) {
  try {
    const maxFileUploads = await getAdminSetting('MAX_FILE_UPLOADS');
    return res.status(200).json(maxFileUploads);
  } catch (e) {
    console.log(e);
    return res.status(500).json('Error while reading max file uploads');
  }
});

app.get('/file-manager/get-recording-prompt-time', async function (req, res, next) {
  try {
    const recordingPromptTime = await getAdminSetting('USER_RECORDING_PROMPT');
    return res.status(200).json(recordingPromptTime);
  } catch (e) {
    console.log(e);
    return res.status(500).json('Error while reading Recording Prompt Time');
  }
});

app.post('/share-collection', auth.verifyToken, async function (request, response) {
  try {
    const recieverUserId = await knex('users')
      .select(['id'])
      .where({ email: request.body.email })
      .first();
    if (recieverUserId) {
      await knex('shared_collections').insert({
        collectionId: request.body.collectionId,
        sharedUserId: recieverUserId.id,
        ownerId: request.body.senderId,
      });
    } else {
      const user = new Users(knex);
      user.getMailTemplate(12).then(async (data) => {
        let subject = data[0].subject;
        subject = subject.replace('{{usermail}}', request.body.email);
        let html = data[0].template;
        html = html.replace(
          '{{sender}}',
          request.decoded.firstname + ' ' + request.decoded.lastname
        );
        html = html.replace('{{reciever}}', request.body.email);
        html = html.replace('{{signupLink}}', `${process.env.FRONTEND_BASE_URL}/auth/registration`);
        var { transporter, mailingAddress } = await emailTransporter();
        var mailOptions2 = {
          from: mailingAddress,
          to: request.body.email,
          subject: subject,
          html,
        };

        transporter.sendMail(mailOptions2, function (error, info) {
          if (error) {
            logger.warn(`Failed to send invitation to ${sanitizeForLog(request.body.email)}`);
            logger.error(error.message);
            return console.log(error);
          }
          logger.info(`Invitation sent to ${sanitizeForLog(request.body.email)}`);
          if (info.accepted.length > 0) {
            logger.debug(
              JSON.stringify({ success: true, message: request.t('invitationSentSuccess') })
            );
            return response
              .status(200)
              .send({ success: true, message: request.t('invitationSentSuccess') });
          } else {
            logger.warn(`Failed to send invitation mail to ${sanitizeForLog(request.body.email)}`);
            logger.debug(
              JSON.stringify({ success: false, message: request.t('invitationSentFailed') })
            );
            return response
              .status(200)
              .send({ success: false, message: request.t('invitationSentFailed') });
          }
        });
      });
    }

    response.status(200).json({ message: 'success' });
  } catch (error) {
    console.log(error);
    response.status(500).json({ message: 'interenal server error' });
  }
});

app.post(
  '/user/admin/cancel-subscription',
  auth.verifyToken,
  auth.adminAccess,
  function (request, response) {
    const stripes = require('stripe')(process.env.STRIPE_SECRET_KEY);

    const user = new Users(knex);

    if (request.body.userId) {
      logger.info(`Cancel Subscription for ${request.body.userId}`);
      user
        .updateSubscriptionData(request.body.userId, '0')
        .then((res) => {
          if (res == 1) {
            user.getSubscriptionData(request.body.userId).then(async (sub) => {
              const subscriptionId = sub[0][0].subscriptionId;
              await stripes.subscriptions.cancel(subscriptionId);

              user.updateUserMeta(request.body.userId, 'accountBlocked', '1').then(() => {
                logger.info(`Account Cancel Subscription for ${request.body.userId}`);
                user
                  .getUserDetailsById(request.body.userId)
                  .then(async (user1) => {
                    logger.info(
                      `Sending confirmation mail for, Account Cancel Subscription for ${request.body.userId}`
                    );
                    user.getMailTemplate(5).then(async (data) => {
                      let subject = data[0].subject;
                      let html = data[0].template;
                      html = html.replace('{{name}}', user1.firstname);
                      var { transporter, mailingAddress } = await emailTransporter();

                      var mailOptions2 = {
                        from: mailingAddress,
                        to: user1.email,
                        subject: subject,
                        html,
                      };

                      transporter.sendMail(mailOptions2, function (error, info) {
                        if (error) {
                          logger.error(error);
                        }
                        if (info) {
                          logger.info(
                            `Subscription cancel message successfully sent to ${user1.email}`
                          );
                        }
                      });
                    });
                  })
                  .catch((err) => {
                    logger.error(err);
                  });
                logger.debug(
                  JSON.stringify({
                    success: true,
                    message: 'Account Cancel Subscription Successful',
                  })
                );
                return response.status(200).send({
                  success: true,
                  message: 'Account Cancel Subscription Successful',
                });
              });
            });
          } else {
            logger.warn(
              `Account Cancel Subscription Failed for ${sanitizeForLog(request.body.userId)}`
            );
            logger.debug(
              JSON.stringify({
                success: false,
                message: 'Account Cancel Subscription Failed',
              })
            );
            return response.status(200).send({
              success: false,
              message: 'Account Cancel Subscription Failed',
            });
          }
        })
        .catch((err) => {
          logger.warn(
            `Account Cancel Subscription Failed for ${sanitizeForLog(request.body.userId)}`
          );
          logger.error(err);
          logger.debug(
            JSON.stringify({
              success: false,
              message: 'Account Cancel Subscription Failed',
            })
          );
          return response.status(200).send({
            success: false,
            message: 'Account Cancel Subscription Failed',
          });
        });
    } else {
      logger.debug(
        JSON.stringify({
          success: false,
          message: 'Missing parameters, fill all the required fields',
        })
      );
      return response.status(400).send({
        success: false,
        message: 'Missing parameters, fill all the required fields',
      });
    }
  }
);

app.get(
  '/file-manager/get-all-folders/:communityId',
  auth.verifyToken,
  auth.onlyAdminOrUser,
  async (request, response) => {
    try {
      const allFolders = await knex('documents')
        .select('*')
        .where({ communityId: request.params.communityId })
        .andWhere({ isFile: false });
      return response.status(200).json({ folders: allFolders });
    } catch (err) {
      console.log(err);
      return response.status(500).json({ message: 'notsuccessfull' });
    }
  }
);
app.get(
  '/file-manager/get-all-teams/:companyId',
  auth.verifyToken,
  auth.onlyAdminOrUser,
  async (request, response) => {
    try {
      const allTeams = await knex('communities')
        .select('*')
        .where({ companyId: request.params.companyId });
      return response.status(200).json({ teams: allTeams });
    } catch (err) {
      console.log(err);
      return response.status(500).json({ message: 'notsuccessfull' });
    }
  }
);

app.post('/get/user/statistics', auth.verifyToken, async function (request, response) {
  const user = new Users(knex);
  const community = new Community(knex);
  const document = new Documents(knex);
  const chat = new Chat(knex);

  if (request.body.userId) {
    logger.info(`Fetching user statistics`);
    const userId = request.body.userId;
    user
      .getUserDetailsById(userId)
      .then(async (res) => {
        const subscriptionDetails = await user.getSubscriptionData(userId);
        // console.log(subscriptionDetails)
        const invitationDetails = await user.getInvitaionsDetailsforSuperAdmin(userId);
        console.log(invitationDetails);

        let companyDetails;
        try {
          companyDetails = await user.getCompanyDetailsByUserId(userId);
        } catch (error) {
          companyDetails = [];
          logger.info(error);
        }

        const communityDetails = await community.getCommunityCount(userId);
        const storageDetails = await document.getStorageDetails(userId);
        const sourceWithNumber = await knex('documents')
          .select('source')
          .count('source as count')
          .select(knex.raw("SUM(CAST(REPLACE(size, ' kb', '') AS DECIMAL)) AS size"))
          .where({ creator: userId })
          .groupBy('source')
          .havingRaw('count > 0');

        let totalStorage;
        try {
          totalStorage = await document.getStorageOccupationDetail(companyDetails?.companyId);
        } catch (error) {
          logger.info(error);
          totalStorage = [];
        }
        const chatDetails = await chat.getChatHistoriesByUser(userId);
        const queryIds = chatDetails.map((query) => query.id);
        let tokenDetails = [];
        let queryDetails = [];
        let recordingDetails = {};
        const limit = await getAdminSetting('RECORDING_MONTHLY_LIMIT');
        const now = new Date();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const startFormatted = startOfCurrentMonth.toISOString().split('T')[0];
        const endFormatted = endOfCurrentMonth.toISOString().split('T')[0];

        let recordingCountData;
        try {
          recordingCountData = await knex('recordings_count')
            .select('*')
            .whereBetween('created', [startFormatted, endFormatted])
            .where({ companyId: companyDetails?.companyId });
        } catch (error) {
          logger.info(error);
          recordingCountData = [{ count: 0 }];
        }
        if (recordingCountData[0]) {
          recordingDetails = { count: recordingCountData[0].count, limit: Number(limit) };
        } else {
          const newRecordingData = await knex('recordings_count').insert({
            companyId: companyDetails?.companyId,
            count: 0,
            created: now,
          });
          recordingDetails = { count: 0, limit: Number(limit) };
        }

        const queryDetailsPromises = queryIds.map((chatId) => {
          return chat.getChatMessages(chatId).then((token) => {
            return token;
          });
        });

        await Promise.all(queryDetailsPromises)
          .then((query) => {
            queryDetails = query.flat();
          })
          .catch((error) => {
            logger.info(`Error fetching user query details:`, error);
            console.error('Error fetching user query details:', error);
          });

        const tokenDetailsPromises = queryIds.map((chatId) => {
          return user.getUserTokenDetails(chatId).then((token) => {
            return token;
          });
        });

        await Promise.all(tokenDetailsPromises)
          .then((tokens) => {
            tokenDetails = tokens.flat();
          })
          .catch((error) => {
            logger.info(`Error fetching user token details:`, error);
            console.error('Error fetching user token details:', error);
          });

        const getQueriesMonthToDate = (details) => {
          const currentDate = new Date();
          const itemsMonthToDate = details.filter((item) => {
            const itemDate = new Date(item.created);
            return (
              itemDate.getMonth() === currentDate.getMonth() &&
              itemDate.getFullYear() === currentDate.getFullYear()
            );
          });
          const countItemsMonthToDate = itemsMonthToDate.length;
          const result = Math.floor(countItemsMonthToDate / 2);
          return result;
        };

        const isQueriesMetaKeys = await user.checkMetaKeyExists(userId, 'queries');
        let currentQueriesCount = 0;
        if (isQueriesMetaKeys?.length != 0) {
          const userMetaQueryCount = await user.getUserMetaValue(userId, 'queries');
          currentQueriesCount += parseInt(userMetaQueryCount);
        } else {
          await user._addUserMeta(userId, 'queries', getQueriesMonthToDate(queryDetails));
          currentQueriesCount += getQueriesMonthToDate(queryDetails);
        }

        const statisticsDetails = {
          userDetails: res,
          companyDetails: companyDetails,
          communityDetails: communityDetails,
          subscriptionDetails: subscriptionDetails[0],
          invitationDetails: invitationDetails,
          storageDetails: storageDetails,
          totalStorage: totalStorage,
          queryDetails: queryDetails,
          currentQueriesCount: currentQueriesCount,
          tokenDetails: tokenDetails,
          recordingDetails: recordingDetails,
          sourceWithNumber: sourceWithNumber || [],
        };
        logger.info(`Statistics fetched successfully`);
        return response.status(200).send({
          success: true,
          clientStatistics: statisticsDetails,
        });
      })
      .catch((error) => {
        logger.warn(`Failed to fetch statistics details`);
        console.error(`Error fetching details: ${error}`);
        logger.debug(
          JSON.stringify({
            success: false,
            message: 'Error fetching details',
          })
        );
        return response.status(200).send({ success: false, message: 'Failed to fetch details' });
      });
  } else {
    logger.warn(`No details found`);
    return response.status(200).send({
      success: true,
      clientStatistics: [],
    });
  }
});

app.post('/get/company/statistics', auth.verifyToken, function (request, response) {
  const user = new Users(knex);
  const community = new Community(knex);
  const document = new Documents(knex);
  const chat = new Chat(knex);
  if (request.body.companyId) {
    logger.info(`Fetching user statistics`);
    user.getCompanyUserRole(request.body.companyId).then(async (userRole) => {
      const userIds = userRole.map((userId) => userId.userId);
      const companyDetails = await user.getCompanyDetails(request.body.companyId);
      const communityDetails = await community.getAllCommunityList(request.body.companyId);
      const storageDetails = await document.getStorageOccupationDetailWithDate(
        request.body.companyId
      );
      const totalStorage = await document.getStorageOccupationDetail(request.body.companyId);
      const sourceWithNumber = await knex('documents')
        .select('source')
        .count('source as count')
        .select(knex.raw("SUM(CAST(REPLACE(size, ' kb', '') AS DECIMAL)) AS size"))
        .where({ creator: request.decoded.userId })
        .groupBy('source')
        .havingRaw('count > 0');

      let userDetails = [];
      let tokenDetails = [];
      let queryDetails = [];
      let queryDetailsByUser = [];
      let recordingDetails = {};
      const userDetailsPromises = userIds.map((userId) => {
        return user.getUserDetailsById(userId).then(async (details) => {
          const chatDetails = await chat.getChatHistoriesByUser(userId);
          const queryIds = chatDetails.map((query) => query.id);

          const queryDetailsPromises = queryIds.map((chatId) => {
            return chat.getChatMessages(chatId).then((token) => {
              return token;
            });
          });

          await Promise.all(queryDetailsPromises)
            .then((query) => {
              queryDetails = query.flat();
              queryDetailsByUser.push({
                userId,
                queryDetails,
              });
            })
            .catch((error) => {
              logger.info(`Error fetching user query details:`, error);
              console.error('Error fetching user query details:', error);
            });

          const tokenDetailsPromises = queryIds.map((chatId) => {
            return user.getUserTokenDetails(chatId).then((token) => {
              return token;
            });
          });

          await Promise.all(tokenDetailsPromises)
            .then((tokens) => {
              tokenDetails = tokens.flat();
            })
            .catch((error) => {
              logger.info(`Error fetching user token details:`, error);
              console.error('Error fetching user token details:', error);
            });
          return details;
        });
      });

      await Promise.all(userDetailsPromises)
        .then((query) => {
          userDetails = query.flat();
        })
        .catch((error) => {
          logger.info(`Error fetching user query details:`, error);
          console.error('Error fetching user query details:', error);
        });

      const getQueriesMonthToDate = (details) => {
        const currentDate = new Date();
        const itemsMonthToDate = details?.filter((item) => {
          const itemDate = new Date(item.created);
          return (
            itemDate.getMonth() === currentDate.getMonth() &&
            itemDate.getFullYear() === currentDate.getFullYear()
          );
        });
        const countItemsMonthToDate = itemsMonthToDate.length;
        const result = Math.floor(countItemsMonthToDate / 2);
        return result;
      };

      let currentQueriesCount = 0;
      for (const item of queryDetailsByUser) {
        const isQueriesMetaKeys = await user.checkMetaKeyExists(item?.userId, 'queries');
        if (isQueriesMetaKeys?.length !== 0) {
          const userMetaQueryCount = await user.getUserMetaValue(item?.userId, 'queries');
          currentQueriesCount += parseInt(userMetaQueryCount);
        } else {
          await user._addUserMeta(
            item?.userId,
            'queries',
            getQueriesMonthToDate(item?.queryDetails)
          );
          currentQueriesCount += getQueriesMonthToDate(item?.queryDetails);
        }
      }

      const limit = await getAdminSetting('RECORDING_MONTHLY_LIMIT');
      const now = new Date();
      const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const startFormatted = startOfCurrentMonth.toISOString().split('T')[0];
      const endFormatted = endOfCurrentMonth.toISOString().split('T')[0];
      const recordingCountData = await knex('recordings_count')
        .select('*')
        .whereBetween('created', [startFormatted, endFormatted])
        .where({ companyId: request.body.companyId });
      if (recordingCountData[0]) {
        recordingDetails = { count: recordingCountData[0].count, limit: Number(limit) };
      } else {
        const newRecordingData = await knex('recordings_count').insert({
          companyId: request.body.companyId,
          count: 0,
          created: now,
        });
        recordingDetails = { count: 0, limit: Number(limit) };
      }

      // Fetching total count and size for each source in the community
      let communitySourceTotals = [];

      const communitySourcePromises = knex('documents')
        .select('source')
        .count('source as count')
        .select(knex.raw("SUM(CAST(REPLACE(size, ' kb', '') AS DECIMAL)) AS size"))
        .whereIn(
          'creator',
          userRole.map((user) => user.userId)
        )
        .groupBy('source')
        .havingRaw('count > 0');

      await communitySourcePromises
        .then((results) => {
          communitySourceTotals = results.map((row) => ({
            source: row.source,
            count: parseInt(row.count || 0),
            size: parseFloat(row.size || 0),
          }));
        })
        .catch((error) => {
          logger.info(`Error fetching community source totals:`, error);
          console.error('Error fetching community source totals:', error);
        });

      const statisticsDetails = {
        userDetails: userDetails,
        companyDetails: companyDetails,
        communityDetails: communityDetails,
        storageDetails: storageDetails,
        queryDetails: queryDetails,
        currentQueriesCount: currentQueriesCount,
        tokenDetails: tokenDetails,
        totalStorage: totalStorage,
        recordingDetails: recordingDetails,
        sourceWithNumber,
        communitySourceTotals,
      };
      logger.info(`Statistics fetched successfully`);
      return response.status(200).send({
        success: true,
        clientStatistics: statisticsDetails,
      });
    });
  } else {
    logger.warn(`No details found`);
    return response.status(200).send({
      success: true,
      clientStatistics: [],
    });
  }
});

app.post(
  '/super-admin/update-profile',
  auth.verifyToken,
  userAvatarUpload.single('image'),
  auth.userExists,
  auth.companyExist,
  function (request, response) {
    const user = new Users(knex);

    if (
      request.body.userId &&
      request.body.firstname &&
      request.body.lastname &&
      request.body.email &&
      request.body.countryCode &&
      request.body.mobileNumber &&
      request.body.companyId &&
      request.body.role
    ) {
      logger.info(`Updating profile for user Id ${sanitizeForLog(request.body.userId)} by admin`);
      if (request.file) {
        logger.info(`Update request include new profile picture`);
        logger.info(`Deleting old profile picture`);
        user.getUserMetaValue(request.body.userId, 'profilePic').then((oldImageName) => {
          if (oldImageName && oldImageName != 'default.png') {
            const filePath = `${process.env.BACKEND_PATH}/uploads/userAvatars/${oldImageName}`;
            fs.unlinkSync(filePath);
          }
        });
        logger.info(`Old profile picture deleted successfully`);
        user
          .adminUserUpdate(
            request.body.userId,
            request.body.firstname,
            request.body.lastname,
            request.body.email,
            request.body.countryCode,
            request.body.mobileNumber,
            request.fileName ? request.fileName : 'default.png',
            request.body.password
          )
          .then((res) => {
            if (res == 1) {
              logger.info(`Profile updated successfully by admin`);
              logger.info(`Updating user role`);
              user
                .adminRoleUpdateForUser(
                  request.body.userId,
                  request.body.companyId,
                  request.body.role
                )
                .then((res) => {
                  if (res == 1) {
                    logger.info(`User role updated successfully`);
                    logger.info(
                      `Fetching updated user details for user ${sanitizeForLog(request.body.userId)}`
                    );
                    user
                      .getUserDetailsById(request.body.userId)
                      .then((data) => {
                        logger.info(`Updated user data fetched successfully`);
                        let userData = data;
                        userData = { ...userData, role: request.body.role };

                        logger.debug(
                          JSON.stringify({
                            success: true,
                            message: request.t('adminAserProfileUpdateSuccess'),
                            userData,
                          })
                        );
                        return response.status(200).send({
                          success: true,
                          message: request.t('adminAserProfileUpdateSuccess'),
                          userData,
                        });
                      })
                      .catch((err) => {
                        console.log(err);
                        logger.warn(`Failed to fetch updated user details`);
                        logger.error(err);
                        logger.debug(
                          JSON.stringify({
                            success: true,
                            message: request.t('adminAserProfileUpdateSuccessFetchFailed'),
                            userData,
                          })
                        );
                        return response.status(200).send({
                          success: true,
                          message: request.t('adminAserProfileUpdateSuccessFetchFailed'),
                          userData,
                        });
                      });
                  } else {
                    logger.warn(`Failed to update role by admin`);
                    logger.debug(
                      JSON.stringify({
                        success: false,
                        message: request.t('adminAserProfileUpdateSuccessRoleFailed'),
                        userData,
                      })
                    );
                    return response.status(200).send({
                      success: false,
                      message: request.t('adminAserProfileUpdateSuccessRoleFailed'),
                      userData,
                    });
                  }
                })
                .catch((err) => {
                  console.log(err);
                  logger.warn(`Failed to update role by admin`);
                  logger.error(err);
                  logger.debug(
                    JSON.stringify({
                      success: false,
                      message: request.t('adminAserProfileUpdateSuccessRoleFailed'),
                      userData,
                    })
                  );
                  return response.status(200).send({
                    success: false,
                    message: request.t('adminAserProfileUpdateSuccessRoleFailed'),
                    userData,
                  });
                });
            } else {
              logger.warn(`Profile update by admin failed`);
              logger.debug(
                JSON.stringify({
                  success: false,
                  message: request.t('adminAserProfileUpdateFailed'),
                })
              );
              return response.status(200).send({
                success: false,
                message: request.t('adminAserProfileUpdateFailed'),
              });
            }
          })
          .catch((err) => {
            console.log(err);
            logger.warn(`Profile update by admin failed`);
            logger.error(err);
            logger.debug(
              JSON.stringify({
                success: false,
                message: request.t('adminAserProfileUpdateFailed'),
              })
            );
            return response.status(200).send({
              success: false,
              message: request.t('adminAserProfileUpdateFailed'),
            });
          });
      } else {
        logger.info(`Update request does not contain profile picture`);
        user
          .adminUserUpdate(
            request.body.userId,
            request.body.firstname,
            request.body.lastname,
            request.body.email,
            request.body.countryCode,
            request.body.mobileNumber,
            '',
            request.body.password
          )
          .then((res) => {
            if (res == 1) {
              logger.info(`Profile updated successfully by admin`);
              logger.info(`Updating user role`);
              user
                .adminRoleUpdateForUser(
                  request.body.userId,
                  request.body.companyId,
                  request.body.role
                )
                .then((res) => {
                  if (res == 1) {
                    logger.info(`User role updated successfully`);
                    logger.info(
                      `Fetching updated user details for user ${sanitizeForLog(request.body.userId)}`
                    );
                    user
                      .getUserDetailsById(request.body.userId)
                      .then((data) => {
                        logger.info(`Updated user data fetched successfully`);
                        let userData = data;
                        userData = { ...userData, role: request.body.role };

                        logger.debug(
                          JSON.stringify({
                            success: true,
                            message: request.t('adminAserProfileUpdateSuccess'),
                            userData,
                          })
                        );
                        return response.status(200).send({
                          success: true,
                          message: request.t('adminAserProfileUpdateSuccess'),
                          userData,
                        });
                      })
                      .catch((err) => {
                        console.log(err);
                        logger.warn(`Failed to fetch updated user details`);
                        logger.error(err);
                        logger.debug(
                          JSON.stringify({
                            success: true,
                            message: request.t('adminAserProfileUpdateSuccessFetchFailed'),
                            userData,
                          })
                        );
                        return response.status(200).send({
                          success: true,
                          message: request.t('adminAserProfileUpdateSuccessFetchFailed'),
                          userData,
                        });
                      });
                  } else {
                    logger.warn(`Failed to update role by admin`);
                    logger.debug(
                      JSON.stringify({
                        success: false,
                        message: request.t('adminAserProfileUpdateSuccessRoleFailed'),
                        userData,
                      })
                    );
                    return response.status(200).send({
                      success: false,
                      message: request.t('adminAserProfileUpdateSuccessRoleFailed'),
                      userData,
                    });
                  }
                })
                .catch((err) => {
                  console.log(err);
                  logger.warn(`Failed to update role by admin`);
                  logger.error(err);
                  logger.debug(
                    JSON.stringify({
                      success: false,
                      message: request.t('adminAserProfileUpdateSuccessRoleFailed'),
                      userData,
                    })
                  );
                  return response.status(200).send({
                    success: false,
                    message: request.t('adminAserProfileUpdateSuccessRoleFailed'),
                    userData,
                  });
                });
            } else {
              logger.warn(`Profile update by admin failed`);
              logger.debug(
                JSON.stringify({
                  success: false,
                  message: request.t('adminAserProfileUpdateFailed'),
                })
              );
              return response.status(200).send({
                success: false,
                message: request.t('adminAserProfileUpdateFailed'),
              });
            }
          })
          .catch((err) => {
            console.log(err);
            logger.warn(`Profile update by admin failed`);
            logger.error(err);
            logger.debug(
              JSON.stringify({
                success: false,
                message: request.t('adminAserProfileUpdateFailed'),
              })
            );
            return response.status(200).send({
              success: false,
              message: request.t('adminAserProfileUpdateFailed'),
            });
          });
      }
    } else {
      logger.debug(
        JSON.stringify({
          success: false,
          message: 'Missing parameters, fill all the required fields',
        })
      );
      return response.status(400).send({
        success: false,
        message: 'Missing parameters, fill all the required fields',
      });
    }
  }
);

app.post(
  '/super-admin/update-user-profile',
  auth.verifyToken,
  userAvatarUpload.single('image'),
  auth.userExists,
  function (request, response) {
    const user = new Users(knex);

    if (
      request.body.userId &&
      request.body.firstname &&
      request.body.lastname &&
      request.body.email &&
      request.body.countryCode &&
      request.body.mobileNumber &&
      request.body.companyId &&
      request.body.role
    ) {
      logger.info(`Updating profile for user Id ${sanitizeForLog(request.body.userId)} by admin`);
      if (request.file) {
        logger.info(`Update request include new profile picture`);
        logger.info(`Deleting old profile picture`);
        user.getUserMetaValue(request.body.userId, 'profilePic').then((oldImageName) => {
          if (oldImageName && oldImageName != 'default.png') {
            const filePath = `${process.env.BACKEND_PATH}/uploads/userAvatars/${oldImageName}`;
            fs.unlinkSync(filePath);
          }
        });
        logger.info(`Old profile picture deleted successfully`);
        user
          .superAdminUserUpdate(
            request.body.userId,
            request.body.firstname,
            request.body.lastname,
            request.body.email,
            request.body.countryCode,
            request.body.mobileNumber,
            request.fileName ? request.fileName : 'default.png',
            request.body.twoFactorAuth,
            request.body.password,
            request.body.userCloudIntegration,
            request.body.userCloudIntegrationMob,
            request.body.Dropbox,
            request.body.Dropbox_M,
            request.body.GoogleDrive,
            request.body.GoogleDrive_M,
            request.body.OneDrive,
            request.body.OneDrive_M,
            request.body.Slack,
            request.body.Slack_M,
            request.body.Wordpress,
            request.body.Wordpress_M
          )
          .then((res) => {
            if (res == 1) {
              logger.info(`Profile updated successfully by admin`);
              logger.info(`Updating user role`);
              user
                .adminRoleUpdateForUser(
                  request.body.userId,
                  request.body.companyId,
                  request.body.role
                )
                .then((res) => {
                  if (res == 1) {
                    logger.info(`User role updated successfully`);
                    logger.info(
                      `Fetching updated user details for user ${sanitizeForLog(request.body.userId)}`
                    );
                    user
                      .getUserDetailsById(request.body.userId)
                      .then((data) => {
                        logger.info(`Updated user data fetched successfully`);
                        let userData = data;
                        userData = { ...userData, role: request.body.role };

                        logger.debug(
                          JSON.stringify({
                            success: true,
                            message: request.t('adminAserProfileUpdateSuccess'),
                            userData,
                          })
                        );
                        return response.status(200).send({
                          success: true,
                          message: request.t('adminAserProfileUpdateSuccess'),
                          userData,
                        });
                      })
                      .catch((err) => {
                        console.log(err);
                        logger.warn(`Failed to fetch updated user details`);
                        logger.error(err);
                        logger.debug(
                          JSON.stringify({
                            success: true,
                            message: request.t('adminAserProfileUpdateSuccessFetchFailed'),
                            userData,
                          })
                        );
                        return response.status(200).send({
                          success: true,
                          message: request.t('adminAserProfileUpdateSuccessFetchFailed'),
                          userData,
                        });
                      });
                  } else {
                    logger.warn(`Failed to update role by admin`);
                    logger.debug(
                      JSON.stringify({
                        success: false,
                        message: request.t('adminAserProfileUpdateSuccessRoleFailed'),
                        userData,
                      })
                    );
                    return response.status(200).send({
                      success: false,
                      message: request.t('adminAserProfileUpdateSuccessRoleFailed'),
                      userData,
                    });
                  }
                })
                .catch((err) => {
                  console.log(err);
                  logger.warn(`Failed to update role by admin`);
                  logger.error(err);
                  logger.debug(
                    JSON.stringify({
                      success: false,
                      message: request.t('adminAserProfileUpdateSuccessRoleFailed'),
                      userData,
                    })
                  );
                  return response.status(200).send({
                    success: false,
                    message: request.t('adminAserProfileUpdateSuccessRoleFailed'),
                    userData,
                  });
                });
            } else {
              logger.warn(`Profile update by admin failed`);
              logger.debug(
                JSON.stringify({
                  success: false,
                  message: request.t('adminAserProfileUpdateFailed'),
                })
              );
              return response.status(200).send({
                success: false,
                message: request.t('adminAserProfileUpdateFailed'),
              });
            }
          })
          .catch((err) => {
            console.log(err);
            logger.warn(`Profile update by admin failed`);
            logger.error(err);
            logger.debug(
              JSON.stringify({
                success: false,
                message: request.t('adminAserProfileUpdateFailed'),
              })
            );
            return response.status(200).send({
              success: false,
              message: request.t('adminAserProfileUpdateFailed'),
            });
          });
      } else {
        logger.info(`Update request does not contain profile picture`);
        user
          .superAdminUserUpdate(
            request.body.userId,
            request.body.firstname,
            request.body.lastname,
            request.body.email,
            request.body.countryCode,
            request.body.mobileNumber,
            '',
            request.body.twoFactorAuth,
            request.body.password,
            request.body.userCloudIntegration,
            request.body.userCloudIntegrationMob,
            request.body.Dropbox,
            request.body.Dropbox_M,
            request.body.GoogleDrive,
            request.body.GoogleDrive_M,
            request.body.OneDrive,
            request.body.OneDrive_M,
            request.body.Slack,
            request.body.Slack_M,
            request.body.Wordpress,
            request.body.Wordpress_M
          )
          .then((res) => {
            if (res == 1) {
              logger.info(`Profile updated successfully by admin`);
              logger.info(`Updating user role`);
              user
                .adminRoleUpdateForUser(
                  request.body.userId,
                  request.body.companyId,
                  request.body.role
                )
                .then((res) => {
                  if (res == 1) {
                    logger.info(`User role updated successfully`);
                    logger.info(
                      `Fetching updated user details for user ${sanitizeForLog(request.body.userId)}`
                    );
                    user
                      .getUserDetailsById(request.body.userId)
                      .then((data) => {
                        logger.info(`Updated user data fetched successfully`);
                        let userData = data;
                        userData = { ...userData, role: request.body.role };

                        logger.debug(
                          JSON.stringify({
                            success: true,
                            message: request.t('adminAserProfileUpdateSuccess'),
                            userData,
                          })
                        );
                        return response.status(200).send({
                          success: true,
                          message: request.t('adminAserProfileUpdateSuccess'),
                          userData,
                        });
                      })
                      .catch((err) => {
                        console.log(err);
                        logger.warn(`Failed to fetch updated user details`);
                        logger.error(err);
                        logger.debug(
                          JSON.stringify({
                            success: true,
                            message: request.t('adminAserProfileUpdateSuccessFetchFailed'),
                            userData,
                          })
                        );
                        return response.status(200).send({
                          success: true,
                          message: request.t('adminAserProfileUpdateSuccessFetchFailed'),
                          userData,
                        });
                      });
                  } else {
                    logger.warn(`Failed to update role by admin`);
                    logger.debug(
                      JSON.stringify({
                        success: false,
                        message: request.t('adminAserProfileUpdateSuccessRoleFailed'),
                        userData,
                      })
                    );
                    return response.status(200).send({
                      success: false,
                      message: request.t('adminAserProfileUpdateSuccessRoleFailed'),
                      userData,
                    });
                  }
                })
                .catch((err) => {
                  console.log(err);
                  logger.warn(`Failed to update role by admin`);
                  logger.error(err);
                  logger.debug(
                    JSON.stringify({
                      success: false,
                      message: request.t('adminAserProfileUpdateSuccessRoleFailed'),
                      userData,
                    })
                  );
                  return response.status(200).send({
                    success: false,
                    message: request.t('adminAserProfileUpdateSuccessRoleFailed'),
                    userData,
                  });
                });
            } else {
              logger.warn(`Profile update by admin failed`);
              logger.debug(
                JSON.stringify({
                  success: false,
                  message: request.t('adminAserProfileUpdateFailed'),
                })
              );
              return response.status(200).send({
                success: false,
                message: request.t('adminAserProfileUpdateFailed'),
              });
            }
          })
          .catch((err) => {
            console.log(err);
            logger.warn(`Profile update by admin failed`);
            logger.error(err);
            logger.debug(
              JSON.stringify({
                success: false,
                message: request.t('adminAserProfileUpdateFailed'),
              })
            );
            return response.status(200).send({
              success: false,
              message: request.t('adminAserProfileUpdateFailed'),
            });
          });
      }
    } else {
      logger.debug(
        JSON.stringify({
          success: false,
          message: 'Missing parameters, fill all the required fields',
        })
      );
      return response.status(400).send({
        success: false,
        message: 'Missing parameters, fill all the required fields',
      });
    }
  }
);

app.post(
  '/super-admin/company/update-profile',
  auth.verifyToken,
  auth.superAdminAccess,
  companyLogoUpload.single('image'),
  auth.companyExist,
  function (request, response) {
    const user = new Users(knex);
    if (
      request.body.companytwoFactorAuth &&
      request.body.companyId &&
      request.body.phoneNumberCountryCode &&
      request.body.phoneNumber &&
      request.body.companyName &&
      request.body.orgType &&
      request.body.mailingAddStreetName &&
      request.body.mailingAddCountryName &&
      request.body.mailingAddCityName &&
      request.body.mailingAddStateName &&
      request.body.mailingAddZip &&
      request.body.billingAddStreetName &&
      request.body.billingAddCountryName &&
      request.body.billingAddCityName &&
      request.body.billingAddStateName &&
      request.body.billingAddZip &&
      request.body.isMailAndBillAddressSame
    ) {
      logger.info(`Updating company profile for id ${sanitizeForLog(request.body.companyId)}`);
      if (request.file) {
        logger.info(`Update request contain company profile picture`);
        logger.info(`Deleting old profile picture`);
        user.getCompanyMetaValue(request.body.companyId, 'companyLogo').then((oldImageName) => {
          if (oldImageName && oldImageName != 'default.png') {
            const filePath = `${process.env.BACKEND_PATH}/uploads/companyLogos/${oldImageName}`;
            fs.unlinkSync(filePath);
          }
        });
        logger.info(`Old profile picture deleted successfully`);
        user
          .updateCompany2(
            request.body.companytwoFactorAuth,
            request.body.companyId,
            request.body.phoneNumber,
            request.body.phoneNumberCountryCode,
            request.body.companyName,
            request.body.orgType,
            request.body.mailingAddStreetName,
            request.body.mailingAddCountryName,
            request.body.mailingAddCityName,
            request.body.mailingAddStateName,
            request.body.mailingAddZip,
            request.body.billingAddStreetName,
            request.body.billingAddCountryName,
            request.body.billingAddCityName,
            request.body.billingAddStateName,
            request.body.billingAddZip,
            request.body.isMailAndBillAddressSame,
            request.fileName ? request.fileName : 'default.png',
            request.body.userCloudIntegration,
            request.body.userCloudIntegrationMob,
            request.body.Dropbox,
            request.body.Dropbox_M,
            request.body.GoogleDrive,
            request.body.GoogleDrive_M,
            request.body.OneDrive,
            request.body.OneDrive_M,
            request.body.Slack,
            request.body.Slack_M,
            request.body.Wordpress,
            request.body.Wordpress_M
          )
          .then((res) => {
            if (res == 1) {
              logger.info(`Company profile updated successfully`);
              logger.info(`Fetching updated company details`);
              user.getCompanyDetails(request.body.companyId).then((data) => {
                logger.info(`Updated company details fetched successfully`);
                let companyData = data;

                logger.debug(
                  JSON.stringify({
                    success: true,
                    message: request.t('companyProfileUpdateSuccess'),
                    companyData,
                  })
                );
                return response.status(200).send({
                  success: true,
                  message: request.t('companyProfileUpdateSuccess'),
                  companyData,
                });
              });
            } else {
              logger.warn(`Company profile update failed `);
              logger.debug(
                JSON.stringify({
                  success: false,
                  message: request.t('companyProfileUpdateFailed'),
                })
              );
              return response.status(200).send({
                success: false,
                message: request.t('companyProfileUpdateFailed'),
              });
            }
          })
          .catch((err) => {
            logger.warn(`Company profile update failed `);
            logger.error(err);
            console.log(err);
            logger.debug(
              JSON.stringify({
                success: false,
                message: request.t('companyProfileUpdateFailed'),
              })
            );
            return response.status(200).send({
              success: false,
              message: request.t('companyProfileUpdateFailed'),
            });
          });
      } else {
        logger.info(`Update request does not contain profile picture`);
        user
          .updateCompany2(
            request.body.companytwoFactorAuth,
            request.body.companyId,
            request.body.phoneNumber,
            request.body.phoneNumberCountryCode,
            request.body.companyName,
            request.body.orgType,
            request.body.mailingAddStreetName,
            request.body.mailingAddCountryName,
            request.body.mailingAddCityName,
            request.body.mailingAddStateName,
            request.body.mailingAddZip,
            request.body.billingAddStreetName,
            request.body.billingAddCountryName,
            request.body.billingAddCityName,
            request.body.billingAddStateName,
            request.body.billingAddZip,
            request.body.isMailAndBillAddressSame,
            '',
            request.body.userCloudIntegration,
            request.body.userCloudIntegrationMob,
            request.body.Dropbox,
            request.body.Dropbox_M,
            request.body.GoogleDrive,
            request.body.GoogleDrive_M,
            request.body.OneDrive,
            request.body.OneDrive_M,
            request.body.Slack,
            request.body.Slack_M,
            request.body.Wordpress,
            request.body.Wordpress_M
          )
          .then((res) => {
            if (res == 1) {
              logger.info(`Company profile updated successfully`);
              logger.info(`Fetching updated company details`);
              user.getCompanyDetails(request.body.companyId).then((data) => {
                logger.info(`Updated company details fetched successfully`);
                let companyData = data;

                logger.debug(
                  JSON.stringify({
                    success: true,
                    message: request.t('companyProfileUpdateSuccess'),
                    companyData,
                  })
                );
                return response.status(200).send({
                  success: true,
                  message: request.t('companyProfileUpdateSuccess'),
                  companyData,
                });
              });
            } else {
              logger.warn(`Company profile update failed `);
              logger.debug(
                JSON.stringify({
                  success: false,
                  message: request.t('companyProfileUpdateFailed'),
                })
              );
              return response.status(200).send({
                success: false,
                message: request.t('companyProfileUpdateFailed'),
              });
            }
          })
          .catch((err) => {
            console.log(err);
            logger.warn(`Company profile update failed `);
            logger.error(err);
            logger.debug(
              JSON.stringify({
                success: false,
                message: request.t('companyProfileUpdateFailed'),
              })
            );
            return response.status(200).send({
              success: false,
              message: request.t('companyProfileUpdateFailed'),
            });
          });
      }
    } else {
      logger.debug(
        JSON.stringify({
          success: false,
          message: 'Missing parameters, fill all the required fields',
        })
      );
      return response.status(400).send({
        success: false,
        message: 'Missing parameters, fill all the required fields',
      });
    }
  }
);

app.post(
  '/super-admin/update-super-profile',
  userAvatarUpload.single('image'),
  function (request, response) {
    const user = new Users(knex);

    if (
      request.body.userId &&
      request.body.firstname &&
      request.body.lastname &&
      request.body.email &&
      request.body.countryCode &&
      request.body.mobileNumber
    ) {
      logger.info(`Updating profile for user Id ${sanitizeForLog(request.body.userId)} by admin`);
      if (request.file) {
        logger.info(`Update request include new profile picture`);
        logger.info(`Deleting old profile picture`);
        user.getUserMetaValue(request.body.userId, 'profilePic').then((oldImageName) => {
          if (oldImageName && oldImageName != 'default.png') {
            const filePath = `${process.env.BACKEND_PATH}/uploads/userAvatars/${oldImageName}`;
            fs.unlinkSync(filePath);
          }
        });
        logger.info(`Old profile picture deleted successfully`);
        user
          .adminUserUpdate(
            request.body.userId,
            request.body.firstname,
            request.body.lastname,
            request.body.email,
            request.body.countryCode,
            request.body.mobileNumber,
            request.fileName ? request.fileName : 'default.png'
          )
          .then((res) => {
            if (res == 1) {
              logger.info(`Profile updated successfully by admin`);
              logger.info(`Updating user role`);
              logger.debug(
                JSON.stringify({
                  success: true,
                  message: request.t('adminAserProfileUpdateSuccess'),
                })
              );
              return response.status(200).send({
                success: true,
                message: request.t('adminAserProfileUpdateSuccess'),
              });
            } else {
              logger.warn(`Profile update by admin failed`);
              logger.debug(
                JSON.stringify({
                  success: false,
                  message: request.t('adminAserProfileUpdateFailed'),
                })
              );
              return response.status(200).send({
                success: false,
                message: request.t('adminAserProfileUpdateFailed'),
              });
            }
          })
          .catch((err) => {
            console.log(err);
            logger.warn(`Profile update by admin failed`);
            logger.error(err);
            logger.debug(
              JSON.stringify({
                success: false,
                message: request.t('adminAserProfileUpdateFailed'),
              })
            );
            return response.status(200).send({
              success: false,
              message: request.t('adminAserProfileUpdateFailed'),
            });
          });
      } else {
        logger.info(`Update request does not contain profile picture`);
        user
          .adminUserUpdate(
            request.body.userId,
            request.body.firstname,
            request.body.lastname,
            request.body.email,
            request.body.countryCode,
            request.body.mobileNumber,
            ''
          )
          .then((res) => {
            if (res == 1) {
              logger.info(`Profile updated successfully by admin`);
              logger.info(`Updating user role`);
              logger.debug(
                JSON.stringify({
                  success: true,
                  message: request.t('adminAserProfileUpdateSuccess'),
                })
              );
              return response.status(200).send({
                success: true,
                message: request.t('adminAserProfileUpdateSuccess'),
              });
            } else {
              logger.warn(`Profile update by admin failed`);
              logger.debug(
                JSON.stringify({
                  success: false,
                  message: request.t('adminAserProfileUpdateFailed'),
                })
              );
              return response.status(200).send({
                success: false,
                message: request.t('adminAserProfileUpdateFailed'),
              });
            }
          })
          .catch((err) => {
            console.log(err);
            logger.warn(`Profile update by admin failed`);
            logger.error(err);
            logger.debug(
              JSON.stringify({
                success: false,
                message: request.t('adminAserProfileUpdateFailed'),
              })
            );
            return response.status(200).send({
              success: false,
              message: request.t('adminAserProfileUpdateFailed'),
            });
          });
      }
    } else {
      logger.debug(
        JSON.stringify({
          success: false,
          message: 'Missing parameters, fill all the required fields',
        })
      );
      return response.status(400).send({
        success: false,
        message: 'Missing parameters, fill all the required fields',
      });
    }
  }
);

app.post('/super-admin/delete-user-data', async function (request, response) {
  const { userId, companyId, role } = request.body;

  if (userId && companyId && role) {
    try {
      const userCountWithRole1 = await knex('user_company_role_relationship')
        .count('*')
        .where({ company: companyId, role: 1 })
        .first();

      if (userCountWithRole1.count == 1) {
        return response.status(200).send({
          success: false,
          message: "Do not delete. There's only one Administrator.",
        });
      }
      switch (role) {
        case 1:
          await knex.transaction(async (trx) => {
            await trx('tokens_used')
              .whereIn('chatId', knex('chat_histories').select('id').where({ userId }))
              .del();
            await trx('chat_histories').where({ userId }).del();

            const newUserIdObject = await trx('user_company_role_relationship')
              .select('userId')
              .where({ company: companyId, role: 1 })
              .whereNot({ userId })
              .first();

            if (!newUserIdObject) {
              return response.status(200).send({
                success: false,
                message: "Do not delete. There's only one Administrator.",
              });
            }

            const newUserId = newUserIdObject.userId;
            const currentCommunityIdObject = await trx('communities')
              .select('id')
              .where({ creator: userId, companyId: companyId })
              .first();

            if (!currentCommunityIdObject) {
              console.log('Error finding current communityId with user Id.');
            } else {
              const currentCommunityId = currentCommunityIdObject.id;

              await Promise.all([
                await trx('communities').where({ creator: userId }).update({ creator: newUserId }),
              ]);

              const newCommunitiesIdObject = await trx('communities')
                .select('id')
                .where({ creator: newUserId, companyId: companyId })
                .first();

              if (!newCommunitiesIdObject) {
                console.log('Error finding current communityId with new user Id.');
              } else {
                const newCommunitiesId = newCommunitiesIdObject.id;

                await Promise.all([
                  trx('documents')
                    .where({ communityId: currentCommunityId })
                    .update({ communityId: newCommunitiesId }),
                ]);
              }
            }

            await Promise.all([
              trx('invitations').where({ sender: userId }).update({ sender: newUserId }),
              trx('subscriptions').where({ userId }).update({ userId: newUserId }),
            ]);

            await trx('users').where({ id: userId }).del();
            await trx('user_company_role_relationship').where({ userId }).del();

            return response.status(200).send({
              success: true,
              message: 'User and related data deleted successfully.',
            });
          });
          break;
        case 2:
          await knex.transaction(async (trx) => {
            await trx('tokens_used')
              .whereIn('chatId', knex('chat_histories').select('id').where({ userId }))
              .del();
            await trx('chat_histories').where({ userId }).del();
            await trx('users').where({ id: userId }).del();
            await trx('user_company_role_relationship').where({ userId }).del();

            return response.status(200).send({
              success: true,
              message: 'User and related data deleted successfully.',
            });
          });
          break;
        case 3:
          await knex.transaction(async (trx) => {
            await trx('chat_histories').where({ userId }).del();
            await trx('tokens_used')
              .whereIn('chatId', knex('chat_histories').select('id').where({ userId }))
              .del();
            await trx('users').where({ id: userId }).del();
            await trx('user_company_role_relationship').where({ userId }).del();

            return response.status(200).send({
              success: true,
              message: 'User and related data deleted successfully.',
            });
          });
          break;
        default:
          return response.status(200).send({ success: false, message: 'Invalid role specified.' });
      }
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  } else {
    console.log('User does not have the required role.');
    return response.status(200).send({
      success: false,
      message: 'User does not have the required role.',
    });
  }
});

app.post('/last-month-data', function (request, response) {
  const {
    statId,
    name,
    plan,
    numberofCollections,
    numberofUsers,
    storageUsed,
    numberofQueries,
    monthName,
    year,
  } = request.body;
  const dateTime = new Date();

  knex('lastmonthusage')
    .where({ monthName, year, statId })
    .then((existingData) => {
      if (existingData.length === 0) {
        return knex('lastmonthusage')
          .insert({
            statId,
            name,
            plan,
            numberofCollections,
            numberofUsers: plan == 'solo' ? '' : numberofUsers,
            storageUsed,
            numberofQueries,
            monthName,
            year,
            created: dateTime,
          })
          .then(() => {
            logger.info({ message: 'Data insertion completed' });
          })
          .catch((error) => {
            logger.info({ error: 'Internal Server Error', error: error });
          });
      } else {
        console.log('Data already exists.');
      }
    })
    .catch((error) => {
      logger.error('Error checking data:', error);
    });
});

app.post('/get-last-month-data', function (request, response) {
  if (request.body.companyId) {
    knex('lastmonthusage')
      .select('*')
      .where({ statId: request.body.companyId })
      .then((res) => {
        logger.info('Usage Data Fetched Successfully');
        return response.status(200).send({
          success: true,
          res,
        });
      })
      .catch((error) => {
        logger.info('Internal Server Error', error);
      });
  } else {
    logger.info('Usage Data Fetched Failed');
    return response.status(200).send({
      success: false,
      message: 'No details found',
    });
  }
});

app.post('/user/support-query', auth.verifyToken, async function (request, response) {
  const { userId, query } = request.body;
});

app.post(
  '/file-manager/upload-audio-file',
  auth.verifyToken,
  auth.checkForDuplicateFile,
  auth.onlyAdminOrUser,
  auth.isMemberOfCommunityOrSharedMemberV2,
  audioUpload.single('file'),
  async function (request, response) {
    const community = new Community(knex);
    const documents = new Documents(knex);

    const storageDetails = await documents.getStorageOccupationDetail(request.decoded.company);
    function convertToKilobytes(formattedSize) {
      const sizes = ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
      const [value, unit] = formattedSize.split(' ');
      const index = sizes.indexOf(unit);

      return parseFloat(value) * Math.pow(1000, index);
    }
    const usedStorage = convertToKilobytes(storageDetails) || 0;
    const maxStorage = parseFloat(process.env.MAX_STORAGE * 1024 * 1024);

    if (usedStorage <= maxStorage) {
      if (request.file) {
        if (fs.existsSync(request.filePath + '/' + request.fileFullName)) {
          try {
            response.write('1&%&Generating Summary of the file...$');
            const { summary } = await audioSummary(request.file.filename);

            const txtContent = summary;
            const txtFilePath = path.join(
              request.filePath,
              `${request.fileFullName.replace('.wav', '')}.txt`
            );
            fs.writeFileSync(txtFilePath, txtContent);

            const wavId = parseInt(request.fileFullName.replace('.wav', ''));
            const wavFileName = request.query.fileName.replace('.wav', '.txt');

            if (process.env.GOOGLE_CLOUD_STORAGE == 1) {
              try {
                logger.info(
                  `Uploading file on cloud: FileName: ${wavFileName} FileId: ${sanitizeForLog(request.fileName[0])}`
                );
                await storage.bucket(process.env.GOOGLE_STORAGE_BUCKET_NAME).upload(txtFilePath, {
                  destination: `${request.fileFullName.replace('.wav', '')}.txt`,
                });
                logger.info('Successfully uploaded file on cloud');
              } catch (error) {
                logger.error('Error uploading file on cloud');
                logger.error(error);
                return response.status(500).json({
                  message: 'Error uploading file on cloud',
                });
              }
            }

            let communityId;
            let notesId;

            let userID;
            let userEmail;
            try {
              await knex('documents')
                .select('communityId')
                .where({ id: wavId })
                .then((res) => (communityId = res[0]?.communityId));

              const fileStat = await fs2.stat(txtFilePath);

              await knex('documents')
                .where({ id: wavId })
                .update({
                  name: wavFileName,
                  parentId: request.query.parentId,
                  isNotAnalyzed: false,
                  size: (fileStat.size / 1000).toFixed(2) + ' kb',
                  creator: request.decoded.userId,
                });

              const company = await knex('communities')
                .select('companyId')
                .where({ id: communityId });
              const now = new Date();
              const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
              const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
              const startFormatted = startOfCurrentMonth.toISOString().split('T')[0];
              const endFormatted = endOfCurrentMonth.toISOString().split('T')[0];
              await knex('recordings_count')
                .whereBetween('created', [startFormatted, endFormatted])
                .andWhere({ companyId: company[0].companyId })
                .increment('count', 1);

              await knex('communities')
                .select('creator')
                .where({ id: request.query.communityId })
                .then((res) => (userID = res[0]?.creator));

              await knex('users')
                .select('email')
                .where({ id: userID })
                .then((res) => (userEmail = res[0]?.email));
            } catch (error) {
              logger.error('Error updating document');
              logger.error(error);
            }

            if (summary.length > 0) {
              const dateTime = new Date();
              await knex('summary')
                .where({
                  fileId: request.fileName[0],
                  fileName: request.query.fileName,
                  communityId: request.query.communityId,
                })
                .then((existingData) => {
                  if (existingData.length === 0) {
                    return knex('summary')
                      .insert({
                        fileId: request.fileName[0],
                        communityId: request.query.communityId,
                        fileName: request.query.fileName,
                        notes: summary,
                        overview: '',
                        created: dateTime,
                      })
                      .then(() => {
                        logger.info({ message: 'Summary insertion completed' });
                        response.write('1&%&Summary of the file generated successfully...$');
                      })
                      .catch((error) => {
                        logger.info({
                          error: 'Internal Server Error',
                          error: error,
                        });
                      });
                  } else {
                    console.log('Data already exists.');
                  }
                })
                .catch((error) => {
                  logger.error('Error checking data:', error);
                });

              const docs = await documents.createDocumentFromText(
                txtFilePath,
                request.fileName[0],
                wavFileName
              );
              community
                .getCommunityUUID(request.query.communityId)
                .then((uuid) => {
                  documents
                    .createAndStoreEmbeddingsOnIndex(
                      docs,
                      uuid,
                      request.fileName[0],
                      request.originalname.split('.').pop()
                    )
                    .then(async (resp) => {
                      fs.unlinkSync(path.resolve(request.filePath + '/' + request.fileFullName));
                      if (process.env.GOOGLE_CLOUD_STORAGE == 1) {
                        await fs2.unlink(txtFilePath);
                      }
                      logger.info(`Embeddings created and stored on vector database`);
                      return response.status(200).send('1&%&File uploaded successfully$');
                    })
                    .catch((err) => {
                      console.log(err);
                      logger.warn(`Failed to create embeddings`);
                      logger.error(err);
                      response.write('0&%&File uploaded successfully, Failed to analyze the file$');
                      response.end();
                    });
                })
                .catch((err) => {
                  console.log(err);
                  logger.warn(`Failed to create embeddings`);
                  logger.error(err);
                  response.write('0&%&File uploaded successfully, Failed to analyze the file$');
                  response.end();
                });
            } else {
              return response.status(200).send('1&%&File uploaded successfully$');
            }
          } catch (err) {
            console.error('Error during transcription:', err);
            return response.status(200).send('0&%&File uploaded successfully$');
          }
        } else {
          logger.warn(`File upload failed`);
          response.write('0&%&File upload failed, Failed to analyze the file$');
          response.end();
        }
      } else {
        logger.error(`File upload failed! No File`);
      }
    } else {
      await fs2.unlink(path.join(request.filePath, request.fileFullName));
      logger.info(
        `You have reached maximum storage capacity ${sanitizeForLog(request.fileFullName)}`
      );
      await knex('documents').where('id', request.fileName[0]).del();
      return response.status(200).send('0&%&You have reached maximum storage capacity$');
    }
  }
);

app.post(
  '/file-manager/get-recording-limit',
  auth.verifyToken,
  auth.communityExists,
  auth.isMemberOfCommunityOrSharedMember,
  async function (request, response) {
    try {
      if (request.body.communityId) {
        const company = await knex('communities')
          .select('companyId')
          .where({ id: request.body.communityId });
        console.log(company[0]);
        const limit = await getAdminSetting('RECORDING_MONTHLY_LIMIT');
        if (company[0]) {
          const now = new Date();
          const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          const startFormatted = startOfCurrentMonth.toISOString().split('T')[0];
          const endFormatted = endOfCurrentMonth.toISOString().split('T')[0];
          const recordingCountData = await knex('recordings_count')
            .select('*')
            .where({ companyId: company[0].companyId })
            .whereBetween('created', [startFormatted, endFormatted]);
          if (recordingCountData[0]) {
            return response
              .status(200)
              .json({ count: recordingCountData[0].count, limit: Number(limit) });
          } else {
            const newRecordingData = await knex('recordings_count').insert({
              companyId: company[0].companyId,
              count: 0,
              created: now,
            });
            return response.status(200).json({ count: 0, limit: Number(limit) });
          }
        } else {
          return response.status(500).json({ message: 'Company Not Found' });
        }
      } else {
        return response.status(500).json({ message: 'Fill All Details' });
      }
    } catch (e) {
      console.log(e);
      return response.status(500).json({ message: 'Internal server error' });
    }
  }
);

app.post('/get-recording-count', auth.verifyToken, async function (request, response) {
  try {
    const date = new Date(request.body.date);
    const startOfCurrentMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfCurrentMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const startFormatted = startOfCurrentMonth.toISOString().split('T')[0];
    const endFormatted = endOfCurrentMonth.toISOString().split('T')[0];
    const count = await knex('recordings_count')
      .select('count')
      .whereBetween('created', [startFormatted, endFormatted])
      .where({ companyId: request.body.companyId });
    if (count[0]) {
      return response.status(200).json({ count: count[0].count });
    }
    return response.status(200).json({ count: 0 });
  } catch (e) {
    return response.status(500).json({ message: 'Internal server error' });
  }
});

app.post(
  '/summarize-document',
  auth.verifyToken,
  auth.communityExists,
  auth.isMemberOfCommunityOrSharedMember,
  auth.isValidFileM2,
  auth.isValidFileExtension,
  function (request, response) {
    const documents = new Documents(knex);

    if (request.body.fileId && request.body.communityId && request.body.fileType) {
      logger.info(`Fetching buffer for file Id ${sanitizeForLog(request.body.fileId)}`);
      documents
        .getDocumentPath(request.body.fileId, request.body.communityId)
        .then(async (res) => {
          if (res == 'file-not-found') {
            logger.warn(`File ${sanitizeForLog(request.body.fileId)} does not exist`);
            logger.debug(
              JSON.stringify({
                success: false,
                message: request.t('fileNotFound'),
              })
            );
            return response
              .status(201)
              .send({ success: false, message: request.t('fileNotFound') });
          } else {
            logger.info(`File ${sanitizeForLog(request.body.fileId)} exists`);

            let userId;
            await knex('communities')
              .select('creator')
              .where({ id: request.body.communityId })
              .then((res) => (userId = res[0]?.creator));

            let originalName;
            await knex('documents')
              .select('name')
              .where({ id: request.body.fileId })
              .then((res) => (originalName = res[0]?.name));

            const summary = await summarizer(res, request.body.fileId, originalName, userId);

            if (summary.success === true) {
              const dateTime = new Date();
              await knex('summary')
                .where({
                  fileId: request.body.fileId,
                  fileName: originalName,
                  communityId: request.body.communityId,
                })
                .then((existingData) => {
                  if (existingData.length === 0) {
                    return knex('summary')
                      .insert({
                        fileId: request.body.fileId,
                        communityId: request.body.communityId,
                        fileName: originalName,
                        notes: summary.outputText,
                        overview: summary.overviewOutputText,
                        created: dateTime,
                      })
                      .then(() => {
                        logger.info({ message: 'Summary insertion completed' });
                      })
                      .catch((error) => {
                        logger.info({
                          error: 'Internal Server Error',
                          error: error,
                        });
                      });
                  } else {
                    console.log('Data already exists.');
                  }
                })
                .catch((error) => {
                  logger.error('Error checking data:', error);
                });
            }
            return response.status(200).send({ success: true, message: summary });
          }
        })
        .catch((err) => {
          logger.warn(`Failed to fetch buffer file Id ${sanitizeForLog(request.body.fileId)}`);
          logger.error(err);
          logger.debug(
            JSON.stringify({
              success: false,
              message: request.t('documentFetchFailed'),
            })
          );
          return response.status(201).send({
            success: false,
            message: request.t('documentFetchFailed'),
          });
        });
    } else {
      logger.debug(
        JSON.stringify({
          success: false,
          message: 'Missing parameters, fill all the required fields',
        })
      );
      return response.status(400).send({
        success: false,
        message: 'Missing parameters, fill all the required fields',
      });
    }
  }
);

app.post('/get-summary-data', function (request, response) {
  if (request.body.fileId) {
    knex('summary')
      .select('*')
      .where({ fileId: request.body.fileId })
      .then((res) => {
        logger.info('Usage Data Fetched Successfully');
        if (res?.length > 0) {
          return response.status(200).send({
            success: true,
            res: res[0],
          });
        } else {
          return response.status(200).send({
            success: false,
            res: 'No data',
          });
        }
      })
      .catch((error) => {
        logger.info('Internal Server Error', error);
      });
  } else {
    logger.info('Usage Data Fetched Failed');
    return response.status(200).send({
      success: false,
      message: 'No details found',
    });
  }
});

app.post(
  '/update-summary-filename',
  auth.verifyToken,
  auth.isMemberOfCommunityOrFileCreatorOfSharedCollection,
  async function (request, response) {
    if (
      request.body.fileId &&
      request.body.fileName &&
      request.body.parentId &&
      request.body.communityId
    ) {
      logger.info(`Changing summary file name for ${sanitizeForLog(request.body.fileId)}`);
      logger.info(`Update database information for fileId ${sanitizeForLog(request.body.fileId)}`);
      const dateTime = new Date();
      await knex('documents')
        .update({
          name: request.body.fileName,
        })
        .where({ id: request.body.fileId })
        .then(async (res) => {
          await knex('summary')
            .update({
              fileName: request.body.fileName,
              created: dateTime,
            })
            .where({ fileId: request.body.fileId })
            .then((res) => {
              if (res == 1) {
                logger.info(`Filename updated successfully`);
                logger.debug(
                  JSON.stringify({
                    success: true,
                    message: 'Filename updated successfully',
                  })
                );
                return response.status(200).send({
                  success: true,
                  message: 'Filename updated successfully',
                });
              } else {
                logger.warn(`Failed to update the filename`);
                logger.debug(
                  JSON.stringify({
                    success: false,
                    message: 'Failed to update the filename',
                  })
                );
                return response.status(200).send({
                  success: false,
                  message: 'Failed to update the filename',
                });
              }
            })
            .catch((err) => {
              console.log(err);
              logger.warn(`Failed to update the filename`);
              logger.error(err);
              logger.debug(
                JSON.stringify({
                  success: false,
                  message: 'Failed to update the filename',
                })
              );
              return response.status(200).send({
                success: false,
                message: 'Failed to update the filename',
              });
            });
        })
        .catch((err) => {
          console.log(err);
          logger.warn(`Failed to update the filename in documents table`);
          logger.error(err);
          logger.debug(
            JSON.stringify({
              success: false,
              message: 'Failed to update the filename',
            })
          );
          return response
            .status(200)
            .send({ success: false, message: 'Failed to update the filename' });
        });
    } else {
      logger.debug(
        JSON.stringify({
          success: false,
          message: 'Missing parameters, fill all the required fields',
        })
      );
      return response.status(400).send({
        success: false,
        message: 'Missing parameters, fill all the required fields',
      });
    }
  }
);

const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUI = require('swagger-ui-express');
const opt = require('./docs.json');

const swaggerOptions = {
  swaggerDefinition: opt,
  apis: ['./server.js'],
};

const options = {
  explorer: true,
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

app.use('/docs', swaggerUI.serve, swaggerUI.setup(swaggerDocs, options));

app.listen(5050, async () => {
  if (process.env.CACHE_MODE == '1') {
    console.log('Enabling caching');
    await loadDataToRedis();
  }
  console.log('app is listening on port 5050');
});
