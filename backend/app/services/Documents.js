var fs = require('fs');
var fs2 = require('fs').promises;
const path = require('path');
const { PDFLoader } = require('langchain/document_loaders/fs/pdf');
const { TokenTextSplitter } = require('langchain/text_splitter');
const { DocxLoader } = require('langchain/document_loaders/fs/docx');
const { TextLoader } = require('langchain/document_loaders/fs/text');
const { CSVLoader } = require('langchain/document_loaders/fs/csv');
const { HumanMessage, AIMessage } = require('langchain/schema');

const XLSX = require('xlsx');
var reader = require('any-text');
const { convert } = require('html-to-text');
const officeParser = require('officeparser');
const Community = require('./Community');
const Chat = require('./Chat');
const CustomQuerying = require('./CustomQuerying');
const FileEmbedding = require('./FileEmbedding');
const winston = require('winston');
const { combine, timestamp, json } = winston.format;
const { Storage } = require('@google-cloud/storage');
const dotenv = require('dotenv');
const { GoogleGenAI } = require('@google/genai');

const { BigQuery } = require('@google-cloud/bigquery');

const genAI = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_PROJECT_ID,
  location: process.env.BIGQUERY_LOCATION,
});
const bigquery = new BigQuery();
dotenv.config();

const { getQueryType, getNonResponseIdentifiers, getAdminSetting } = require('../init/redisUtils');

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

class Documents {
  constructor(dbConnection) {
    this.dbConnection = dbConnection;
  }

  buildAbsolutePathWithFoldersArray(foldersArray) {
    let _path = `${process.env.DOCUMENT_PATH}/`;
    const reversedFolderArray = foldersArray.reverse();
    reversedFolderArray.forEach((folder) => {
      if (folder != 'Root') {
        _path += folder + '/';
      }
    });
    return path.resolve(_path);
  }

  // getPredecessorFolders(folderId) {
  //     return new Promise(async(resolve, reject) => {
  //         try {
  //             let nextParentId = folderId;
  //             let folderTrace = [];
  //             while(true) {
  //                 if(!nextParentId) {
  //                     resolve(folderTrace.reverse())
  //                     break
  //                 }
  //                 const _data = await this.dbConnection('documents').select('*').where({ id: nextParentId })
  //                 folderTrace.push(_data[0])
  //                 nextParentId = _data[0]["parentId"]
  //             }
  //         } catch (error) {
  //             console.log(error)
  //             reject(error)
  //         }
  //     })
  // }

  getPredecessorFolders(folderId) {
    return new Promise(async (resolve, reject) => {
      try {
        let nextParentId = folderId;
        let folderTrace = [];

        while (nextParentId) {
          const _data = await this.dbConnection('documents')
            .select('*')
            .where({ id: nextParentId });

          if (_data.length === 0) {
            break;
          }

          folderTrace.push(_data[0]);
          nextParentId = _data[0]['parentId'];
        }

        resolve(folderTrace.reverse());
      } catch (error) {
        console.log(error);
        reject(error);
      }
    });
  }

  createDefaultFoldersForCommunity(communityAlias, defaultFoldersArray) {
    defaultFoldersArray.forEach((folder) => {
      const folderPath = `${process.env.DOCUMENT_PATH}/` + communityAlias + '/' + folder;
      if (!fs.existsSync(path.resolve(folderPath))) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
    });
  }

  async createCommunityFolder(communityAlias) {
    const folderPath = `${process.env.DOCUMENT_PATH}/` + communityAlias;
    if (!fs.existsSync(path.resolve(folderPath))) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
  }

