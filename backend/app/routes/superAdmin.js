const express = require('express');
const router = express.Router();
const SuperAdminController = require('../controllers/superAdmin');
const auth = require('../middleware/authenticate');

router
  .route('/get-admin-role')
  .post(auth.verifyToken, auth.superAdminAccess, SuperAdminController.getRoles);

router
  .route('/get-admin-env')
  .post(auth.verifyToken, auth.superAdminAccess, SuperAdminController.getENV);

router
  .route('/update-admin-env')
  .post(auth.verifyToken, auth.superAdminAccess, SuperAdminController.updateENV);

router
  .route('/get/email-templates')
  .post(auth.verifyToken, auth.superAdminAccess, SuperAdminController.getEmailTemplates);

router
  .route('/update-template')
  .post(auth.verifyToken, auth.superAdminAccess, SuperAdminController.updateTemplate);

router
  .route('/super-admin/delete-user')
  .post(auth.verifyToken, auth.superAdminAccess, SuperAdminController.deleteUser);

router
  .route('/super-admin/delete-team-account')
  .post(auth.verifyToken, auth.superAdminAccess, SuperAdminController.deleteTeamAccount);

module.exports = () => router;
