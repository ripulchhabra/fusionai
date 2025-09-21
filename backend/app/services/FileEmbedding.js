const winston = require('winston');
const { combine, timestamp, json } = winston.format;
const dotenv = require('dotenv');
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

class FileEmbedding {
  constructor(dbConnection) {
    this.dbConnection = dbConnection;
  }

  createFileEmbeddingMap(fileId, embeddingIds) {
    return new Promise((resolve, reject) => {
      const promises = embeddingIds.map((embeddingId) => {
        return this.dbConnection('file_embedding').insert({
          fileId,
          embeddingId,
        });
      });

      Promise.all(promises)
        .then(() => {
          resolve();
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  getFileEmbedding(fileId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('file_embedding')
        .select('embeddingId')
        .where({
          fileId,
        })
        .then((id) => {
          resolve(id);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  deleteFileEmbeddingMap(fileId) {
    return new Promise((resolve, reject) => {
      this.dbConnection('file_embedding')
        .delete()
        .where({
          fileId,
        })
        .then((id) => {
          resolve(id);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }
}

module.exports = FileEmbedding;
