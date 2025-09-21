const express = require('express');
const router = express.Router();
const usersController = require('../controllers/user');
const auth = require('../middleware/authenticate');
const SuperAdminController = require('../controllers/superAdmin');

router.route('/user/register').post(usersController.createSessionURL);

router.route('/user/check-email').post(usersController.checkIfEmailExist);

router.route('/user/check-payment-status').post(usersController.checkPaymentStatus);

router.route('/user/verify').post(auth.userExists, usersController.verifyUser);

router
  .route('/user/resend-verification-link')
  .post(auth.verifyToken, auth.userExists, usersController.resendVerificationMail);

router.route('/user/login/google').post(usersController.validateGoogleLoginCredentials);

router.route('/user/google/submit-otp').post(usersController.validateGoogleOTPAndAuthenticateUser);

router.route('/user/login').post(usersController.validateLoginCredentials);

router.route('/user/submit-otp').post(usersController.validateOTPAndAuthenticateUser);

router
  .route('/user/integration')
  .post(
    auth.verifyToken,
    auth.userExists,
    auth.isSenderOwner,
    usersController.getUserCloudIntegraion
  );

router
  .route('/user/integration/status')
  .post(auth.verifyToken, auth.userExists, auth.isSenderOwner, usersController.getUserIntegrations);

router
  .route('/user/integration/update')
  .post(
    auth.verifyToken,
    auth.userExists,
    auth.isSenderOwner,
    usersController.updateUserCloudIntegration
  );

router
  .route('/user/googleDrive/files')
  .post(auth.verifyToken, auth.userExists, usersController.googleDriveFiles);

router
  .route('/user/oneDrive/files')
  .post(auth.verifyToken, auth.userExists, usersController.oneDriveFiles);

router
  .route('/user/dropbox/files')
  .post(auth.verifyToken, auth.userExists, usersController.dropboxFiles);

router
  .route('/user/wordpress/files')
  .post(auth.verifyToken, auth.userExists, usersController.wordpressFiles);

router
  .route('/user/slack/files')
  .post(auth.verifyToken, auth.userExists, usersController.slackFiles);

router
  .route('/user/user_data')
  .post(auth.verifyToken, auth.userExists, auth.isSenderOwner, usersController.getUserData);

router.route('/user/forgot_password').post(usersController.sendResetPasswordLink);

router.route('/user/reset-password').post(usersController.changePassword);

router
  .route('/profile/change-password')
  .post(
    auth.verifyToken,
    auth.userExists,
    auth.isSenderOwner,
    usersController.changeCurrentPassword
  );

router
  .route('/profile/update-email')
  .post(auth.verifyToken, auth.userExists, auth.isSenderOwner, usersController.updateEmail);

router
  .route('/profile/enable-2fa')
  .post(
    auth.verifyToken,
    auth.userExists,
    auth.isSenderOwner,
    auth.isAccountVerified,
    usersController.enableTwoFactorAuth
  );

router
  .route('/profile/disable-2fa')
  .post(
    auth.verifyToken,
    auth.userExists,
    auth.isSenderOwner,
    auth.isAccountVerified,
    usersController.disableTwoFactorAuth
  );

router
  .route('/profile/enable-company-2fa')
  .post(
    auth.verifyToken,
    auth.adminAccess,
    auth.userExists,
    auth.companyExist,
    auth.isUserBelongsToCompany,
    auth.isCompanyUser,
    auth.isAccountVerified,
    usersController.enableCompanyTwoFactorAuth
  );

router
  .route('/profile/disable-company-2fa')
  .post(
    auth.verifyToken,
    auth.adminAccess,
    auth.companyExist,
    auth.isCompanyUser,
    usersController.disableCompanyTwoFactorAuth
  );

router
  .route('/invitation/send')
  .post(
    auth.verifyToken,
    auth.adminAccess,
    auth.isValidSenderId,
    auth.isValidRole,
    auth.companyExist,
    auth.isCompanyUser,
    usersController.sendInvitation
  );

router
  .route('/invitation/list')
  .post(
    auth.verifyToken,
    auth.adminAccess,
    auth.companyExist,
    auth.isCompanyUser,
    usersController.getInvitationList
  );

