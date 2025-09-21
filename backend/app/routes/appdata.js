const express = require('express');
const AppdataController = require('../controllers/appdata');
const router = express.Router();

router.route('/app-data').post(AppdataController.appData);

module.exports = () => router;
