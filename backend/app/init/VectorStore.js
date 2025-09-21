const { PineconeStore } = require('langchain/vectorstores/pinecone');
const { Pinecone } = require('@pinecone-database/pinecone');
const { VectorDBQAChain } = require('langchain/chains');
const { OpenAIEmbeddings } = require('langchain/embeddings/openai');
const { OpenAI } = require('langchain/llms/openai');
const dotenv = require('dotenv');
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

exports.initVectoreStore = async (namespace) => {
  const client = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });
  const pineconeIndex = client.Index(process.env.PINECONE_INDEX);

  const settings = await knex('super-admin-settings')
    .select('meta_value')
    .where(function () {
      this.where({ meta_key: 'Embedding_Model' });
    });

  const dimensions = parseInt(process.env.EMBEDDING_SIZE);

  const vectorStore = await PineconeStore.fromExistingIndex(
    new OpenAIEmbeddings({
      modelName: settings[0]['meta_value'],
      dimensions: dimensions,
    }),
    { pineconeIndex, namespace }
  );

  return vectorStore;
};
