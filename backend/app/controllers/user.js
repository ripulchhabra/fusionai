var jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const qs = require('qs');
const Users = require('../services/Users');
const SuperAdmin = require('../services/SuperAdmin');
const hbs = require('nodemailer-express-handlebars');
const nodemailer = require('nodemailer');
const path = require('path');
const winston = require('winston');
const { emailTransporter } = require('../init/emailTransporter');
const { combine, timestamp, json } = winston.format;
const axios = require('axios');
const fs = require('fs');
const { getAdminSetting } = require('../init/redisUtils');
const { google } = require('googleapis');
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

class UsersController {
  static async createSessionURL(request, response) {
    const user = new Users(knex);
    if (request.body.accountType == 'solo' && request.body.signUpMethod == 'email') {
      if (
        request.body.email &&
        request.body.firstname &&
        request.body.lastname &&
        request.body.countryCode &&
        request.body.mobileNumber &&
        request.body.password &&
        request.body.accountType
      ) {
        const debugData = {
          url: request.protocol + '://' + request.get('host') + request.originalUrl,
          body: { ...request.body, password: '*********' },
          headers: request.headers,
        };
        logger.debug(JSON.stringify(debugData));

        logger.info(`Creating new account for ${request.body.email}`);
        logger.info(`Checking if account already exists for ${request.body.email}`);
        user.checkIfUserExist(request.body.email).then((res) => {
          if (res.length > 0) {
            logger.warn(`Account already exists for ${request.body.email}`);
            return response.status(200).send({
              success: false,
              message: `${request.body.email} already has an account, try with another email`,
            });
          } else {
            logger.info(`Account does not exist for ${request.body.email}`);
            logger.info(`Creating user account for ${request.body.email}`);
            user
              .createNewUser(
                request.body.firstname,
                request.body.lastname,
                request.body.email,
                request.body.countryCode,
                request.body.mobileNumber,
                request.body.password,
                request.body.accountType,
                '1',
                request.body.signUpMethod
              )
              .then(async (res) => {
                const { userId, token, default2FA, userCloudIntegration, userCloudIntegrationMob } =
                  res;
                logger.info(`Creating company account for ${request.body.email}`);
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
                    null,
                    null,
                    null
                  )
                  .then(async (res) => {
                    const { companyId } = res;
                    logger.info(`Company account creation successful for ${request.body.email}`);
                    const jwtToken = jwt.sign(
                      {
                        userId: userId,
                        firstname: request.body.firstname,
                        lastname: request.body.lastname,
                        email: request.body.email,
                        role: 1,
                        company: companyId[0],
                      },
                      process.env.TOKEN_SECRET,
                      { expiresIn: '30 days' }
                    );

                    const data = {
                      id: userId,
                      firstname: request.body.firstname,
                      lastname: request.body.lastname,
                      email: request.body.email,
                      accountStatus: false,
                      role: 1,
                      countryCode: request.body.countryCode,
                      mobileNumber: request.body.mobileNumber,
                      companyId: companyId[0],
                      companyName: null,
                      orgType: null,
                      phoneNumber: null,
                      phoneNumberCountryCode: null,
                      mailingAddress: {
                        addressLine: null,
                        city: null,
                        state: null,
                        country: null,
                        postCode: null,
                      },
                      auth: {
                        api_token: jwtToken,
                      },
                      billingAddress: {
                        addressLine: null,
                        city: null,
                        country: null,
                        state: null,
                        postCode: null,
                      },
                      avatarName: `${process.env.USER_IMAGE_URL}/default.png`,
                      twoFactorAuth: default2FA == '1' ? true : false,
                      companyLogo: null,
                      companytwoFactorAuth: false,
                      isMailAndBillAddressSame: null,
                      accountType: request.body.accountType,
                      userCloudIntegration,
                      userCloudIntegrationMob,
                    };

                    user.getMailTemplate(1).then(async (data) => {
                      let subject = data[0].subject;
                      subject = subject.replace('{{name}}', request.body.firstname);
                      let html = data[0].template;
                      html = html.replace('{{name}}', request.body.firstname);
                      var { transporter, mailingAddress } = await emailTransporter();

                      var mailOptions2 = {
                        from: mailingAddress,
                        to: request.body.email,
                        subject: subject,
                        html,
                      };

                      transporter.sendMail(mailOptions2, function (error, info) {
                        if (error) {
                          logger.error(error.message);
                          return;
                        }
                        logger.info(`Welcome message successfully sent to ${request.body.email}`);
                      });

                      user.getMailTemplate(2).then(async (data) => {
                        let subject = data[0].subject;
                        let html = data[0].template;
                        html = html.replace('{{name}}', request.body.firstname);
                        html = html.replace(
                          '{{link}}',
                          `${process.env.FRONTEND_BASE_URL}/verify-account?id=${userId}&token=${token}`
                        );
                        var mailOptions = {
                          from: mailingAddress,
                          to: request.body.email,
                          subject: subject,
                          html,
                        };

                        transporter.sendMail(mailOptions, function (error, info) {
                          if (error) {
                            logger.error(error.message);
                            return;
                          }
                          logger.info(
                            `Verification email successfully sent to ${request.body.email}`
                          );
                        });
                      });
                    });

                    logger.debug(
                      JSON.stringify({
                        success: true,
                        message: request.t('accountCreationSuccess'),
                        userData: data,
                      })
                    );
                    return response.status(201).send({
                      success: true,
                      payment_mode: 'off',
                      message: request.t('accountCreationSuccess'),
                      userData: data,
                    });
                  })
                  .catch((err) => {
                    console.log(err);
                    logger.warn(`User account creation failed for ${request.body.email}`);
                    logger.error(err);
                    logger.debug(JSON.stringify({ success: false, message: err }));
                    return response.status(400).send({ success: false, message: err });
                  });
              })
              .catch((err) => {
                console.log(err);
                logger.warn(`User account creation failed for ${request.body.email}`);
                logger.error(err);
                logger.debug(JSON.stringify({ success: false, message: err }));
                return response.status(400).send({ success: false, message: err });
              });
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
    } else if (request.body.accountType == 'solo' && request.body.signUpMethod !== 'email') {
      if (
        request.body.email &&
        request.body.firstname &&
        request.body.lastname &&
        request.body.profilePic &&
        request.body.accountType
      ) {
        const debugData = {
          url: request.protocol + '://' + request.get('host') + request.originalUrl,
          body: { ...request.body, password: '*********' },
          headers: request.headers,
        };
        logger.debug(JSON.stringify(debugData));

        logger.info(`Creating new account for ${request.body.email}`);
        logger.info(`Checking if account already exists for ${request.body.email}`);
        user.checkIfUserExist(request.body.email).then(async (res) => {
          if (res.length > 0) {
            logger.warn(`Account already exists for ${request.body.email}`);
            return response.status(200).send({
              success: false,
              message: `${request.body.email} already has an account, try with another email`,
            });
          } else {
            logger.info(`Account does not exist for ${request.body.email}`);
            logger.info(`Creating user account for ${request.body.email}`);
            logger.info(`Uploading Image for ${request.body.email}`);

            const imageResponse = await axios.get(request.body.profilePic, {
              responseType: 'arraybuffer',
            });
            const imageBuffer = Buffer.from(imageResponse.data, 'binary');

            const fileName = `${request.body.firstname}_${Date.now()}.jpg`;
            fs.writeFileSync(
              `${process.env.BACKEND_PATH}/uploads/userAvatars/${fileName}`,
              imageBuffer
            );

            user
              .createNewUserGoogle(
                request.body.firstname,
                request.body.lastname,
                request.body.email,
                request.body.accountType,
                request.body.signUpMethod
              )
              .then(async (res) => {
                const { userId, default2FA, userCloudIntegration, userCloudIntegrationMob } = res;
                logger.info(`Uploading Image for ${userId}`);
                await user.updateUserMeta(userId, 'profilePic', fileName);
                logger.info(`Image upload successful for ${userId}`);
                logger.info(`Creating company account for ${request.body.email}`);
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
                    null,
                    null,
                    null
                  )
                  .then(async (res) => {
                    const { companyId } = res;
                    logger.info(`Company account creation successful for ${request.body.email}`);
                    const jwtToken = jwt.sign(
                      {
                        userId: userId,
                        firstname: request.body.firstname,
                        lastname: request.body.lastname,
                        email: request.body.email,
                        role: 1,
                        company: companyId[0],
                      },
                      process.env.TOKEN_SECRET,
                      { expiresIn: '30 days' }
                    );

                    const data = {
                      id: userId,
                      firstname: request.body.firstname,
                      lastname: request.body.lastname,
                      email: request.body.email,
                      accountStatus: true,
                      role: 1,
                      countryCode: null,
                      mobileNumber: '(000)-000-0000',
                      companyId: companyId[0],
                      companyName: null,
                      orgType: null,
                      phoneNumberCountryCode: null,
                      phoneNumber: null,
                      mailingAddress: {
                        addressLine: null,
                        country: null,
                        city: null,
                        state: null,
                        postCode: null,
                      },
                      auth: {
                        api_token: jwtToken,
                      },
                      billingAddress: {
                        addressLine: null,
                        country: null,
                        city: null,
                        state: null,
                        postCode: null,
                      },
                      avatarName: `${process.env.USER_IMAGE_URL}/${fileName}`,
                      twoFactorAuth: default2FA == '1' ? true : false,
                      companyLogo: null,
                      companytwoFactorAuth: false,
                      isMailAndBillAddressSame: null,
                      accountType: request.body.accountType,
                      userCloudIntegration,
                      userCloudIntegrationMob,
                    };
                    user.getMailTemplate(1).then(async (data) => {
                      let subject = data[0].subject;
                      subject = subject.replace('{{name}}', request.body.firstname);
                      let html = data[0].template;
                      html = html.replace('{{name}}', request.body.firstname);
                      var { transporter, mailingAddress } = await emailTransporter();

                      var mailOptions2 = {
                        from: mailingAddress,
                        to: request.body.email,
                        subject: subject,
                        html,
                      };

                      transporter.sendMail(mailOptions2, function (error, info) {
                        if (error) {
                          logger.error(error.message);
                          return;
                        }
                        logger.info(`Welcome message successfully sent to ${request.body.email}`);
                      });
                    });

                    logger.debug(
                      JSON.stringify({
                        success: true,
                        message: request.t('accountCreationSuccess'),
                        userData: data,
                      })
                    );
                    return response.status(201).send({
                      success: true,
                      payment_mode: 'off',
                      message: request.t('accountCreationSuccess'),
                      userData: data,
                    });
                  })
                  .catch((err) => {
                    console.log(err);
                    logger.warn(`User account creation failed for ${request.body.email}`);
                    logger.error(err);
                    logger.debug(JSON.stringify({ success: false, message: err }));
                    return response.status(400).send({ success: false, message: err });
                  });
              })
              .catch((err) => {
                console.log(err);
                logger.warn(`User account creation failed for ${request.body.email}`);
                logger.error(err);
                logger.debug(JSON.stringify({ success: false, message: err }));
                return response.status(400).send({ success: false, message: err });
              });
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
    } else if (request.body.accountType == 'team' && request.body.signUpMethod !== 'email') {
      if (
        request.body.firstname &&
        request.body.lastname &&
        request.body.email &&
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
        request.body.profilePic &&
        request.body.accountType
      ) {
        const debugData = {
          url: request.protocol + '://' + request.get('host') + request.originalUrl,
          body: { ...request.body, password: '*********' },
          headers: request.headers,
        };
        logger.debug(JSON.stringify(debugData));

        logger.info(`Creating new account for ${request.body.email}`);
        logger.info(`Checking if account already exists for ${request.body.email}`);
        user.checkIfUserExist(request.body.email).then(async (res) => {
          if (res.length > 0) {
            logger.warn(`Account already exists for ${request.body.email}`);
            return response.status(200).send({
              success: false,
              message: `${request.body.email} already has an account, try with another email`,
            });
          } else {
            logger.info(`Account does not exist for ${request.body.email}`);
            logger.info(`Creating user account for ${request.body.email}`);
            logger.info(`Uploading Image for ${request.body.email}`);

            const imageResponse = await axios.get(request.body.profilePic, {
              responseType: 'arraybuffer',
            });
            const imageBuffer = Buffer.from(imageResponse.data, 'binary');

            const fileName = `${request.body.firstname}_${Date.now()}.jpg`;
            fs.writeFileSync(
              `${process.env.BACKEND_PATH}/uploads/userAvatars/${fileName}`,
              imageBuffer
            );

            user
              .createNewUserGoogle(
                request.body.firstname,
                request.body.lastname,
                request.body.email,
                request.body.accountType,
                request.body.signUpMethod
              )
              .then(async (res) => {
                const { userId, default2FA, userCloudIntegration, userCloudIntegrationMob } = res;
                logger.info(`Uploading Image for ${userId}`);
                await user.updateUserMeta(userId, 'profilePic', fileName);
                logger.info(`Image upload successful for ${userId}`);
                logger.info(`Creating company account for ${request.body.email}`);
                user
                  .createNewCompany(
                    userId,
                    request.body.companyName,
                    request.body.phoneNumberCountryCode,
                    request.body.phoneNumber,
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
                    request.body.isMailAndBillAddressSame
                  )
                  .then(async (res) => {
                    const { companyId, companyDefault2FA } = res;
                    logger.info(`Company account creation successful for ${request.body.email}`);
                    const jwtToken = jwt.sign(
                      {
                        userId: userId,
                        firstname: request.body.firstname,
                        lastname: request.body.lastname,
                        email: request.body.email,
                        role: 1,
                        company: companyId[0],
                      },
                      process.env.TOKEN_SECRET,
                      { expiresIn: '30 days' }
                    );

                    const data = {
                      id: userId,
                      firstname: request.body.firstname,
                      lastname: request.body.lastname,
                      email: request.body.email,
                      accountStatus: true,
                      role: 1,
                      countryCode: '+1',
                      mobileNumber: '(000)-000-0000',
                      companyId: companyId[0],
                      companyName: request.body.companyName,
                      orgType: request.body.orgType,
                      phoneNumberCountryCode: request.body.phoneNumberCountryCode,
                      phoneNumber: request.body.phoneNumber,
                      mailingAddress: {
                        addressLine: request.body.mailingAddStreetName,
                        country: request.body.mailingAddCountryName,
                        city: request.body.mailingAddCityName,
                        state: request.body.mailingAddStateName,
                        postCode: request.body.mailingAddZip,
                      },
                      auth: {
                        api_token: jwtToken,
                      },
                      billingAddress: {
                        addressLine: request.body.billingAddStreetName,
                        country: request.body.billingAddCountryName,
                        city: request.body.billingAddCityName,
                        state: request.body.billingAddStateName,
                        postCode: request.body.billingAddZip,
                      },
                      avatarName: `${process.env.USER_IMAGE_URL}/${fileName}`,
                      twoFactorAuth: default2FA == '1' ? true : false,
                      companyLogo: `${process.env.COMPANY_IMAGE_URL}/default.png`,
                      companytwoFactorAuth: companyDefault2FA == '1' ? true : false,
                      isMailAndBillAddressSame: request.body.isMailAndBillAddressSame,
                      accountType: request.body.accountType,
                      userCloudIntegration,
                      userCloudIntegrationMob,
                    };

                    user.getMailTemplate(1).then(async (data) => {
                      let subject = data[0].subject;
                      subject = subject.replace('{{name}}', request.body.firstname);
                      let html = data[0].template;
                      html = html.replace('{{name}}', request.body.firstname);
                      var { transporter, mailingAddress } = await emailTransporter();

                      var mailOptions2 = {
                        from: mailingAddress,
                        to: request.body.email,
                        subject: subject,
                        html,
                      };

                      transporter.sendMail(mailOptions2, function (error, info) {
                        if (error) {
                          logger.error(error.message);
                          return;
                        }
                        logger.info(`Welcome message successfully sent to ${request.body.email}`);
                      });
                    });

                    logger.debug(
                      JSON.stringify({
                        success: true,
                        message: request.t('accountCreationSuccess'),
                        userData: data,
                      })
                    );
                    return response.status(201).send({
                      success: true,
                      payment_mode: 'off',
                      message: request.t('accountCreationSuccess'),
                      userData: data,
                    });
                  })
                  .catch((err) => {
                    console.log(err);
                    logger.warn(`User account creation failed for ${request.body.email}`);
                    logger.error(err);
                    logger.debug(JSON.stringify({ success: false, message: err }));
                    return response.status(400).send({ success: false, message: err });
                  });
              })
              .catch((err) => {
                logger.warn(`User account creation failed for ${request.body.email}`);
                logger.error(err);
                logger.debug(JSON.stringify({ success: false, message: err }));
                return response.status(400).send({ success: false, message: err });
              });
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
    } else {
      if (
        request.body.email &&
        request.body.firstname &&
        request.body.lastname &&
        request.body.countryCode &&
        request.body.mobileNumber &&
        request.body.accountType &&
        request.body.password &&
        request.body.companyName &&
        request.body.phoneNumberCountryCode &&
        request.body.phoneNumber &&
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
        request.body.billingAddZip
      ) {
        user
          .checkIfUserExist(request.body.email)
          .then(async (res) => {
            if (res.length > 0) {
              logger.warn(`Account already exists for ${request.body.email}`);
              return response.status(201).send({
                success: false,
                message: `${request.body.email} already has an account, try with another email`,
              });
            } else {
              user
                .createNewUser(
                  request.body.firstname,
                  request.body.lastname,
                  request.body.email,
                  request.body.countryCode,
                  request.body.mobileNumber,
                  request.body.password,
                  request.body.accountType,
                  '1',
                  request.body.signUpMethod
                )
                .then((res) => {
                  const {
                    userId,
                    token,
                    default2FA,
                    userCloudIntegration,
                    userCloudIntegrationMob,
                  } = res;
                  logger.info(`User account creation successful for ${request.body.email}`);
                  logger.info(`Creating company account for ${request.body.email}`);
                  user
                    .createNewCompany(
                      userId,
                      request.body.companyName,
                      request.body.phoneNumberCountryCode,
                      request.body.phoneNumber,
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
                      request.body.isMailAndBillAddressSame
                    )
                    .then(async (res) => {
                      const { companyId, companyDefault2FA } = res;

                      const jwtToken = jwt.sign(
                        {
                          userId: userId,
                          firstname: request.body.firstname,
                          lastname: request.body.lastname,
                          email: request.body.email,
                          role: 1,
                          company: companyId[0],
                        },
                        process.env.TOKEN_SECRET,
                        { expiresIn: '30 days' }
                      );

                      const data = {
                        id: userId,
                        firstname: request.body.firstname,
                        lastname: request.body.lastname,
                        email: request.body.email,
                        accountStatus: false,
                        phoneNumberCountryCode: request.body.phoneNumberCountryCode,
                        phoneNumber: request.body.phoneNumber,
                        role: 1,
                        countryCode: request.body.countryCode,
                        mobileNumber: request.body.mobileNumber,
                        companyId: companyId[0],
                        companyName: request.body.companyName,
                        orgType: request.body.orgType,
                        mailingAddress: {
                          addressLine: request.body.mailingAddStreetName,
                          country: request.body.mailingAddCountryName,
                          city: request.body.mailingAddCityName,
                          state: request.body.mailingAddStateName,
                          postCode: request.body.mailingAddZip,
                        },
                        auth: {
                          api_token: jwtToken,
                        },
                        billingAddress: {
                          addressLine: request.body.billingAddStreetName,
                          country: request.body.billingAddCountryName,
                          city: request.body.billingAddCityName,
                          state: request.body.billingAddStateName,
                          postCode: request.body.billingAddZip,
                        },
                        avatarName: `${process.env.USER_IMAGE_URL}/default.png`,
                        twoFactorAuth: default2FA == '1' ? true : false,
                        companyLogo: `${process.env.COMPANY_IMAGE_URL}/default.png`,
                        companytwoFactorAuth: companyDefault2FA == '1' ? true : false,
                        isMailAndBillAddressSame: request.body.isMailAndBillAddressSame,
                        accountType: request.body.accountType,
                        userCloudIntegration,
                        userCloudIntegrationMob,
                      };

                      user.getMailTemplate(1).then(async (data) => {
                        let subject = data[0].subject;
                        subject = subject.replace('{{name}}', request.body.firstname);
                        let html = data[0].template;
                        html = html.replace('{{name}}', request.body.firstname);
                        var { transporter, mailingAddress } = await emailTransporter();

                        var mailOptions2 = {
                          from: mailingAddress,
                          to: request.body.email,
                          subject: subject,
                          html,
                        };

                        transporter.sendMail(mailOptions2, function (error, info) {
                          if (error) {
                            logger.error(error.message);
                            console.log(error);
                          }
                          console.log(`Message sent ${info}`);
                          logger.info(`Welcome message successfully sent to ${request.body.email}`);
                        });

                        user.getMailTemplate(2).then(async (data) => {
                          let subject = data[0].subject;
                          let html = data[0].template;
                          html = html.replace('{{name}}', request.body.firstname);
                          html = html.replace(
                            '{{link}}',
                            `${process.env.FRONTEND_BASE_URL}/verify-account?id=${userId}&token=${token}`
                          );
                          var mailOptions = {
                            from: mailingAddress,
                            to: request.body.email,
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
                              `Verification email successfully sent to ${request.body.email}`
                            );
                          });
                        });
                      });

                      logger.info(`Company account creation successful for ${request.body.email}`);
                      return response.status(201).send({
                        success: true,
                        payment_mode: 'off',
                        message: request.t('accountCreationSuccess'),
                        userData: data,
                      });
                    })
                    .catch((err) => {
                      logger.warn(`Company account creation failed for ${request.body.email}`);
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
                  logger.warn(`User account creation failed for ${request.body.email}`);
                  logger.error(err);
                  logger.debug(JSON.stringify({ success: false, message: err }));
                });
            }
          })
          .catch((err) => {
            logger.warn(`User account creation failed for ${request.body.email}`);
            logger.error(err);
            logger.debug(JSON.stringify({ success: false, message: err }));
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

  static checkIfEmailExist(request, response) {
    const user = new Users(knex);

    if (request.body.email) {
      logger.info('Checking Payment Staius');
      user
        .checkIfUserExist(request.body.email)
        .then((res) => {
          if (res.length > 0) {
            logger.info('User Exists');
            return response.status(201).send({ success: true, exists: true });
          } else {
            logger.info('User Not Exist');
            return response.status(201).send({ success: true, exists: false });
          }
        })
        .catch((err) => {
          console.log(err);
          return response.status(201).send({ success: false, status: 'failed' });
        });
    } else {
      logger.debug(
        JSON.stringify({
          success: false,
          message: 'Missing  parameters, fill all the required fields',
        })
      );
      return response
        .status(201)
        .send({ success: false, message: 'Missing parameters, fill all the required fields' });
    }
  }

  static checkPaymentStatus(request, response) {
    const user = new Users(knex);

    if (request.body.email) {
      logger.info('Checking Payment Staius');
      user
        .checkPaymentStatus(request.body.email)
        .then((res) => {
          if (res == 'success') {
            logger.info('Success Payment Staius');
            return response.status(201).send({ success: true, status: 'success' });
          } else if (res == 'failed') {
            logger.info('Failed Payment Staius');
            return response.status(201).send({ success: false, status: 'failed' });
          } else {
            logger.info('Pending Payment Staius');
            return response.status(201).send({ success: true, status: 'pending' });
          }
        })
        .catch((err) => {
          console.log(err);
          return response.status(201).send({ success: false, status: 'failed' });
        });
    } else {
      logger.debug(
        JSON.stringify({
          success: false,
          message: 'Missing payment requested parameters, fill all the required fields',
        })
      );
      return response
        .status(201)
        .send({ success: false, message: 'Missing parameters, fill all the required fields' });
    }
  }

  static verifyUser(request, response) {
    const user = new Users(knex);

    if (request.body.userId && request.body.token) {
      const debugData = {
        url: request.protocol + '://' + request.get('host') + request.originalUrl,
        body: { ...request.body },
        headers: request.headers,
      };
      logger.debug(JSON.stringify(debugData));
      logger.info(`Validating verification token for user ID ${request.body.userId}`);
      user
        .validateToken(request.body.userId, request.body.token)
        .then((res) => {
          if (res == 'valid') {
            logger.info(`Verification token is valid for user ID ${request.body.userId}`);
            logger.info(`Verifying account for user ID ${request.body.userId}`);
            user
              .verifyAccount(request.body.userId)
              .then((res) => {
                if (res == 1) {
                  logger.info(`Account verification success for ${request.body.userId}`);
                  logger.debug(
                    JSON.stringify({
                      success: true,
                      message: request.t('accountVerificationSuccess'),
                    })
                  );
                  return response
                    .status(200)
                    .send({ success: true, message: request.t('accountVerificationSuccess') });
                } else {
                  logger.warn(`Account verification failed for ${request.body.userId}`);
                  logger.debug(
                    JSON.stringify({
                      success: false,
                      message: request.t('accountVerificationFailed'),
                    })
                  );
                  return response
                    .status(200)
                    .send({ success: false, message: request.t('accountVerificationFailed') });
                }
              })
              .catch((err) => {
                logger.warn(`Account verification failed for ${request.body.userId}`);
                logger.error(err);
                logger.debug(
                  JSON.stringify({
                    success: false,
                    message: request.t('accountVerificationFailed'),
                  })
                );
                return response
                  .status(200)
                  .send({ success: false, message: request.t('accountVerificationFailed') });
              });
          } else if (res == 'expired') {
            logger.warn(`Verification token expired for user ID ${request.body.userId}`);
            logger.debug(
              JSON.stringify({ success: false, message: request.t('verifyLinkExpired') })
            );
            return response
              .status(200)
              .send({ success: false, message: request.t('verifyLinkExpired') });
          } else {
            logger.warn(`Verification token invalid for user ID ${request.body.userId}`);
            logger.debug(
              JSON.stringify({ success: false, message: request.t('verifyLinkInvalid') })
            );
            return response
              .status(200)
              .send({ success: false, message: request.t('verifyLinkInvalid') });
          }
        })
        .catch((err) => {
          logger.warn(`Token verification failed for ${request.body.userId}`);
          logger.error(err);
          logger.debug(
            JSON.stringify({ success: false, message: request.t('accountVerificationFailed') })
          );
          return response
            .status(200)
            .send({ success: false, message: request.t('accountVerificationFailed') });
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

  static resendVerificationMail(request, response) {
    const user = new Users(knex);

    if (request.body.userId) {
      const debugData = {
        url: request.protocol + '://' + request.get('host') + request.originalUrl,
        body: { ...request.body },
        headers: request.headers,
      };
      logger.debug(JSON.stringify(debugData));
      logger.info(`Resending verification link for ${request.body.userId}`);
      logger.info(`Resetting verification token for ${request.body.userId}`);
      user
        .resetToken(request.body.userId)
        .then((result) => {
          const { res, token } = result;
          if (res == 1) {
            logger.info(`Token reset success for ${request.body.userId}`);
            logger.info(`Fetching user information for ${request.body.userId}`);
            user.getUserDetailsById(request.body.userId).then(async (user1) => {
              user.getMailTemplate(2).then(async (data) => {
                let html = data[0].template;
                html = html.replace('{{name}}', user1.firstname);
                html = html.replace(
                  '{{link}}',
                  `${process.env.FRONTEND_BASE_URL}/verify-account?id=${user1.id}&token=${token}`
                );
                var { transporter, mailingAddress } = await emailTransporter();
                var mailOptions = {
                  from: mailingAddress,
                  to: user1.email,
                  subject: `${data[0].subject}`,
                  html,
                };

                transporter.sendMail(mailOptions, function (error, info) {
                  if (error) {
                    logger.warn(`Failed to resend verification email for ${request.body.userId}`);
                    logger.error(error.message);
                    logger.debug(
                      JSON.stringify({ success: false, message: request.t('verifyLinkSendFailed') })
                    );
                    return response
                      .status(200)
                      .send({ success: false, message: request.t('verifyLinkSendFailed') });
                  }
                  logger.info(`Verification email resent successfully for ${request.body.userId}`);

                  logger.debug(
                    JSON.stringify({ success: true, message: request.t('verifyLinkSendSuccess') })
                  );
                  return response
                    .status(200)
                    .send({ success: true, message: request.t('verifyLinkSendSuccess') });
                });
              });
            });
          } else {
            logger.warn(`Token reset failed for ${request.body.userId}`);
            logger.debug(
              JSON.stringify({ success: false, message: request.t('verifyLinkSendFailed') })
            );
            return response
              .status(200)
              .send({ success: false, message: request.t('verifyLinkSendFailed') });
          }
        })
        .catch((err) => {
          logger.warn(`Token reset failed for ${request.body.userId}`);
          logger.error(err);
          logger.debug(
            JSON.stringify({ success: false, message: request.t('verifyLinkSendFailed') })
          );
          return response
            .status(200)
            .send({ success: false, message: request.t('verifyLinkSendFailed') });
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

  static validateGoogleLoginCredentials(request, response) {
    const user = new Users(knex);

    if (request.body.email) {
      const debugData = {
        url: request.protocol + '://' + request.get('host') + request.originalUrl,
        body: { ...request.body, password: '*********' },
        headers: request.headers,
      };
      logger.debug(JSON.stringify(debugData));

      logger.info(`Validating login credential for ${request.body.email}`);
      user
        .validateGoogleLoginCredential(request.body.email)
        .then((res) => {
          if (res.stat == 'valid') {
            logger.info(`Valid credentials provided by ${request.body.email}`);
            user.getUserDetails(request.body.email).then((data) => {
              let userData = data;
              logger.info(`Checking if account is blocked for ${request.body.email}`);
              if (!userData.accountBlocked) {
                logger.info(`Account not in block status`);
                logger.info(`Checking if 2FA is enabled for ${request.body.email}`);
                user.is2FAEnabled(userData.id).then((res) => {
                  if (res == 'disabled') {
                    logger.info(`2FA is disabled for ${request.body.email}`);
                    logger.info(`Initiating authentication for ${request.body.email}`);
                    user
                      .getAccountType(userData.id)
                      .then((type) => {
                        user.getCompanyRole(userData.id).then((roleData) => {
                          user.getCompanyDetails(roleData.company).then((companyData) => {
                            const jwtToken = jwt.sign(
                              {
                                userId: userData.id,
                                firstname: userData.firstname,
                                email: userData.email,
                                role: roleData.role,
                                company: roleData.company,
                              },
                              process.env.TOKEN_SECRET,
                              { expiresIn: '30 days' }
                            );

                            let _auth = {
                              auth: {
                                api_token: jwtToken,
                              },
                            };

                            userData = {
                              ...userData,
                              ...companyData,
                              ..._auth,
                              role: roleData.role,
                              accountType: type,
                            };
                            logger.info(`Authentication success for ${request.body.email}`);
                            logger.debug(
                              JSON.stringify({
                                success: true,
                                message: request.t('Authentication Success'),
                                userData,
                                twoFactorAuth: false,
                              })
                            );
                            return response.status(200).send({
                              success: true,
                              message: request.t('Authentication Success'),
                              userData,
                              twoFactorAuth: false,
                            });
                          });
                        });
                      })
                      .catch((err) => {
                        logger.warn(`Authentication failed for ${request.body.email}`);
                        logger.error(err);
                        logger.debug(
                          JSON.stringify({ success: false, message: request.t('loginFailed') })
                        );
                        return response
                          .status(200)
                          .send({ success: false, message: request.t('loginFailed') });
                      });
                  } else {
                    logger.info(`2FA is enabled for ${request.body.email}`);
                    logger.info(`Sending OTP to ${request.body.email}`);
                    let userId = userData.id;

                    user
                      .generateOTP(userId)
                      .then(async (otp) => {
                        user.getMailTemplate(9).then(async (data) => {
                          let subject = data[0].subject;
                          let html = data[0].template;
                          html = html.replace('{{otp}}', otp);
                          var { transporter, mailingAddress } = await emailTransporter();
                          var mailOptions = {
                            from: mailingAddress,
                            to: request.body.email,
                            subject: subject,
                            html,
                          };

                          transporter.sendMail(mailOptions, function (error, info) {
                            if (error) {
                              logger.warn(`Failed to send OTP for ${request.body.email}`);
                              logger.error(error.message);
                              return console.log(error);
                            }
                            logger.info(`OTP sent successfully for ${request.body.email}`);
                          });
                        });

                        logger.debug(
                          JSON.stringify({
                            success: true,
                            message: 'Valid credential',
                            twoFactorAuth: true,
                          })
                        );
                        return response.status(200).send({
                          success: true,
                          message: 'Valid credential',
                          twoFactorAuth: true,
                        });
                      })
                      .catch((err) => {
                        logger.warn(`Failed to send OTP for ${request.body.email}`);
                        logger.error(err);
                        logger.debug(
                          JSON.stringify({
                            success: false,
                            message: request.t('invalidCredential'),
                          })
                        );
                        return response
                          .status(200)
                          .send({ success: false, message: request.t('invalidCredential') });
                      });
                  }
                });
              } else {
                logger.warn(
                  `Authentication failed, account marked for deletion for ${request.body.email}`
                );
                logger.debug(
                  JSON.stringify({ success: false, message: request.t('accountDeleted') })
                );
                return response
                  .status(200)
                  .send({ success: false, message: request.t('accountDeleted') });
              }
            });
          } else if (res.stat == 'locked') {
            logger.warn(`Authentication failed, account locked for ${request.body.email}`);
            logger.debug(JSON.stringify({ success: false, message: request.t('accountLocked') }));
            return response
              .status(200)
              .send({ success: false, message: request.t('accountLocked') });
          } else {
            logger.warn(
              `Authentication failed, invalid credential provided by ${request.body.email}`
            );
            logger.debug(
              JSON.stringify({ success: false, message: request.t('invalidCredential') })
            );
            return response
              .status(200)
              .send({ success: false, message: request.t('invalidCredential') });
          }
        })
        .catch((err) => {
          logger.warn(`Authentication failed for ${request.body.email}`);
          logger.error(err);
          logger.debug(JSON.stringify({ success: false, message: request.t('loginFailed') }));
          return response.status(200).send({ success: false, message: request.t('loginFailed') });
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

  static validateGoogleOTPAndAuthenticateUser(request, response) {
    const user = new Users(knex);

    if (request.body.email && request.body.otp) {
      const debugData = {
        url: request.protocol + '://' + request.get('host') + request.originalUrl,
        body: { ...request.body, password: '*********' },
        headers: request.headers,
      };
      logger.debug(JSON.stringify(debugData));
      logger.info(`Validating OTP sent by ${request.body.email}`);
      user.validateGoogleCredentialAndOtp(request.body.email, request.body.otp).then((res) => {
        if (res == 'valid') {
          logger.info(`Valid credentials provided by ${request.body.email}`);
          user.getUserDetails(request.body.email).then((data) => {
            let userData = data;
            logger.info(`Checking if account is blocked for ${request.body.email}`);
            if (!userData.accountBlocked) {
              logger.info(`Account not in block status`);
              logger.info(`Initiating authentication for ${request.body.email}`);
              user
                .getAccountType(userData.id)
                .then((type) => {
                  user.getCompanyRole(userData.id).then((roleData) => {
                    user.getCompanyDetails(roleData.company).then((companyData) => {
                      const jwtToken = jwt.sign(
                        {
                          userId: userData.id,
                          firstname: userData.firstname,
                          email: userData.email,
                          role: roleData.role,
                          company: roleData.company,
                        },
                        process.env.TOKEN_SECRET,
                        { expiresIn: '30 days' }
                      );

                      let _auth = {
                        auth: {
                          api_token: jwtToken,
                        },
                      };

                      userData = {
                        ...userData,
                        ...companyData,
                        ..._auth,
                        role: roleData.role,
                        accountType: type,
                      };
                      logger.info(`Authentication success for ${request.body.email}`);
                      logger.debug(
                        JSON.stringify({
                          success: true,
                          message: 'Authentication Success',
                          userData,
                          twoFactorAuth: true,
                        })
                      );
                      return response.status(200).send({
                        success: true,
                        message: 'Authentication Success',
                        userData,
                        twoFactorAuth: true,
                      });
                    });
                  });
                })
                .catch((err) => {
                  logger.warn(`Authentication failed for ${request.body.email}`);
                  logger.error(err);
                  logger.debug(
                    JSON.stringify({ success: false, message: request.t('loginFailed') })
                  );
                  return response
                    .status(200)
                    .send({ success: false, message: request.t('loginFailed') });
                });
            } else {
              logger.warn(
                `Authentication failed, account marked for deletion for ${request.body.email}`
              );
              logger.debug(
                JSON.stringify({ success: false, message: request.t('accountDeleted') })
              );
              return response
                .status(200)
                .send({ success: false, message: request.t('accountDeleted') });
            }
          });
        } else if (res == 'expired') {
          logger.warn(`OTP expired for ${request.body.email}`);
          logger.debug(JSON.stringify({ success: false, message: request.t('OTPExpired') }));
          return response.status(201).send({ success: false, message: request.t('OTPExpired') });
        } else if (res == 'Invalid OTP') {
          logger.warn(`Invalid OTP provided by ${request.body.email}`);
          user.getUserDetails(request.body.email).then(async (data) => {
            let userData = data;
            user.getMailTemplate(6).then(async (data) => {
              let subject = data[0].subject;
              let html = data[0].template;
              html = html.replace('{{name}}', userData.firstname);
              var { transporter, mailingAddress } = await emailTransporter();
              var mailOptions = {
                from: mailingAddress,
                to: userData.email,
                subject: subject,
                html,
              };

              transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                  logger.error(error.message);
                  return console.log(error);
                }
                console.log('Message sent: ' + info.response);
              });
            });
            logger.debug(JSON.stringify({ success: false, message: request.t('invalidOTP') }));
            return response.status(201).send({ success: false, message: request.t('invalidOTP') });
          });
        } else if (res == 'locked') {
          logger.warn(
            `Account locked due to multiple incorrect OTP attempt for ${request.body.email}`
          );
          logger.debug(JSON.stringify({ success: false, message: request.t('accountLocked') }));
          return response.status(201).send({ success: false, message: request.t('accountLocked') });
        } else {
          logger.warn(
            `Authentication failed, invalid credential provided by ${request.body.email}`
          );
          logger.debug(JSON.stringify({ success: false, message: request.t('invalidCredential') }));
          return response
            .status(201)
            .send({ success: false, message: request.t('invalidCredential') });
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

  static validateLoginCredentials(request, response) {
    const user = new Users(knex);

    if (request.body.email && request.body.password) {
      const debugData = {
        url: request.protocol + '://' + request.get('host') + request.originalUrl,
        body: { ...request.body, password: '*********' },
        headers: request.headers,
      };
      logger.debug(JSON.stringify(debugData));

      logger.info(`Validating login credential for ${request.body.email}`);
      user
        .validateLoginCredential(request.body.email, request.body.password)
        .then((res) => {
          if (res.stat == 'valid') {
            logger.info(`Valid credentials provided by ${request.body.email}`);
            user.getUserDetails(request.body.email).then((data) => {
              let userData = data;
              logger.info(`Checking if account is blocked for ${request.body.email}`);
              if (!userData.accountBlocked) {
                logger.info(`Account not in block status`);
                logger.info(`Checking if 2FA is enabled for ${request.body.email}`);
                user.is2FAEnabled(userData.id).then((res) => {
                  if (res == 'disabled') {
                    logger.info(`2FA is disabled for ${request.body.email}`);
                    user
                      .getAccountType(userData.id)
                      .then((type) => {
                        logger.info(`Initiating authentication for ${request.body.email}`);
                        user
                          .getCompanyRole(userData.id)
                          .then((roleData) => {
                            console.log(roleData);
                            user.getCompanyDetails(roleData.company).then((companyData) => {
                              const jwtToken = jwt.sign(
                                {
                                  userId: userData.id,
                                  firstname: userData.firstname,
                                  email: userData.email,
                                  role: roleData.role,
                                  company: roleData.company,
                                },
                                process.env.TOKEN_SECRET,
                                { expiresIn: '30 days' }
                              );

                              let _auth = {
                                auth: {
                                  api_token: jwtToken,
                                },
                              };

                              userData = {
                                ...userData,
                                ...companyData,
                                ..._auth,
                                role: roleData.role,
                                accountType: type,
                              };
                              logger.info(`Authentication success for ${request.body.email}`);
                              logger.debug(
                                JSON.stringify({
                                  success: true,
                                  message: request.t('Authentication Success'),
                                  userData,
                                  twoFactorAuth: false,
                                })
                              );
                              return response.status(200).send({
                                success: true,
                                message: request.t('Authentication Success'),
                                userData,
                                twoFactorAuth: false,
                              });
                            });
                          })
                          .catch((err) => {
                            console.log(err);
                            logger.warn(`Authentication failed for ${request.body.email}`);
                            logger.error(err);
                            logger.debug(
                              JSON.stringify({ success: false, message: request.t('loginFailed') })
                            );
                            return response
                              .status(200)
                              .send({ success: false, message: request.t('loginFailed') });
                          });
                      })
                      .catch((err) => {});
                  } else {
                    logger.info(`2FA is enabled for ${request.body.email}`);
                    logger.info(`Sending OTP to ${request.body.email}`);
                    let userId = userData.id;

                    user
                      .generateOTP(userId)
                      .then(async (otp) => {
                        user.getMailTemplate(9).then(async (data) => {
                          let subject = data[0].subject;
                          let html = data[0].template;
                          html = html.replace('{{otp}}', otp);
                          var { transporter, mailingAddress } = await emailTransporter();
                          var mailOptions = {
                            from: mailingAddress,
                            to: request.body.email,
                            subject: subject,
                            html,
                          };

                          transporter.sendMail(mailOptions, function (error, info) {
                            if (error) {
                              logger.warn(`Failed to send OTP for ${request.body.email}`);
                              logger.error(error.message);
                              return console.log(error);
                            }
                            logger.info(`OTP sent successfully for ${request.body.email}`);
                          });
                        });

                        logger.debug(
                          JSON.stringify({
                            success: true,
                            message: 'Valid credential',
                            twoFactorAuth: true,
                          })
                        );
                        return response.status(200).send({
                          success: true,
                          message: 'Valid credential',
                          twoFactorAuth: true,
                        });
                      })
                      .catch((err) => {
                        logger.warn(`Failed to send OTP for ${request.body.email}`);
                        logger.error(err);
                        logger.debug(
                          JSON.stringify({
                            success: false,
                            message: request.t('invalidCredential'),
                          })
                        );
                        return response
                          .status(200)
                          .send({ success: false, message: request.t('invalidCredential') });
                      });
                  }
                });
              } else {
                logger.warn(
                  `Authentication failed, account marked for deletion for ${request.body.email}`
                );
                logger.debug(
                  JSON.stringify({ success: false, message: request.t('accountDeleted') })
                );
                return response
                  .status(200)
                  .send({ success: false, message: request.t('accountDeleted') });
              }
            });
          } else if (res.stat == 'locked') {
            logger.warn(`Authentication failed, account locked for ${request.body.email}`);
            logger.debug(JSON.stringify({ success: false, message: request.t('accountLocked') }));
            return response
              .status(200)
              .send({ success: false, message: request.t('accountLocked') });
          } else {
            logger.warn(
              `Authentication failed, invalid credential provided by ${request.body.email}`
            );
            logger.debug(
              JSON.stringify({ success: false, message: request.t('invalidCredential') })
            );
            return response
              .status(200)
              .send({ success: false, message: request.t('invalidCredential') });
          }
        })
        .catch((err) => {
          console.log(err);
          logger.warn(`Authentication failed for ${request.body.email}`);
          logger.error(err);
          logger.debug(JSON.stringify({ success: false, message: request.t('loginFailed') }));
          return response.status(200).send({ success: false, message: request.t('loginFailed') });
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

  static validateOTPAndAuthenticateUser(request, response) {
    const user = new Users(knex);

    if (request.body.email && request.body.password && request.body.otp) {
      const debugData = {
        url: request.protocol + '://' + request.get('host') + request.originalUrl,
        body: { ...request.body, password: '*********' },
        headers: request.headers,
      };
      logger.debug(JSON.stringify(debugData));
      logger.info(`Validating OTP sent by ${request.body.email}`);
      user
        .validateCredentialAndOtp(request.body.email, request.body.password, request.body.otp)
        .then((res) => {
          if (res == 'valid') {
            logger.info(`Valid credentials provided by ${request.body.email}`);
            user.getUserDetails(request.body.email).then((data) => {
              let userData = data;
              logger.info(`Checking if account is blocked for ${request.body.email}`);
              if (!userData.accountBlocked) {
                logger.info(`Account not in block status`);
                logger.info(`Initiating authentication for ${request.body.email}`);
                user
                  .getCompanyRole(userData.id)
                  .then((roleData) => {
                    user.getCompanyDetails(roleData.company).then((companyData) => {
                      const jwtToken = jwt.sign(
                        {
                          userId: userData.id,
                          firstname: userData.firstname,
                          email: userData.email,
                          role: roleData.role,
                          company: roleData.company,
                        },
                        process.env.TOKEN_SECRET,
                        { expiresIn: '30 days' }
                      );

                      let _auth = {
                        auth: {
                          api_token: jwtToken,
                        },
                      };

                      userData = { ...userData, ...companyData, ..._auth, role: roleData.role };
                      logger.info(`Authentication success for ${request.body.email}`);
                      logger.debug(
                        JSON.stringify({
                          success: true,
                          message: 'Authentication Success',
                          userData,
                          twoFactorAuth: true,
                        })
                      );
                      return response.status(200).send({
                        success: true,
                        message: 'Authentication Success',
                        userData,
                        twoFactorAuth: true,
                      });
                    });
                  })
                  .catch((err) => {
                    logger.warn(`Authentication failed for ${request.body.email}`);
                    logger.error(err);
                    logger.debug(
                      JSON.stringify({ success: false, message: request.t('loginFailed') })
                    );
                    return response
                      .status(200)
                      .send({ success: false, message: request.t('loginFailed') });
                  });
              } else {
                logger.warn(
                  `Authentication failed, account marked for deletion for ${request.body.email}`
                );
                logger.debug(
                  JSON.stringify({ success: false, message: request.t('accountDeleted') })
                );
                return response
                  .status(200)
                  .send({ success: false, message: request.t('accountDeleted') });
              }
            });
          } else if (res == 'expired') {
            logger.warn(`OTP expired for ${request.body.email}`);
            logger.debug(JSON.stringify({ success: false, message: request.t('OTPExpired') }));
            return response.status(201).send({ success: false, message: request.t('OTPExpired') });
          } else if (res == 'Invalid OTP') {
            logger.warn(`Invalid OTP provided by ${request.body.email}`);
            user.getUserDetails(request.body.email).then(async (data) => {
              let userData = data;
              user.getMailTemplate(6).then(async (data) => {
                let subject = data[0].subject;
                let html = data[0].template;
                html = html.replace('{{name}}', userData.firstname);
                var { transporter, mailingAddress } = await emailTransporter();
                var mailOptions = {
                  from: mailingAddress,
                  to: userData.email,
                  subject: subject,
                  html,
                };

                transporter.sendMail(mailOptions, function (error, info) {
                  if (error) {
                    logger.error(error.message);
                    return console.log(error);
                  }
                  console.log('Message sent: ' + info.response);
                });
              });
              logger.debug(JSON.stringify({ success: false, message: request.t('invalidOTP') }));
              return response
                .status(201)
                .send({ success: false, message: request.t('invalidOTP') });
            });
          } else if (res == 'locked') {
            logger.warn(
              `Account locked due to multiple incorrect OTP attempt for ${request.body.email}`
            );
            logger.debug(JSON.stringify({ success: false, message: request.t('accountLocked') }));
            return response
              .status(201)
              .send({ success: false, message: request.t('accountLocked') });
          } else {
            logger.warn(
              `Authentication failed, invalid credential provided by ${request.body.email}`
            );
            logger.debug(
              JSON.stringify({ success: false, message: request.t('invalidCredential') })
            );
            return response
              .status(201)
              .send({ success: false, message: request.t('invalidCredential') });
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

  static async getUserData(request, response) {
    const user = new Users(knex);
    const userId = request.body.userId;
    if (!userId) {
      return response.status(402).json({ success: false, message: 'User ID is required' });
    }
    try {
      const userDetailsData = await user.getUserDetailsById(userId);
      const roleData = await user.getCompanyRole(userId);
      const userDetails = {
        id: 0,
        firstname: '',
        lastname: '',
        email: '',
        accountStatus: false,
        countryCode: '',
        mobileNumber: '',
        accountLockStatus: false,
        avatarName: '',
        twoFactorAuth: false,
        accountBlocked: false,
        accountType: '',
        role: 1,
      };
      if (userDetailsData) {
        userDetails.id = userDetailsData.id;
        userDetails.firstname = userDetailsData.firstname;
        userDetails.lastname = userDetailsData.lastname;
        userDetails.email = userDetailsData.email;
        userDetails.accountStatus = userDetailsData.accountStatus;
        userDetails.countryCode = userDetailsData.countryCode;
        userDetails.mobileNumber = userDetailsData.mobileNumber;
        userDetails.accountLockStatus = userDetailsData.accountLockStatus;
        userDetails.avatarName = userDetailsData.avatarName;
        userDetails.twoFactorAuth = userDetailsData.twoFactorAuth;
        userDetails.accountBlocked = userDetailsData.accountBlocked;
        userDetails.accountType = userDetailsData.accountType;
        userDetails.role = roleData.role;
      }
      const companyData = await user.getCompanyDetails(roleData.company);
      const userData = { ...userDetails, ...companyData };
      return response
        .status(200)
        .json({ success: true, message: 'User Data Fetched Successfully', userData });
    } catch (error) {
      console.log(error);
      return response.status(500).json('Internal server error');
    }
  }

  static async updateUserCloudIntegration(request, response) {
    const userId = request.body.userId;
    const integrationId = request.body.id;
    if (!userId || !integrationId) {
      logger.info('Required fieldss are missing to update user integrations');
      return response.status(401).json({
        success: false,
        message: 'userId and integrationId are required',
      });
    }
    const { accessToken, refreshToken, account, time, login } = request.body.updates;
    let name = '';
    if (integrationId === 'integration_1') {
      name = 'GoogleDrive';
    } else if (integrationId === 'integration_2') {
      name = 'DropBox';
    } else if (integrationId === 'integration_3') {
      name = 'OneDrive';
    } else if (integrationId === 'integration_4') {
      name = 'Slack';
    } else if (integrationId === 'integration_5') {
      name = 'WordPress';
    } else {
      return response.status(401).json({ error: 'Integration ID missing or invalid.' });
    }
    try {
      const updateData = {};
      if (accessToken !== undefined) updateData.accessToken = accessToken;
      if (refreshToken !== undefined) updateData.refreshToken = refreshToken;
      if (time !== undefined) updateData.time = time;
      if (name !== undefined) updateData.name = name;
      if (login !== undefined) updateData.login = login;
      if (login !== undefined) updateData.account = account;
      if (login == false) {
        updateData.source = '';
      } else {
        const isMobile = source.isMobile;
        updateData.source = isMobile ? 'Mobile' : 'Web';
      }

      if (Object.keys(updateData).length === 0) {
        return response.status(402).json({ error: 'At least one field is required for update.' });
      }
      const updated = await knex('user_integrations')
        .where({ userId, integrationId })
        .update(updateData);
      if (updated === 0) {
        await knex('user_integrations').insert({ userId, integrationId, ...updateData });
      }
      const cloudIntegrationsRaw = await knex('user_integrations')
        .where({ userId })
        .select(
          'integrationId as id',
          'name',
          'accessToken',
          'refreshToken',
          'account',
          'source',
          'time',
          'login'
        );

      const cloudIntegrations = cloudIntegrationsRaw.map((row) => ({
        ...row,
        login: !!row.login,
      }));
      response.status(200).json({
        success: true,
        message: 'User Cloud Integration data updated successfully',
        data: {
          cloudIntegrations,
        },
      });
    } catch (error) {
      logger.info(`Error updating  user integrations details`);
      console.error(`Error processing user details for user ID ${userId}: ${error}`);
      return response
        .status(500)
        .send({ success: false, message: 'Error updating cloud integration details' });
    }
  }

  static async getUserIntegrations(request, response) {
    const { userId, id, fields } = request.body;
    if (!userId || !id || !Array.isArray(fields) || fields.length === 0) {
      logger.info('Required fieldss are missing to fetch user integrations');
      return response.status(401).json({
        success: false,
        message: 'userId, integrationId, and a non-empty fields array are required',
      });
    }
    try {
      logger.info('Fetching user integrations');
      const validFields = [
        'accessToken',
        'refreshToken',
        'account',
        'source',
        'time',
        'login',
        'name',
      ];
      const requestedFields = fields.filter((f) => validFields.includes(f));
      if (requestedFields.length === 0) {
        logger.info('None of the requested fields are valid');
        return response.status(402).json({
          success: false,
          message: 'None of the requested fields are valid',
        });
      }
      const record = await knex('user_integrations')
        .where({ userId: userId, integrationId: id })
        .first(requestedFields);
      if (!record) {
        logger.info('Integration not found for the user');
        return response.status(403).json({
          success: false,
          message: 'Integration not found for the user',
        });
      }
      return response.status(200).json({
        success: true,
        message: 'Requested fields fetched successfully',
        data: {
          id,
          fields: record,
        },
      });
    } catch (error) {
      response.status(500).json({
        success: false,
        message: 'Failed to fetch requested fields',
      });
    }
  }

  static async getUserCloudIntegraion(request, response) {
    const source = request.useragent;
    const user = new Users(knex);

    const userId = request.body.userId;
    const isMobile = source.isMobile;
    // const isMobile = true
    logger.info('Device is mobile:', isMobile);
    if (userId) {
      const isCIA = await getAdminSetting('CLOUD_INTEGRATION');
      const isCIAM = await getAdminSetting('CLOUD_INTEGRATION_MOBILE');
      const isGDActive = process.env.GOOGLE_DRIVE_INTEGRATION == 1 ? true : false;
      const isDBActive = process.env.DROPBOX_INTEGRATION == 1 ? true : false;
      const isODActive = process.env.ONEDRIVE_INTEGRATION == 1 ? true : false;
      const isSLActive = process.env.SLACK_INTEGRATION == 1 ? true : false;
      const isWPActive = process.env.WORDPRESS_INTEGRATION == 1 ? true : false;
      let gdriveClientId = process.env.GOOGLE_CLIENT_ID;
      let GOOGLE_iOS_CLIENT_ID = process.env.GOOGLE_iOS_CLIENT_ID;
      let GOOGLE_ANDROID_CLIENT_ID = process.env.GOOGLE_ANDROID_CLIENT_ID;
      let gdriveDeveloperKey = process.env.GOOGLE_CLIENT_SECRET;
      let GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
      let GOOGLE_REDIRECT_URL = process.env.GOOGLE_OAUTH_REDIRECT_URL;
      let dropboxAppKey = process.env.DROPBOX_APP_KEY;
      let dropboxAccessToken = process.env.DROPBOX_ACCESS_TOKEN;
      let dropboxRedirectUrl = process.env.FRONTEND_BASE_URL;
      let DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET;
      let microsoftClientId = process.env.MICROSOFT_CLIENT_ID;
      let MICROSOFT_REDIRECT_URL = process.env.MICROSOFT_OAUTH_REDIRECT_URL;
      let MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
      let slackVerificationToken = process.env.SLACK_VERIFICATION_TOKEN;
      let slackClientId = process.env.SLACK_CLIENT_ID;
      let SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
      let slackRedirectUri = `${process.env.BACKEND_URL}/slack/callback`;
      let WP_CLIENT_ID = process.env.WORDPRESS_CLIENT_ID;
      let WP_CLIENT_SECRET = process.env.WORDPRESS_CLIENT_SECRET;
      let WP_REDIRECT_URI = `${process.env.BACKEND_URL}/wordpress/callback`;

      logger.info('Getting user specific cloud integration configurations');

      try {
        return user.getUserMetaDetails(userId).then(async (metaData) => {
          user.getUserCloudIntegrationData(userId).then(async (cloudData) => {
            let data = {
              cloudIntegrations: [
                {
                  id: 'integration_1',
                  name: 'GoogleDrive',
                  active: false,
                  clientId_web: '',
                  clientSecret: '',
                  redirectUri: '',
                  developerKey: '',
                  clientId_ios: '',
                  clientId_android: '',
                  accessToken: '',
                  refreshToken: '',
                  time: '',
                  login: false,
                  account: '',
                  source: '',
                },
                {
                  id: 'integration_3',
                  name: 'OneDrive',
                  active: false,
                  clientId: '',
                  clientSecret: '',
                  redirectUri: '',
                  accessToken: '',
                  refreshToken: '',
                  time: '',
                  login: false,
                  account: '',
                  source: '',
                },
                {
                  id: 'integration_2',
                  name: 'Dropbox',
                  active: false,
                  clientId: '',
                  clientSecret: '',
                  redirectUri: '',
                  accessToken: '',
                  refreshToken: '',
                  time: '',
                  login: false,
                  account: '',
                  source: '',
                },
                {
                  id: 'integration_4',
                  name: 'Slack',
                  active: false,
                  clientId: '',
                  clientSecret: '',
                  redirectUri: '',
                  accessToken: '',
                  refreshToken: '',
                  time: '',
                  login: false,
                  account: '',
                  source: '',
                },
                {
                  id: 'integration_5',
                  name: 'WordPress',
                  active: false,
                  clientId: '',
                  clientSecret: '',
                  redirectUri: '',
                  accessToken: '',
                  refreshToken: '',
                  time: '',
                  login: false,
                  account: '',
                  source: '',
                },
              ],
            };

            if (isMobile) {
              if (isCIAM) {
                if (metaData.userCloudIntegrationMob == 1) {
                  if (isGDActive) {
                    if (metaData.GoogleDrive_M == 1) {
                      data.cloudIntegrations.find((i) => i.name === 'GoogleDrive').active = true;
                      data.cloudIntegrations.find((i) => i.name === 'GoogleDrive').clientId_web =
                        gdriveClientId;
                      data.cloudIntegrations.find((i) => i.name === 'GoogleDrive').clientSecret =
                        GOOGLE_CLIENT_SECRET;
                      data.cloudIntegrations.find((i) => i.name === 'GoogleDrive').redirectUri =
                        GOOGLE_REDIRECT_URL;
                      data.cloudIntegrations.find((i) => i.name === 'GoogleDrive').developerKey =
                        gdriveDeveloperKey;
                      data.cloudIntegrations.find((i) => i.name === 'GoogleDrive').clientId_ios =
                        GOOGLE_iOS_CLIENT_ID;
                      data.cloudIntegrations.find(
                        (i) => i.name === 'GoogleDrive'
                      ).clientId_android = GOOGLE_ANDROID_CLIENT_ID;
                      const GdIndex = cloudData.findIndex(
                        (i) => i.integrationId === 'integration_1'
                      );
                      if (GdIndex !== -1) {
                        data.cloudIntegrations.find((i) => i.name === 'GoogleDrive').accessToken =
                          cloudData[GdIndex].accessToken || '';
                        data.cloudIntegrations.find((i) => i.name === 'GoogleDrive').refreshToken =
                          cloudData[GdIndex].refreshToken || '';
                        data.cloudIntegrations.find((i) => i.name === 'GoogleDrive').time =
                          cloudData[GdIndex].time || '';
                        data.cloudIntegrations.find((i) => i.name === 'GoogleDrive').account =
                          cloudData[GdIndex].account || '';
                        data.cloudIntegrations.find((i) => i.name === 'GoogleDrive').source =
                          cloudData[GdIndex].source || '';
                        data.cloudIntegrations.find((i) => i.name === 'GoogleDrive').login =
                          cloudData[GdIndex].login == 1 ? true : false;
                      }
                    }
                  }
                  if (isDBActive) {
                    if (metaData.Dropbox_M == 1) {
                      data.cloudIntegrations.find((i) => i.name === 'Dropbox').active = true;
                      data.cloudIntegrations.find((i) => i.name === 'Dropbox').clientId =
                        dropboxAppKey;
                      data.cloudIntegrations.find((i) => i.name === 'Dropbox').clientSecret =
                        DROPBOX_APP_SECRET;
                      data.cloudIntegrations.find((i) => i.name === 'Dropbox').redirectUri =
                        dropboxRedirectUrl;
                      const DbIndex = cloudData.findIndex(
                        (i) => i.integrationId === 'integration_2'
                      );

                      if (DbIndex !== -1) {
                        data.cloudIntegrations.find((i) => i.name === 'Dropbox').accessToken =
                          cloudData[DbIndex].accessToken || '';
                        data.cloudIntegrations.find((i) => i.name === 'Dropbox').refreshToken =
                          cloudData[DbIndex].refreshToken || '';
                        data.cloudIntegrations.find((i) => i.name === 'Dropbox').time =
                          cloudData[DbIndex].time || '';
                        data.cloudIntegrations.find((i) => i.name === 'Dropbox').account =
                          cloudData[DbIndex].account || '';
                        data.cloudIntegrations.find((i) => i.name === 'Dropbox').source =
                          cloudData[DbIndex].source || '';
                        data.cloudIntegrations.find((i) => i.name === 'Dropbox').login =
                          cloudData[DbIndex].login == 1 ? true : false;
                      }
                    }
                  }
                  if (isODActive) {
                    if (metaData.OneDrive_M == 1) {
                      data.cloudIntegrations.find((i) => i.name === 'OneDrive').active = true;
                      data.cloudIntegrations.find((i) => i.name === 'OneDrive').clientId =
                        microsoftClientId;
                      data.cloudIntegrations.find((i) => i.name === 'OneDrive').clientSecret =
                        MICROSOFT_CLIENT_SECRET;
                      data.cloudIntegrations.find((i) => i.name === 'OneDrive').redirectUri =
                        MICROSOFT_REDIRECT_URL;
                      const OdIndex = cloudData.findIndex(
                        (i) => i.integrationId === 'integration_3'
                      );

                      if (OdIndex !== -1) {
                        data.cloudIntegrations.find((i) => i.name === 'OneDrive').accessToken =
                          cloudData[OdIndex].accessToken || '';
                        data.cloudIntegrations.find((i) => i.name === 'OneDrive').refreshToken =
                          cloudData[OdIndex].refreshToken || '';
                        data.cloudIntegrations.find((i) => i.name === 'OneDrive').time =
                          cloudData[OdIndex].time || '';
                        data.cloudIntegrations.find((i) => i.name === 'OneDrive').account =
                          cloudData[OdIndex].account || '';
                        data.cloudIntegrations.find((i) => i.name === 'OneDrive').source =
                          cloudData[OdIndex].source || '';
                        data.cloudIntegrations.find((i) => i.name === 'OneDrive').login =
                          cloudData[OdIndex].login == 1 ? true : false;
                      }
                    }
                  }
                  if (isSLActive) {
                    if (metaData.Slack_M == 1) {
                      data.cloudIntegrations.find((i) => i.name === 'Slack').active = true;
                      data.cloudIntegrations.find((i) => i.name === 'Slack').clientId =
                        slackClientId;
                      data.cloudIntegrations.find((i) => i.name === 'Slack').clientSecret =
                        SLACK_CLIENT_SECRET;
                      data.cloudIntegrations.find((i) => i.name === 'Slack').redirectUri =
                        slackRedirectUri;
                      const slIndex = cloudData.findIndex(
                        (i) => i.integrationId === 'integration_4'
                      );
                      if (slIndex !== -1) {
                        data.cloudIntegrations.find((i) => i.name === 'Slack').accessToken =
                          cloudData[slIndex].accessToken || '';
                        data.cloudIntegrations.find((i) => i.name === 'Slack').refreshToken =
                          cloudData[slIndex].refreshToken || '';
                        data.cloudIntegrations.find((i) => i.name === 'Slack').time =
                          cloudData[slIndex].time || '';
                        data.cloudIntegrations.find((i) => i.name === 'Slack').account =
                          cloudData[slIndex].account || '';
                        data.cloudIntegrations.find((i) => i.name === 'Slack').source =
                          cloudData[slIndex].source || '';
                        data.cloudIntegrations.find((i) => i.name === 'Slack').login =
                          cloudData[slIndex].login == 1 ? true : false;
                      }
                    }
                  }
                  if (isWPActive) {
                    if (metaData.Wordpress_M == 1) {
                      data.cloudIntegrations.find((i) => i.name === 'WordPress').active = true;
                      data.cloudIntegrations.find((i) => i.name === 'WordPress').clientId =
                        WP_CLIENT_ID;
                      data.cloudIntegrations.find((i) => i.name === 'WordPress').clientSecret =
                        WP_CLIENT_SECRET;
                      data.cloudIntegrations.find((i) => i.name === 'WordPress').redirectUri =
                        WP_REDIRECT_URI;
                      const wpIndex = cloudData.findIndex(
                        (i) => i.integrationId === 'integration_5'
                      );

                      if (wpIndex !== -1) {
                        data.cloudIntegrations.find((i) => i.name === 'WordPress').accessToken =
                          cloudData[wpIndex].accessToken || '';
                        data.cloudIntegrations.find((i) => i.name === 'WordPress').refreshToken =
                          cloudData[wpIndex].refreshToken || '';
                        data.cloudIntegrations.find((i) => i.name === 'WordPress').time =
                          cloudData[wpIndex].time || '';
                        data.cloudIntegrations.find((i) => i.name === 'WordPress').account =
                          cloudData[wpIndex].account || '';
                        data.cloudIntegrations.find((i) => i.name === 'WordPress').source =
                          cloudData[wpIndex].source || '';
                        data.cloudIntegrations.find((i) => i.name === 'WordPress').login =
                          cloudData[wpIndex].login == 1 ? true : false;
                      }
                    }
                  }
                }
              }
            } else {
              if (isCIA) {
                if (metaData.userCloudIntegration == 1) {
                  if (isGDActive) {
                    if (metaData.GoogleDrive == 1) {
                      data.cloudIntegrations.find((i) => i.name === 'GoogleDrive').active = true;
                      data.cloudIntegrations.find((i) => i.name === 'GoogleDrive').clientId_web =
                        gdriveClientId;
                      data.cloudIntegrations.find((i) => i.name === 'GoogleDrive').developerKey =
                        gdriveDeveloperKey;
                      const GdIndex = cloudData.findIndex(
                        (i) => i.integrationId === 'integration_1'
                      );
                      if (GdIndex !== -1) {
                        data.cloudIntegrations.find((i) => i.name === 'GoogleDrive').accessToken =
                          cloudData[GdIndex].accessToken || '';
                        data.cloudIntegrations.find((i) => i.name === 'GoogleDrive').refreshToken =
                          cloudData[GdIndex].refreshToken || '';
                        data.cloudIntegrations.find((i) => i.name === 'GoogleDrive').time =
                          cloudData[GdIndex].time || '';
                        data.cloudIntegrations.find((i) => i.name === 'GoogleDrive').account =
                          cloudData[GdIndex].account || '';
                        data.cloudIntegrations.find((i) => i.name === 'GoogleDrive').source =
                          cloudData[GdIndex].source || '';
                        data.cloudIntegrations.find((i) => i.name === 'GoogleDrive').login =
                          cloudData[GdIndex].login == 1 ? true : false;
                      }
                    }
                  }
                  if (isDBActive) {
                    if (metaData.Dropbox == 1) {
                      data.cloudIntegrations.find((i) => i.name === 'Dropbox').active = true;
                      data.cloudIntegrations.find((i) => i.name === 'Dropbox').clientId =
                        dropboxAppKey;
                      data.cloudIntegrations.find((i) => i.name === 'Dropbox').dropboxAccessToken =
                        dropboxAccessToken;
                      const DbIndex = cloudData.findIndex(
                        (i) => i.integrationId === 'integration_2'
                      );

                      if (DbIndex !== -1) {
                        data.cloudIntegrations.find((i) => i.name === 'Dropbox').accessToken =
                          cloudData[DbIndex].accessToken || '';
                        data.cloudIntegrations.find((i) => i.name === 'Dropbox').refreshToken =
                          cloudData[DbIndex].refreshToken || '';
                        data.cloudIntegrations.find((i) => i.name === 'Dropbox').time =
                          cloudData[DbIndex].time || '';
                        data.cloudIntegrations.find((i) => i.name === 'Dropbox').account =
                          cloudData[DbIndex].account || '';
                        data.cloudIntegrations.find((i) => i.name === 'Dropbox').source =
                          cloudData[DbIndex].source || '';
                        data.cloudIntegrations.find((i) => i.name === 'Dropbox').login =
                          cloudData[DbIndex].login == 1 ? true : false;
                      }
                    }
                  }
                  if (isODActive) {
                    if (metaData.OneDrive == 1) {
                      data.cloudIntegrations.find((i) => i.name === 'OneDrive').active = true;
                      data.cloudIntegrations.find((i) => i.name === 'OneDrive').clientId =
                        microsoftClientId;
                      const OdIndex = cloudData.findIndex(
                        (i) => i.integrationId === 'integration_3'
                      );

                      if (OdIndex !== -1) {
                        data.cloudIntegrations.find((i) => i.name === 'OneDrive').accessToken =
                          cloudData[OdIndex].accessToken || '';
                        data.cloudIntegrations.find((i) => i.name === 'OneDrive').refreshToken =
                          cloudData[OdIndex].refreshToken || '';
                        data.cloudIntegrations.find((i) => i.name === 'OneDrive').time =
                          cloudData[OdIndex].time || '';
                        data.cloudIntegrations.find((i) => i.name === 'OneDrive').account =
                          cloudData[OdIndex].account || '';
                        data.cloudIntegrations.find((i) => i.name === 'OneDrive').source =
                          cloudData[OdIndex].source || '';
                        data.cloudIntegrations.find((i) => i.name === 'OneDrive').login =
                          cloudData[OdIndex].login == 1 ? true : false;
                      }
                    }
                  }
                  if (isSLActive) {
                    if (metaData.Slack == 1) {
                      data.cloudIntegrations.find((i) => i.name === 'Slack').active = true;
                      data.cloudIntegrations.find(
                        (i) => i.name === 'Slack'
                      ).slackVerificationToken = slackVerificationToken;
                      const slIndex = cloudData.findIndex(
                        (i) => i.integrationId === 'integration_4'
                      );
                      if (slIndex !== -1) {
                        data.cloudIntegrations.find((i) => i.name === 'Slack').accessToken =
                          cloudData[slIndex].accessToken || '';
                        data.cloudIntegrations.find((i) => i.name === 'Slack').refreshToken =
                          cloudData[slIndex].refreshToken || '';
                        data.cloudIntegrations.find((i) => i.name === 'Slack').time =
                          cloudData[slIndex].time || '';
                        data.cloudIntegrations.find((i) => i.name === 'Slack').account =
                          cloudData[slIndex].account || '';
                        data.cloudIntegrations.find((i) => i.name === 'Slack').source =
                          cloudData[slIndex].source || '';
                        data.cloudIntegrations.find((i) => i.name === 'Slack').login =
                          cloudData[slIndex].login == 1 ? true : false;
                      }
                    }
                  }
                  if (isWPActive) {
                    if (metaData.Wordpress == 1) {
                      data.cloudIntegrations.find((i) => i.name === 'WordPress').active = true;
                      const wpIndex = cloudData.findIndex(
                        (i) => i.integrationId === 'integration_5'
                      );

                      if (wpIndex !== -1) {
                        data.cloudIntegrations.find((i) => i.name === 'WordPress').accessToken =
                          cloudData[wpIndex].accessToken || '';
                        data.cloudIntegrations.find((i) => i.name === 'WordPress').refreshToken =
                          cloudData[wpIndex].refreshToken || '';
                        data.cloudIntegrations.find((i) => i.name === 'WordPress').time =
                          cloudData[wpIndex].time || '';
                        data.cloudIntegrations.find((i) => i.name === 'WordPress').account =
                          cloudData[wpIndex].account || '';
                        data.cloudIntegrations.find((i) => i.name === 'WordPress').source =
                          cloudData[wpIndex].source || '';
                        data.cloudIntegrations.find((i) => i.name === 'WordPress').login =
                          cloudData[wpIndex].login == 1 ? true : false;
                      }
                    }
                  }
                }
              }
            }
            logger.info('Successfully fetched user specific cloud integration configurations');
            return response.status(200).send({
              success: true,
              message: 'User Cloud Integration data fetched successfully',
              data,
            });
          });
        });
      } catch (error) {
        logger.info(`Error processing user details for user ID`);
        console.error(`Error processing user details for user ID ${userId}: ${error}`);
        return response
          .status(200)
          .send({ success: false, message: 'Error getting cloud integration details' });
      }
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

  static async googleDriveFiles(request, response) {
    if (request.body.userId) {
      try {
        const user_integrations = await knex('user_integrations')
          .select('*')
          .where({ userId: request.body.userId, integrationId: 'integration_1' });
        if (user_integrations[0].login == 1) {
          const tokenresponse = await axios.post('https://oauth2.googleapis.com/token', null, {
            params: {
              client_id: process.env.GOOGLE_CLIENT_ID,
              client_secret: process.env.GOOGLE_CLIENT_SECRET,
              refresh_token: user_integrations[0].refreshToken,
              grant_type: 'refresh_token',
            },
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          });

          const newAccessToken = tokenresponse.data.access_token;
          const oauth2Client = new google.auth.OAuth2();
          oauth2Client.setCredentials({ access_token: newAccessToken });
          const drive = google.drive({ version: 'v3', auth: oauth2Client });
          const res = await drive.files.list({
            fields: 'files(id, name, mimeType, size, createdTime)',
          });
          logger.info('Google Drive files fetched successfully');
          return response.status(200).send({
            success: true,
            login: true,
            files: res.data.files,
            accessToken: newAccessToken,
          });
        } else {
          return response.status(200).send({ success: true, login: false });
        }
      } catch (error) {
        logger.error(error);
        return response.status(200).send({ success: true, login: false });
      }
    } else {
      return response
        .status(400)
        .send({ success: false, message: 'Missing parameters, fill all the required fields' });
    }
  }

  static async oneDriveFiles(request, response) {
    if (request.body.userId) {
      try {
        const user_integrations = await knex('user_integrations')
          .select('*')
          .where({ userId: request.body.userId, integrationId: 'integration_3' });
        if (user_integrations[0].login == 1) {
          const tokenResponse = await axios.post(
            'https://login.microsoftonline.com/common/oauth2/v2.0/token',
            qs.stringify({
              client_id: process.env.MICROSOFT_CLIENT_ID,
              client_secret: process.env.MICROSOFT_CLIENT_SECRET,
              refresh_token: user_integrations[0].refreshToken,
              grant_type: 'refresh_token',
              scope: 'https://graph.microsoft.com/.default',
            }),
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            }
          );

          const newAccessToken = tokenResponse.data.access_token;

          // Step 2: Use Microsoft Graph API to fetch OneDrive files
          const driveResponse = await axios.get(
            'https://graph.microsoft.com/v1.0/me/drive/root/children',
            {
              headers: {
                Authorization: `Bearer ${newAccessToken}`,
              },
            }
          );

          // Output OneDrive file list
          logger.info('One Drive files fetched successfully');
          return response.status(200).send({
            success: true,
            login: true,
            files: driveResponse.data.value,
            accessToken: newAccessToken,
          });
        } else {
          return response.status(200).send({ success: true, login: false });
        }
      } catch (error) {
        logger.error(error);
        return response.status(200).send({ success: true, login: false });
      }
    } else {
      return response
        .status(400)
        .send({ success: false, message: 'Missing parameters, fill all the required fields' });
    }
  }

  static async wordpressFiles(request, response) {
    if (request.body.userId) {
      try {
        // Step 1: Fetch the user's integration record for WordPress
        const user_integrations = await knex('user_integrations').select('*').where({
          userId: request.body.userId,
          integrationId: 'integration_5',
        });

        const integration = user_integrations[0];

        if (integration?.login == 1) {
          const accessToken = integration.accessToken;

          // Step 2: Get site URL
          const siteResponse = await axios.get(
            'https://public-api.wordpress.com/rest/v1.1/me/sites',
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );

          const siteURL = siteResponse.data.sites[0]?.URL?.replace('https://', '') || '';

          // Step 3: Fetch media files
          let mediaResponse = null;
          try {
            mediaResponse = await axios.get(
              `https://public-api.wordpress.com/wp/v2/sites/${siteURL}/media`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              }
            );
          } catch (error) {
            logger.error('Error fetching media:', error.response?.data || error.message);
            return response.status(400).json({
              success: false,
              login: true,
              message: 'Failed to fetch media files.',
            });
          }

          const mediaFiles = mediaResponse.data;
          logger.info('Wordpress files fetched successfully');

          return response.status(200).json({
            success: true,
            login: true,
            files: mediaFiles,
            accessToken: accessToken,
          });
        } else {
          return response.status(200).json({ success: true, login: false });
        }
      } catch (error) {
        logger.error('Unexpected error:', error.message);
        return response.status(200).json({ success: false, login: false, error: error.message });
      }
    } else {
      return response
        .status(400)
        .send({ success: false, message: 'Missing parameters, fill all the required fields' });
    }
  }

  static async slackFiles(request, response) {
    if (request.body.userId) {
      try {
        // Step 1: Fetch the user's Slack integration record
        const user_integrations = await knex('user_integrations').select('*').where({
          userId: request.body.userId,
          integrationId: 'integration_4',
        });

        const integration = user_integrations[0];

        if (integration?.login == 1) {
          const accessToken = integration.accessToken;

          // Step 2: Fetch Slack files
          const slackResponse = await axios.get('https://slack.com/api/files.list', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            params: {
              types: 'all', // fetch all file types
              user: integration.refreshToken,
            },
          });

          if (slackResponse.data.ok) {
            const files = slackResponse.data.files;

            logger.info('Slack files fetched successfully');

            return response.status(200).json({
              success: true,
              login: true,
              files: files,
              accessToken: accessToken,
            });
          } else {
            logger.error('Failed to retrieve Slack files:', slackResponse.data.error);
            return response.status(400).json({
              success: false,
              login: true,
              message: slackResponse.data.error,
            });
          }
        } else {
          return response.status(200).json({ success: true, login: false });
        }
      } catch (error) {
        logger.error('Unexpected error:', error.message);
        return response.status(200).json({
          success: false,
          login: false,
          message: error.message,
        });
      }
    } else {
      return response
        .status(400)
        .send({ success: false, message: 'Missing parameters, fill all the required fields' });
    }
  }

  static async dropboxFiles(request, response) {
    if (!request.body.userId) {
      return response
        .status(400)
        .send({ success: false, message: 'Missing parameters, fill all the required fields' });
    }

    try {
      const user_integrations = await knex('user_integrations').select('*').where({
        userId: request.body.userId,
        integrationId: 'integration_2', // Dropbox
      });

      const userIntegration = user_integrations[0];

      if (userIntegration && userIntegration.login === 1) {
        let accessToken = userIntegration.accessToken;

        if (userIntegration.refreshToken) {
          const tokenResponse = await axios.post(
            'https://api.dropbox.com/oauth2/token',
            qs.stringify({
              grant_type: 'refresh_token',
              refresh_token: userIntegration.refreshToken,
              client_id: process.env.DROPBOX_APP_KEY,
              client_secret: process.env.DROPBOX_APP_SECRET,
            }),
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            }
          );

          accessToken = tokenResponse.data.access_token;
        }

        // Step 1: List files from the given path
        const listResponse = await axios.post(
          'https://api.dropboxapi.com/2/files/list_folder',
          {
            path: '',
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

        const entries = listResponse.data.entries;

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

                logger.info('Dropbox files fetched successfully');

                return {
                  ...file,
                  downloadUrl: tempLinkRes.data.link,
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

        return response.status(200).send({
          success: true,
          login: true,
          files: enrichedFiles.filter(Boolean),
          accessToken,
        });
      } else {
        return response.status(200).send({ success: true, login: false });
      }
    } catch (error) {
      logger.error('Dropbox error:', error.response?.data || error.message);
      return response.status(200).send({ success: true, login: false });
    }
  }

  static sendResetPasswordLink(request, response) {
    const user = new Users(knex);

    if (request.body.email) {
      const debugData = {
        url: request.protocol + '://' + request.get('host') + request.originalUrl,
        body: { ...request.body },
        headers: request.headers,
      };
      logger.debug(JSON.stringify(debugData));
      logger.info(`Sending password reset link for ${request.body.email}`);
      logger.info(`Checking if account exists for ${request.body.email}`);
      user
        .checkIfUserExist(request.body.email)
        .then((res) => {
          if (res.length > 0) {
            logger.warn(`Account exists for ${request.body.email}`);
            user.getUserDetails(request.body.email).then((data) => {
              const userData = data;

              user
                .resetToken(userData.id)
                .then(async (result) => {
                  const { res, token } = result;
                  if (res == 1) {
                    user.getMailTemplate(4).then(async (data) => {
                      let subject = data[0].subject;
                      let html = data[0].template;
                      html = html.replace('{{name}}', userData.firstname);
                      html = html.replace(
                        '{{link}}',
                        `${process.env.FRONTEND_BASE_URL}/auth/reset-password?email=${request.body.email}&token=${token}`
                      );
                      var { transporter, mailingAddress } = await emailTransporter();
                      var mailOptions = {
                        from: mailingAddress,
                        to: userData.email,
                        subject: subject,
                        html,
                      };

                      transporter.sendMail(mailOptions, function (error, info) {
                        if (error) {
                          logger.warn(`Failed send password reset email for ${request.body.email}`);
                          logger.error(error.message);
                          logger.debug(
                            JSON.stringify({
                              success: false,
                              message: request.t('resetPassLinkSendFailed'),
                            })
                          );
                          return response.status(200).send({
                            success: false,
                            message: request.t('resetPassLinkSendFailed'),
                          });
                        }
                        logger.info(
                          `Password reset email sent successfully for ${request.body.email}`
                        );
                      });

                      logger.debug(
                        JSON.stringify({
                          success: true,
                          message: request.t('resetPassLinkSendSuccess'),
                        })
                      );
                      return response
                        .status(200)
                        .send({ success: true, message: request.t('resetPassLinkSendSuccess') });
                    });
                  } else {
                    logger.warn(`Failed to send password reset email for ${request.body.email}`);
                    logger.debug(
                      JSON.stringify({
                        success: false,
                        message: request.t('resetPassLinkSendFailed'),
                      })
                    );
                    return response
                      .status(200)
                      .send({ success: false, message: request.t('resetPassLinkSendFailed') });
                  }
                })
                .catch((err) => {
                  logger.warn(`Failed to send password reset email for ${request.body.email}`);
                  logger.error(err);
                  logger.debug(
                    JSON.stringify({
                      success: false,
                      message: request.t('resetPassLinkSendFailed'),
                    })
                  );
                  return response
                    .status(200)
                    .send({ success: false, message: request.t('resetPassLinkSendFailed') });
                });
            });
          } else {
            logger.warn(`Cannot find account registered under ${request.body.email}`);
            logger.debug(
              JSON.stringify({
                success: false,
                message: `${request.body.email} ${request.t('emailNotExist')}`,
              })
            );
            return response.status(200).send({
              success: false,
              message: `${request.body.email} ${request.t('emailNotExist')}`,
            });
          }
        })
        .catch((err) => {
          logger.warn(`Failed to send password reset email for ${request.body.email}`);
          logger.error(err);
          logger.debug(
            JSON.stringify({ success: false, message: request.t('resetPassLinkSendFailed') })
          );
          return response
            .status(200)
            .send({ success: false, message: request.t('resetPassLinkSendFailed') });
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

  static changePassword(request, response) {
    const user = new Users(knex);

    if (request.body.email && request.body.token && request.body.password) {
      const debugData = {
        url: request.protocol + '://' + request.get('host') + request.originalUrl,
        body: { ...request.body, password: '**********' },
        headers: request.headers,
      };
      logger.debug(JSON.stringify(debugData));
      logger.info(`Initiating password change for ${request.body.email}`);
      logger.info(`Validating password reset token for ${request.body.email}`);

      user
        .getUserDetails(request.body.email)
        .then((userData) => {
          const userId = userData.id;

          user
            .validateToken(userId, request.body.token)
            .then((res) => {
              if (res == 'valid') {
                logger.info(`Valid token provided by ${request.body.email}`);
                user.updatePassword(userId, request.body.password).then((res) => {
                  if (res == 1) {
                    logger.info(`Password update successful for ${request.body.email}`);
                    logger.debug(
                      JSON.stringify({ success: true, message: request.t('passChangeSuccess') })
                    );
                    return response
                      .status(200)
                      .send({ success: true, message: request.t('passChangeSuccess') });
                  } else {
                    logger.warn(`Password update failed for ${request.body.email}`);
                    logger.debug(
                      JSON.stringify({ success: false, message: request.t('passChangeFailed') })
                    );
                    return response
                      .status(200)
                      .send({ success: false, message: request.t('passChangeFailed') });
                  }
                });
              } else if (res == 'invalid token') {
                logger.warn(`Invalid token provided by ${request.body.email}`);
                logger.debug(
                  JSON.stringify({ success: false, message: request.t('resetPassLinkInvalid') })
                );
                return response
                  .status(200)
                  .send({ success: false, message: request.t('resetPassLinkInvalid') });
              } else if (res == 'expired') {
                logger.warn(`Expired token provided by ${request.body.email}`);
                logger.debug(
                  JSON.stringify({ success: false, message: request.t('resetPassLinkExpired') })
                );
                return response
                  .status(200)
                  .send({ success: false, message: request.t('resetPassLinkExpired') });
              }
            })
            .catch((err) => {
              logger.warn(`Password change failed for ${request.body.email}`);
              logger.error(err);
              logger.debug(
                JSON.stringify({ success: false, message: request.t('passChangeFailed') })
              );
              return response
                .status(200)
                .send({ success: false, message: request.t('passChangeFailed') });
            });
        })
        .catch((err) => {
          logger.warn(`Password change failed for ${request.body.email}`);
          logger.error(err);
          console.log(err);
          logger.debug(JSON.stringify({ success: false, message: request.t('passChangeFailed') }));
          return response
            .status(200)
            .send({ success: false, message: request.t('passChangeFailed') });
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

  static changeCurrentPassword(request, response) {
    const user = new Users(knex);

    if (request.body.userId && request.body.newPassword && request.body.currentPassword) {
      logger.info(`Initiating password change for user ID ${request.body.userId}`);
      logger.info(`Validating current password for user ID ${request.body.userId}`);
      user
        .validatePasswordByUserId(request.body.userId, request.body.currentPassword)
        .then((res) => {
          if (res == 'valid') {
            logger.info(`Valid password provided by user ID ${request.body.userId}`);
            user.updatePassword(request.body.userId, request.body.newPassword).then((res) => {
              if (res == 1) {
                logger.info(`Password update successful for user ID ${request.body.userId}`);
                logger.debug(
                  JSON.stringify({ success: true, message: request.t('passwordUpdateSuccess') })
                );
                return response
                  .status(200)
                  .send({ success: true, message: request.t('passwordUpdateSuccess') });
              } else {
                logger.warn(`Password update failed for user ID ${request.body.userId}`);
                logger.debug(
                  JSON.stringify({ success: false, message: request.t('passwordUpdateFailed') })
                );
                return response
                  .status(200)
                  .send({ success: false, message: request.t('passwordUpdateFailed') });
              }
            });
          } else {
            logger.warn(`Invalid password provided by user ID ${request.body.userId}`);
            logger.debug(JSON.stringify({ success: false, message: request.t('invalidPassword') }));
            return response
              .status(200)
              .send({ success: false, message: request.t('invalidPassword') });
          }
        })
        .catch((err) => {
          logger.warn(`Password update failed for user ID ${request.body.userId}`);
          logger.error(err);
          logger.debug(
            JSON.stringify({ success: false, message: request.t('passwordUpdateFailed') })
          );
          return response
            .status(200)
            .send({ success: false, message: request.t('passwordUpdateFailed') });
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

  static updateEmail(request, response) {
    const user = new Users(knex);

    if (request.body.userId && request.body.password && request.body.newEmail) {
      logger.info(`Updating email for user ID ${request.body.userId}`);
      user
        .isUpdatingSameEmail(request.body.userId, request.body.newEmail)
        .then((isSameEmail) => {
          if (isSameEmail == 'no') {
            user
              .validatePasswordByUserId(request.body.userId, request.body.password)
              .then((res) => {
                if (res == 'valid') {
                  user.updateEmail(request.body.userId, request.body.newEmail).then((res) => {
                    if (res == 1) {
                      logger.info(`Email update success for user ID ${request.body.userId}`);
                      user
                        .resetToken(request.body.userId)
                        .then(async (result) => {
                          const { res, token } = result;
                          if (res == 1) {
                            await user.updateUserMeta(request.body.userId, '2FA', 0);
                            user.getUserDetailsById(request.body.userId).then(async (user1) => {
                              user.getMailTemplate(2).then(async (data) => {
                                let subject = data[0].subject;
                                let html = data[0].template;
                                html = html.replace('{{name}}', user1.firstname);
                                html = html.replace(
                                  '{{link}}',
                                  `${process.env.FRONTEND_BASE_URL}/verify-account?id=${user1.id}&token=${token}`
                                );
                                var { transporter, mailingAddress } = await emailTransporter();
                                var mailOptions = {
                                  from: mailingAddress,
                                  to: user1.email,
                                  subject: subject,
                                  html,
                                };

                                transporter.sendMail(mailOptions, function (error, info) {
                                  if (error) {
                                    logger.warn(
                                      `Failed to send email verification to ${request.body.newEmail}`
                                    );
                                    logger.error(error.message);
                                    logger.debug(
                                      JSON.stringify({
                                        success: false,
                                        message: request.t('verifyLinkSendFailed'),
                                      })
                                    );
                                    return response.status(200).send({
                                      success: false,
                                      message: request.t('verifyLinkSendFailed'),
                                    });
                                  }
                                  logger.info(
                                    `Email verification sent to ${request.body.newEmail}`
                                  );
                                });

                                logger.debug(
                                  JSON.stringify({
                                    success: true,
                                    message: request.t('emailUpdateSuccess'),
                                    email: request.body.newEmail,
                                    accountStatus: false,
                                  })
                                );
                                return response.status(200).send({
                                  success: true,
                                  message: request.t('emailUpdateSuccess'),
                                  email: request.body.newEmail,
                                  accountStatus: false,
                                });
                              });
                            });
                          } else {
                            logger.warn(`Email update failed for ${request.body.newEmail}`);
                            logger.debug(
                              JSON.stringify({
                                success: false,
                                message: request.t('emailUpdateFailed'),
                              })
                            );
                            return response
                              .status(200)
                              .send({ success: false, message: request.t('emailUpdateFailed') });
                          }
                        })
                        .catch((err) => {
                          logger.warn(`Email update failed for ${request.body.newEmail}`);
                          logger.error(err);
                          logger.debug(
                            JSON.stringify({
                              success: false,
                              message: request.t('emailUpdateFailed'),
                            })
                          );
                          return response
                            .status(200)
                            .send({ success: false, message: request.t('emailUpdateFailed') });
                        });
                    }
                  });
                } else {
                  logger.warn(
                    `Email update failed due to invalid password provided by ${request.body.newEmail}`
                  );
                  logger.debug(
                    JSON.stringify({ success: false, message: request.t('invalidPassword') })
                  );
                  return response
                    .status(200)
                    .send({ success: false, message: request.t('invalidPassword') });
                }
              })
              .catch((err) => {
                logger.warn(`Email update failed for ${request.body.newEmail}`);
                logger.error(err);
                logger.debug(
                  JSON.stringify({ success: false, message: request.t('emailUpdateFailed') })
                );
                return response
                  .status(200)
                  .send({ success: false, message: request.t('emailUpdateFailed') });
              });
          } else {
            logger.warn(`Email update failed, current email and new email are same`);
            logger.debug(JSON.stringify({ success: false, message: request.t('sameEmail') }));
            return response.status(200).send({ success: false, message: request.t('sameEmail') });
          }
        })
        .catch((err) => {
          logger.warn(`Email update failed for ${request.body.newEmail}`);
          logger.error(err);
          logger.debug(JSON.stringify({ success: false, message: request.t('emailUpdateFailed') }));
          return response
            .status(200)
            .send({ success: false, message: request.t('emailUpdateFailed') });
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

  static enableTwoFactorAuth(request, response) {
    const user = new Users(knex);

    if (request.body.userId) {
      logger.info(`Enabling 2FA for ${request.body.userId}`);
      user
        .enable2FA(request.body.userId)
        .then((res) => {
          if (res == 1) {
            logger.info(`2FA enabled for ${request.body.userId}`);
            logger.debug(JSON.stringify({ success: true, message: request.t('2FAEnableSuccess') }));
            return response
              .status(200)
              .send({ success: true, message: request.t('2FAEnableSuccess') });
          } else {
            logger.warn(`Failed to enable 2FA for ${request.body.userId}`);
            logger.debug(JSON.stringify({ success: false, message: request.t('2FAEnableFailed') }));
            return response
              .status(200)
              .send({ success: false, message: request.t('2FAEnableFailed') });
          }
        })
        .catch((err) => {
          logger.warn(`Failed to enable 2FA for ${request.body.userId}`);
          logger.error(err);
          logger.debug(JSON.stringify({ success: false, message: request.t('2FAEnableFailed') }));
          return response
            .status(200)
            .send({ success: false, message: request.t('2FAEnableFailed') });
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

  static disableTwoFactorAuth(request, response) {
    const user = new Users(knex);

    if (request.body.userId) {
      logger.info(`Disabling 2FA for ${request.body.userId}`);
      user
        .disable2FA(request.body.userId)
        .then((res) => {
          if (res == 1) {
            logger.info(`2FA disabled for ${request.body.userId}`);
            logger.debug(
              JSON.stringify({ success: true, message: request.t('2FADisableSuccess') })
            );
            return response
              .status(200)
              .send({ success: true, message: request.t('2FADisableSuccess') });
          } else {
            logger.warn(`Failed to disable 2FA for ${request.body.userId}`);
            logger.debug(
              JSON.stringify({ success: false, message: request.t('2FADisableFailed') })
            );
            return response
              .status(200)
              .send({ success: false, message: request.t('2FADisableFailed') });
          }
        })
        .catch((err) => {
          logger.warn(`Failed to disable 2FA for ${request.body.userId}`);
          logger.error(err);
          logger.debug(JSON.stringify({ success: false, message: request.t('2FADisableFailed') }));
          return response
            .status(200)
            .send({ success: false, message: request.t('2FADisableFailed') });
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

  static enableCompanyTwoFactorAuth(request, response) {
    const user = new Users(knex);

    if (request.body.companyId && request.body.userId) {
      logger.info(`Enabling company 2FA for ${request.body.companyId}`);
      logger.warn(`Failed to enable company 2FA for ${request.body.companyId}`);
      user
        .enableCompany2FA(request.body.companyId, request.body.userId)
        .then((res) => {
          if (res == 1) {
            logger.info(`Company 2FA enabled for ${request.body.companyId}`);
            logger.info(`Enabling 2FA for company users`);
            user.enable2FAForAllCompanyUsers(request.body.companyId).then((res) => {
              if (res == 1) {
                logger.info(`2FA enabled for all company users`);
                logger.debug(
                  JSON.stringify({ success: true, message: request.t('company2FAEnableSuccess') })
                );
                return response
                  .status(200)
                  .send({ success: true, message: request.t('company2FAEnableSuccess') });
              } else {
                logger.warn(`Failed to enable 2FA for company users`);
                logger.debug(
                  JSON.stringify({
                    success: false,
                    message: request.t('company2FAEnableSuccessUsers2FAFailed'),
                  })
                );
                return response.status(200).send({
                  success: false,
                  message: request.t('company2FAEnableSuccessUsers2FAFailed'),
                });
              }
            });
          } else {
            logger.warn(`Failed to enable 2FA for company Id ${request.body.companyId}`);
            logger.debug(
              JSON.stringify({ success: false, message: request.t('company2FAEnableFailed') })
            );
            return response
              .status(200)
              .send({ success: false, message: request.t('company2FAEnableFailed') });
          }
        })
        .catch((err) => {
          logger.warn(`Failed to enable 2FA for company Id ${request.body.companyId}`);
          logger.error(err);
          logger.debug(
            JSON.stringify({ success: false, message: request.t('company2FAEnableFailed') })
          );
          return response
            .status(200)
            .send({ success: false, message: request.t('company2FAEnableFailed') });
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

  static disableCompanyTwoFactorAuth(request, response) {
    const user = new Users(knex);

    if (request.body.companyId) {
      logger.info(`Disabling company 2FA for ${request.body.companyId}`);
      logger.warn(`Failed to disable company 2FA for ${request.body.companyId}`);
      user
        .disableCompany2FA(request.body.companyId)
        .then((res) => {
          if (res == 1) {
            logger.info(`Company 2FA disabled for ${request.body.companyId}`);
            logger.info(`Disabling 2FA for company users`);
            user.disable2FAForAllCompanyUsers(request.body.companyId).then((res) => {
              if (res == 1) {
                logger.info(`2FA disabled for all company users`);
                logger.debug(
                  JSON.stringify({ success: true, message: request.t('company2FADisableSuccess') })
                );
                return response
                  .status(200)
                  .send({ success: true, message: request.t('company2FADisableSuccess') });
              } else {
                logger.warn(`Failed to disable 2FA for company users`);
                logger.debug(
                  JSON.stringify({
                    success: false,
                    message: request.t('company2FADisableSuccessUsers2FAFailed'),
                  })
                );
                return response.status(200).send({
                  success: false,
                  message: request.t('company2FADisableSuccessUsers2FAFailed'),
                });
              }
            });
          } else {
            logger.warn(`Failed to disable 2FA for company Id ${request.body.companyId}`);
            logger.debug(
              JSON.stringify({ success: false, message: request.t('company2FADisableFailed') })
            );
            return response
              .status(200)
              .send({ success: false, message: request.t('company2FADisableFailed') });
          }
        })
        .catch((err) => {
          logger.warn(`Failed to disable 2FA for company Id ${request.body.companyId}`);
          logger.error(err);
          logger.debug(
            JSON.stringify({ success: false, message: request.t('company2FADisableFailed') })
          );
          return response
            .status(200)
            .send({ success: false, message: request.t('company2FADisableFailed') });
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

  static getAccountStatictic(request, response) {
    const user = new Users(knex);

    logger.info(`Fetching account statistics for user ID ${request.body.userId}`);
    user
      .getAccountStatistic(request.body.userId)
      .then((statData) => {
        if (statData) {
          logger.info(`Account stat fetched successfully for user ID ${request.body.userId}`);
          return response
            .status(200)
            .send({ success: true, message: request.t('accountStatFetchSuccess'), statData });
        } else {
          logger.warn(`Failed to fetch account stat for user ID ${request.body.userId}`);
          return response
            .status(200)
            .send({ success: false, message: request.t('accountStatFetchFailed') });
        }
      })
      .catch((err) => {
        logger.warn(`Failed to fetch account stat for user ID ${request.body.userId}`);
        logger.error(err);
        return response
          .status(200)
          .send({ success: false, message: request.t('accountStatFetchFailed') });
      });
  }

  static sendInvitation(request, response) {
    const user = new Users(knex);

    if (
      request.body.email &&
      request.body.senderId &&
      request.body.role &&
      request.body.companyId
    ) {
      logger.info(`Sending invitation to ${request.body.email}`);
      logger.info(`Checking if account registered under ${request.body.email}`);
      user
        .checkIfUserExist(request.body.email)
        .then((res) => {
          if (res.length > 0) {
            logger.info(`Account exist under ${request.body.email}`);
            logger.debug(
              JSON.stringify({ success: false, message: request.t('invtiationAlreadyExist') })
            );
            return response.send({ success: false, message: request.t('invtiationAlreadyExist') });
          } else {
            user
              .getCompanyUserCount(request.body.companyId)
              .then(async (userCount) => {
                logger.info(`User count data fetched: ${userCount}`);
                logger.debug(JSON.stringify({ success: true, noOfUsers: userCount }));

                const superAdmin = new SuperAdmin(knex);
                let maxInvite = process.env.MAX_USERS;

                if (userCount <= maxInvite) {
                  user.isInvitationSent(request.body.email).then((inviteSent) => {
                    if (inviteSent == 'no') {
                      user
                        .addInvitationDetails(
                          request.body.email,
                          request.body.senderId,
                          request.body.role,
                          request.body.companyId
                        )
                        .then((res) => {
                          const { invitationId, token } = res;

                          user
                            .getUserDetailsById(request.body.senderId)
                            .then((_sender) => {
                              const senderName = _sender.firstname;

                              user
                                .getCompanyDetails(request.body.companyId)
                                .then(async (companyData) => {
                                  if (companyData) {
                                    user.getMailTemplate(3).then(async (data) => {
                                      let subject = data[0].subject;
                                      subject = subject.replace('{{usermail}}', request.body.email);
                                      let html = data[0].template;
                                      html = html.replace('{{sender}}', senderName);
                                      html = html.replace('{{usermail}}', request.body.email);
                                      html = html.replace(
                                        '{{acceptLink}}',
                                        `${process.env.FRONTEND_BASE_URL}/auth/create-account?email=${request.body.email}&token=${token}`
                                      );
                                      html = html.replace(
                                        '{{denyLink}}',
                                        `${process.env.FRONTEND_BASE_URL}/auth/decline-invitation?email=${request.body.email}&token=${token}`
                                      );
                                      var { transporter, mailingAddress } =
                                        await emailTransporter();
                                      var mailOptions2 = {
                                        from: mailingAddress,
                                        to: request.body.email,
                                        subject: subject,
                                        html,
                                      };

                                      transporter.sendMail(mailOptions2, function (error, info) {
                                        if (error) {
                                          logger.warn(
                                            `Failed to send invitation to ${request.body.email}`
                                          );
                                          logger.error(error.message);
                                          return console.log(error);
                                        }
                                        logger.info(`Invitation sent to ${request.body.email}`);
                                        if (info.accepted.length > 0) {
                                          logger.debug(
                                            JSON.stringify({
                                              success: true,
                                              message: request.t('invitationSentSuccess'),
                                            })
                                          );
                                          return response.status(200).send({
                                            success: true,
                                            message: request.t('invitationSentSuccess'),
                                          });
                                        } else {
                                          logger.warn(
                                            `Failed to send invitation mail to ${request.body.email}`
                                          );
                                          logger.debug(
                                            JSON.stringify({
                                              success: false,
                                              message: request.t('invitationSentFailed'),
                                            })
                                          );
                                          return response.status(200).send({
                                            success: false,
                                            message: request.t('invitationSentFailed'),
                                          });
                                        }
                                      });
                                    });
                                  } else {
                                    console.log('No Company data');
                                    logger.warn(
                                      `Failed to send invitation to ${request.body.email}`
                                    );
                                    logger.debug(
                                      JSON.stringify({
                                        success: false,
                                        message: request.t('invitationSentFailed'),
                                      })
                                    );
                                    return response.status(200).send({
                                      success: false,
                                      message: request.t('invitationSentFailed'),
                                    });
                                  }
                                })
                                .catch((err) => {
                                  logger.warn(`Failed to send invitation to ${request.body.email}`);
                                  logger.error(err);
                                  logger.debug(
                                    JSON.stringify({
                                      success: false,
                                      message: request.t('invitationSentFailed'),
                                    })
                                  );
                                  return response.status(200).send({
                                    success: false,
                                    message: request.t('invitationSentFailed'),
                                  });
                                });
                            })
                            .catch((err) => {
                              logger.warn(`Failed to send invitation to ${request.body.email}`);
                              logger.error(err);
                              logger.debug(
                                JSON.stringify({
                                  success: false,
                                  message: request.t('invitationSentFailed'),
                                })
                              );
                              return response.status(200).send({
                                success: false,
                                message: request.t('invitationSentFailed'),
                              });
                            });
                        })
                        .catch((err) => {
                          logger.warn(`Failed to send invitation to ${request.body.email}`);
                          logger.error(err);
                          logger.debug(
                            JSON.stringify({
                              success: false,
                              message: request.t('invitationSentFailed'),
                            })
                          );
                          return response
                            .status(200)
                            .send({ success: false, message: request.t('invitationSentFailed') });
                        });
                    } else {
                      logger.info(`Invitation already exists for ${request.body.email}`);
                      logger.debug(
                        JSON.stringify({
                          success: false,
                          message: request.t('invitationAlreadySent'),
                        })
                      );
                      return response
                        .status(200)
                        .send({ success: false, message: request.t('invitationAlreadySent') });
                    }
                  });
                } else {
                  logger.debug(
                    JSON.stringify({
                      success: false,
                      message: 'You have reached the maximum number of users.',
                    })
                  );
                  return response.status(200).send({
                    success: false,
                    message: 'You have reached the maximum number of users.',
                  });
                }
              })
              .catch((err) => {
                logger.warn(`Failed to send invitation to ${request.body.email}`);
                logger.error(err);
                logger.debug(
                  JSON.stringify({ success: false, message: request.t('invitationSentFailed') })
                );
                return response
                  .status(200)
                  .send({ success: false, message: request.t('invitationSentFailed') });
              });
          }
        })
        .catch((err) => {
          logger.warn(`Failed to send invitation to ${request.body.email}`);
          logger.error(err);
          logger.debug(
            JSON.stringify({ success: false, message: request.t('invitationSentFailed') })
          );
          return response
            .status(200)
            .send({ success: false, message: request.t('invitationSentFailed') });
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

  static getInvitationList(request, response) {
    const user = new Users(knex);

    if (request.body.limit && request.body.companyId) {
      request.body.offset = request.body.offset ? request.body.offset : 0;
      logger.info(`Fetching invitation list for company Id ${request.body.companyId}`);
      if (request.body.searchString && request.body.searchString != '') {
        user
          .searchUser(
            request.body.searchString,
            request.body.offset,
            request.body.limit,
            request.body.companyId
          )
          .then((invitationList) => {
            user
              .getTotalNumberOfPageForFilteredInvitationList(
                request.body.limit,
                request.body.companyId,
                request.body.searchString
              )
              .then((recordCounts) => {
                const { totalPageNum, noOfRecords } = recordCounts;
                logger.info(
                  `Invitation list successfully fetched for company Id ${request.body.companyId}`
                );
                logger.debug(
                  JSON.stringify({ success: true, invitationList, totalPageNum, noOfRecords })
                );
                return response
                  .status(200)
                  .send({ success: true, invitationList, totalPageNum, noOfRecords });
              });
          })
          .catch((err) => {
            logger.warn(`Failed to fetch invitation list for ${request.body.companyId}`);
            logger.error(err);
            logger.debug(
              JSON.stringify({ success: false, message: request.t('invitationListFetchFailed') })
            );
            return response
              .status(200)
              .send({ success: false, message: request.t('invitationListFetchFailed') });
          });
      } else {
        user
          .getInvitationList(request.body.offset, request.body.limit, request.body.companyId)
          .then((invitationList) => {
            user
              .getTotalNumberOfPageForInvitationList(request.body.limit, request.body.companyId)
              .then((recordCounts) => {
                const { totalPageNum, noOfRecords } = recordCounts;
                logger.info(
                  `Invitation list successfully fetched for company Id ${request.body.companyId}`
                );
                logger.debug(
                  JSON.stringify({ success: true, invitationList, totalPageNum, noOfRecords })
                );
                return response
                  .status(200)
                  .send({ success: true, invitationList, totalPageNum, noOfRecords });
              });
          })
          .catch((err) => {
            logger.warn(`Failed to fetch invitation list for ${request.body.companyId}`);
            logger.error(err);
            logger.debug(
              JSON.stringify({ success: false, message: request.t('invitationListFetchFailed') })
            );
            return response
              .status(200)
              .send({ success: false, message: request.t('invitationListFetchFailed') });
          });
      }
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

  static deleteInvitations(request, response) {
    const user = new Users(knex);

    if (request.body.invitationIds && request.body.limit && request.body.companyId) {
      logger.info(`Deleting invitations for company ID ${request.body.companyId}`);
      user
        .deleteInvitations(request.body.invitationIds)
        .then((res) => {
          if (res == 1) {
            logger.info(`Invitations deleted successfully for ${request.body.companyId}`);
            logger.info(`Fetching updated list for company ID ${request.body.companyId}`);
            user
              .getInvitationList(0, request.body.limit, request.body.companyId)
              .then((invitationList) => {
                user
                  .getTotalNumberOfPageForInvitationList(request.body.limit, request.body.companyId)
                  .then((recordCounts) => {
                    const { totalPageNum, noOfRecords } = recordCounts;
                    logger.info(
                      `Updated invitation list fetched successfully for ${request.body.companyId}`
                    );
                    logger.debug(
                      JSON.stringify({
                        success: true,
                        invitationList,
                        totalPageNum,
                        noOfRecords,
                        message: request.t('userDeletionSuccess'),
                      })
                    );
                    return response.status(200).send({
                      success: true,
                      invitationList,
                      totalPageNum,
                      noOfRecords,
                      message: request.t('userDeletionSuccess'),
                    });
                  });
              })
              .catch((err) => {
                logger.error(err);
                logger.warn(
                  `Failed to fetch the updated the invitation list for company ID ${request.body.companyId}`
                );
                logger.debug(
                  JSON.stringify({ success: false, message: request.t('userDeletionFailed1') })
                );
                return response
                  .status(200)
                  .send({ success: false, message: request.t('userDeletionFailed1') });
              });
          }
        })
        .catch((err) => {
          logger.warn(`Failed to delete the invitations for ${request.body.companyId}`);
          logger.error(err);
          logger.debug(
            JSON.stringify({ success: false, message: request.t('userDeletionFailed2') })
          );
          return response
            .status(200)
            .send({ success: false, message: request.t('userDeletionFailed2') });
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

  static deleteInvitation(request, response) {
    const user = new Users(knex);

    if (request.body.invitationId && request.body.limit && request.body.companyId) {
      logger.info(`Deleting invitation for company ID ${request.body.companyId}`);
      logger.warn(`Failed to delete the invitations for ${request.body.companyId}`);
      user
        .deleteInvitation(request.body.invitationId)
        .then((res) => {
          if (res == 1) {
            logger.info(`Invitation deleted successfully for ${request.body.companyId}`);
            logger.info(`Fetching updated list for company ID ${request.body.companyId}`);
            user
              .getInvitationList(0, request.body.limit, request.body.companyId)
              .then((invitationList) => {
                user
                  .getTotalNumberOfPageForInvitationList(request.body.limit, request.body.companyId)
                  .then((recordCounts) => {
                    const { totalPageNum, noOfRecords } = recordCounts;
                    logger.info(
                      `Updated invitation list fetched successfully for ${request.body.companyId}`
                    );
                    logger.debug(
                      JSON.stringify({
                        success: true,
                        invitationList,
                        totalPageNum,
                        noOfRecords,
                        message: request.t('userDeletionSuccess'),
                      })
                    );
                    return response.status(200).send({
                      success: true,
                      invitationList,
                      totalPageNum,
                      noOfRecords,
                      message: request.t('userDeletionSuccess'),
                    });
                  });
              })
              .catch((err) => {
                logger.warn(
                  `Failed to fetch the updated the invitation list for company ID ${request.body.companyId}`
                );
                logger.error(err);
                logger.debug(
                  JSON.stringify({ success: false, message: request.t('userDeletionFailed1') })
                );
                return response
                  .status(200)
                  .send({ success: false, message: request.t('userDeletionFailed1') });
              });
          }
        })
        .catch((err) => {
          logger.warn(`Failed to delete the invitation for ${request.body.companyId}`);
          logger.error(err);
          logger.debug(
            JSON.stringify({ success: false, message: request.t('userDeletionFailed2') })
          );
          return response
            .status(200)
            .send({ success: false, message: request.t('userDeletionFailed2') });
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

  static resendInvitation(request, response) {
    const user = new Users(knex);

    if (request.body.email && request.body.limit && request.body.companyId) {
      request.body.offset = request.body.offset ? request.body.offset : 0;
      logger.info(`Resending invitation to ${request.body.email}`);
      logger.info(`Checking if account registered under ${request.body.email}`);
      user.checkIfUserExist(request.body.email).then((res) => {
        if (res.length > 0) {
          logger.info(`Account exist under ${request.body.email}`);
          logger.debug(
            JSON.stringify({
              success: false,
              message: request.t('invitationSendFailedAlreadyRegistered'),
            })
          );
          return response
            .status(200)
            .send({ success: false, message: request.t('invitationSendFailedAlreadyRegistered') });
        } else {
          user
            .getCompanyUserCount(request.body.companyId)
            .then(async (userCount) => {
              logger.info(`User count data fetched: ${userCount}`);
              logger.debug(JSON.stringify({ success: true, noOfUsers: userCount }));

              const superAdmin = new SuperAdmin(knex);
              let maxInvite = process.env.MAX_USERS;

              if (userCount <= maxInvite) {
                user.isInvitationSent(request.body.email).then((inviteSent) => {
                  if (inviteSent == 'no') {
                    user
                      .addInvitationDetails(
                        request.body.email,
                        request.body.senderId,
                        request.body.role,
                        request.body.companyId
                      )
                      .then((res) => {
                        const { invitationId, token } = res;

                        user
                          .getUserDetailsById(request.body.senderId)
                          .then((_sender) => {
                            const senderName = _sender.firstname;

                            user
                              .getCompanyDetails(request.body.companyId)
                              .then(async (companyData) => {
                                if (companyData) {
                                  user.getMailTemplate(3).then(async (data) => {
                                    let subject = data[0].subject;
                                    subject = subject.replace(
                                      '{{usermail}}',
                                      request.body.username
                                    );
                                    let html = data[0].template;
                                    html = html.replace('{{username}}', request.body.username);
                                    html = html.replace('{{usermail}}', request.body.email);
                                    html = html.replace('{{sender}}', senderName);
                                    html = html.replace(
                                      '{{acceptLink}}',
                                      `${process.env.FRONTEND_BASE_URL}/auth/create-account?email=${request.body.email}&token=${token}`
                                    );
                                    html = html.replace(
                                      '{{denyLink}}',
                                      `${process.env.FRONTEND_BASE_URL}/auth/decline-invitation?email=${request.body.email}&token=${token}`
                                    );
                                    var { transporter, mailingAddress } = await emailTransporter();
                                    var mailOptions2 = {
                                      from: mailingAddress,
                                      to: request.body.email,
                                      subject: subject,
                                      html,
                                    };

                                    transporter.sendMail(mailOptions2, function (error, info) {
                                      if (error) {
                                        logger.warn(
                                          `Failed to send invitation to ${request.body.email}`
                                        );
                                        logger.error(error.message);
                                        return console.log(error);
                                      }
                                      logger.info(`Invitation sent to ${request.body.email}`);
                                      if (info.accepted.length > 0) {
                                        logger.debug(
                                          JSON.stringify({
                                            success: true,
                                            message: request.t('invitationSentSuccess'),
                                          })
                                        );
                                        return response.status(200).send({
                                          success: true,
                                          message: request.t('invitationSentSuccess'),
                                        });
                                      } else {
                                        logger.warn(
                                          `Failed to send invitation mail to ${request.body.email}`
                                        );
                                        logger.debug(
                                          JSON.stringify({
                                            success: false,
                                            message: request.t('invitationSentFailed'),
                                          })
                                        );
                                        return response.status(200).send({
                                          success: false,
                                          message: request.t('invitationSentFailed'),
                                        });
                                      }
                                    });
                                  });
                                } else {
                                  console.log('No Company data');
                                  logger.warn(`Failed to send invitation to ${request.body.email}`);
                                  logger.debug(
                                    JSON.stringify({
                                      success: false,
                                      message: request.t('invitationSentFailed'),
                                    })
                                  );
                                  return response.status(200).send({
                                    success: false,
                                    message: request.t('invitationSentFailed'),
                                  });
                                }
                              })
                              .catch((err) => {
                                logger.warn(`Failed to send invitation to ${request.body.email}`);
                                logger.error(err);
                                logger.debug(
                                  JSON.stringify({
                                    success: false,
                                    message: request.t('invitationSentFailed'),
                                  })
                                );
                                return response.status(200).send({
                                  success: false,
                                  message: request.t('invitationSentFailed'),
                                });
                              });
                          })
                          .catch((err) => {
                            logger.warn(`Failed to send invitation to ${request.body.email}`);
                            logger.error(err);
                            logger.debug(
                              JSON.stringify({
                                success: false,
                                message: request.t('invitationSentFailed'),
                              })
                            );
                            return response
                              .status(200)
                              .send({ success: false, message: request.t('invitationSentFailed') });
                          });
                      })
                      .catch((err) => {
                        logger.warn(`Failed to send invitation to ${request.body.email}`);
                        logger.error(err);
                        logger.debug(
                          JSON.stringify({
                            success: false,
                            message: request.t('invitationSentFailed'),
                          })
                        );
                        return response
                          .status(200)
                          .send({ success: false, message: request.t('invitationSentFailed') });
                      });
                  } else {
                    logger.info(`Invitation already exists for ${request.body.email}`);
                    user
                      .updateInvitationDetails(request.body.email, request.body.companyId)
                      .then((res) => {
                        const { invitationId, token } = res;

                        user
                          .getUserDetailsById(request.decoded.userId)
                          .then((_sender) => {
                            const senderName = _sender.firstname;

                            user
                              .getCompanyDetails(request.body.companyId)
                              .then(async (companyData) => {
                                if (companyData) {
                                  user.getMailTemplate(3).then(async (data) => {
                                    let subject = data[0].subject;
                                    subject = subject.replace('{{usermail}}', request.body.email);
                                    let html = data[0].template;
                                    html = html.replace('{{username}}', request.body.email);
                                    html = html.replace('{{usermail}}', request.body.email);
                                    html = html.replace('{{sender}}', senderName);
                                    html = html.replace(
                                      '{{acceptLink}}',
                                      `${process.env.FRONTEND_BASE_URL}/auth/create-account?email=${request.body.email}&token=${token}`
                                    );
                                    html = html.replace(
                                      '{{denyLink}}',
                                      `${process.env.FRONTEND_BASE_URL}/auth/decline-invitation?email=${request.body.email}&token=${token}`
                                    );
                                    var { transporter, mailingAddress } = await emailTransporter();
                                    var mailOptions2 = {
                                      from: mailingAddress,
                                      to: request.body.email,
                                      subject: subject,
                                      html,
                                    };

                                    transporter.sendMail(mailOptions2, function (error, info) {
                                      if (error) {
                                        logger.warn(
                                          `Failed to send invitation to ${request.body.email}`
                                        );
                                        logger.error(error.message);
                                        return console.log(error);
                                      }
                                      logger.info(`Invitation sent to ${request.body.email}`);
                                      if (info.accepted.length > 0) {
                                        user
                                          .getInvitationList(
                                            request.body.offset,
                                            request.body.limit,
                                            request.body.companyId
                                          )
                                          .then((invitationList) => {
                                            user
                                              .getTotalNumberOfPageForInvitationList(
                                                request.body.limit,
                                                request.body.companyId
                                              )
                                              .then((recordCounts) => {
                                                const { totalPageNum, noOfRecords } = recordCounts;
                                                logger.info(
                                                  `Updated invitation list fetched successfully for ${request.body.companyId}`
                                                );
                                                logger.debug(
                                                  JSON.stringify({
                                                    success: true,
                                                    message: request.t('invitationSentSuccess'),
                                                  })
                                                );
                                                return response.status(200).send({
                                                  success: true,
                                                  message: request.t('invitationSentSuccess'),
                                                  invitationList,
                                                  totalPageNum,
                                                  noOfRecords,
                                                });
                                              });
                                          });
                                      } else {
                                        logger.warn(
                                          `Failed to send invitation mail to ${request.body.email}`
                                        );
                                        logger.debug(
                                          JSON.stringify({
                                            success: false,
                                            message: request.t('invitationSentFailed'),
                                          })
                                        );
                                        return response.status(200).send({
                                          success: false,
                                          message: request.t('invitationSentFailed'),
                                        });
                                      }
                                    });
                                  });
                                } else {
                                  console.log('No Company data');
                                  logger.warn(`Failed to send invitation to ${request.body.email}`);
                                  logger.debug(
                                    JSON.stringify({
                                      success: false,
                                      message: request.t('invitationSentFailed'),
                                    })
                                  );
                                  return response.status(200).send({
                                    success: false,
                                    message: request.t('invitationSentFailed'),
                                  });
                                }
                              })
                              .catch((err) => {
                                logger.warn(`Failed to send invitation to ${request.body.email}`);
                                logger.error(err);
                                logger.debug(
                                  JSON.stringify({
                                    success: false,
                                    message: request.t('invitationSentFailed'),
                                  })
                                );
                                return response.status(200).send({
                                  success: false,
                                  message: request.t('invitationSentFailed'),
                                });
                              });
                          })
                          .catch((err) => {
                            logger.warn(`Failed to send invitation to ${request.body.email}`);
                            logger.error(err);
                            logger.debug(
                              JSON.stringify({
                                success: false,
                                message: request.t('invitationSentFailed'),
                              })
                            );
                            return response
                              .status(200)
                              .send({ success: false, message: request.t('invitationSentFailed') });
                          });
                      });
                  }
                });
              } else {
                logger.debug(
                  JSON.stringify({
                    success: false,
                    message: 'You have reached the maximum number of users.',
                  })
                );
                return response.status(200).send({
                  success: false,
                  message: 'You have reached the maximum number of users.',
                });
              }
            })
            .catch((err) => {
              logger.warn(`Failed to send invitation to ${request.body.email}`);
              logger.error(err);
              logger.debug(
                JSON.stringify({ success: false, message: request.t('invitationSentFailed') })
              );
              return response
                .status(200)
                .send({ success: false, message: request.t('invitationSentFailed') });
            });
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

  static getInvitationData(request, response) {
    const user = new Users(knex);

    if (request.body.email && request.body.token) {
      logger.info(`Fetching invitation detail for ${request.body.email}`);
      user
        .getInvitationDetail(request.body.email)
        .then((invitationData) => {
          if (invitationData) {
            const tnow = Date.now();
            const tDiff = tnow - parseInt(invitationData.token_issued);

            if (invitationData.status == 'Pending') {
              if (tDiff < 43200000) {
                if (invitationData.token == request.body.token) {
                  logger.info(`Valid invitation provided by ${request.body.email}`);
                  logger.debug(JSON.stringify({ success: true, status: 'valid', invitationData }));
                  return response
                    .status(200)
                    .send({ success: true, status: 'valid', invitationData });
                } else {
                  logger.warn(`Invalid invitation provided by ${request.body.email}`);
                  logger.debug(JSON.stringify({ success: false, status: 'invalid-token' }));
                  return response.status(200).send({ success: false, status: 'invalid-token' });
                }
              } else {
                logger.info(`Expired invitation provided by ${request.body.email}`);
                logger.debug(JSON.stringify({ success: false, status: 'expired' }));
                return response.status(200).send({ success: false, status: 'expired' });
              }
            } else if (invitationData.status == 'Declined') {
              logger.info(`Declined invitation provided by ${request.body.email}`);
              logger.debug(JSON.stringify({ success: false, status: 'declined' }));
              return response.status(200).send({ success: false, status: 'declined' });
            } else if (invitationData.status == 'Registered') {
              logger.info(`Registered invitation provided by ${request.body.email}`);
              logger.debug(JSON.stringify({ success: false, status: 'registered' }));
              return response.status(200).send({ success: false, status: 'registered' });
            }
          } else {
            logger.warn(`Invalid invitation provided by ${request.body.email}`);
            logger.debug(JSON.stringify({ success: false, status: 'invalid' }));
            return response.status(200).send({ success: false, status: 'invalid' });
          }
        })
        .catch((err) => {
          logger.warn(`Invalid invitation provided by ${request.body.email}`);
          logger.error(err);
          logger.debug(JSON.stringify({ success: false, status: 'invalid' }));
          return response.status(200).send({ success: false, status: 'invalid' });
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

  static createAccountForInvitedUser(request, response) {
    const user = new Users(knex);

    if (request.body.signUpMethod == 'email') {
      if (
        request.body.firstname &&
        request.body.lastname &&
        request.body.email &&
        request.body.countryCode &&
        request.body.mobileNumber &&
        request.body.password &&
        request.body.companyId &&
        request.body.role &&
        request.body.token &&
        request.body.signUpMethod
      ) {
        const debugData = {
          url: request.protocol + '://' + request.get('host') + request.originalUrl,
          body: { ...request.body, password: '**********' },
          headers: request.headers,
        };
        logger.debug(JSON.stringify(debugData));
        logger.info(`Creating account for invited user ${request.body.email}`);
        user
          .getInvitationDetail(request.body.email)
          .then((invitationData) => {
            if (invitationData) {
              const tnow = Date.now();
              const tDiff = tnow - parseInt(invitationData.token_issued);
              logger.info(`Checking Invitaion Status`);
              if (invitationData.status == 'Pending') {
                if (tDiff < 43200000) {
                  logger.info(`Checking Pending Invitaion Status is expired or not`);
                  if (invitationData.token == request.body.token) {
                    logger.info(`Fetching company details for invited user`);
                    user
                      .getCompanyDetails(request.body.companyId)
                      .then((companyData) => {
                        if (companyData) {
                          user
                            .createNewAccountForInvitedUser(
                              request.body.firstname,
                              request.body.lastname,
                              request.body.email,
                              request.body.countryCode,
                              request.body.mobileNumber,
                              request.body.password,
                              companyData.companytwoFactorAuth,
                              request.body.companyId,
                              request.body.role,
                              request.body.signUpMethod
                            )
                            .then((res) => {
                              const { userId } = res;
                              user
                                .updateInvitationStatusAndUserId(
                                  'Registered',
                                  request.body.email,
                                  userId
                                )
                                .then((res) => {
                                  user
                                    .getUserDetailsById(userId)
                                    .then((data) => {
                                      let userData = data;
                                      userData = { ...userData, ...companyData };

                                      user.getCompanyRole(userData.id).then((roleData) => {
                                        const jwtToken = jwt.sign(
                                          {
                                            userId: userData.id,
                                            firstname: userData.firstname,
                                            email: userData.email,
                                            role: roleData.role,
                                            company: roleData.company,
                                          },
                                          process.env.TOKEN_SECRET,
                                          { expiresIn: '30 days' }
                                        );

                                        let _auth = {
                                          auth: {
                                            api_token: jwtToken,
                                          },
                                        };

                                        userData = { ...userData, ..._auth, role: roleData.role };

                                        user
                                          .getUserDetailsById(invitationData.sender)
                                          .then(async (senderData) => {
                                            user.getMailTemplate(7).then(async (data) => {
                                              let subject = data[0].subject;
                                              subject = subject.replace(
                                                '{{name}}',
                                                senderData.firstname
                                              );
                                              let html = data[0].template;
                                              html = html.replace('{{name}}', senderData.firstname);
                                              html = html.replace('{{email}}', request.body.email);
                                              var { transporter, mailingAddress } =
                                                await emailTransporter();
                                              var mailOptions2 = {
                                                from: mailingAddress,
                                                to: senderData.email,
                                                subject: subject,
                                                html,
                                              };

                                              transporter.sendMail(
                                                mailOptions2,
                                                function (error, info) {
                                                  if (error) {
                                                    logger.error(error.message);
                                                  }
                                                  logger.info(
                                                    `Acceptance mail sent to invitation sender ${senderData.email}`
                                                  );
                                                }
                                              );
                                            });
                                          });

                                        logger.info(`Account created for ${request.body.email}`);
                                        logger.debug(
                                          JSON.stringify({
                                            success: true,
                                            message: request.t('Authentication success'),
                                            userData,
                                            twoFactorAuth: companyData.twoFactorAuth,
                                          })
                                        );
                                        return response.status(200).send({
                                          success: true,
                                          message: request.t('Authentication success'),
                                          userData,
                                          twoFactorAuth: companyData.twoFactorAuth,
                                        });
                                      });
                                    })
                                    .catch((err) => {
                                      logger.warn(
                                        `Account creation failed for ${request.body.email}`
                                      );
                                      logger.error(err);
                                      logger.debug(
                                        JSON.stringify({
                                          success: false,
                                          message: request.t('accountCreationFailed'),
                                        })
                                      );
                                      return response.status(200).send({
                                        success: false,
                                        message: request.t('accountCreationFailed'),
                                      });
                                    });
                                })
                                .catch((err) => {
                                  logger.warn(`Account creation failed for ${request.body.email}`);
                                  logger.error(err);
                                  logger.debug(
                                    JSON.stringify({
                                      success: false,
                                      message: request.t('accountCreationFailed'),
                                    })
                                  );
                                  return response.status(200).send({
                                    success: false,
                                    message: request.t('accountCreationFailed'),
                                  });
                                });
                            })
                            .catch((err) => {
                              logger.warn(`Account creation failed for ${request.body.email}`);
                              logger.error(err);
                              logger.debug(
                                JSON.stringify({
                                  success: false,
                                  message: request.t('accountCreationFailed'),
                                })
                              );
                              return response.status(200).send({
                                success: false,
                                message: request.t('accountCreationFailed'),
                              });
                            });
                        } else {
                          logger.warn(
                            `Account creation failed for ${request.body.email} due to invalid company`
                          );
                          logger.debug(
                            JSON.stringify({
                              success: false,
                              message: request.t('accountCreationFailedInvalidCompany'),
                            })
                          );
                          return response.status(200).send({
                            success: false,
                            message: request.t('accountCreationFailedInvalidCompany'),
                          });
                        }
                      })
                      .catch((err) => {
                        logger.warn(
                          `Account creation failed for ${request.body.email} due to invalid company`
                        );
                        logger.error(err);
                        logger.debug(
                          JSON.stringify({
                            success: false,
                            message: request.t('accountCreationFailedInvalidCompany'),
                          })
                        );
                        return response.status(200).send({
                          success: false,
                          message: request.t('accountCreationFailedInvalidCompany'),
                        });
                      });
                  } else {
                    logger.warn(
                      `Account creation failed for ${request.body.email} due to invalid token`
                    );
                    logger.debug(
                      JSON.stringify({ success: false, message: request.t('invalidToken') })
                    );
                    return response
                      .status(200)
                      .send({ success: false, message: request.t('invalidToken') });
                  }
                } else {
                  logger.warn(
                    `Account creation failed for ${request.body.email} due to expired invitation`
                  );
                  logger.debug(
                    JSON.stringify({ success: false, message: request.t('invitationExpired') })
                  );
                  return response
                    .status(200)
                    .send({ success: false, message: request.t('invitationExpired') });
                }
              } else if (invitationData.status == 'Declined') {
                logger.warn(
                  `Account creation failed for ${request.body.email} due to declined invitation`
                );
                logger.debug(
                  JSON.stringify({ success: false, message: request.t('invitationDeclined') })
                );
                return response
                  .status(200)
                  .send({ success: false, message: request.t('invitationDeclined') });
              } else if (invitationData.status == 'Registered') {
                logger.warn(
                  `Account creation failed for ${request.body.email} due to registered invitation`
                );
                logger.debug(
                  JSON.stringify({ success: false, message: request.t('accountAlreadyRegistered') })
                );
                return response
                  .status(200)
                  .send({ success: false, message: request.t('accountAlreadyRegistered') });
              }
            } else {
              logger.warn(
                `Account creation failed for ${request.body.email} due to invalid invitation`
              );
              logger.debug(
                JSON.stringify({ success: false, message: request.t('invalidInvitation') })
              );
              return response
                .status(200)
                .send({ success: false, message: request.t('invalidInvitation') });
            }
          })
          .catch((err) => {
            logger.warn(
              `Account creation failed for ${request.body.email} due to invalid invitation`
            );
            logger.error(err);
            logger.debug(
              JSON.stringify({ success: false, message: request.t('invalidInvitation') })
            );
            return response
              .status(200)
              .send({ success: false, message: request.t('invalidInvitation') });
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
    } else {
      if (
        request.body.firstname &&
        request.body.lastname &&
        request.body.email &&
        request.body.companyId &&
        request.body.role &&
        request.body.token &&
        request.body.signUpMethod &&
        request.body.profilePic
      ) {
        const debugData = {
          url: request.protocol + '://' + request.get('host') + request.originalUrl,
          body: { ...request.body, password: '**********' },
          headers: request.headers,
        };
        logger.debug(JSON.stringify(debugData));
        logger.info(`Creating account for invited user ${request.body.email}`);
        user
          .getInvitationDetail(request.body.email)
          .then((invitationData) => {
            if (invitationData) {
              const tnow = Date.now();
              const tDiff = tnow - parseInt(invitationData.token_issued);
              logger.info(`Checking Invitaion Status`);
              if (invitationData.status == 'Pending') {
                if (tDiff < 43200000) {
                  logger.info(`Checking Pending Invitaion Status is expired or not`);
                  if (invitationData.token == request.body.token) {
                    logger.info(`Fetching company details for invited user`);
                    user
                      .getCompanyDetails(request.body.companyId)
                      .then(async (companyData) => {
                        if (companyData) {
                          user
                            .createNewAccountForSocialInvitedUser(
                              request.body.firstname,
                              request.body.lastname,
                              request.body.email,
                              companyData.companytwoFactorAuth,
                              request.body.companyId,
                              request.body.role,
                              request.body.signUpMethod
                            )
                            .then(async (res) => {
                              const { userId } = res;

                              logger.info(`Uploading Image for ${request.body.email}`);
                              const imageResponse = await axios.get(request.body.profilePic, {
                                responseType: 'arraybuffer',
                              });
                              const imageBuffer = Buffer.from(imageResponse.data, 'binary');
                              const fileName = `${request.body.firstname}_${Date.now()}.jpg`;
                              fs.writeFileSync(
                                `${process.env.BACKEND_PATH}/uploads/userAvatars/${fileName}`,
                                imageBuffer
                              );
                              logger.info(`Uploading Image for ${userId}`);
                              await user.updateUserMeta(userId, 'profilePic', fileName);
                              logger.info(`Image upload successful for ${userId}`);

                              user
                                .updateInvitationStatusAndUserId(
                                  'Registered',
                                  request.body.email,
                                  userId
                                )
                                .then((res) => {
                                  user
                                    .getUserDetailsById(userId)
                                    .then((data) => {
                                      let userData = data;
                                      userData = { ...userData, ...companyData };

                                      user.getCompanyRole(userData.id).then((roleData) => {
                                        const jwtToken = jwt.sign(
                                          {
                                            userId: userData.id,
                                            firstname: userData.firstname,
                                            email: userData.email,
                                            role: roleData.role,
                                            company: roleData.company,
                                          },
                                          process.env.TOKEN_SECRET,
                                          { expiresIn: '30 days' }
                                        );

                                        let _auth = {
                                          auth: {
                                            api_token: jwtToken,
                                          },
                                        };

                                        userData = { ...userData, ..._auth, role: roleData.role };

                                        user
                                          .getUserDetailsById(invitationData.sender)
                                          .then(async (senderData) => {
                                            user.getMailTemplate(7).then(async (data) => {
                                              let subject = data[0].subject;
                                              subject = subject.replace(
                                                '{{name}}',
                                                senderData.firstname
                                              );
                                              let html = data[0].template;
                                              html = html.replace('{{name}}', senderData.firstname);
                                              html = html.replace('{{email}}', request.body.email);
                                              var { transporter, mailingAddress } =
                                                await emailTransporter();
                                              var mailOptions2 = {
                                                from: mailingAddress,
                                                to: senderData.email,
                                                subject: subject,
                                                html,
                                              };

                                              transporter.sendMail(
                                                mailOptions2,
                                                function (error, info) {
                                                  if (error) {
                                                    logger.error(error.message);
                                                  }
                                                  logger.info(
                                                    `Acceptance mail sent to invitation sender ${senderData.email}`
                                                  );
                                                }
                                              );
                                            });
                                          });

                                        logger.info(`Account created for ${request.body.email}`);
                                        logger.debug(
                                          JSON.stringify({
                                            success: true,
                                            message: request.t('Authentication success'),
                                            userData,
                                            twoFactorAuth: companyData.twoFactorAuth,
                                          })
                                        );
                                        return response.status(200).send({
                                          success: true,
                                          message: request.t('Authentication success'),
                                          userData,
                                          twoFactorAuth: companyData.twoFactorAuth,
                                        });
                                      });
                                    })
                                    .catch((err) => {
                                      logger.warn(
                                        `Account creation failed for ${request.body.email}`
                                      );
                                      logger.error(err);
                                      logger.debug(
                                        JSON.stringify({
                                          success: false,
                                          message: request.t('accountCreationFailed'),
                                        })
                                      );
                                      return response.status(200).send({
                                        success: false,
                                        message: request.t('accountCreationFailed'),
                                      });
                                    });
                                })
                                .catch((err) => {
                                  logger.warn(`Account creation failed for ${request.body.email}`);
                                  logger.error(err);
                                  logger.debug(
                                    JSON.stringify({
                                      success: false,
                                      message: request.t('accountCreationFailed'),
                                    })
                                  );
                                  return response.status(200).send({
                                    success: false,
                                    message: request.t('accountCreationFailed'),
                                  });
                                });
                            })
                            .catch((err) => {
                              logger.warn(`Account creation failed for ${request.body.email}`);
                              logger.error(err);
                              logger.debug(
                                JSON.stringify({
                                  success: false,
                                  message: request.t('accountCreationFailed'),
                                })
                              );
                              return response.status(200).send({
                                success: false,
                                message: request.t('accountCreationFailed'),
                              });
                            });
                        } else {
                          logger.warn(
                            `Account creation failed for ${request.body.email} due to invalid company`
                          );
                          logger.debug(
                            JSON.stringify({
                              success: false,
                              message: request.t('accountCreationFailedInvalidCompany'),
                            })
                          );
                          return response.status(200).send({
                            success: false,
                            message: request.t('accountCreationFailedInvalidCompany'),
                          });
                        }
                      })
                      .catch((err) => {
                        logger.warn(
                          `Account creation failed for ${request.body.email} due to invalid company`
                        );
                        logger.error(err);
                        logger.debug(
                          JSON.stringify({
                            success: false,
                            message: request.t('accountCreationFailedInvalidCompany'),
                          })
                        );
                        return response.status(200).send({
                          success: false,
                          message: request.t('accountCreationFailedInvalidCompany'),
                        });
                      });
                  } else {
                    logger.warn(
                      `Account creation failed for ${request.body.email} due to invalid token`
                    );
                    logger.debug(
                      JSON.stringify({ success: false, message: request.t('invalidToken') })
                    );
                    return response
                      .status(200)
                      .send({ success: false, message: request.t('invalidToken') });
                  }
                } else {
                  logger.warn(
                    `Account creation failed for ${request.body.email} due to expired invitation`
                  );
                  logger.debug(
                    JSON.stringify({ success: false, message: request.t('invitationExpired') })
                  );
                  return response
                    .status(200)
                    .send({ success: false, message: request.t('invitationExpired') });
                }
              } else if (invitationData.status == 'Declined') {
                logger.warn(
                  `Account creation failed for ${request.body.email} due to declined invitation`
                );
                logger.debug(
                  JSON.stringify({ success: false, message: request.t('invitationDeclined') })
                );
                return response
                  .status(200)
                  .send({ success: false, message: request.t('invitationDeclined') });
              } else if (invitationData.status == 'Registered') {
                logger.warn(
                  `Account creation failed for ${request.body.email} due to registered invitation`
                );
                logger.debug(
                  JSON.stringify({ success: false, message: request.t('accountAlreadyRegistered') })
                );
                return response
                  .status(200)
                  .send({ success: false, message: request.t('accountAlreadyRegistered') });
              }
            } else {
              logger.warn(
                `Account creation failed for ${request.body.email} due to invalid invitation`
              );
              logger.debug(
                JSON.stringify({ success: false, message: request.t('invalidInvitation') })
              );
              return response
                .status(200)
                .send({ success: false, message: request.t('invalidInvitation') });
            }
          })
          .catch((err) => {
            logger.warn(
              `Account creation failed for ${request.body.email} due to invalid invitation`
            );
            logger.error(err);
            logger.debug(
              JSON.stringify({ success: false, message: request.t('invalidInvitation') })
            );
            return response
              .status(200)
              .send({ success: false, message: request.t('invalidInvitation') });
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

  static declineInvitation(request, response) {
    const user = new Users(knex);

    if (request.body.email && request.body.token) {
      logger.info(`Declining invitation for ${request.body.email}`);
      user
        .getInvitationDetail(request.body.email)
        .then((invitationData) => {
          if (invitationData) {
            const tnow = Date.now();
            const tDiff = tnow - parseInt(invitationData.token_issued);

            if (invitationData.status == 'Pending') {
              if (tDiff < 600000) {
                if (invitationData.token == request.body.token) {
                  user
                    .getCompanyDetails(invitationData.company)
                    .then((companyData) => {
                      if (companyData) {
                        user.declineInvitation(request.body.email).then((res) => {
                          if (res == 1) {
                            user
                              .getUserDetailsById(invitationData.sender)
                              .then(async (senderData) => {
                                user.getMailTemplate(8).then(async (data) => {
                                  let subject = data[0].subject;
                                  let html = data[0].template;
                                  html = html.replace('{{name}}', senderData.firstname);
                                  html = html.replace('{{email}}', request.body.email);
                                  var { transporter, mailingAddress } = await emailTransporter();
                                  var mailOptions2 = {
                                    from: mailingAddress,
                                    to: senderData.email,
                                    subject: subject,
                                    html,
                                  };

                                  transporter.sendMail(mailOptions2, function (error, info) {
                                    if (error) {
                                      logger.error(error.message);
                                    }
                                    logger.info(
                                      `Decline mail sent to invitation sender ${senderData.email}`
                                    );
                                  });
                                });
                              });
                            logger.info(`Invitation declined for ${request.body.email}`);
                            logger.debug(
                              JSON.stringify({
                                success: true,
                                message: request.t('invitationDeclineSuccess'),
                              })
                            );
                            return response.status(200).send({
                              success: true,
                              message: request.t('invitationDeclineSuccess'),
                            });
                          } else {
                            logger.warn(`Failed to decline invitation for ${request.body.email}`);
                            logger.debug(
                              JSON.stringify({
                                success: true,
                                status: 'failed',
                                message: request.t('invitationDeclineFailed'),
                              })
                            );
                            return response.status(200).send({
                              success: true,
                              status: 'failed',
                              message: request.t('invitationDeclineFailed'),
                            });
                          }
                        });
                      } else {
                        logger.warn(`Failed to decline invitation for ${request.body.email}`);
                        logger.debug(
                          JSON.stringify({
                            success: false,
                            status: 'failed',
                            message: request.t('invitationDeclineFailed'),
                          })
                        );
                        return response.status(200).send({
                          success: false,
                          status: 'failed',
                          message: request.t('invitationDeclineFailed'),
                        });
                      }
                    })
                    .catch((err) => {
                      logger.warn(`Failed to decline invitation for ${request.body.email}`);
                      logger.error(err);
                      logger.debug(
                        JSON.stringify({
                          success: false,
                          status: 'failed',
                          message: request.t('invitationDeclineFailed'),
                        })
                      );
                      return response.status(200).send({
                        success: false,
                        status: 'failed',
                        message: request.t('invitationDeclineFailed'),
                      });
                    });
                } else {
                  logger.warn(
                    `Failed to decline invitation for ${request.body.email} due to invalid token`
                  );
                  logger.debug(
                    JSON.stringify({
                      success: false,
                      status: 'invalid-token',
                      message: request.t('invitationDeclineFailedInvalidToken'),
                    })
                  );
                  return response.status(200).send({
                    success: false,
                    status: 'invalid-token',
                    message: request.t('invitationDeclineFailedInvalidToken'),
                  });
                }
              } else {
                logger.warn(
                  `Failed to decline invitation for ${request.body.email} due to expired invitation`
                );
                logger.debug(
                  JSON.stringify({
                    success: false,
                    status: 'expired',
                    message: request.t('invitationExpired'),
                  })
                );
                return response.status(200).send({
                  success: false,
                  status: 'expired',
                  message: request.t('invitationExpired'),
                });
              }
            } else if (invitationData.status == 'Declined') {
              logger.warn(
                `Failed to decline invitation for ${request.body.email} due to declined invitation`
              );
              logger.debug(
                JSON.stringify({
                  success: false,
                  status: 'declined',
                  message: request.t('invitationDeclined'),
                })
              );
              return response.status(200).send({
                success: false,
                status: 'declined',
                message: request.t('invitationDeclined'),
              });
            } else if (invitationData.status == 'Registered') {
              logger.warn(
                `Failed to decline invitation for ${request.body.email} due to registered invitation`
              );
              logger.debug(
                JSON.stringify({
                  success: false,
                  status: 'registered',
                  message: request.t('accountAlreadyRegistered'),
                })
              );
              return response.status(200).send({
                success: false,
                status: 'registered',
                message: request.t('accountAlreadyRegistered'),
              });
            }
          } else {
            logger.warn(
              `Failed to decline invitation for ${request.body.email} due to invalid invitation`
            );
            logger.debug(
              JSON.stringify({
                success: false,
                status: 'invalid',
                message: request.t('invalidInvitation'),
              })
            );
            return response
              .status(200)
              .send({ success: false, status: 'invalid', message: request.t('invalidInvitation') });
          }
        })
        .catch((err) => {
          logger.warn(
            `Failed to decline invitation for ${request.body.email} due to invalid invitation`
          );
          logger.error(err);
          logger.debug(
            JSON.stringify({
              success: false,
              status: 'invalid',
              message: request.t('invalidInvitation'),
            })
          );
          return response
            .status(200)
            .send({ success: false, status: 'invalid', message: request.t('invalidInvitation') });
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

  static getUserDetailsForAdmin(request, response) {
    const user = new Users(knex);

    if (request.body.userId) {
      logger.info(`Fetching user details for user ID ${request.body.userId}`);
      user
        .getUserDetailsById(request.body.userId)
        .then((userData) => {
          user
            .getCompanyRole(request.body.userId)
            .then((roleData) => {
              userData = { ...userData, role: roleData.role };
              logger.info(`User details successfully fethced for ${request.body.userId}`);
              logger.debug(
                JSON.stringify({
                  success: true,
                  message: request.t('adminUserDetailFetchSuccess'),
                  userData,
                })
              );
              return response.status(200).send({
                success: true,
                message: request.t('adminUserDetailFetchSuccess'),
                userData,
              });
            })
            .catch((err) => {
              logger.warn(
                `User details successfully fethced but failed to fetch role data for ${request.body.userId}`
              );
              logger.error(err);
              userData = { ...userData, role: '3' };
              logger.debug(
                JSON.stringify({
                  success: true,
                  message: request.t('adminUserDetailFetchFailed1'),
                  userData,
                })
              );
              return response.status(200).send({
                success: true,
                message: request.t('adminUserDetailFetchFailed1'),
                userData,
              });
            });
        })
        .catch((err) => {
          logger.warn(`Failed to fetch user details for user ID ${request.body.userId}`);
          logger.debug(
            JSON.stringify({ success: false, message: request.t('adminUserDetailFetchFailed2') })
          );
          return response
            .status(200)
            .send({ success: false, message: request.t('adminUserDetailFetchFailed2') });
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

  static getUserDetailsForSuperAdmin(request, response) {
    const user = new Users(knex);

    if (request.body.userId) {
      logger.info(`Fetching user details for user ID ${request.body.userId}`);
      user
        .getUserDetailsById(request.body.userId)
        .then((userData) => {
          userData = { ...userData, role: '4' };
          return response.status(200);
        })
        .catch((err) => {
          logger.warn(`Failed to fetch user details for user ID ${request.body.userId}`);
          logger.debug(
            JSON.stringify({ success: false, message: request.t('adminUserDetailFetchFailed2') })
          );
          return response
            .status(200)
            .send({ success: false, message: request.t('adminUserDetailFetchFailed2') });
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

  static verifyAccountForAdmin(request, response) {
    const user = new Users(knex);

    if (request.body.userId) {
      logger.info(`Verifying account for user Id ${request.body.userId}`);
      user
        .verifyAccount(request.body.userId)
        .then((res) => {
          if (res == 1) {
            logger.info(`Account verification success for ${request.body.userId}`);
            logger.debug(
              JSON.stringify({ success: true, message: request.t('accountVerificationSuccess') })
            );
            return response
              .status(200)
              .send({ success: true, message: request.t('accountVerificationSuccess') });
          } else {
            logger.warn(`Account verification failed for ${request.body.userId}`);
            logger.debug(
              JSON.stringify({ success: false, message: request.t('accountVerificationFailed') })
            );
            return response
              .status(200)
              .send({ success: false, message: request.t('accountVerificationFailed') });
          }
        })
        .catch((err) => {
          logger.warn(`Account verification failed for ${request.body.userId}`);
          logger.error(err);
          logger.debug(
            JSON.stringify({ success: false, message: request.t('accountVerificationFailed') })
          );
          return response
            .status(200)
            .send({ success: false, message: request.t('accountVerificationFailed') });
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

  static enable2FAFordmin(request, response) {
    const user = new Users(knex);

    if (request.body.userId) {
      logger.info(`Enabling 2FA for user Id ${request.body.userId}`);
      user
        .enable2FA(request.body.userId)
        .then((res) => {
          if (res == 1) {
            logger.info(`2FA enabled successfully for ${request.body.userId}`);
            logger.debug(JSON.stringify({ success: true, message: request.t('2FAEnableSuccess') }));
            return response
              .status(200)
              .send({ success: true, message: request.t('2FAEnableSuccess') });
          } else {
            logger.warn(`Failed to enable 2FA for ${request.body.userId}`);
            logger.debug(JSON.stringify({ success: false, message: request.t('2FAEnableFailed') }));
            return response
              .status(200)
              .send({ success: false, message: request.t('2FAEnableFailed') });
          }
        })
        .catch((err) => {
          logger.warn(`Failed to enable 2FA for ${request.body.userId}`);
          logger.error(err);
          logger.debug(JSON.stringify({ success: false, message: request.t('2FAEnableFailed') }));
          return response
            .status(200)
            .send({ success: false, message: request.t('2FAEnableFailed') });
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

  static disable2FAFordmin(request, response) {
    const user = new Users(knex);

    if (request.body.userId) {
      logger.info(`Disabling 2FA for ${request.body.userId}`);
      user
        .disable2FA(request.body.userId)
        .then((res) => {
          if (res == 1) {
            logger.info(`2FA disabled successfully for ${request.body.userId}`);
            logger.debug(
              JSON.stringify({ success: true, message: request.t('2FADisableSuccess') })
            );
            return response
              .status(200)
              .send({ success: true, message: request.t('2FADisableSuccess') });
          } else {
            logger.warn(`Failed to disable 2FA for ${request.body.userId}`);
            logger.debug(
              JSON.stringify({ success: false, message: request.t('2FADisableFailed') })
            );
            return response
              .status(200)
              .send({ success: false, message: request.t('2FADisableFailed') });
          }
        })
        .catch((err) => {
          logger.warn(`Failed to disable 2FA for ${request.body.userId}`);
          logger.error(err);
          logger.debug(JSON.stringify({ success: false, message: request.t('2FADisableFailed') }));
          return response
            .status(200)
            .send({ success: false, message: request.t('2FADisableFailed') });
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

  static userLockAndUnlockOptionForAdmin(request, response) {
    const user = new Users(knex);

    if (request.body.userId) {
      request.body.status = request.body.status ? request.body.status : 0;
      logger.info(`Changing account status for user Id ${request.body.userId}`);
      user
        .userLockAndUnlockOptionForAdmin(request.body.userId, request.body.status)
        .then((res) => {
          if (res == 1) {
            if (request.body.status == '1') {
              logger.info(`Account status changed to locked for ${request.body.userId}`);
              logger.debug(
                JSON.stringify({ success: true, message: request.t('userAccountLockedSuccess') })
              );
              return response
                .status(200)
                .send({ success: true, message: request.t('userAccountLockedSuccess') });
            } else {
              logger.info(`Account status changed to unlocked for ${request.body.userId}`);
              logger.debug(
                JSON.stringify({ success: true, message: request.t('userAccountUnlockedSuccess') })
              );
              return response
                .status(200)
                .send({ success: true, message: request.t('userAccountUnlockedSuccess') });
            }
          } else {
            logger.warn(`Failed to change the account status for ${request.body.userId}`);
            logger.debug(
              JSON.stringify({ success: false, message: request.t('userAccountLockFailed') })
            );
            return response
              .status(200)
              .send({ success: false, message: request.t('userAccountLockFailed') });
          }
        })
        .catch((err) => {
          logger.warn(`Failed to change the account status for ${request.body.userId}`);
          logger.error(err);
          logger.debug(
            JSON.stringify({ success: false, message: request.t('userAccountLockFailed') })
          );
          return response
            .status(200)
            .send({ success: false, message: request.t('userAccountLockFailed') });
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

  static adminUpdatePasswordOptionForUser(request, response) {
    const user = new Users(knex);

    if (request.body.userId && request.body.newPassword) {
      logger.info(`Updating password for ${request.body.userId}`);
      user
        .updatePassword(request.body.userId, request.body.newPassword)
        .then((res) => {
          if (res == 1) {
            logger.info(`Password updated successfully for ${request.body.userId}`);
            logger.debug(
              JSON.stringify({ success: true, message: request.t('adminPasswordUpdateSuccess') })
            );
            return response
              .status(200)
              .send({ success: true, message: request.t('adminPasswordUpdateSuccess') });
          } else {
            logger.warn(`Failed to update the password for ${request.body.userId}`);
            logger.debug(
              JSON.stringify({ success: false, message: request.t('adminPasswordUpdateFailed') })
            );
            return response
              .status(200)
              .send({ success: false, message: request.t('adminPasswordUpdateFailed') });
          }
        })
        .catch((err) => {
          logger.warn(`Failed to update the password for ${request.body.userId}`);
          logger.error(err);
          logger.debug(
            JSON.stringify({ success: false, message: request.t('adminPasswordUpdateFailed') })
          );
          return response
            .status(200)
            .send({ success: false, message: request.t('adminPasswordUpdateFailed') });
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

  static whiteListUserAccount(request, response) {
    const user = new Users(knex);

    if (request.body.userId) {
      logger.info(`Whitelisting account for ${request.body.userId}`);
      user
        .whiteListAccount(request.body.userId)
        .then((res) => {
          if (res == 1) {
            logger.info(`Account whitelisted for ${request.body.userId}`);
            logger.debug(
              JSON.stringify({ success: true, message: request.t('accountWhitelistedSuccess') })
            );
            return response
              .status(200)
              .send({ success: true, message: request.t('accountWhitelistedSuccess') });
          } else {
            logger.warn(`Failed to whitelist account for ${request.body.userId}`);
            logger.debug(
              JSON.stringify({ success: false, message: request.t('accountWhitelistedFailed') })
            );
            return response
              .status(200)
              .send({ success: false, message: request.t('accountWhitelistedFailed') });
          }
        })
        .catch((err) => {
          logger.warn(`Failed to whitelist account for ${request.body.userId}`);
          logger.error(err);
          logger.debug(
            JSON.stringify({ success: false, message: request.t('accountWhitelistedFailed') })
          );
          return response
            .status(200)
            .send({ success: false, message: request.t('accountWhitelistedFailed') });
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

  static blackListUserAccount(request, response) {
    const user = new Users(knex);

    if (request.body.userId) {
      logger.info(`Blacklisting account for ${request.body.userId}`);
      user
        .blackListAccount(request.body.userId)
        .then((res) => {
          if (res == 1) {
            logger.info(`Account blacklisted for ${request.body.userId}`);
            logger.debug(
              JSON.stringify({ success: true, message: request.t('accountBlacklistedSuccess') })
            );
            return response
              .status(200)
              .send({ success: true, message: request.t('accountBlacklistedSuccess') });
          } else {
            logger.warn(`Failed to blacklist the account for ${request.body.userId}`);
            logger.debug(
              JSON.stringify({ success: false, message: request.t('accountBlacklistedFailed') })
            );
            return response
              .status(200)
              .send({ success: false, message: request.t('accountBlacklistedFailed') });
          }
        })
        .catch((err) => {
          logger.warn(`Failed to blacklist the account for ${request.body.userId}`);
          logger.error(err);
          logger.debug(
            JSON.stringify({ success: false, message: request.t('accountBlacklistedFailed') })
          );
          return response
            .status(200)
            .send({ success: false, message: request.t('accountBlacklistedFailed') });
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

  static getSubscriptionDetails(request, response) {
    const user = new Users(knex);

    if (request.body.userId) {
      logger.info(`Subscription details fetched for ${request.body.userId}`);
      user
        .getSubscriptionData(request.body.userId)
        .then((res) => {
          if (res[0].length > 0) {
            logger.info(`Subscrption fetch Successfully for ${request.body.userId}`);
            logger.debug(
              JSON.stringify({ success: true, message: 'Subscrption fetch Successfully' })
            );
            return response.status(200).send({ success: true, subscriptionData: res[0][0] });
          } else {
            logger.info(`Subscrption fetch Failed for ${request.body.userId}`);
            logger.debug(JSON.stringify({ success: true, message: 'Subscrption fetch Failed' }));
            return response.status(200).send({ success: false });
          }
        })
        .catch((err) => {
          logger.warn(`Failed to fetch subscription details for ${request.body.userId}`);
          logger.error(err);
          logger.debug(
            JSON.stringify({ success: false, message: 'Failed to fetch subscription details' })
          );
          return response
            .status(200)
            .send({ success: false, message: 'Failed to fetch subscription details' });
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

  static removeUserPermanently(request, response) {
    const user = new Users(knex);

    if (request.body.userId) {
      logger.info(`Account Delete for ${request.body.userId}`);
      user
        .removeUser(request.body.userId)
        .then((res) => {
          if (res == 1) {
            logger.info(`Account Deleted for ${request.body.userId}`);
            logger.debug(JSON.stringify({ success: true, message: 'Account Deletion Successful' }));
            return response
              .status(200)
              .send({ success: true, message: 'Account Deletion Successful.' });
          } else {
            logger.warn(`Account Deletion Failed for ${request.body.userId}`);
            logger.debug(JSON.stringify({ success: false, message: 'Account Deletion Failed' }));
            return response
              .status(200)
              .send({ success: false, message: 'Account Deletion Failed' });
          }
        })
        .catch((err) => {
          logger.warn(`Account Deletion Failed for ${request.body.userId}`);
          logger.error(err);
          logger.debug(JSON.stringify({ success: false, message: 'Account Deletion Failed' }));
          return response.status(200).send({ success: false, message: 'Account Deletion Failed' });
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

  static getUserDynamicRoles(request, response) {
    const user = new Users(knex);

    user
      .getUserRoles()
      .then((roleData) => {
        logger.debug(JSON.stringify('Role data fetched successfully'));
        return response.status(200).send({ success: true, roleData: roleData });
      })
      .catch((err) => {
        logger.error(`Error getting roles for user data: ${err}`);
        return response.status(200).json({ success: false, message: 'Failed to fetch role data' });
      });
  }

  static getClientsforSuperAdmin(request, response) {
    const user = new Users(knex);

    logger.info(`Fetching clients for super admin`);
    user
      .getUserDetailsforSuperAdmin()
      .then((res) => {
        if (res.length > 0) {
          logger.info(`Fetching all client details for super admin`);
          const userIds = res.map((user) => user.id);
          const userDetailsPromises = userIds.map((userId) => {
            try {
              return user.getUserMetaDetails(userId).then(async (metaData) => {
                const userDetails = res.find((user) => user.id === userId);
                const subscriptionDetails = await user.getSubscriptionData(userId);
                const invitationDetails = await user.getInvitaionDetailsforSuperAdmin(userId);
                const roleDetails = await user.getCompanyRole(userId);
                const companyDetails = await user.getCompanyDetails(roleDetails?.company);
                if (userDetails.id !== invitationDetails[0]?.userId) {
                  const userData = {
                    ...userDetails,
                    countryCode: userDetails.countryCode,
                    ...metaData,
                    ...subscriptionDetails[0],
                    roleDetails,
                    ...companyDetails,
                  };
                  return userData;
                } else {
                  return null;
                }
              });
            } catch (error) {
              logger.info(`Error processing user details for user ID`);
              console.error(`Error processing user details for user ID ${userId}: ${error}`);
              return null;
            }
          });

          Promise.all(userDetailsPromises)
            .then((userDetailsArray) => {
              const filteredUserDetailsArray = userDetailsArray.filter(
                (userDetails) => userDetails !== null
              );
              logger.info(`Clients are fetched for super admin`);
              return response.status(200).send({
                success: true,
                message: 'Successfully fetched client details',
                clientDetails: filteredUserDetailsArray,
              });
            })
            .catch((error) => {
              logger.warn(`Failed to fetch client details`);
              console.error(`Error fetching user details: ${error}`);
              logger.debug(
                JSON.stringify({ success: false, message: 'Error fetching client details' })
              );
              return response
                .status(200)
                .send({ success: false, message: 'Failed to fetch client details' });
            });
        } else {
          logger.warn(`No subscriptions found for Super Admin`);
          return response.status(200).send({
            success: true,
            message: 'No subscriptions found for Super Admin',
            clientDetails: [],
          });
        }
      })
      .catch((err) => {
        logger.warn(`Failed to fetch subscription details for Super Admin`);
        logger.error(err);
        logger.debug(
          JSON.stringify({ success: false, message: 'Failed to fetch subscription details' })
        );
        return response
          .status(200)
          .send({ success: false, message: 'Failed to fetch subscription details' });
      });
  }

  static getUserInvitedDetailsforSuperAdmin(request, response) {
    const user = new Users(knex);

    logger.info(`Fetching invited users for super admin`);
    if (request.body.companyId) {
      user.getCompanyUsers(request.body.companyId).then((res) => {
        const userIds = res.map((user) => user.userId);
        const usersDetailsPromises = userIds.map((userId) => {
          return user.getUserInvitedDetailforSuperAdmin(userId).then(async (userData) => {
            const userRoles = await user.getCompanyRole(userId);
            const userRole = userRoles?.role;
            return { ...userData, userRole };
          });
        });

        Promise.all(usersDetailsPromises)
          .then((userDetailsArray) => {
            logger.info(`Invited users are fetched for super admin`);
            return response.status(200).send({
              success: true,
              userDetails: userDetailsArray,
            });
          })
          .catch((error) => {
            logger.error(`Failed to fetch client details`, error);
            return response
              .status(200)
              .send({ success: false, message: 'Failed to fetch user details' });
          });
      });
    } else {
      logger.warn(`No invited users for super admin`);
    }
  }

  static createAccountForSuperUser(request, response) {
    const user = new Users(knex);

    if (
      request.body.firstname &&
      request.body.lastname &&
      request.body.email &&
      request.body.countryCode &&
      request.body.mobileNumber &&
      request.body.password &&
      request.body.companyId &&
      request.body.role
    ) {
      const debugData = {
        url: request.protocol + '://' + request.get('host') + request.originalUrl,
        body: { ...request.body, password: '**********' },
        headers: request.headers,
      };
      logger.debug(JSON.stringify(debugData));
      logger.info(`Creating account for super user ${request.body.email}`);
      user
        .checkIfUserExist(request.body.email)
        .then(async (res) => {
          if (res.length > 0) {
            logger.warn(`Account already exists for ${request.body.email}`);
            return response.status(201).send({
              success: false,
              message: `${request.body.email} already has an account, try with another email`,
            });
          } else {
            user.getCompanyDetails(request.body.companyId).then((companyData) => {
              if (companyData) {
                user
                  .createNewAccountForSuperUser(
                    request.body.firstname,
                    request.body.lastname,
                    request.body.email,
                    request.body.countryCode,
                    request.body.mobileNumber,
                    request.body.password,
                    companyData.companytwoFactorAuth,
                    request.body.companyId,
                    request.body.role
                  )
                  .then((res) => {
                    const { userId } = res;
                    user
                      .getUserDetailsById(userId)
                      .then((data) => {
                        let userData = data;
                        userData = { ...userData, ...companyData };
                        user.getCompanyRole(userData.id).then((roleData) => {
                          const jwtToken = jwt.sign(
                            {
                              userId: userData.id,
                              firstname: userData.firstname,
                              email: userData.email,
                              role: roleData.role,
                              company: roleData.company,
                            },
                            process.env.TOKEN_SECRET,
                            { expiresIn: '30 days' }
                          );
                          let _auth = {
                            auth: {
                              api_token: jwtToken,
                            },
                          };
                          userData = { ...userData, ..._auth, role: roleData.role };
                          user.getUserDetailsById(userId).then(async (senderData) => {
                            user.getMailTemplate(10).then(async (data) => {
                              let subject = data[0].subject;
                              let html = data[0].template;
                              html = html.replace('{{name}}', senderData.firstname);
                              html = html.replace('{{email}}', request.body.email);
                              var { transporter, mailingAddress } = await emailTransporter();
                              var mailOptions2 = {
                                from: mailingAddress,
                                to: senderData.email,
                                subject: subject,
                                html,
                              };

                              transporter.sendMail(mailOptions2, function (error, info) {
                                if (error) {
                                  logger.error(error.message);
                                }
                                logger.info(
                                  `Acceptance mail sent to super sender ${senderData.email}`
                                );
                              });
                            });
                          });

                          logger.info(`Account created for ${request.body.email}`);
                          logger.debug(
                            JSON.stringify({
                              success: true,
                              message: request.t('Authentication success'),
                              userData,
                              twoFactorAuth: companyData.twoFactorAuth,
                            })
                          );
                          return response.status(200).send({
                            success: true,
                            message: request.t('Authentication success'),
                            userData,
                            twoFactorAuth: companyData.twoFactorAuth,
                          });
                        });
                      })
                      .catch((err) => {
                        logger.warn(`Account creation failed for ${request.body.email}`);
                        logger.error(err);
                        logger.debug(
                          JSON.stringify({
                            success: false,
                            message: request.t('accountCreationFailed'),
                          })
                        );
                        return response
                          .status(200)
                          .send({ success: false, message: request.t('accountCreationFailed') });
                      });
                  })
                  .catch((err) => {
                    logger.warn(`Account creation failed for ${request.body.email}`);
                    logger.error(err);
                    logger.debug(
                      JSON.stringify({
                        success: false,
                        message: request.t('accountCreationFailed'),
                      })
                    );
                    return response
                      .status(200)
                      .send({ success: false, message: request.t('accountCreationFailed') });
                  });
              } else {
                logger.warn(
                  `Account creation failed for ${request.body.email} due to invalid company`
                );
                logger.debug(
                  JSON.stringify({
                    success: false,
                    message: request.t('accountCreationFailedInvalidCompany'),
                  })
                );
                return response.status(200).send({
                  success: false,
                  message: request.t('accountCreationFailedInvalidCompany'),
                });
              }
            });
          }
        })
        .catch((err) => {
          logger.warn(`Failed to create checout session URL for ${request.body.email}`);
          logger.error(err);
          return response
            .status(201)
            .send({ success: false, message: 'Failed to create checkout session URL' });
        });
    }
  }

  static getSuperEmail(request, response) {
    return response
      .status(200)
      .send({ success: true, superEmail: process.env.SUPER_ADMIN_EMAIL_DOMAIN_NAME });
  }

  static async removeSuperUserPermanently(request, response) {
    const user = new Users(knex);

    if (request.body.userId && request.body.companyId) {
      logger.info(`Account Delete for ${request.body.userId}`);

      const userCountWithRole = await knex('companies')
        .count('*')
        .where({ id: request.body.companyId, adminId: request.body.userId })
        .first();

      if (userCountWithRole.count == 0) {
        logger.info(`Account Delete for ${request.body.userId} shared company details.`);

        user
          .removeSuperUser(request.body.userId)
          .then((res) => {
            if (res == 1) {
              logger.info(`Account Deleted for ${request.body.userId}`);
              logger.debug(
                JSON.stringify({ success: true, message: 'Account Deletion Successful' })
              );
              return response
                .status(200)
                .send({ success: true, message: 'Account Deletion Successful.' });
            } else {
              logger.warn(`Account Deletion Failed for ${request.body.userId}`);
              logger.debug(JSON.stringify({ success: false, message: 'Account Deletion Failed' }));
              return response
                .status(200)
                .send({ success: false, message: 'Account Deletion Failed' });
            }
          })
          .catch((err) => {
            logger.warn(`Account Deletion Failed for ${request.body.userId}`);
            logger.error(err);
            logger.debug(JSON.stringify({ success: false, message: 'Account Deletion Failed' }));
            return response
              .status(200)
              .send({ success: false, message: 'Account Deletion Failed' });
          });
      } else {
        logger.info(`Account Delete for ${request.body.userId} non shared company details.`);

        const newUserIdObject = await knex('user_company_role_relationship')
          .select('userId')
          .where({ company: request.body.companyId, role: 4 })
          .whereNot({ userId: request.body.userId })
          .first();

        if (!newUserIdObject) {
          console.log("Do not delete. There's only one Administrator.");
        }

        const newUserId = newUserIdObject.userId;

        await knex('companies')
          .where({ id: request.body.companyId })
          .update({ adminId: newUserId })
          .then(() => {
            user
              .removeSuperUser(request.body.userId)
              .then((res) => {
                if (res == 1) {
                  logger.info(`Account Deleted for ${request.body.userId}`);
                  logger.debug(
                    JSON.stringify({ success: true, message: 'Account Deletion Successful' })
                  );
                  return response
                    .status(200)
                    .send({ success: true, message: 'Account Deletion Successful.' });
                } else {
                  logger.warn(`Account Deletion Failed for ${request.body.userId}`);
                  logger.debug(
                    JSON.stringify({ success: false, message: 'Account Deletion Failed' })
                  );
                  return response
                    .status(200)
                    .send({ success: false, message: 'Account Deletion Failed' });
                }
              })
              .catch((err) => {
                logger.warn(`Account Deletion Failed for ${request.body.userId}`);
                logger.error(err);
                logger.debug(
                  JSON.stringify({ success: false, message: 'Account Deletion Failed' })
                );
                return response
                  .status(200)
                  .send({ success: false, message: 'Account Deletion Failed' });
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
      return response
        .status(400)
        .send({ success: false, message: 'Missing parameters, fill all the required fields' });
    }
  }
}

module.exports = UsersController;
