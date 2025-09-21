const dotenv = require('dotenv');
dotenv.config();

const { OpenAIEmbeddings } = require('langchain/embeddings/openai');

const dimensions = parseInt(process.env.EMBEDDING_SIZE);

exports.embeddings = new OpenAIEmbeddings({
  modelName: process.env.EMBEDDING_MODEL,
  dimensions: dimensions,
});