  getChildFoldersAndFiles(parentId, communityId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('documents')
        .select('*')
        .where({ parentId, communityId })
        .andWhere((qb) => {
          qb.where({ isNotAnalyzed: false }).orWhereNull('isNotAnalyzed');
        })
        .then((res) => {
          let foldersAndFiles = [...res];
          let promises = foldersAndFiles.map((file, index) => {
            return this.dbConnection('users')
              .where({ id: file.creator })
              .select('firstname', 'lastname')
              .first()
              .then((owner) => {
                const ownerName = (owner?.firstname || '') + ' ' + (owner?.lastname || '');
                return this.dbConnection('users_meta')
                  .where({ userId: file.creator, metaKey: 'profilePic' })
                  .select('metaValue')
                  .first()
                  .then((userImage) => {
                    foldersAndFiles[index]['avatarName'] =
                      `${process.env.USER_PROFILE_IMAGE_URL}/${userImage?.metaValue || 'default.png'}`;
                    foldersAndFiles[index]['ownerName'] = ownerName.trim()
                      ? ownerName
                      : 'root folder';
                  });
              });
          });
          Promise.all(promises)
            .then(() => {
              resolve(foldersAndFiles);
            })
            .catch((err) => {
              console.log(err);
              reject(err);
            });
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  getRootFolders(communityId) {
    return new Promise((resolve, reject) => {
      const _data = this.dbConnection('documents')
        .select('*')
        .where({ parentId: 4 })
        .andWhere({ communityId })
        .andWhere({ isNotAnalyzed: false })
        .then((res) => {
          let foldersAndFiles = [...res];
          let promises = foldersAndFiles.map((file, index) => {
            return this.dbConnection('users')
              .where({ id: file.creator })
              .select('firstname', 'lastname')
              .first()
              .then((owner) => {
                const ownerName = (owner?.firstname || '') + ' ' + (owner?.lastname || '');
                return this.dbConnection('users_meta')
                  .where({ userId: file.creator, metaKey: 'profilePic' })
                  .select('metaValue')
                  .first()
                  .then((userImage) => {
                    foldersAndFiles[index]['avatarName'] =
                      `${process.env.USER_PROFILE_IMAGE_URL}/${userImage?.metaValue || 'default.png'}`;
                    foldersAndFiles[index]['ownerName'] = ownerName.trim()
                      ? ownerName
                      : 'root folder';
                  });
              });
          });
          Promise.all(promises)
            .then(() => {
              resolve(foldersAndFiles);
            })
            .catch((err) => {
              console.log(err);
              reject(err);
            });
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  getParentId(folderId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('documents')
        .select('parentId')
        .where({ id: folderId })
        .then((res) => {
          resolve(res[0]['parentId']);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  createFolder(folderName, tooltip, isDefault, parentId, communityId, userId) {
    return new Promise((resolve, reject) => {
      const dateTime = new Date();
      this.dbConnection('documents')
        .insert({
          parentId,
          communityId,
          name: folderName,
          tooltip,
          isDefault: isDefault == true ? 1 : 0,
          isFile: 0,
          created: dateTime,
          creator: userId,
        })
        .then((folderId) => {
          resolve(folderId);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  createFile(fileName, parentId, communityId, source) {
    return new Promise((resolve, reject) => {
      const dateTime = new Date();
      this.dbConnection('documents')
        .insert({
          parentId,
          communityId,
          name: fileName,
          tooltip: '',
          isDefault: 0,
          isFile: 1,
          created: dateTime,
          isNotAnalyzed: true,
          source: source,
        })
        .then((fileId) => {
          resolve(fileId);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  updateFile(fileName, fileId) {
    return new Promise((resolve, reject) => {
      const dateTime = new Date();
      this.dbConnection('documents')
        .update({
          name: fileName,
          created: dateTime,
        })
        .where({ id: fileId })
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  isFileNameSame(newFileName, fileId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('documents')
        .select('name')
        .where({ id: fileId })
        .then((res) => {
          if (res[0].name == newFileName) {
            resolve(1);
          } else {
            resolve(0);
          }
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  checkIfFileExists(fileId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('documents')
        .select('*')
        .where({ id: fileId })
        .then((res) => {
          if (res.length > 0) {
            resolve(1);
          } else {
            resolve(0);
          }
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  checkIfFileNameExistUnderParentId(fileName, parentId, communityId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('documents')
        .select('*')
        .where({ parentId, name: fileName, communityId })
        .then((res) => {
          if (res.length > 0) {
            if (res[0].isNotAnalyzed) {
              // If found and file is not analyzed, delete the file
              return this.dbConnection('documents')
                .where({ parentId, name: fileName, communityId })
                .del()
                .then(() => resolve(0))
                .catch((err) => reject(err));
            } else {
              resolve(1);
            }
          } else {
            resolve(0);
          }
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  checkIfFolderExists(folderId, parentId, communityId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('documents')
        .select('*')
        .where({ id: folderId })
        .andWhere({ parentId })
        .andWhere({ communityId })
        .then((res) => {
          if (res.length > 0) {
            resolve('exists');
          } else {
            resolve('not-exists');
          }
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  checkIfFolderExistsM2(parentId, communityId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('documents')
        .select('*')
        .where({ id: parentId })
        .andWhere({ communityId })
        .then((res) => {
          if (res.length > 0) {
            resolve('exists');
          } else {
            resolve('not-exists');
          }
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  checkIfFileIsValid(fileId, parentId, communityId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('documents')
        .select('*')
        .where({ id: fileId })
        .andWhere({ communityId })
        .andWhere({ parentId })
        .andWhere({ isFile: '1' })
        .then((res) => {
          if (res.length > 0) {
            resolve('exists');
          } else {
            resolve('not-exists');
          }
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  checkIfFileIsValidM2(fileId, communityId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('documents')
        .select('*')
        .where({ id: fileId })
        .andWhere({ communityId })
        .andWhere({ isFile: '1' })
        .then((res) => {
          if (res.length > 0) {
            resolve('exists');
          } else {
            resolve('not-exists');
          }
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  isFile(fileName) {
    return fs.lstatSync(fileName).isFile();
  }

  fetchFilesWithinFolder(folderId, communityId) {
    return new Promise(async (resolve, reject) => {
      try {
        let filesToBeDeleted = [];
        let contents = await this.getChildFoldersAndFiles(folderId, communityId);
        let foldersToBeQueried = [];
        contents.forEach((content) => {
          if (content.isFile == 0) {
            foldersToBeQueried.push(content);
          } else {
            filesToBeDeleted.push(content);
          }
        });
        contents = foldersToBeQueried;

        while (true) {
          if (contents.length == 0) {
            break;
          }
          foldersToBeQueried = [];

          for (const content of contents) {
            let tempData = await this.getChildFoldersAndFiles(content.id, content.communityId);
            for (const _content of tempData) {
              if (_content.isFile == 0) {
                foldersToBeQueried.push(_content);
              } else {
                filesToBeDeleted.push(_content);
              }
            }
          }
          contents = foldersToBeQueried;
        }
        resolve(filesToBeDeleted);
      } catch (error) {
        reject(error);
      }
    });
  }

  async deleteEmbeddingsById(fileId, namespace) {
    const bigquery = new BigQuery();
    const tableId = process.env.BIGQUERY_TABLE;
    const datasetId = process.env.BIGQUERY_DATASET_ID;
    const projectId = process.env.GOOGLE_PROJECT_ID;

    const backgroundDelete = async () => {
      try {
        let streamingRows = 1;
        while (streamingRows > 0) {
          const [tables] = await bigquery.dataset(datasetId).getTables();
          const table = tables.find((t) => t.id === tableId);
          const [metadata] = await table.getMetadata();

          if (metadata.streamingBuffer && metadata.streamingBuffer.estimatedRows > 0) {
            streamingRows = parseInt(metadata.streamingBuffer.estimatedRows, 10);
            await new Promise((res) => setTimeout(res, 5000));
          } else {
            streamingRows = 0;
          }
        }

        const deleteQuery = `
            DELETE FROM \`${projectId}.${datasetId}.${tableId}\`
            WHERE file_id = @fileId
            AND namespace = @namespace
          `;

        const [job] = await bigquery.createQueryJob({
          query: deleteQuery,
          location: 'US',
          params: { fileId: String(fileId), namespace: String(namespace) },
        });

        await job.getQueryResults();
      } catch (err) {
        console.error('Background deletion failed for fileId:', fileId, err);
      }
    };
    backgroundDelete();
    return 1;
  }

  deleteFiles(filesList, communityId) {
    return new Promise((resolve, reject) => {
      const community = new Community(this.dbConnection);
      community
        .getCommunityUUID(communityId)
        .then(async (uuid) => {
          if (filesList.length > 0) {
            const folderPath = path.resolve(`${process.env.DOCUMENT_PATH}/${uuid}`);
            for (const file of filesList) {
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
                await this.deleteEmbeddingsById(file.id, uuid);
              } else {
                if (fs.existsSync(path.join(folderPath, fileName))) {
                  logger.info(`${fileName} deleted from server`);
                  await fs2.unlink(path.join(folderPath, fileName));
                  await this.deleteEmbeddingsById(file.id, uuid);
                }
              }
            }
            resolve(1);
          } else {
            resolve(0);
          }
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  deleteFolderDataFromDatabase(folderId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('documents')
        .where({ id: folderId })
        .del()
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  deleteFolder(folderId, communityId) {
    return new Promise((resolve, reject) => {
      this.fetchFilesWithinFolder(folderId, communityId)
        .then(async (files) => {
          if (files.length > 0) {
            await this.deleteFiles(files, communityId);
          }
          this.deleteFolderDataFromDatabase(folderId)
            .then((res) => {
              resolve(1);
            })
            .catch((err) => {
              console.log(err);
              reject(err);
            });
        })
        .catch((err) => {
          console.log(err);
          reject('file-fetch-failed');
        });
    });
  }

  getFolderData(folderId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('documents')
        .select('*')
        .where({ id: folderId })
        .then((res) => {
          resolve(res[0]);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  updateFolder(folderId, folderName, folderDescription) {
    return new Promise((resolve, reject) => {
      this.dbConnection('documents')
        .update({
          name: folderName,
          tooltip: folderDescription,
        })
        .where({ id: folderId })
        .then((res) => {
          if (res == 1) {
            resolve(1);
          } else {
            resolve(2);
          }
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  getFileData(fileId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('documents')
        .select('*')
        .where({ id: fileId })
        .then((data) => {
          resolve(data[0]);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  deleteSummaryFromDatabase(fileId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('summary')
        .where({ fileId: fileId })
        .first() // Retrieve the first matching record
        .then((record) => {
          if (record) {
            // Record exists, proceed to delete
            logger.info(
              `Summary Record exist for fileId ${fileId} with fileName ${record.fileName}`
            );
            return this.dbConnection('summary')
              .where({ fileId: fileId })
              .del()
              .then((res) => {
                logger.info(
                  `Summary Record of ${record.fileName} of fileId ${fileId} deleted from database`
                );
                resolve(res); // Resolve the promise with the result of the deletion operation
              });
          } else {
            // Record does not exist, resolve with appropriate message
            logger.info(`Summary Record does not exist for fileId ${fileId}`);
            resolve({ message: 'Record not found' });
          }
        })
        .catch((err) => {
          console.log(err); // Log the error to the console
          logger.info(`Error finding Summary Record for fileId ${fileId}`);
          reject(err); // Reject the promise with the error
        });
    });
  }

  deleteFile(fileId, communityId) {
    return new Promise(async (resolve, reject) => {
      const community = new Community(this.dbConnection);
      community
        .getCommunityUUID(communityId)
        .then(async (uuid) => {
          this.getFileData(fileId)
            .then(async (file) => {
              const folderPath = path.resolve(`${process.env.DOCUMENT_PATH}/${uuid}`);
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
              logger.info(`FileName: ${file.name} and ID: ${fileName} exists on cloud : ${exists}`);
              if (exists) {
                const res = await storage
                  .bucket(process.env.GOOGLE_STORAGE_BUCKET_NAME)
                  .file(fileName)
                  .delete();
                logger.info(`${fileName} deleted from cloud`);
                await this.deleteEmbeddingsById(file.id, uuid);
                await this.deleteSummaryFromDatabase(fileId);
              } else {
                if (fs.existsSync(path.join(folderPath, fileName))) {
                  logger.info(`${fileName} deleted from server`);
                  await fs2.unlink(path.join(folderPath, fileName));
                  await this.deleteEmbeddingsById(file.id, uuid);
                  await this.deleteSummaryFromDatabase(fileId);
                }
              }

              await this.deleteFolderDataFromDatabase(fileId);
              resolve(1);
            })
            .catch((err) => {
              console.log(err);
              reject(err);
            });
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  getDocumentPath(fileId, communityId) {
    return new Promise((resolve, reject) => {
      const community = new Community(this.dbConnection);
      community
        .getCommunityUUID(communityId)
        .then((uuid) => {
          this.getFileData(fileId)
            .then(async (file) => {
              const folderPath = path.resolve(`${process.env.DOCUMENT_PATH}/${uuid}`);
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
              logger.info(`FileName: ${file.name} and ID: ${fileName} exists on cloud : ${exists}`);
              if (exists) {
                const options = {
                  version: 'v4',
                  action: 'read',
                  expires: Date.now() + 1000 * 60 * 60, // 1 hour
                };

                const [url] = await storage
                  .bucket(process.env.GOOGLE_STORAGE_BUCKET_NAME)
                  .file(fileName)
                  .getSignedUrl(options);
                if (url) {
                  resolve({ url });
                } else {
                  resolve('file-not-found');
                }
              } else {
                if (fs.existsSync(path.join(folderPath, fileName))) {
                  resolve(path.join(folderPath, fileName));
                } else {
                  resolve('file-not-found');
                }
              }
            })
            .catch((err) => {
              console.log(err);
              reject(err);
            });
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  searchFilesAndFolders(searchString, communityId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('documents')
        .select('*')
        .where({ communityId })
        .whereILike('name', `%${searchString}%`)
        .then((searchResult) => {
          let foldersAndFiles = [...searchResult];
          let promises = foldersAndFiles.map((file, index) => {
            return this.dbConnection('users')
              .where({ id: file.creator })
              .select('firstname', 'lastname')
              .first()
              .then((owner) => {
                const ownerName = owner.firstname + ' ' + owner.lastname;
                return this.dbConnection('users_meta')
                  .where({ userId: file.creator, metaKey: 'profilePic' })
                  .select('metaValue')
                  .first()
                  .then((userImage) => {
                    foldersAndFiles[index]['avatarName'] =
                      `${process.env.USER_PROFILE_IMAGE_URL}/${userImage.metaValue}`;
                    foldersAndFiles[index]['ownerName'] = ownerName;
                  });
              });
          });
          Promise.all(promises)
            .then(() => {
              resolve(foldersAndFiles);
            })
            .catch((err) => {
              console.log(err);
              reject(err);
            });
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  formatFileSize(kilobytes, decimalPoint) {
    if (kilobytes == 0) return '0 KB';
    const k = 1000,
      dm = decimalPoint || 2,
      sizes = ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
      i = Math.floor(Math.log(kilobytes) / Math.log(k));
    return parseFloat((kilobytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  getStorageOccupationDetail(companyId) {
    return new Promise((resolve, reject) => {
      const community = new Community(this.dbConnection);

      community
        .getAllCommunityList(companyId)
        .then(async (communityList) => {
          let size = 0;
          for (const _community of communityList) {
            const communityId = _community.id;
            const documents = await knex('documents')
              .select('*')
              .where(function () {
                this.where({ communityId: communityId });
              });
            for (const document of documents) {
              let docSize = document?.size || 0;
              const numericValue = parseFloat(docSize.toString().match(/[\d.]+/)[0]);
              size = size + numericValue;
            }
          }
          resolve(this.formatFileSize(size));
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  getStorageOccupationDetailWithDate(companyId) {
    return new Promise((resolve, reject) => {
      const community = new Community(this.dbConnection);

      community
        .getAllCommunityList(companyId)
        .then(async (communityList) => {
          const docBasePath = path.resolve(`${process.env.DOCUMENT_PATH}/`);
          let storageDetails = [];

          for (const _community of communityList) {
            const uuid = await community.getCommunityUUID(_community.id);
            const folderPath = path.join(docBasePath, uuid);

            if (fs.existsSync(folderPath)) {
              const files = await fs2.readdir(folderPath);
              for (const file of files) {
                const filePath = path.join(folderPath, file);
                const stat = await fs2.lstat(filePath);
                const createdDate = _community.created;

                storageDetails.push({
                  size: stat.size,
                  created: createdDate,
                });
              }
            }
          }
          resolve(storageDetails);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  renameCommunityDirectory(communityId, newAlias) {
    return new Promise((resolve, reject) => {
      const community = new Community(this.dbConnection);
      const docBasePath = path.resolve(`${process.env.DOCUMENT_PATH}/`);

      community
        .getCommunityAlias(communityId)
        .then(async (oldAlias) => {
          if (oldAlias != newAlias) {
            await fs2.rename(path.join(docBasePath, oldAlias), path.join(docBasePath, newAlias));
            resolve(1);
          } else {
            resolve(1);
          }
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  async changeExtension(filePath) {
    return filePath.replace(/\.[^/.]+$/, '.txt');
  }

  // ********************************** AI integration ***************************************************

  async createDocumentFromPDF(file, metaData, fileName, summary, overview) {
    const loader = new PDFLoader(file);

    const splitter = new TokenTextSplitter({
      encodingName: 'gpt2',
      chunkSize: 1000,
      chunkOverlap: 50,
    });

    const docs = await loader.loadAndSplit(splitter);

    docs.forEach((element) => {
      element.metadata['fileId'] = metaData;
      let _pageContent = `The content given below belongs to ${fileName} file\n`;
      element.pageContent = _pageContent + element.pageContent;
    });

    if (summary) {
      let pageContent = `This is the summary of ${fileName} file\n`;
      pageContent = pageContent + summary;
      docs.push({
        pageContent: pageContent,
        metadata: {
          fileId: metaData,
        },
      });
    }
    if (overview) {
      let pageContent = `This is the overview of ${fileName} file\n`;
      pageContent = pageContent + overview;
      docs.push({
        pageContent: pageContent,
        metadata: {
          fileId: metaData,
        },
      });
    }

    logger.info(JSON.stringify(docs));

    return docs;
  }

  async createDocumentFromDocx(file, metaData, fileName, summary, overview) {
    const loader = new DocxLoader(file);

    const splitter = new TokenTextSplitter({
      encodingName: 'gpt2',
      chunkSize: 1000,
      chunkOverlap: 50,
    });

    const docs = await loader.loadAndSplit(splitter);

    docs.forEach((element) => {
      element.metadata['fileId'] = metaData;
      let _pageContent = `The content given below belongs to ${fileName} file\n`;
      element.pageContent = _pageContent + element.pageContent;
    });

    if (summary) {
      let pageContent = `This is the summary of ${fileName} file\n`;
      pageContent = pageContent + summary;
      docs.push({
        pageContent: pageContent,
        metadata: {
          fileId: metaData,
        },
      });
    }
    if (overview) {
      let pageContent = `This is the overview of ${fileName} file\n`;
      pageContent = pageContent + overview;
      docs.push({
        pageContent: pageContent,
        metadata: {
          fileId: metaData,
        },
      });
    }

    logger.info(JSON.stringify(docs));

    return docs;
  }

  async createDocumentFromText(file, metaData, fileName, summary, overview) {
    const loader = new TextLoader(file);

    const splitter = new TokenTextSplitter({
      encodingName: 'gpt2',
      chunkSize: 1000,
      chunkOverlap: 50,
    });

    const docs = await loader.loadAndSplit(splitter);

    docs.forEach((element) => {
      element.metadata['fileId'] = metaData;
      let _pageContent = `The content given below belongs to ${fileName} file\n`;
      element.pageContent = _pageContent + element.pageContent;
    });

    if (summary) {
      let pageContent = `This is the summary of ${fileName} file\n`;
      pageContent = pageContent + summary;
      docs.push({
        pageContent: pageContent,
        metadata: {
          fileId: metaData,
        },
      });
    }
    if (overview) {
      let pageContent = `This is the overview of ${fileName} file\n`;
      pageContent = pageContent + overview;
      docs.push({
        pageContent: pageContent,
        metadata: {
          fileId: metaData,
        },
      });
    }

    logger.info(JSON.stringify(docs));

    return docs;
  }

  async createDocumentFromCSV(file, metaData, fileName, summary, overview) {
    const loader = new CSVLoader(file);

    const splitter = new TokenTextSplitter({
      encodingName: 'gpt2',
      chunkSize: 1000,
      chunkOverlap: 50,
    });

    const docs = await loader.loadAndSplit(splitter);

    docs.forEach((element, index) => {
      element.metadata['fileId'] = metaData;
      let _pageContent = '';
      if (index === 0) {
        _pageContent = `The content given below belongs to ${fileName} file\n`;
      } else {
        _pageContent = '';
      }
      element.pageContent = _pageContent + element.pageContent;
    });

    if (summary) {
      let pageContent = `This is the summary of ${fileName} file\n`;
      pageContent = pageContent + summary;
      docs.push({
        pageContent: pageContent,
        metadata: {
          fileId: metaData,
        },
      });
    }
    if (overview) {
      let pageContent = `This is the overview of ${fileName} file\n`;
      pageContent = pageContent + overview;
      docs.push({
        pageContent: pageContent,
        metadata: {
          fileId: metaData,
        },
      });
    }

    logger.info(JSON.stringify(docs));

    return docs;
  }

  async createDocumentFromImage(file, metaData, fileName, summary) {
    const docs = [];

    if (summary) {
      let pageContent = `This is the summary of ${fileName} file\n`;
      pageContent = pageContent + summary;
      docs.push({
        pageContent: pageContent,
        metadata: {
          source: file,
          fileId: metaData,
        },
      });
    }

    logger.info(JSON.stringify(docs));

    return docs;
  }

  async createDocumentFromVideo(file, metaData, fileName, summary, overview) {
    const docs = [];

    if (summary) {
      let pageContent = `This is the summary of ${fileName} file\n`;
      pageContent = pageContent + summary;
      docs.push({
        pageContent: pageContent,
        metadata: {
          source: file,
          fileId: metaData,
        },
      });
    }

    logger.info(JSON.stringify(docs));

    return docs;
  }

  async createDocumentFromAudio(file, metaData, fileName, summary, overview) {
    const docs = [];

    if (summary) {
      let pageContent = `This is the summary of ${fileName} file\n`;
      pageContent = pageContent + summary;
      docs.push({
        pageContent: pageContent,
        metadata: {
          source: file,
          fileId: metaData,
        },
      });
    }

    logger.info(JSON.stringify(docs));

    return docs;
  }

  createTempCSVFileForXLSXFile(filePath, fileName, type) {
    return new Promise(async (resolve, reject) => {
      try {
        const inputFilename = path.join(filePath, `${fileName}.${type}`);
        const outputFilename = path.resolve(`${process.env.TMP_CSV_PATH}/${fileName}.csv`);

        const workBook = XLSX.readFile(inputFilename);
        await XLSX.writeFile(workBook, outputFilename, { bookType: 'csv' });
        resolve(1);
      } catch (error) {
        reject(error);
      }
    });
  }

  async buildTextFileFromString(string, userId, fileName) {
    await fsp.appendFile(`${process.env.TMP_TXT_PATH}/${userId}/${fileName}.txt`, string);
    return path.resolve(`${process.env.TMP_TXT_PATH}/${userId}/${fileName}.txt`);
  }

  extractTextFromDocAndCreateTextFile(filePath, userId, fileName) {
    return new Promise((resolve, reject) => {
      reader
        .getText(filePath)
        .then(async function (data) {
          const folderPath = `${process.env.TMP_TXT_PATH}/` + userId;
          if (!fs.existsSync(path.resolve(folderPath))) {
            await fs2.mkdir(folderPath);
          }
          await fs2.appendFile(`${process.env.TMP_TXT_PATH}/${userId}/${fileName}.txt`, data);
          const textFilePath = path.resolve(
            `${process.env.TMP_TXT_PATH}/${userId}/${fileName}.txt`
          );
          resolve(textFilePath);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  extractTextFromPPTXAndCreateTextFile(filePath, userId, fileName) {
    return new Promise((resolve, reject) => {
      officeParser.parseOffice(filePath, async function (data, err) {
        if (err) {
          console.log(err);
          reject(err);
        }
        const folderPath = `${process.env.TMP_TXT_PATH}/` + userId;
        if (!fs.existsSync(path.resolve(folderPath))) {
          await fs2.mkdir(folderPath);
        }
        await fs2.appendFile(`${process.env.TMP_TXT_PATH}/${userId}/${fileName}.txt`, data);
        const textFilePath = path.resolve(`${process.env.TMP_TXT_PATH}/${userId}/${fileName}.txt`);
        resolve(textFilePath);
      });
    });
  }

  deleteTempTextFile(userId) {
    const textFolderPath = `${process.env.TMP_TXT_PATH}/${userId}`;
    fs.readdir(textFolderPath, async (err, files) => {
      if (err) reject(err);
      for (const file of files) {
        await fs2.unlink(path.join(textFolderPath, file));
      }
    });
  }

  deleteTempMediaTextFile(filePath) {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error(err);
        return;
      }
    });
  }

  saveHtmlStringToFile(uuid, fileName, htmlString) {
    return new Promise(async (resolve, reject) => {
      try {
        const htmlFilePath = path.join(path.resolve(process.env.DOCUMENT_PATH), uuid);
        await fs2.writeFile(path.join(htmlFilePath, `${fileName}.html`), htmlString);

        try {
          let filePath = path.join(htmlFilePath, `${fileName}.html`);
          if (process.env.GOOGLE_CLOUD_STORAGE == 1) {
            logger.info(`Uploading file on cloud FileId: ${fileName}.html`);
            await storage.bucket(process.env.GOOGLE_STORAGE_BUCKET_NAME).upload(filePath, {
              destination: `${fileName}.html`,
            });
            logger.info('Successfully uploaded file on cloud');
          }
        } catch (error) {
          logger.error(error);
          logger.error('Error uploading file on cloud');
          logger.error(error);
          reject(error);
        }

        resolve(1);
      } catch (error) {
        reject(error);
      }
    });
  }

  extractTextFromHtmlStringAndCreateTextFile(htmlString, userId, fileName) {
    return new Promise(async (resolve, reject) => {
      try {
        const tmpTextFileBasePath = path.join(path.resolve(process.env.TMP_TXT_PATH), `${userId}`);
        const options = {
          wordwrap: false,
        };
        const text = convert(htmlString, options);
        const folderPath = `${process.env.TMP_TXT_PATH}/` + userId;
        if (!fs.existsSync(path.resolve(folderPath))) {
          await fs2.mkdir(folderPath);
        }
        await fs2.writeFile(path.join(tmpTextFileBasePath, `${fileName}.txt`), text);
        resolve(path.join(tmpTextFileBasePath, `${fileName}.txt`));
      } catch (error) {
        reject(error);
      }
    });
  }

  async createAndStoreEmbeddingsOnIndex(documents, namespace, fileId, fileExtension) {
    try {
      async function processEmbeddingBatch(batch, fileId, fileExtension, namespace) {
        try {
          const resultsArray = [];
          const response = await genAI.models.embedContent({
            model: 'text-embedding-004',
            contents: batch.map((batchItem) => ({ parts: [{ text: batchItem.content }] })),
          });

          batch.forEach((batchItem, idx) => {
            resultsArray.push({
              docid: batchItem.docid,
              namespace,
              file_id: String(fileId),
              content: batchItem.content,
              embedding: (response.embeddings[idx]?.values || []).map(Number),
              object_ref: {
                uri: `gs://Fusion AI_bq_demo/${String(fileId)}.${String(fileExtension)}`,
                version: '',
                authorizer: 'us-central1.myconnection',
                details: JSON.stringify({}),
              },
            });
          });
          return resultsArray;
        } catch (err) {
          console.error(` Error processing embedding batch:`, err.message);
          throw err;
        }
      }

      async function insertBigQueryBatch(batch) {
        const dataset = bigquery.dataset(process.env.BIGQUERY_DATASET_ID);
        const table = dataset.table(process.env.BIGQUERY_TABLE);
        await table.insert(batch);
        console.log(` Inserted ${batch.length} embeddings into BigQuery.`);
      }

      const MAX_CHUNK_SIZE = 1500;
      const BATCH_CHAR_LIMIT = 18000;
      const allChunks = [];

      documents.forEach((doc) => {
        const content = (doc.pageContent || '').trim();
        if (!content) {
          console.warn(` Skipping empty document chunk.`);
          return;
        }

        const docIdPrefix = `${namespace}_${doc.metadata?.fileId || fileId}_${doc.metadata?.source || 'unknown'}`;

        for (let i = 0; i < content.length; i += MAX_CHUNK_SIZE) {
          const chunk = content.substring(i, i + MAX_CHUNK_SIZE);
          allChunks.push({
            docid: `${docIdPrefix}_chunk${Math.floor(i / MAX_CHUNK_SIZE)}`, // ✅ renamed
            content: chunk,
          });
        }
      });

      if (allChunks.length === 0) {
        console.warn(' No valid chunks with content to embed.');
        return false;
      }

      const allDocIds = [];
      let currentEmbeddingBatch = [];
      let currentCharCount = 0;

      for (const chunk of allChunks) {
        if (currentCharCount + chunk.content.length > BATCH_CHAR_LIMIT) {
          if (currentEmbeddingBatch.length > 0) {
            const results = await processEmbeddingBatch(
              currentEmbeddingBatch,
              fileId,
              fileExtension,
              namespace
            );
            allDocIds.push(...results.map((r) => r.docid));
            await insertBigQueryBatch(results);
          }
          currentEmbeddingBatch = [chunk];
          currentCharCount = chunk.content.length;
        } else {
          currentEmbeddingBatch.push(chunk);
          currentCharCount += chunk.content.length;
        }
      }

      if (currentEmbeddingBatch.length > 0) {
        const results = await processEmbeddingBatch(
          currentEmbeddingBatch,
          fileId,
          fileExtension,
          namespace
        );
        allDocIds.push(...results.map((r) => r.docid));
        await insertBigQueryBatch(results);
      }

      const fileEmbedding = new FileEmbedding(knex);
      await fileEmbedding.createFileEmbeddingMap(fileId, allDocIds);

      return true;
    } catch (error) {
      console.error(' BigQuery insert failed:', JSON.stringify(error.errors, null, 2));
      if (error.response && error.response.insertErrors) {
        console.error('Insert Errors:', JSON.stringify(error.response.insertErrors, null, 2));
      }
      throw error;
    }
  }

  removeTempCSVFile(fileName) {
    const filePath = `${process.env.TMP_CSV_PATH}`;
    if (fs.existsSync(path.join(filePath, `${fileName}.csv`))) {
      fs.unlinkSync(path.join(filePath, `${fileName}.csv`));
    }
  }

  getPastMessages(chatId) {
    return new Promise((resolve, reject) => {
      const chat = new Chat(this.dbConnection);
      chat
        .getChatMessages(chatId)
        .then((messages) => {
          let pastMessages = [];
          for (const message of messages) {
            if (message.role == 'user') {
              pastMessages.push(new HumanMessage(message.message));
            } else if (message.role == 'bot') {
              pastMessages.push(new AIMessage(message.message));
            }
          }
          resolve(pastMessages);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  combineStrings(strList) {
    let combinedString = '';
    strList.map((str, index) => {
      if (str) {
        if (index != strList.length - 1) {
          combinedString += str + '$$';
        } else {
          combinedString += str;
        }
      }
    });
    return combinedString;
  }

  removeEmptyString(str) {
    const cleanedData = str.map((s) => {
      if (s != '') return s;
    });
    return cleanedData;
  }

  addDelimiterForAIResponse(response) {
    if (response) {
      const textArr = response.split('\n');
      const cleanedData = this.removeEmptyString(textArr);
      const combinedString = this.combineStrings(cleanedData);

      return combinedString;
    }
    return null;
  }

  getFileName(fileId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('documents')
        .select('name')
        .where({ id: fileId })
        .then((res) => {
          if (res.length > 0) {
            resolve(res[0]);
          }
          resolve(null);
        })
        .catch((err) => {
          console.log(err);
        });
    });
  }

  getFilePath(fileId) {
    return new Promise((resolve, reject) => {
      this.checkIfFileExists(fileId)
        .then((res) => {
          if (res == 1) {
            this.getPredecessorFolders(fileId)
              .then((parentFolders) => {
                let filePath = '';
                parentFolders.map((fileOrFolderData, index) => {
                  if (index != 0) {
                    const pathEnd = index != parentFolders.length - 1 ? '/' : '';
                    filePath += fileOrFolderData.name + pathEnd;
                  }
                });
                resolve(filePath);
              })
              .catch((err) => {
                console.log(err);
                reject(err);
              });
          } else {
            resolve(null);
          }
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  async extractMetadataFromDocuments(sourceData) {
    try {
      const fileList = [];
      if (sourceData) {
        const citationExist = {};
        for (const document of sourceData) {
          if (document.pageContent.length > 25) {
            const fileId = document.metadata.fileId;
            const filePath = await this.getFilePath(fileId);
            if (filePath && !citationExist[filePath]) {
              fileList.push({ fileName: filePath });
              citationExist[filePath] = true;
            }
          }
        }
      }
      return fileList;
    } catch (error) {
      console.log(error);
      return [];
    }
  }

  getNonResponseIdentifiers() {
    return new Promise((resolve, reject) => {
      this.dbConnection('non-response-identifiers')
        .select('*')
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  buildRegExpFilterString() {
    return new Promise(async (resolve, reject) => {
      try {
        let filterString = '';
        const identifierList = await this.getNonResponseIdentifiers();
        identifierList.map((data, index) => {
          const stringSuffix = index == identifierList.length - 1 ? '' : '|';
          filterString += data.identifier + stringSuffix;
        });
        resolve(filterString);
      } catch (error) {
        reject(error);
      }
    });
  }

  async isOutOfContextAnswer(aiAnswer) {
    // const superAdmin = new SuperAdmin(this.dbConnection)
    // const filterString = await superAdmin.getDataFromRedis(process.env.REDIS_IDENTIFIER_REGEX_STRING_KEY)
    let filterString = null;
    if (process.env.CACHE_MODE == '1') {
      filterString = await getNonResponseIdentifiers();
    } else {
      filterString = await this.getNonResponseIdentifiers();
    }
    const regExp = new RegExp(`(?<text>${filterString})`, 'i');
    const found = aiAnswer.match(regExp);
    if (found && found.length > 0) return true;
    return false;
  }

  queryIndex(uuid, parentId, chatId, question) {
    return new Promise(async (resolve, reject) => {
      const chat = new Chat(this.dbConnection);
      const customQuerying = new CustomQuerying(this.dbConnection);

      try {
        // const superAdmin = new SuperAdmin(this.dbConnection)
        // const settings = await superAdmin.getDataFromRedis(process.env.REDIS_SUPER_ADMIN_SETTINGS_KEY)
        // const queryType = settings['queryType']
        const queryType = await getQueryType();
        let res = null;
        console.log('Custom Query');
        logger.info(`Querying using custom query solution`);
        res = await customQuerying.queryIndexByCustomQuerying(question, uuid, chatId);

        const delimitedText = this.addDelimiterForAIResponse(res.result);
        let fileList = [];
        if (!(await this.isOutOfContextAnswer(res.result))) {
          fileList = await this.extractMetadataFromDocuments(res.sourceDocuments);
        }

        logger.info(JSON.stringify(res));

        if (delimitedText) {
          chat
            .addMessagesToTheChatHistory(chatId, delimitedText, 'bot', parentId, null)
            .then((messageId) => {
              resolve({ messageId, suggestedQuestions: res?.suggestedQuestions ?? [] });
            })
            .catch((err) => {
              console.log(err);
              reject(err);
            });
        } else {
          const BIGQUERY_FAILURE_RESPONSE = await getAdminSetting('BIGQUERY_FAILURE_RESPONSE');
          chat
            .addMessagesToTheChatHistory(chatId, BIGQUERY_FAILURE_RESPONSE, 'bot', parentId, null)
            .then((messageId) => {
              resolve(messageId);
            })
            .catch((err) => {
              console.log(err);
              reject(err);
            });
        }
      } catch (error) {
        console.log(error);
        const BIGQUERY_FAILURE_RESPONSE = await getAdminSetting('BIGQUERY_FAILURE_RESPONSE');
        chat
          .addMessagesToTheChatHistory(chatId, BIGQUERY_FAILURE_RESPONSE, 'bot', parentId, null)
          .then((messageId) => {
            resolve(messageId);
          })
          .catch((err) => {
            console.log(err);
            reject(err);
          });
      }
    });
  }

  getFilesAndFolders(communityId) {
    return new Promise((resolve, reject) => {
      const _data = this.dbConnection('documents')
        .select('*')
        .where({ communityId })
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  getStorageDetails(userId) {
    return new Promise((resolve, reject) => {
      const community = new Community(this.dbConnection);

      community
        .getCommunityCount(userId)
        .then(async (communityList) => {
          const docBasePath = path.resolve(`${process.env.DOCUMENT_PATH}/`);
          let storageDetails = [];

          for (const _community of communityList) {
            const uuid = await community.getCommunityUUID(_community.id);
            const folderPath = path.join(docBasePath, uuid);
            if (fs.existsSync(folderPath)) {
              const files = await fs2.readdir(folderPath);
              for (const file of files) {
                const filePath = path.join(folderPath, file);
                const stat = await fs2.lstat(filePath);
                const createdDate = _community.created;

                storageDetails.push({
                  size: stat.size,
                  created: createdDate,
                });
              }
            }
          }
          resolve(storageDetails);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }
}

module.exports = Documents;
