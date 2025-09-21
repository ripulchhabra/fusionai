const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const ChatController = require('../controllers/chat');
const auth = require('../middleware/authenticate');

const messageRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1-minute window
  max: process.env.QUERY_RATE_LIMIT || 3, // Limit each user to 50 requests per windowMs
  keyGenerator: (req) => req.decoded.userId, // Use user ID from verified token
  message: {
    status: 429,
    error: 'Too many requests, please wait and try again later.',
  },
  standardHeaders: true, // Include rate limit headers in responses
  legacyHeaders: false, // Disable the deprecated X-RateLimit-* headers
  handler: (req, res) => {
    // Custom handler for rate limit exceeded
    console.log('limiter msg');
    return res.status(429).json({
      success: false,
      message: `Please try again later. Only ${process.env.QUERY_RATE_LIMIT} request(s) are allowed per minute.`,
    });
  },
});

router
  .route('/chat/create')
  .post(
    auth.verifyToken,
    auth.communityExists,
    auth.isMemberOfCommunityOrSharedMember,
    ChatController.createNewChat
  );

router
  .route('/chat/get-histories')
  .post(
    auth.verifyToken,
    auth.userExists,
    auth.isSenderOwner,
    auth.communityExists,
    auth.isMemberOfCommunityOrSharedMember,
    ChatController.getChatHistoriesForUserByCommunity
  );

router
  .route('/chat/rename')
  .post(
    auth.verifyToken,
    auth.communityExists,
    auth.isMemberOfCommunityOrSharedMember,
    auth.isChatIdExist,
    auth.isChatIdBelongsToCommunity,
    auth.isChatCreator,
    ChatController.renameChatHistory
  );

router
  .route('/chat/delete')
  .post(
    auth.verifyToken,
    auth.communityExists,
    auth.isMemberOfCommunityOrSharedMember,
    auth.isChatIdExist,
    auth.isChatIdBelongsToCommunity,
    auth.isChatCreator,
    ChatController.deleteChatHistory
  );

router
  .route('/chat/get-messages')
  .post(
    auth.verifyToken,
    auth.isChatIdExist,
    auth.isChatCreator,
    ChatController.retrieveChatMessages
  );

router
  .route('/chat/add-message')
  .post(
    auth.verifyToken,
    messageRateLimiter,
    auth.communityExists,
    auth.isMemberOfCommunityOrSharedMember,
    auth.isChatIdExist,
    auth.isChatIdBelongsToCommunity,
    auth.isChatCreator,
    ChatController.addMessageToConversation
  );

router
  .route('/chat/get-histories-for-specific-scope')
  .post(
    auth.verifyToken,
    auth.userExists,
    auth.isSenderOwner,
    auth.communityExists,
    auth.isMemberOfCommunityOrSharedMember,
    ChatController.getChatHistoriesForUserBySpecificScope
  );

module.exports = () => router;