router.route('/invitation/get').post(usersController.getInvitationData);

router
  .route('/invitation/delete')
  .post(
    auth.verifyToken,
    auth.adminAccess,
    auth.isValidInvitationId,
    auth.companyExist,
    auth.isCompanyUser,
    usersController.deleteInvitation
  );

router
  .route('/invitation/resend')
  .post(
    auth.verifyToken,
    auth.adminAccess,
    auth.companyExist,
    auth.isCompanyUser,
    usersController.resendInvitation
  );

router
  .route('/user/create-account-for-invited-user')
  .post(auth.companyExist, auth.isValidRole, usersController.createAccountForInvitedUser);

router.route('/invitation/decline').post(usersController.declineInvitation);

router
  .route('/admin/get-user-detail')
  .post(
    auth.verifyToken,
    auth.adminAccess,
    auth.userExists,
    auth.hasUserEditAccess,
    usersController.getUserDetailsForAdmin
  );

router
  .route('/admin/get-superAdmin-detail')
  .post(
    auth.verifyToken,
    auth.superAdminAccess,
    auth.userExists,
    auth.hasUserEditAccess,
    usersController.getUserDetailsForAdmin
  );

router
  .route('/admin/verify-account')
  .post(
    auth.verifyToken,
    auth.adminAccess,
    auth.userExists,
    auth.hasUserEditAccess,
    usersController.verifyAccountForAdmin
  );

router
  .route('/admin/enable-user-2fa')
  .post(
    auth.verifyToken,
    auth.adminAccess,
    auth.userExists,
    auth.hasUserEditAccess,
    usersController.enable2FAFordmin
  );

router
  .route('/admin/disable-user-2fa')
  .post(
    auth.verifyToken,
    auth.adminAccess,
    auth.userExists,
    auth.hasUserEditAccess,
    usersController.disable2FAFordmin
  );

router
  .route('/admin/change-lock-status')
  .post(
    auth.verifyToken,
    auth.adminAccess,
    auth.userExists,
    auth.hasUserEditAccess,
    usersController.userLockAndUnlockOptionForAdmin
  );

router
  .route('/admin/change-password')
  .post(
    auth.verifyToken,
    auth.adminAccess,
    auth.userExists,
    auth.hasUserEditAccess,
    usersController.adminUpdatePasswordOptionForUser
  );

router
  .route('/admin/blacklist-user')
  .post(
    auth.verifyToken,
    auth.adminAccess,
    auth.userExists,
    auth.hasUserEditAccess,
    usersController.blackListUserAccount
  );

router
  .route('/admin/whitelist-user')
  .post(
    auth.verifyToken,
    auth.adminAccess,
    auth.userExists,
    auth.hasUserEditAccess,
    usersController.whiteListUserAccount
  );

router
  .route('/get/subscription-details')
  .post(auth.verifyToken, auth.adminAccess, usersController.getSubscriptionDetails);

router
  .route('/user/admin/remove-user')
  .post(auth.verifyToken, auth.adminAccess, usersController.removeUserPermanently);

router.route('/user-role').post(auth.verifyToken, usersController.getUserDynamicRoles);

router
  .route('/get/clients')
  .post(auth.verifyToken, auth.superAdminAccess, usersController.getClientsforSuperAdmin);

router
  .route('/get/user/users')
  .post(
    auth.verifyToken,
    auth.superAdminAccess,
    usersController.getUserInvitedDetailsforSuperAdmin
  );

router.route('/user/create-account-for-super-user').post(usersController.createAccountForSuperUser);

router.route('/super-user-email').post(usersController.getSuperEmail);

router.route('/remove-suoer-user').post(usersController.removeSuperUserPermanently);

router
  .route('/user/delete-profile')
  .post(auth.verifyToken, auth.userExists, SuperAdminController.deleteUser);

router
  .route('/user/delete-team-profile')
  .post(
    auth.verifyToken,
    auth.userExists,
    auth.hasUserEditAccess,
    SuperAdminController.deleteTeamAccount
  );

module.exports = () => router;
