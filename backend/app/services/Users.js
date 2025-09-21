const user = require('../routes/user');
const SuperAdmin = require('./SuperAdmin');
const winston = require('winston');
const { combine, timestamp, json } = winston.format;
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const { getAdminSetting } = require('../init/redisUtils');
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

class Users {
  constructor(dbConnection) {
    this.dbConnection = dbConnection;
  }

  getUserRoles() {
    return new Promise((resolve, reject) => {
      this.dbConnection('roles')
        .select('id', 'role')
        .whereNot('role', '=', 'System Administrator')
        .then((data) => {
          resolve(data);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  getMailTemplate(id) {
    return new Promise((resolve, reject) => {
      this.dbConnection('email_templates')
        .select('*')
        .where({ id })
        .then((data) => {
          resolve(data);
        })
        .catch((err) => {
          console.log(err);
          logger.error(err);
          reject(err);
        });
    });
  }

  createNewUserGoogle(firstname, lastname, email, accountType, signUpMethod) {
    return new Promise((resolve, reject) => {
      const token = this.getRandomIntInclusive();
      const token_issued = Date.now();
      const dateTime = new Date();

      this.dbConnection('users')
        .insert({
          firstname,
          lastname,
          email,
          mobileNumber: '(000)-000-0000',
          password: '',
          accountStatus: 1,
          token,
          token_issued,
          created: dateTime,
          updated: dateTime,
        })
        .then(async (userId) => {
          try {
            await this._addUserMeta(userId[0], 'otp', '');
            await this._addUserMeta(userId[0], 'otp_issued', '');
            await this._addUserMeta(userId[0], 'incorrect_attempt_count', 0);
            await this._addUserMeta(userId[0], 'attempt_timestamp', '');
            await this._addUserMeta(userId[0], 'accountLockStatus', 0);
            await this._addUserMeta(userId[0], 'profilePic', 'default.png');
            await this._addUserMeta(userId[0], 'accountBlocked', '0');
            await this._addUserMeta(userId[0], 'queries', '0');

            const superAdmin = new SuperAdmin(this.dbConnection);
            const default2FA = process.env.DEFAULT_2FA;
            await this._addUserMeta(userId[0], '2FA', default2FA);
            await this._addUserMeta(userId[0], 'accountType', accountType);
            await this._addUserMeta(userId[0], 'signUpMethod', signUpMethod);
            const userCloudIntegration = await getAdminSetting('DEFAULT_CLOUD_INTEGRATION');
            const userCloudIntegrationMob = userCloudIntegration;
            await this._addUserMeta(userId[0], 'userCloudIntegration', userCloudIntegration);
            await this._addUserMeta(userId[0], 'userCloudIntegrationMob', userCloudIntegrationMob);

            await this._addUserMeta(userId[0], 'GoogleDrive', userCloudIntegration);
            await this._addUserMeta(userId[0], 'Dropbox', userCloudIntegration);
            await this._addUserMeta(userId[0], 'OneDrive', userCloudIntegration);
            await this._addUserMeta(userId[0], 'Slack', userCloudIntegration);
            await this._addUserMeta(userId[0], 'Wordpress', userCloudIntegration);

            await this._addUserMeta(userId[0], 'GoogleDrive_M', userCloudIntegrationMob);
            await this._addUserMeta(userId[0], 'Dropbox_M', userCloudIntegrationMob);
            await this._addUserMeta(userId[0], 'OneDrive_M', userCloudIntegrationMob);
            await this._addUserMeta(userId[0], 'Slack_M', userCloudIntegrationMob);
            await this._addUserMeta(userId[0], 'Wordpress_M', userCloudIntegrationMob);

            resolve({
              userId: userId[0],
              token,
              default2FA: default2FA,
            });
          } catch (error) {
            console.log(error);
            logger.error(error);
            reject(error);
          }
        });
    });
  }

  validateGoogleLoginCredential(email) {
    return new Promise((resolve, reject) => {
      this.dbConnection('users')
        .where({
          email: email,
        })
        .select('id')
        .then((res) => {
          if (res.length > 0) {
            this.isAccountLockedForIncorrectOtpAccount(res[0].id)
              .then((stat) => {
                if (stat == 0) {
                  resolve({
                    stat: 'valid',
                    userId: res[0].id,
                  });
                } else {
                  resolve({
                    stat: 'locked',
                  });
                }
              })
              .catch((err) => {
                console.log(err);
                reject(err);
              });
          } else {
            resolve({ stat: 'invalid' });
          }
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  validateGoogleCredentialAndOtp(email, otp) {
    return new Promise((resolve, reject) => {
      this.validateGoogleLoginCredential(email).then((res) => {
        const currentTimestamp = Date.now();
        if (res.stat == 'valid') {
          this.isAccountLockedForIncorrectOtpAccount(res.userId).then((stat) => {
            if (stat == 0) {
              this.getUserMetaValue(res.userId, 'otp').then((otpInRecord) => {
                if (otpInRecord == otp) {
                  this.getUserMetaValue(res.userId, 'otp_issued').then((otpIssuedTime) => {
                    const tDiff = currentTimestamp - otpIssuedTime;
                    if (tDiff <= 600000) {
                      resolve('valid');
                    } else {
                      resolve('expired');
                    }
                  });
                } else {
                  this.updateIncorrectOTPAttemptRecord(res.userId);
                  resolve('Invalid OTP');
                }
              });
            } else {
              resolve('locked');
            }
          });
        } else if (res.stat == 'locked') {
          resolve('locked');
        } else {
          resolve('Invalid Credential');
        }
      });
    });
  }

  getAccountType(userId) {
    return new Promise((resolve, reject) => {
      this.getUserMetaValue(userId, 'accountType')
        .then((accountType) => {
          resolve(accountType);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  createNewUser(
    firstname,
    lastname,
    email,
    countryCode,
    mobileNumber,
    password,
    accountType,
    paidStatus,
    signUpMethod
  ) {
    return new Promise((resolve, reject) => {
      const token = this.getRandomIntInclusive();
      const token_issued = Date.now();
      const dateTime = new Date();

      this.generateHash(password).then((hashedPassword) => {
        this.dbConnection('users')
          .insert({
            firstname,
            lastname,
            email,
            countryCode,
            mobileNumber,
            password: hashedPassword,
            accountStatus: 0,
            token,
            token_issued,
            created: dateTime,
            updated: dateTime,
          })
          .then(async (userId) => {
            try {
              await this._addUserMeta(userId[0], 'otp', '');
              await this._addUserMeta(userId[0], 'otp_issued', '');
              await this._addUserMeta(userId[0], 'incorrect_attempt_count', 0);
              await this._addUserMeta(userId[0], 'attempt_timestamp', '');
              await this._addUserMeta(userId[0], 'accountLockStatus', 0);
              await this._addUserMeta(userId[0], 'profilePic', 'default.png');
              await this._addUserMeta(userId[0], 'accountBlocked', paidStatus == '1' ? '0' : '1');
              await this._addUserMeta(userId[0], 'queries', '0');

              const default2FA = process.env.DEFAULT_2FA;
              await this._addUserMeta(userId[0], '2FA', default2FA);
              await this._addUserMeta(userId[0], 'accountType', accountType);
              await this._addUserMeta(userId[0], 'signUpMethod', signUpMethod);
              resolve({
                userId: userId[0],
                token,
                default2FA: default2FA,
              });
            } catch (error) {
              console.log(error);
              logger.error(error);
              reject(error);
            }
          })
          .catch((err) => {
            console.log(err);
            logger.error(err);
            reject(err);
          });
      });
    });
  }

  createNewAccountForInvitedUser(
    firstname,
    lastname,
    email,
    countryCode,
    mobileNumber,
    password,
    companytwoFactorAuth,
    companyId,
    role,
    signUpMethod
  ) {
    return new Promise((resolve, reject) => {
      const token = this.getRandomIntInclusive();
      const token_issued = Date.now();
      const dateTime = new Date();

      this.generateHash(password)
        .then((hashedPassword) => {
          this.dbConnection('users')
            .insert({
              firstname,
              lastname,
              email,
              countryCode,
              mobileNumber,
              password: hashedPassword,
              accountStatus: 1,
              token,
              token_issued,
              created: dateTime,
              updated: dateTime,
            })
            .then(async (userId) => {
              try {
                await this._addUserMeta(userId[0], 'otp', '');
                await this._addUserMeta(userId[0], 'otp_issued', '');
                await this._addUserMeta(userId[0], 'incorrect_attempt_count', 0);
                await this._addUserMeta(userId[0], 'attempt_timestamp', '');
                await this._addUserMeta(userId[0], 'accountLockStatus', 0);
                await this._addUserMeta(userId[0], 'profilePic', 'default.png');
                await this._addUserMeta(userId[0], '2FA', companytwoFactorAuth ? '1' : '0');
                await this._addUserMeta(userId[0], 'accountBlocked', '0');
                await this._addUserMeta(userId[0], 'accountType', 'invited');
                await this._addUserMeta(userId[0], 'signUpMethod', signUpMethod);
                await this._addUserMeta(userId[0], 'queries', '0');
                const companyCloudIntegrationData =
                  await this.getCloudIntegrationsOfCompany(companyId);

                const userCloudIntegration = await getAdminSetting('DEFAULT_CLOUD_INTEGRATION');
                const userCloudIntegrationMob = userCloudIntegration;
                await this._addUserMeta(userId[0], 'userCloudIntegration', userCloudIntegration);
                await this._addUserMeta(
                  userId[0],
                  'userCloudIntegrationMob',
                  userCloudIntegrationMob
                );

                await this._addUserMeta(
                  userId[0],
                  'GoogleDrive',
                  companyCloudIntegrationData.GoogleDrive
                );
                await this._addUserMeta(userId[0], 'Dropbox', companyCloudIntegrationData.Dropbox);
                await this._addUserMeta(
                  userId[0],
                  'OneDrive',
                  companyCloudIntegrationData.OneDrive
                );
                await this._addUserMeta(userId[0], 'Slack', companyCloudIntegrationData.Slack);
                await this._addUserMeta(
                  userId[0],
                  'Wordpress',
                  companyCloudIntegrationData.Wordpress
                );

                await this._addUserMeta(
                  userId[0],
                  'GoogleDrive_M',
                  companyCloudIntegrationData.GoogleDrive_M
                );
                await this._addUserMeta(
                  userId[0],
                  'Dropbox_M',
                  companyCloudIntegrationData.Dropbox_M
                );
                await this._addUserMeta(
                  userId[0],
                  'OneDrive_M',
                  companyCloudIntegrationData.OneDrive_M
                );
                await this._addUserMeta(userId[0], 'Slack_M', companyCloudIntegrationData.Slack_M);
                await this._addUserMeta(
                  userId[0],
                  'Wordpress_M',
                  companyCloudIntegrationData.Wordpress_M
                );

                await this.addRoleAndCompanyToUser(userId, companyId, role);

                resolve({
                  userId: userId[0],
                });
              } catch (error) {
                logger.error(error);
                reject(error);
              }
            })
            .catch((err) => {
              logger.error(err);
              reject(err);
            });
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  createNewAccountForSocialInvitedUser(
    firstname,
    lastname,
    email,
    companytwoFactorAuth,
    companyId,
    role,
    signUpMethod
  ) {
    return new Promise((resolve, reject) => {
      const token = this.getRandomIntInclusive();
      const token_issued = Date.now();
      const dateTime = new Date();

      this.dbConnection('users')
        .insert({
          firstname,
          lastname,
          email,
          mobileNumber: '(000)-000-0000',
          password: '',
          accountStatus: 1,
          token,
          token_issued,
          created: dateTime,
          updated: dateTime,
        })
        .then(async (userId) => {
          try {
            await this._addUserMeta(userId[0], 'otp', '');
            await this._addUserMeta(userId[0], 'otp_issued', '');
            await this._addUserMeta(userId[0], 'incorrect_attempt_count', 0);
            await this._addUserMeta(userId[0], 'attempt_timestamp', '');
            await this._addUserMeta(userId[0], 'accountLockStatus', 0);
            await this._addUserMeta(userId[0], 'profilePic', 'default.png');
            await this._addUserMeta(userId[0], '2FA', companytwoFactorAuth ? '1' : '0');
            await this._addUserMeta(userId[0], 'accountBlocked', '0');
            await this._addUserMeta(userId[0], 'accountType', 'invited');
            await this._addUserMeta(userId[0], 'signUpMethod', signUpMethod);
            await this._addUserMeta(userId[0], 'queries', '0');
            await this.addRoleAndCompanyToUser(userId, companyId, role);
            const userCloudIntegration = await getAdminSetting('DEFAULT_CLOUD_INTEGRATION');
            const userCloudIntegrationMob = userCloudIntegration;
            await this._addUserMeta(userId[0], 'userCloudIntegration', userCloudIntegration);
            await this._addUserMeta(userId[0], 'userCloudIntegrationMob', userCloudIntegrationMob);

            await this._addUserMeta(userId[0], 'GoogleDrive', userCloudIntegration);
            await this._addUserMeta(userId[0], 'Dropbox', userCloudIntegration);
            await this._addUserMeta(userId[0], 'OneDrive', userCloudIntegration);
            await this._addUserMeta(userId[0], 'Slack', userCloudIntegration);
            await this._addUserMeta(userId[0], 'Wordpress', userCloudIntegration);

            await this._addUserMeta(userId[0], 'GoogleDrive_M', userCloudIntegrationMob);
            await this._addUserMeta(userId[0], 'Dropbox_M', userCloudIntegrationMob);
            await this._addUserMeta(userId[0], 'OneDrive_M', userCloudIntegrationMob);
            await this._addUserMeta(userId[0], 'Slack_M', userCloudIntegrationMob);
            await this._addUserMeta(userId[0], 'Wordpress_M', userCloudIntegrationMob);
            resolve({
              userId: userId[0],
            });
          } catch (error) {
            logger.error(error);
            reject(error);
          }
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  generateHash(password) {
    return new Promise((resolve, reject) => {
      bcrypt
        .hash(password, parseInt(process.env.SALT_ROUND))
        .then(function (hash) {
          resolve(hash);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  comparePassword(password, userId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('users')
        .where({
          id: userId,
        })
        .select('password')
        .then((res) => {
          if (res.length > 0) {
            bcrypt
              .compare(password, res[0].password)
              .then((isValidPassword) => {
                if (isValidPassword) {
                  resolve(1);
                } else {
                  resolve(0);
                }
              })
              .catch((err) => {
                console.log(err);
                reject(err);
              });
          } else {
            resolve(0);
          }
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  createNewCompany(
    userId,
    companyName,
    phoneNumberCountryCode,
    phoneNumber,
    companyType,
    mailingAddStreetName,
    mailingAddCountryName,
    mailingAddState,
    mailingAddCityName,
    mailingAddZip,
    billingAddStreetName,
    billingAddCountryName,
    billingAddCityName,
    billingAddState,
    billingAddZip,
    isMailAndBillAddressSame
  ) {
    return new Promise((resolve, reject) => {
      const dateTime = new Date();
      this.dbConnection('companies')
        .insert({
          adminId: userId,
          company_name: companyName,
          company_phone_country_code: phoneNumberCountryCode,
          company_phone: phoneNumber,
          company_type: companyType,
          created: dateTime,
          updated: dateTime,
        })
        .then(async (_companyId) => {
          try {
            await this.addCompanyMeta(_companyId[0], 'mailingAddStreetName', mailingAddStreetName);
            await this.addCompanyMeta(
              _companyId[0],
              'mailingAddCountryName',
              mailingAddCountryName
            );
            await this.addCompanyMeta(_companyId[0], 'mailingAddCityName', mailingAddCityName);
            await this.addCompanyMeta(_companyId[0], 'mailingAddState', mailingAddState);
            await this.addCompanyMeta(_companyId[0], 'mailingAddZip', mailingAddZip);
            await this.addCompanyMeta(_companyId[0], 'billingAddStreetName', billingAddStreetName);
            await this.addCompanyMeta(
              _companyId[0],
              'billingAddCountryName',
              billingAddCountryName
            );
            await this.addCompanyMeta(_companyId[0], 'billingAddCityName', billingAddCityName);
            await this.addCompanyMeta(_companyId[0], 'billingAddState', billingAddState);
            await this.addCompanyMeta(_companyId[0], 'billingAddZip', billingAddZip);
            await this.addCompanyMeta(_companyId[0], 'companyLogo', 'default.png');

            const superAdmin = new SuperAdmin(this.dbConnection);
            const default2FA = process.env.DEFAULT_2FA;
            await this.addCompanyMeta(_companyId[0], '2FA', default2FA);
            await this.addCompanyMeta(
              _companyId[0],
              'isMailAndBillAddressSame',
              isMailAndBillAddressSame == true ? '1' : '0'
            );

            await this.addRoleAndCompanyToUser(userId, _companyId, 1);

            resolve({
              companyId: _companyId,
              companyDefault2FA: default2FA,
            });
          } catch (error) {
            logger.error(error);
            reject(error);
          }
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  addSubscriptionData(
    userId,
    paymentId,
    subscriptionType,
    subscriptionAmount,
    paymentStatus,
    subscriptionId,
    customerId,
    currency
  ) {
    return new Promise((resolve, reject) => {
      const dateTime = new Date();
      this.dbConnection('subscriptions')
        .insert({
          userId: userId,
          payment_id: paymentId,
          subscription_type: subscriptionType,
          subscription_amount: subscriptionAmount,
          payment_status: paymentStatus,
          subscriptionId,
          currency,
          customerId,
          created: dateTime,
        })
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  updateSubscriptionData(userId, paymentStatus) {
    return new Promise((resolve, reject) => {
      const dateTime = new Date();
      this.dbConnection('subscriptions')
        .where({ userId: userId })
        .update({
          payment_status: paymentStatus,
          deactivated: dateTime,
        })
        .then(() => {
          resolve(1);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  getSubscriptionData(userId) {
    return new Promise((resolve, reject) => {
      this.dbConnection
        .raw('Select * from subscriptions where userId = ?', [userId])
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  getUserIdByEmail(userEmail) {
    return new Promise((resolve, reject) => {
      this.dbConnection
        .raw('Select id from users where email = ?', [userEmail])
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  checkPaymentStatus(email) {
    return new Promise((resolve, reject) => {
      this.dbConnection('users')
        .select('id')
        .where({ email })
        .then((res) => {
          if (res.length > 0) {
            this.dbConnection('subscriptions')
              .select('payment_status')
              .where({ userId: res[0]['id'] })
              .then((res) => {
                if (res.length > 0) {
                  if (res[0]['payment_status'] == '1') {
                    resolve('success');
                  } else {
                    resolve('failed');
                  }
                } else {
                  resolve('pending');
                }
              });
          } else {
            resolve('pending');
          }
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  getCloudIntegrationsOfCompany(companyId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('user_company_role_relationship')
        .select('userId')
        .where({ company: companyId, role: 1 })
        .then(async (res) => {
          if (res.length > 0) {
            let data = await this.getUserMetaDetails(res[0].userId);
            resolve({
              GoogleDrive: data.GoogleDrive,
              Dropbox: data.Dropbox,
              OneDrive: data.OneDrive,
              Slack: data.Slack,
              Wordpress: data.Wordpress,
              GoogleDrive_M: data.GoogleDrive_M,
              Dropbox_M: data.Dropbox_M,
              OneDrive_M: data.OneDrive_M,
              Slack_M: data.Slack_M,
              Wordpress_M: data.Wordpress_M,
            });
          } else {
            resolve('pending');
          }
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  addRoleAndCompanyToUser(userId, companyId, role) {
    return new Promise((resolve, reject) => {
      const dateTime = new Date();
      this.dbConnection('user_company_role_relationship')
        .insert({
          userId,
          company: companyId,
          role,
          created: dateTime,
          updated: dateTime,
        })
        .then((res) => {
          if (res) {
            resolve(res);
          } else {
            reject(false);
          }
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  adminRoleUpdateForUser(userId, companyId, role) {
    return new Promise((resolve, reject) => {
      this.dbConnection
        .raw(
          'Update user_company_role_relationship set role = ? where userId = ? and company = ?',
          [role, userId, companyId]
        )
        .then(() => {
          resolve(1);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });

      this.dbConnection
        .raw('Update invitations set role = ? where userId = ?', [role, userId])
        .then(() => {
          resolve(1);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  addCompanyMeta(companyId, metaKey, metaValue) {
    if (companyId) {
      return new Promise((resolve, reject) => {
        this.dbConnection('companies_meta')
          .insert({
            companyId,
            metaKey,
            metaValue,
          })
          .then((result) => {
            if (result) {
              resolve(true);
            } else {
              reject(false);
            }
          })
          .catch((err) => {
            logger.error(err);
            reject(false);
          });
      });
    }
  }

  updateUser(userId, firstname, lastname, countryCode, mobileNumber, profilePic) {
    return new Promise((resolve, reject) => {
      const dateTime = new Date();

      this.dbConnection('users')
        .where({ id: userId })
        .update({
          firstname,
          lastname,
          countryCode,
          mobileNumber,
          updated: dateTime,
        })
        .then(async (res) => {
          if (res == 1) {
            if (profilePic && profilePic != '') {
              await this.updateUserMeta(userId, 'profilePic', profilePic);
            }

            resolve(1);
          } else {
            resolve(0);
          }
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  adminUserUpdate(
    userId,
    firstname,
    lastname,
    email,
    countryCode,
    mobileNumber,
    profilePic,
    password
  ) {
    return new Promise((resolve, reject) => {
      const dateTime = new Date();

      this.dbConnection('users')
        .where({ id: userId })
        .update({
          firstname,
          lastname,
          email,
          countryCode,
          mobileNumber,
          updated: dateTime,
        })
        .then(async (res) => {
          if (res == 1) {
            if (password != null && password != '' && password.length > 0) {
              this.updatePassword(userId, password)
                .then((res) => {
                  if (res == 1) {
                    logger.info(`Password update successful for user ID ${userId}`);
                  } else {
                    logger.warn(`Password update failed for user ID ${userId}`);
                  }
                })
                .catch((err) => {
                  logger.error(err);
                });
            }
            if (profilePic && profilePic != '') {
              await this.updateUserMeta(userId, 'profilePic', profilePic);
            }

            resolve(1);
          } else {
            resolve(0);
          }
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  superAdminUserUpdate(
    userId,
    firstname,
    lastname,
    email,
    countryCode,
    mobileNumber,
    profilePic,
    twoFactorAuth,
    password,
    userCloudIntegration,
    userCloudIntegrationMob,
    Dropbox,
    Dropbox_M,
    GoogleDrive,
    GoogleDrive_M,
    OneDrive,
    OneDrive_M,
    Slack,
    Slack_M,
    Wordpress,
    Wordpress_M
  ) {
    return new Promise((resolve, reject) => {
      const dateTime = new Date();

      this.dbConnection('users')
        .where({ id: userId })
        .update({
          firstname,
          lastname,
          email,
          countryCode,
          mobileNumber,
          updated: dateTime,
        })
        .then(async (res) => {
          if (res == 1) {
            if (password != null && password != '' && password.length > 0) {
              this.updatePassword(userId, password)
                .then((res) => {
                  if (res == 1) {
                    logger.info(`Password update successful for user ID ${userId}`);
                  } else {
                    logger.warn(`Password update failed for user ID ${userId}`);
                  }
                })
                .catch((err) => {
                  logger.error(err);
                });
            }
            if (profilePic && profilePic != '') {
              await this.updateUserMeta(userId, 'profilePic', profilePic);
            }
            if (twoFactorAuth) {
              await this.updateUserMeta(userId, '2FA', twoFactorAuth);
            }
            if (userCloudIntegration) {
              await this.updateUserMeta(userId, 'userCloudIntegration', userCloudIntegration);
              await this.updateUserMeta(userId, 'userCloudIntegrationMob', userCloudIntegrationMob);
              await this.updateUserMeta(userId, 'Dropbox', Dropbox);
              await this.updateUserMeta(userId, 'Dropbox_M', Dropbox_M);
              await this.updateUserMeta(userId, 'GoogleDrive', GoogleDrive);
              await this.updateUserMeta(userId, 'GoogleDrive_M', GoogleDrive_M);
              await this.updateUserMeta(userId, 'OneDrive', OneDrive);
              await this.updateUserMeta(userId, 'OneDrive_M', OneDrive_M);
              await this.updateUserMeta(userId, 'Slack', Slack);
              await this.updateUserMeta(userId, 'Slack_M', Slack_M);
              await this.updateUserMeta(userId, 'Wordpress', Wordpress);
              await this.updateUserMeta(userId, 'Wordpress_M', Wordpress_M);
            }

            resolve(1);
          } else {
            resolve(0);
          }
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  updateCompany(
    companyId,
    phoneNumber,
    phoneNumberCountryCode,
    companyName,
    companyType,
    mailingAddStreetName,
    mailingAddCountryName,
    mailingAddCityName,
    mailingAddState,
    mailingAddZip,
    billingAddStreetName,
    billingAddCountryName,
    billingAddCityName,
    billingAddState,
    billingAddZip,
    isMailAndBillAddressSame,
    companyLogo
  ) {
    return new Promise((resolve, reject) => {
      const dateTime = new Date();

      this.dbConnection('companies')
        .where({ id: companyId })
        .update({
          company_name: companyName,
          company_phone_country_code: phoneNumberCountryCode,
          company_phone: phoneNumber,
          company_type: companyType,
          updated: dateTime,
        })
        .then(async (res) => {
          if (res == 1) {
            await this.updateCompanyMeta(companyId, 'mailingAddStreetName', mailingAddStreetName);
            await this.updateCompanyMeta(companyId, 'mailingAddCountryName', mailingAddCountryName);
            await this.updateCompanyMeta(companyId, 'mailingAddCityName', mailingAddCityName);
            await this.updateCompanyMeta(companyId, 'mailingAddState', mailingAddState);
            await this.updateCompanyMeta(companyId, 'mailingAddZip', mailingAddZip);
            await this.updateCompanyMeta(companyId, 'billingAddStreetName', billingAddStreetName);
            await this.updateCompanyMeta(companyId, 'billingAddCountryName', billingAddCountryName);
            await this.updateCompanyMeta(companyId, 'billingAddCityName', billingAddCityName);
            await this.updateCompanyMeta(companyId, 'billingAddState', billingAddState);
            await this.updateCompanyMeta(companyId, 'billingAddZip', billingAddZip);
            await this.updateCompanyMeta(
              companyId,
              'isMailAndBillAddressSame',
              isMailAndBillAddressSame == 'true' ? '1' : '0'
            );

            if (companyLogo && companyLogo != '') {
              await this.updateCompanyMeta(companyId, 'companyLogo', companyLogo);
            }

            resolve(1);
          } else {
            resolve(0);
          }
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  updateCompany2(
    companytwoFactorAuth,
    companyId,
    phoneNumber,
    phoneNumberCountryCode,
    companyName,
    companyType,
    mailingAddStreetName,
    mailingAddCountryName,
    mailingAddCityName,
    mailingAddState,
    mailingAddZip,
    billingAddStreetName,
    billingAddCountryName,
    billingAddCityName,
    billingAddState,
    billingAddZip,
    isMailAndBillAddressSame,
    companyLogo,
    userCloudIntegration,
    userCloudIntegrationMob,
    Dropbox,
    Dropbox_M,
    GoogleDrive,
    GoogleDrive_M,
    OneDrive,
    OneDrive_M,
    Slack,
    Slack_M,
    Wordpress,
    Wordpress_M
  ) {
    return new Promise((resolve, reject) => {
      const dateTime = new Date();

      this.dbConnection('companies')
        .where({ id: companyId })
        .update({
          company_name: companyName,
          company_phone_country_code: phoneNumberCountryCode,
          company_phone: phoneNumber,
          company_type: companyType,
          updated: dateTime,
        })
        .then(async (res) => {
          if (res == 1) {
            await this.updateCompanyMeta(companyId, 'mailingAddStreetName', mailingAddStreetName);
            await this.updateCompanyMeta(companyId, 'mailingAddCountryName', mailingAddCountryName);
            await this.updateCompanyMeta(companyId, 'mailingAddCityName', mailingAddCityName);
            await this.updateCompanyMeta(companyId, 'mailingAddState', mailingAddState);
            await this.updateCompanyMeta(companyId, 'mailingAddZip', mailingAddZip);
            await this.updateCompanyMeta(companyId, 'billingAddStreetName', billingAddStreetName);
            await this.updateCompanyMeta(companyId, 'billingAddCountryName', billingAddCountryName);
            await this.updateCompanyMeta(companyId, 'billingAddCityName', billingAddCityName);
            await this.updateCompanyMeta(companyId, 'billingAddState', billingAddState);
            await this.updateCompanyMeta(companyId, 'billingAddZip', billingAddZip);
            await this.updateCompanyMeta(
              companyId,
              'isMailAndBillAddressSame',
              isMailAndBillAddressSame == 'true' ? '1' : '0'
            );
            await this.updateCompanyMeta(companyId, '2FA', companytwoFactorAuth);
            await this.updateCloudIntegrationForAllCompanyUsers(
              companyId,
              userCloudIntegration,
              userCloudIntegrationMob,
              Dropbox,
              Dropbox_M,
              GoogleDrive,
              GoogleDrive_M,
              OneDrive,
              OneDrive_M,
              Slack,
              Slack_M,
              Wordpress,
              Wordpress_M
            );
            if (companyLogo && companyLogo != '') {
              await this.updateCompanyMeta(companyId, 'companyLogo', companyLogo);
            }

            resolve(1);
          } else {
            resolve(0);
          }
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  _addUserMeta(userId, metaKey, metaValue) {
    if (userId) {
      return new Promise((resolve, reject) => {
        this.dbConnection('users_meta')
          .insert({
            userId,
            metaKey,
            metaValue,
          })
          .then((result) => {
            if (result) {
              resolve(true);
            } else {
              reject(false);
            }
          })
          .catch((err) => {
            logger.error(err);
            reject(false);
          });
      });
    }
  }

  updateUserMeta(userId, metaKey, metaValue) {
    if (userId) {
      return new Promise((resolve, reject) => {
        this.dbConnection
          .raw('Update users_meta set metaValue = ? where userId = ? and metaKey = ?', [
            metaValue,
            userId,
            metaKey,
          ])
          .then((result) => {
            resolve(result);
          })
          .catch((err) => {
            logger.error(err);
            reject(err);
          });
      });
    }
  }

  updateCompanyMeta(companyId, metaKey, metaValue) {
    if (companyId) {
      return new Promise((resolve, reject) => {
        this.dbConnection
          .raw('Update companies_meta set metaValue = ? where companyId = ? and metaKey = ?', [
            metaValue,
            companyId,
            metaKey,
          ])
          .then((result) => {
            resolve(result);
          })
          .catch((err) => {
            logger.error(err);
            reject(err);
          });
      });
    }
  }

  checkIfUserExist(email) {
    return new Promise((resolve, reject) => {
      this.dbConnection('users')
        .where({
          email,
        })
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  getRandomIntInclusive() {
    const min = Math.ceil(1000);
    const max = Math.floor(9999);
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  getUserMetaValue(userId, metaKey) {
    return new Promise((resolve, reject) => {
      this.dbConnection
        .raw('Select metaValue from users_meta where userId = ? and metaKey = ?', [userId, metaKey])
        .then((res) => {
          if (res[0].length > 0) {
            resolve(res[0][0].metaValue);
          } else {
            resolve('');
          }
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  getCompanyMetaValue(companyId, metaKey) {
    return new Promise((resolve, reject) => {
      this.dbConnection
        .raw('Select metaValue from companies_meta where companyId = ? and metaKey = ?', [
          companyId,
          metaKey,
        ])
        .then((res) => {
          resolve(res[0][0].metaValue);
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  validateToken(userId, token) {
    return new Promise((resolve, reject) => {
      this.dbConnection('users')
        .where({
          id: userId,
        })
        .select('token', 'token_issued')
        .then((res) => {
          const tnow = Date.now();
          const tDiff = tnow - parseInt(res[0].token_issued);
          if (tDiff < 43200000) {
            if (token == res[0].token) {
              resolve('valid');
            } else {
              resolve('invalid token');
            }
          } else {
            resolve('expired');
          }
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  validatePasswordByUserId(userId, password) {
    return new Promise((resolve, reject) => {
      this.dbConnection('users')
        .where({
          id: userId,
        })
        .select('password')
        .then((res) => {
          if (res.length > 0) {
            this.comparePassword(password, userId).then((isValid) => {
              if (isValid) {
                resolve('valid');
              } else {
                resolve('invalid');
              }
            });
          } else {
            resolve('invalid');
          }
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  verifyAccount(userId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('users')
        .where({ id: userId })
        .update({
          accountStatus: 1,
        })
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  resetToken(userId) {
    return new Promise((resolve, reject) => {
      const token = this.getRandomIntInclusive();
      const token_issued = Date.now();

      this.dbConnection('users')
        .where({ id: userId })
        .update({
          token,
          token_issued,
        })
        .then((res) => {
          resolve({
            res,
            token,
          });
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  generateOTP(userId) {
    return new Promise(async (resolve, reject) => {
      try {
        const otp = this.getRandomIntInclusive();
        const otp_issued = Date.now();

        await this.updateUserMeta(userId, 'otp', otp);
        await this.updateUserMeta(userId, 'otp_issued', otp_issued);

        resolve(otp);
      } catch (error) {
        logger.error(err);
        reject(error);
      }
    });
  }

  isCompanyAdmin(userId, companyId) {
    return new Promise((resolve, reject) => {
      this.dbConnection
        .raw('Select role from user_company_role_relationship where userId = ? and company = ?', [
          userId,
          companyId,
        ])
        .then((res) => {
          resolve(res[0][0].role);
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  getCompanyIdForUser(userId) {
    return new Promise((resolve, reject) => {
      this.dbConnection
        .raw('Select company from user_company_role_relationship where userId = ?', [userId])
        .then((res) => {
          resolve(res[0][0].company);
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  getCompanyRoleForUser(userId, companyId) {
    return new Promise((resolve, reject) => {
      this.dbConnection
        .raw('Select role from user_company_role_relationship where userId = ? and company = ?', [
          userId,
          companyId,
        ])
        .then((res) => {
          if (res[0][0]) {
            resolve(res[0][0].role);
          } else {
            resolve('no role');
          }
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  getUserDetails(email) {
    return new Promise((resolve, reject) => {
      logger.info('Fetching user details');
      this.dbConnection('users')
        .where({
          email: email,
        })
        .select('*')
        .then((res) => {
          const userId = res[0].id;
          let user = {
            id: res[0].id,
            firstname: res[0].firstname,
            lastname: res[0].lastname,
            email: res[0].email,
            accountStatus: res[0].accountStatus == 1 ? true : false,
            countryCode: res[0].countryCode,
            mobileNumber: res[0].mobileNumber,
          };
          this.getUserMetaDetailsLogin(userId).then((metaData) => {
            if (metaData) {
              user = { ...user, ...metaData };
            }
            resolve(user);
          });
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  getUserCloudIntegrationData(userId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('user_integrations')
        .where({ userId: userId })
        .select('*')
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  getUserMetaDetailsLogin(userId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('users_meta')
        .where({ userId: userId })
        .select('*')
        .then((res) => {
          let temp = {};
          res.forEach((element) => {
            temp[element.metaKey] = element.metaValue;
          });

          let data = {
            accountLockStatus: temp['accountLockStatus'] == 1 ? true : false,
            avatarName: `${process.env.USER_PROFILE_IMAGE_URL}/${temp['profilePic']}`,
            twoFactorAuth: temp['2FA'] == 1 ? true : false,
            accountBlocked: temp['accountBlocked'] == 1 ? true : false,
            accountType: temp['accountType'],
          };
          resolve(data);
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  isUserExist(userId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('users')
        .where({
          id: userId,
        })
        .select('*')
        .then((res) => {
          if (res.length > 0) {
            resolve('exists');
          }
          resolve('not-exists');
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  isCompanyExist(companyId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('companies')
        .where({
          id: companyId,
        })
        .select('*')
        .then((res) => {
          if (res.length > 0) {
            resolve('exists');
          }
          resolve('not-exists');
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  getCompanyDetails(companyId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('companies')
        .where({
          id: companyId,
        })
        .select('*')
        .then(async (res) => {
          const companyId = res[0].id;
          let company = {
            companyId: res[0].id,
            phoneNumber: res[0].company_phone,
            phoneNumberCountryCode: res[0].company_phone_country_code,
            companyName: res[0].company_name,
            orgType: res[0].company_type,
            created: res[0].created,
          };
          this.getCompanyMetaDetails(companyId).then((metaData) => {
            if (metaData) {
              company = { ...company, ...metaData };
            }
            resolve(company);
          });
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  getCompanyDetailsByUserId(userId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('companies')
        .where({
          adminId: userId,
        })
        .select('*')
        .then((res) => {
          const companyId = res[0].id;
          let company = {
            companyId: res[0].id,
            phoneNumber: res[0].company_phone,
            companyName: res[0].company_name,
            orgType: res[0].company_type,
            created: res[0].created,
          };
          this.getCompanyMetaDetails(companyId).then((metaData) => {
            if (metaData) {
              company = { ...company, ...metaData };
            }
            resolve(company);
          });
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  getUserDetailsById(userId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('users')
        .where({
          id: userId,
        })
        .select('*')
        .then((res) => {
          const userId = res[0].id;
          let user = {
            id: res[0].id,
            firstname: res[0].firstname,
            lastname: res[0].lastname,
            email: res[0].email,
            accountStatus: res[0].accountStatus == 1 ? true : false,
            countryCode: res[0].countryCode,
            mobileNumber: res[0].mobileNumber,
            created: res[0].created,
          };
          this.getUserMetaDetails(userId).then((metaData) => {
            if (metaData) {
              user = { ...user, ...metaData };
            }
            resolve(user);
          });
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  getUserMetaDetails(userId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('users_meta')
        .where({ userId: userId })
        .select('*')
        .then((res) => {
          let temp = {};
          res.forEach((element) => {
            temp[element.metaKey] = element.metaValue;
          });

          let data = {
            accountLockStatus: temp['accountLockStatus'] == 1 ? true : false,
            avatarName: `${process.env.USER_PROFILE_IMAGE_URL}/${temp['profilePic']}`,
            twoFactorAuth: temp['2FA'] == 1 ? true : false,
            accountBlocked: temp['accountBlocked'] == 1 ? true : false,
            accountType: temp['accountType'],
            userCloudIntegration: temp['userCloudIntegration'],
            userCloudIntegrationMob: temp['userCloudIntegrationMob'],
            GoogleDrive: temp['GoogleDrive'],
            Dropbox: temp['Dropbox'],
            OneDrive: temp['OneDrive'],
            Slack: temp['Slack'],
            Wordpress: temp['Wordpress'],

            GoogleDrive_M: temp['GoogleDrive_M'],
            Dropbox_M: temp['Dropbox_M'],
            OneDrive_M: temp['OneDrive_M'],
            Slack_M: temp['Slack_M'],
            Wordpress_M: temp['Wordpress_M'],
          };
          resolve(data);
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  getCompanyMetaDetails(companyId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('companies_meta')
        .where({ companyId: companyId })
        .select('*')
        .then((res) => {
          let temp = {};
          res.forEach((element) => {
            temp[element.metaKey] = element.metaValue;
          });

          let data = {
            mailingAddress: {
              addressLine: temp['mailingAddStreetName'],
              country: temp['mailingAddCountryName'],
              city: temp['mailingAddCityName'],
              state: temp['mailingAddState'],
              postCode: temp['mailingAddZip'],
            },
            billingAddress: {
              addressLine: temp['billingAddStreetName'],
              country: temp['billingAddCountryName'],
              city: temp['billingAddCityName'],
              state: temp['billingAddState'],
              postCode: temp['billingAddZip'],
            },
            companyLogo: temp['companyLogo']
              ? `${process.env.COMPANY_LOGO_URL}/${temp['companyLogo']}`
              : null,
            companytwoFactorAuth: temp['2FA'] == 1 ? true : false,
            isMailAndBillAddressSame: temp['isMailAndBillAddressSame'] == 1 ? true : false,
          };
          resolve(data);
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  getCompanyRole(userId) {
    console.log('getting company role for user ', userId);
    return new Promise((resolve, reject) => {
      this.dbConnection('user_company_role_relationship')
        .where({ userId })
        .select('*')
        .then((roleData) => {
          resolve(roleData[0]);
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  getIncorrectOTPAttemptRecord(userId) {
    return new Promise((resolve, reject) => {
      this.getUserMetaValue(userId, 'incorrect_attempt_count')
        .then((count) => resolve(count))
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  isAccountLockedForIncorrectOtpAccount(userId) {
    return new Promise((resolve, reject) => {
      this.getUserMetaValue(userId, 'accountLockStatus')
        .then((status) => {
          if (status == 0) {
            resolve(0);
          } else {
            const currentTimestamp = Date.now();
            this.getUserMetaValue(userId, 'attempt_timestamp').then((time) => {
              if (time) {
                let tDiff = currentTimestamp - parseInt(time);
                if (tDiff < 43200000) {
                  resolve(1);
                } else {
                  this.updateUserMeta(userId, 'incorrect_attempt_count', 0);
                  this.updateUserMeta(userId, 'accountLockStatus', 0);
                  resolve(0);
                }
              }
            });
          }
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  updateIncorrectOTPAttemptRecord(userId) {
    return new Promise((resolve, reject) => {
      const currentTimestamp = Date.now();
      this.getUserMetaValue(userId, 'attempt_timestamp').then((time) => {
        if (time) {
          let tDiff = currentTimestamp - parseInt(time);
          if (tDiff < 43200000) {
            this.getIncorrectOTPAttemptRecord(userId).then((count) => {
              let countInt = parseInt(count);
              countInt += 1;
              if (countInt <= 3) {
                this.updateUserMeta(userId, 'incorrect_attempt_count', countInt);
              } else {
                this.updateUserMeta(userId, 'accountLockStatus', 1);
              }
            });
          } else {
            this.updateUserMeta(userId, 'incorrect_attempt_count', 1);
            this.updateUserMeta(userId, 'attempt_timestamp', currentTimestamp);
          }
        } else {
          this.updateUserMeta(userId, 'incorrect_attempt_count', 1);
          this.updateUserMeta(userId, 'attempt_timestamp', currentTimestamp);
        }
      });
    });
  }

  validateLoginCredential(email, password) {
    return new Promise((resolve, reject) => {
      this.dbConnection('users')
        .where({
          email: email,
        })
        .select('id', 'password')
        .then((res) => {
          if (res.length > 0) {
            this.comparePassword(password, res[0].id)
              .then((isValid) => {
                if (isValid) {
                  this.isAccountLockedForIncorrectOtpAccount(res[0].id)
                    .then((stat) => {
                      if (stat == 0) {
                        resolve({
                          stat: 'valid',
                          userId: res[0].id,
                        });
                      } else {
                        resolve({
                          stat: 'locked',
                        });
                      }
                    })
                    .catch((err) => {
                      console.log(err);
                      reject(err);
                    });
                } else {
                  resolve({ stat: 'invalid' });
                }
              })
              .catch((err) => {
                console.log(err);
                reject(err);
              });
          } else {
            resolve({ stat: 'invalid' });
          }
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  validateCredentialAndOtp(email, password, otp) {
    return new Promise((resolve, reject) => {
      this.validateLoginCredential(email, password).then((res) => {
        const currentTimestamp = Date.now();
        if (res.stat == 'valid') {
          this.isAccountLockedForIncorrectOtpAccount(res.userId).then((stat) => {
            if (stat == 0) {
              this.getUserMetaValue(res.userId, 'otp').then((otpInRecord) => {
                if (otpInRecord == otp) {
                  this.getUserMetaValue(res.userId, 'otp_issued').then((otpIssuedTime) => {
                    const tDiff = currentTimestamp - otpIssuedTime;
                    if (tDiff <= 600000) {
                      resolve('valid');
                    } else {
                      resolve('expired');
                    }
                  });
                } else {
                  this.updateIncorrectOTPAttemptRecord(res.userId);
                  resolve('Invalid OTP');
                }
              });
            } else {
              resolve('locked');
            }
          });
        } else if (res.stat == 'locked') {
          resolve('locked');
        } else {
          resolve('Invalid Credential');
        }
      });
    });
  }

  validatePassword(userId, password) {
    return new Promise((resolve, reject) => {
      this.dbConnection('users')
        .where({ id: userId })
        .select('password')
        .then((res) => {
          this.comparePassword(password, userId)
            .then((isValid) => {
              if (isValid) {
                resolve('valid');
              } else {
                resolve('invalid');
              }
            })
            .catch((err) => {
              console.log(err);
              reject(err);
            });
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  updatePassword(userId, password) {
    return new Promise((resolve, reject) => {
      this.generateHash(password)
        .then((hashedPassword) => {
          this.dbConnection('users')
            .where({ id: userId })
            .update({ password: hashedPassword })
            .then((res) => {
              resolve(res);
            })
            .catch((err) => {
              reject(err);
              logger.error(err);
            });
        })
        .catch((err) => {
          reject(err);
          logger.error(err);
        });
    });
  }

  updateEmail(userId, email) {
    return new Promise((resolve, reject) => {
      this.dbConnection('users')
        .where({ id: userId })
        .update({
          email,
          accountStatus: 0,
        })
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  isUpdatingSameEmail(userId, newEmail) {
    return new Promise((resolve, reject) => {
      this.dbConnection('users')
        .where({ id: userId })
        .select('email')
        .then((res) => {
          if (res[0].email == newEmail) {
            resolve('yes');
          } else {
            resolve('no');
          }
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  isAccountVerified(userId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('users')
        .where({ id: userId })
        .select('accountStatus')
        .then((res) => {
          if (res[0].accountStatus == 1) {
            resolve('verified');
          } else {
            resolve('not verified');
          }
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  is2FAEnabled(userId) {
    return new Promise((resolve, reject) => {
      this.getUserMetaValue(userId, '2FA')
        .then((res) => {
          if (res == 1) {
            resolve('enabled');
          } else {
            resolve('disabled');
          }
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  isCompany2FAEnabled(companyId) {
    return new Promise((resolve, reject) => {
      this.getCompanyMetaValue(companyId, '2FA')
        .then((res) => {
          if (res == 1) {
            resolve('enabled');
          } else {
            resolve('disabled');
          }
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  enable2FA(userId) {
    return new Promise((resolve, reject) => {
      this.isAccountVerified(userId)
        .then(async (res) => {
          if (res == 'verified') {
            await this.updateUserMeta(userId, '2FA', 1);

            resolve(1);
          } else {
            resolve(0);
          }
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  disable2FA(userId) {
    return new Promise(async (resolve, reject) => {
      await this.updateUserMeta(userId, '2FA', 0);
      resolve(1);
    });
  }

  enableCompany2FA(companyId, userId) {
    return new Promise((resolve, reject) => {
      this.isAccountVerified(userId)
        .then(async (res) => {
          if (res == 'verified') {
            await this.updateCompanyMeta(companyId, '2FA', 1);

            resolve(1);
          } else {
            resolve(0);
          }
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  disableCompany2FA(companyId) {
    return new Promise(async (resolve, reject) => {
      await this.updateCompanyMeta(companyId, '2FA', 0);
      resolve(1);
    });
  }

  enable2FAForAllCompanyUsers(companyId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('user_company_role_relationship')
        .where({ company: companyId })
        .select('userId')
        .then(async (res) => {
          if (res.length > 0) {
            await res.forEach((data) => {
              this.isAccountVerified(data.userId)
                .then(async (res) => {
                  if (res == 'verified') {
                    await this.updateUserMeta(data.userId, '2FA', 1);
                  }
                })
                .catch((err) => {
                  logger.error(err);
                });
            });
            resolve(1);
          }
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  disable2FAForAllCompanyUsers(companyId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('user_company_role_relationship')
        .where({ company: companyId })
        .select('userId')
        .then(async (res) => {
          if (res.length > 0) {
            res.forEach((data) => {
              this.updateUserMeta(data.userId, '2FA', 0);
            });
            resolve(1);
          }
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  updateCloudIntegrationForAllCompanyUsers(
    companyId,
    userCloudIntegration,
    userCloudIntegrationMob,
    Dropbox,
    Dropbox_M,
    GoogleDrive,
    GoogleDrive_M,
    OneDrive,
    OneDrive_M,
    Slack,
    Slack_M,
    Wordpress,
    Wordpress_M
  ) {
    return new Promise((resolve, reject) => {
      this.dbConnection('user_company_role_relationship')
        .where({ company: companyId })
        .select('userId')
        .then(async (res) => {
          if (res.length > 0) {
            await res.forEach(async (data) => {
              await this.updateUserMeta(data.userId, 'userCloudIntegration', userCloudIntegration);
              await this.updateUserMeta(
                data.userId,
                'userCloudIntegrationMob',
                userCloudIntegrationMob
              );
              await this.updateUserMeta(data.userId, 'Dropbox', Dropbox);
              await this.updateUserMeta(data.userId, 'Dropbox_M', Dropbox_M);
              await this.updateUserMeta(data.userId, 'GoogleDrive', GoogleDrive);
              await this.updateUserMeta(data.userId, 'GoogleDrive_M', GoogleDrive_M);
              await this.updateUserMeta(data.userId, 'OneDrive', OneDrive);
              await this.updateUserMeta(data.userId, 'OneDrive_M', OneDrive_M);
              await this.updateUserMeta(data.userId, 'Slack', Slack);
              await this.updateUserMeta(data.userId, 'Slack_M', Slack_M);
              await this.updateUserMeta(data.userId, 'Wordpress', Wordpress);
              await this.updateUserMeta(data.userId, 'Wordpress_M', Wordpress_M);
            });
            resolve(1);
          }
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  getAccountStatistic(userId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('users_meta')
        .where({ userId: userId })
        .select('*')
        .then((res) => {
          let temp = {};
          res.forEach((element) => {
            temp[element.metaKey] = element.metaValue;
          });

          let stat = {
            noOfQueriesMaxLimit: temp['queries_max_limit'],
            noOfQueriesDone: temp['no_of_queries'],
            noOfUsersMaxLimit: temp['users_max_limit'],
            noOfUsers: temp['no_of_users'],
            storageSizeMaxLimit: temp['storage_size_max_limit'],
            storageSizeOccupied: temp['file_size'],
          };
          resolve(stat);
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  addInvitationDetails(email, senderId, role, companyId) {
    return new Promise((resolve, reject) => {
      const token = this.getRandomIntInclusive();
      const token_issued = Date.now();
      const dateTime = new Date();

      this.dbConnection('invitations')
        .insert({
          sender: senderId,
          company: companyId,
          email,
          role,
          status: 'Pending',
          token,
          token_issued,
          created: dateTime,
          updated: dateTime,
        })
        .then((invitationId) => {
          resolve({
            invitationId,
            token,
          });
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  updateInvitationDetails(email, companyId) {
    return new Promise((resolve, reject) => {
      const token = this.getRandomIntInclusive();
      const token_issued = Date.now();
      const dateTime = new Date();

      this.dbConnection('invitations')
        .where({ email, company: companyId })
        .update({
          status: 'Pending',
          token,
          token_issued,
          created: dateTime,
          updated: dateTime,
        })
        .then((result) => {
          if (result > 0) {
            return this.dbConnection('invitations')
              .select('id')
              .where({ email, company: companyId })
              .first()
              .then(({ id }) => resolve({ invitationId: id, token }));
          }
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  getTotalNumberOfPageForInvitationList(limit, companyId) {
    return new Promise((resolve, reject) => {
      this.dbConnection
        .select('*')
        .from('invitations')
        .where({ company: companyId })
        .then((_list) => {
          resolve({
            totalPageNum: Math.ceil(_list.length / limit),
            noOfRecords: _list.length,
          });
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  getTotalNumberOfPageForFilteredInvitationList(limit, companyId, email) {
    return new Promise((resolve, reject) => {
      this.dbConnection
        .select('*')
        .from('invitations')
        .where({ company: companyId })
        .whereLike('email', `%${email}%`)
        .then((_list) => {
          resolve({
            totalPageNum: Math.ceil(_list.length / limit),
            noOfRecords: _list.length,
          });
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  getInvitationList(offset, limit, companyId) {
    return new Promise((resolve, reject) => {
      this.dbConnection
        .select('*')
        .from('invitations')
        .where({ company: companyId })
        .limit(limit)
        .offset(offset)
        .then(async (invitationList) => {
          await invitationList.map((invitation) => {
            invitation.selected = false;
          });
          resolve(invitationList);
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  searchUser(email, offset, limit, companyId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('invitations')
        .whereLike('email', `%${email}%`)
        .where({ company: companyId })
        .limit(limit)
        .offset(offset)
        .then(async (invitationList) => {
          await invitationList.map((invitation) => {
            invitation.selected = false;
          });
          resolve(invitationList);
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  deleteInvitations(invitationIds) {
    return new Promise(async (resolve, reject) => {
      try {
        await invitationIds.map(async (invId) => {
          await this.dbConnection.raw('Delete from invitations where id = ?', [invId]);
        });
        resolve(1);
      } catch (error) {
        logger.error(error);
        reject(error);
      }
    });
  }

  deleteInvitation(invitationId) {
    return new Promise((resolve, reject) => {
      try {
        this.dbConnection
          .raw('Delete from invitations where id = ?', [invitationId])
          .then((res) => {
            resolve(1);
          })
          .catch((err) => {
            logger.error(err);
            reject(err);
          });
      } catch (error) {
        logger.error(error);
        reject(error);
      }
    });
  }

  getInvitationDetail(email) {
    return new Promise((resolve, reject) => {
      this.dbConnection('invitations')
        .where({ email: email })
        .select('*')
        .then((res) => {
          if (res.length > 0) {
            resolve(res[0]);
          } else {
            resolve(false);
          }
        })
        .catch((err) => {
          logger.error(err);
          console.log(err);
          reject(err);
        });
    });
  }

  isInvitationExist(invitationId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('invitations')
        .where({ id: invitationId })
        .select('*')
        .then((res) => {
          if (res.length > 0) {
            resolve('exists');
          } else {
            resolve('not-exists');
          }
        })
        .catch((err) => {
          logger.error(err);
          console.log(err);
          reject(err);
        });
    });
  }

  isInvitationSent(email) {
    return new Promise((resolve, reject) => {
      this.dbConnection('invitations')
        .where({ email: email })
        .select('*')
        .then((res) => {
          if (res.length > 0) {
            resolve('yes');
          } else {
            resolve('no');
          }
        })
        .catch((err) => {
          logger.error(err);
          console.log(err);
          reject(err);
        });
    });
  }

  isPreviousInvitationExpired(email) {
    return new Promise((resolve, reject) => {
      this.dbConnection('invitations')
        .where({ email: email })
        .select('*')
        .then((res) => {
          const tnow = Date.now();
          const tDiff = tnow - parseInt(res[0].token_issued);

          if (tDiff < 600000) {
            resolve('not-expired');
          } else {
            resolve('expired');
          }
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  updateInvitationToken(email) {
    return new Promise((resolve, reject) => {
      const token = this.getRandomIntInclusive();
      const token_issued = Date.now();
      const dateTime = new Date();

      this.dbConnection('invitations')
        .where({ email: email })
        .update({
          status: 'Pending',
          token,
          token_issued,
          created: dateTime,
          updated: dateTime,
        })
        .then((res) => {
          resolve({
            res,
            token,
          });
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  updateInvitationStatusAndUserId(status, email, userId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('invitations')
        .where({ email: email })
        .update({
          status,
          userId,
        })
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  declineInvitation(email) {
    return new Promise((resolve, reject) => {
      this.dbConnection('invitations')
        .where({ email: email })
        .update({
          status: 'Declined',
        })
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  userLockAndUnlockOptionForAdmin(userId, status) {
    return new Promise((resolve, reject) => {
      this.updateUserMeta(userId, 'accountLockStatus', status)
        .then((res) => {
          resolve(1);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  blackListAccount(userId) {
    return new Promise((resolve, reject) => {
      this.updateUserMeta(userId, 'accountBlocked', '1')
        .then((res) => {
          resolve(1);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  whiteListAccount(userId) {
    return new Promise((resolve, reject) => {
      this.updateUserMeta(userId, 'accountBlocked', '0')
        .then((res) => {
          resolve(1);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  getCompanyUserCount(companyId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('user_company_role_relationship')
        .where({ company: companyId })
        .then((users) => {
          resolve(users.length);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  removeUser(userId) {
    return new Promise((resolve, reject) => {
      const dateTime = new Date();

      this.dbConnection('users')
        .where({ id: userId })
        .update({
          firstname: null,
          lastname: null,
          email: null,
          mobileNumber: null,
          password: null,
          accountStatus: 0,
          token: null,
          token_issued: null,
          updated: dateTime,
        })
        .then(async () => {
          try {
            this.dbConnection('user_company_role_relationship')
              .where({ userId: userId })
              .delete()
              .then(() => {
                this.dbConnection('invitations')
                  .where({ userId: userId })
                  .delete()
                  .then(() => {
                    resolve(1);
                  });
              });
          } catch (error) {
            console.log(error);
            logger.error(error);
            reject(error);
          }
        });
    });
  }

  getUserDetailsforSuperAdmin() {
    return new Promise((resolve, reject) => {
      this.dbConnection('users')
        .select(
          'id',
          'firstname',
          'lastname',
          'email',
          'countryCode',
          'mobileNumber',
          'accountStatus',
          'created'
        )
        .whereNotNull('email')
        .andWhere('email', '<>', '')
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  getInvitaionDetailsforSuperAdmin(userId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('invitations')
        .where({ userId })
        .select('*')
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  getInvitaionsDetailsforSuperAdmin(userId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('invitations')
        .where({ sender: userId })
        .select('*')
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  getUserTokenDetails(chatId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('tokens_used')
        .select('*')
        .where({ chatId })
        .then((data) => {
          resolve(data);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  getUserInvitedDetailforSuperAdmin(userId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('users')
        .where({ id: userId })
        .select(
          'id',
          'firstname',
          'lastname',
          'email',
          'countryCode',
          'mobileNumber',
          'accountStatus',
          'created'
        )
        .then((res) => {
          const userId = res[0].id;
          this.getUserMetaDetails(userId).then((metaData) => {
            if (metaData) {
              resolve({ ...res[0], ...metaData });
            }
          });
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  getCompanyUsers(companyId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('user_company_role_relationship')
        .where({ company: companyId })
        .then((users) => {
          resolve(users);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  createNewAccountForSuperUser(
    firstname,
    lastname,
    email,
    countryCode,
    mobileNumber,
    password,
    companytwoFactorAuth,
    companyId,
    role
  ) {
    return new Promise((resolve, reject) => {
      const token = this.getRandomIntInclusive();
      const token_issued = Date.now();
      const dateTime = new Date();

      this.generateHash(password)
        .then((hashedPassword) => {
          this.dbConnection('users')
            .insert({
              firstname,
              lastname,
              email,
              countryCode,
              mobileNumber,
              password: hashedPassword,
              accountStatus: 1,
              token,
              token_issued,
              created: dateTime,
              updated: dateTime,
            })
            .then(async (userId) => {
              try {
                await this._addUserMeta(userId[0], 'otp', '');
                await this._addUserMeta(userId[0], 'otp_issued', '');
                await this._addUserMeta(userId[0], 'incorrect_attempt_count', 0);
                await this._addUserMeta(userId[0], 'attempt_timestamp', '');
                await this._addUserMeta(userId[0], 'accountLockStatus', 0);
                await this._addUserMeta(userId[0], 'profilePic', 'default.png');
                await this._addUserMeta(userId[0], '2FA', companytwoFactorAuth ? '1' : '0');
                await this._addUserMeta(userId[0], 'accountBlocked', '0');
                await this._addUserMeta(userId[0], 'accountType', 'Team');
                await this._addUserMeta(userId[0], 'signUpMethod', 'email');
                const userCloudIntegration = await getAdminSetting('CLOUD_INTEGRATION');
                const userCloudIntegrationMob = userCloudIntegration;
                await this._addUserMeta(userId[0], 'userCloudIntegration', userCloudIntegration);
                await this._addUserMeta(
                  userId[0],
                  'userCloudIntegrationMob',
                  userCloudIntegrationMob
                );

                await this._addUserMeta(userId[0], 'GoogleDrive', userCloudIntegration);
                await this._addUserMeta(userId[0], 'Dropbox', userCloudIntegration);
                await this._addUserMeta(userId[0], 'OneDrive', userCloudIntegration);
                await this._addUserMeta(userId[0], 'Slack', userCloudIntegration);
                await this._addUserMeta(userId[0], 'Wordpress', userCloudIntegration);

                await this._addUserMeta(userId[0], 'GoogleDrive_M', userCloudIntegrationMob);
                await this._addUserMeta(userId[0], 'Dropbox_M', userCloudIntegrationMob);
                await this._addUserMeta(userId[0], 'OneDrive_M', userCloudIntegrationMob);
                await this._addUserMeta(userId[0], 'Slack_M', userCloudIntegrationMob);
                await this._addUserMeta(userId[0], 'Wordpress_M', userCloudIntegrationMob);

                await this.addRoleAndCompanyToUser(userId, companyId, role);

                resolve({
                  userId: userId[0],
                });
              } catch (error) {
                logger.error(error);
                reject(error);
              }
            })
            .catch((err) => {
              logger.error(err);
              reject(err);
            });
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  removeSuperUser(userId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('users')
        .where({ id: userId })
        .delete()
        .then(async () => {
          resolve(1);
        })
        .catch((error) => {
          console.log(error);
          logger.error(error);
          reject(error);
        });
    });
  }

  getCompanyUserRole(companyId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('user_company_role_relationship')
        .where({ company: companyId })
        .select('*')
        .then((roleData) => {
          resolve(roleData);
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  updateUserMetaQueries(userId, metaKey = 'queries') {
    if (userId) {
      return new Promise((resolve, reject) => {
        this.dbConnection
          .raw('UPDATE users_meta SET metaValue = metaValue + 1 WHERE userId = ? AND metaKey = ?', [
            userId,
            metaKey,
          ])
          .then((result) => {
            resolve(result);
          })
          .catch((err) => {
            logger.error(err);
            reject(err);
          });
      });
    }
  }

  checkMetaKeyExists(userId, metaKey) {
    return new Promise((resolve, reject) => {
      this.dbConnection
        .raw('SELECT * FROM users_meta WHERE userId = ? AND metaKey = ?', [userId, metaKey])
        .then((result) => {
          resolve(result[0]);
        })
        .catch((err) => {
          logger.error(err);
          reject(err);
        });
    });
  }

  shouldResetQueriesMetaValue() {
    return new Promise(async (resolve, reject) => {
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;

      const userId = await this.dbConnection('users_meta')
        .select('userId')
        .first()
        .then((row) => row.userId);
      const lastCheckedMonth = await this.getUserMetaValue(userId, 'lastCheckedMonth');
      if (lastCheckedMonth == currentMonth) {
        resolve(0);
        return;
      }

      this.dbConnection('users_meta')
        .where('metaKey', 'queries')
        .pluck('metaValue')
        .then((allQueriesMetaValues) => {
          const allZeroValues = allQueriesMetaValues.every((value) => value == 0);
          if (allZeroValues) {
            resolve(0);
          } else {
            resolve(1);
          }
        })
        .catch((error) => {
          logger.error(error);
          reject(error);
        });
    });
  }

  async resetQueriesMetaValueForNewMonth() {
    return new Promise(async (resolve, reject) => {
      this.shouldResetQueriesMetaValue()
        .then(async (res) => {
          if (res == 0) {
            resolve(0);
          } else {
            const currentMonth = new Date().getMonth() + 1;
            try {
              const userIds = await this.dbConnection('users_meta')
                .distinct('userId')
                .pluck('userId');

              for (const userId of userIds) {
                await this.dbConnection('users_meta')
                  .where({
                    userId: userId,
                    metaKey: 'queries',
                  })
                  .update({
                    metaValue: 0,
                  });

                const lastCheckedMonth = await this.getUserMetaValue(userId, 'lastCheckedMonth');
                if (!lastCheckedMonth) {
                  await this._addUserMeta(userId, 'lastCheckedMonth', currentMonth);
                } else {
                  await this.updateUserMeta(userId, 'lastCheckedMonth', currentMonth);
                }
              }
              resolve(1);
            } catch (error) {
              logger.error(error);
              reject(error);
            }
          }
        })
        .catch((error) => {
          logger.error(error);
          reject(error);
        });
    });
  }
}

module.exports = Users;
