import axios from 'axios'
import {UserModel} from './_models'

const API_URL = process.env.REACT_APP_BACKEND_URL

export const GET_USER_BY_ACCESSTOKEN_URL = `${API_URL}/verify_token`
export const VALIDATE_AND_GET_OTP_URL = `${API_URL}/user/login`
export const GET_USER_CLOUD_INTEGRATION = `${API_URL}/user/integration`
export const LOGIN_URL_GOOGLE = `${API_URL}/user/google/submit-otp`
export const VALIDATE_GOOGLE_AND_GET_OTP_URL = `${API_URL}/user/login/google`
export const LOGIN_URL = `${API_URL}/user/submit-otp`
export const REGISTER_URL = `${API_URL}/user/register`
export const VERIFY_ACCOUNT_URL = `${API_URL}/user/verify`
export const RESEND_VERIFICATION_URL = `${API_URL}/user/resend-verification-link`
export const REQUEST_PASSWORD_URL = `${API_URL}/user/forgot_password`
export const RESET_PASSWORD = `${API_URL}/user/reset-password`
export const UPDATE_USER_PROFILE = `${API_URL}/profile/update`
export const UPDATE_COMPANY_PROFILE = `${API_URL}/company/update-profile`
export const CHANGE_PASSWORD_URL = `${API_URL}/profile/change-password`
export const UPDATE_EMAIL = `${API_URL}/profile/update-email`
export const ENABLE_2FA = `${API_URL}/profile/enable-2fa`
export const DISABLE_2FA = `${API_URL}/profile/disable-2fa`
export const ENABLE_COMPANY_2FA = `${API_URL}/profile/enable-company-2fa`
export const DISABLE_COMPANY_2FA = `${API_URL}/profile/disable-company-2fa`
export const GET_ACCOUNT_STATS = `${API_URL}/profile/get-account-stat`
export const SEND_INVITATION = `${API_URL}/invitation/send`
export const CHECK_PAYMENT_STATUS = `${API_URL}/user/check-payment-status`
export const GOOGLE_PROFILE_IMAGE = `${API_URL}/google/profile/update`
export const SHARE_COLLECTION = `${API_URL}/share-collection`
export const DELETE_USER_PROFILE = `${API_URL}/user/delete-profile`
export const DELETE_TEAM_PROFILE = `${API_URL}/user/delete-team-profile`

// Server should return AuthModel
export function register(
  firstname: string,
  lastname: string,
  email: string,
  phoneNumberCountryCode: string,
  phoneNumber: string,
  countryCode: string,
  mobileNumber: string,
  companyName: string,
  orgType: string,
  password: string,
  mailingAddStreetName: string,
  mailingAddCountryName: string,
  mailingAddCityName: string,
  mailingAddStateName: string,
  mailingAddZip: string,
  billingAddStreetName: string,
  billingAddCountryName: string,
  billingAddCityName: string,
  billingAddStateName: string,
  billingAddZip: string,
  isMailAndBillAddressSame: boolean,
  accountType: string,
  signUpMethod: string,
  currency: string
) {
  return axios.post(
    REGISTER_URL,
    {
      firstname,
      lastname,
      email,
      phoneNumberCountryCode,
      phoneNumber,
      countryCode,
      mobileNumber,
      companyName,
      orgType,
      password,
      mailingAddStreetName,
      mailingAddCountryName,
      mailingAddCityName,
      mailingAddStateName,
      mailingAddZip,
      billingAddStreetName,
      billingAddCountryName,
      billingAddCityName,
      billingAddStateName,
      billingAddZip,
      isMailAndBillAddressSame,
      accountType,
      signUpMethod,
      currency,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function registerGoogle(
  email: string,
  firstname: string,
  lastname: string,
  profilePic: string,
  accountType: string,
  signUpMethod: string,
  currency: string
) {
  return axios.post(
    REGISTER_URL,
    {
      email,
      firstname,
      lastname,
      profilePic,
      accountType,
      signUpMethod,
      currency,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function registerGoogleComp(
  firstname: string,
  lastname: string,
  email: string,
  phoneNumberCountryCode: string,
  phoneNumber: string,
  companyName: string,
  orgType: string,
  mailingAddStreetName: string,
  mailingAddCountryName: string,
  mailingAddCityName: string,
  mailingAddStateName: string,
  mailingAddZip: string,
  billingAddStreetName: string,
  billingAddCountryName: string,
  billingAddCityName: string,
  billingAddStateName: string,
  billingAddZip: string,
  isMailAndBillAddressSame: boolean,
  profilePic: string,
  accountType: string,
  signUpMethod: string,
  currency: string
) {
  return axios.post(
    REGISTER_URL,
    {
      firstname,
      lastname,
      email,
      phoneNumberCountryCode,
      phoneNumber,
      companyName,
      orgType,
      mailingAddStreetName,
      mailingAddCountryName,
      mailingAddCityName,
      mailingAddStateName,
      mailingAddZip,
      billingAddStreetName,
      billingAddCountryName,
      billingAddCityName,
      billingAddStateName,
      billingAddZip,
      isMailAndBillAddressSame,
      profilePic,
      accountType,
      signUpMethod,
      currency,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function registerNonComp(
  firstname: string,
  lastname: string,
  email: string,
  countryCode: string,
  mobileNumber: string,
  password: string,
  accountType: string,
  signUpMethod: string,
  currency: string
) {
  return axios.post(
    REGISTER_URL,
    {
      firstname,
      lastname,
      email,
      countryCode,
      mobileNumber,
      password,
      accountType,
      signUpMethod,
      currency,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function validateGoogleCredential(email: string) {
  return axios.post(
    VALIDATE_GOOGLE_AND_GET_OTP_URL,
    {
      email,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function loginGoogle(email: string, otp: any) {
  return axios.post(
    LOGIN_URL_GOOGLE,
    {
      email,
      otp,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function verifyAccount(userId: any, token: any) {
  return axios.post(
    VERIFY_ACCOUNT_URL,
    {
      userId,
      token,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function resendVerificationEmail(userId: any, api_token: any) {
  return axios.post(
    RESEND_VERIFICATION_URL,
    {
      userId,
      api_token,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function validateCredential(email: string, password: string) {
  return axios.post(
    VALIDATE_AND_GET_OTP_URL,
    {
      email,
      password,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function getUserCloudIntegration(userId: number) {
  return axios.post(
    GET_USER_CLOUD_INTEGRATION,
    {
      userId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

// Server should return AuthModel
export function login(email: string, password: string, otp: any) {
  return axios.post(
    LOGIN_URL,
    {
      email,
      password,
      otp,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function requestPasswordResetLink(email: string) {
  return axios.post(
    REQUEST_PASSWORD_URL,
    {
      email,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function resetPassword(email: any, token: any, password: string) {
  return axios.post(
    RESET_PASSWORD,
    {
      email,
      token,
      password,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function updateUserProfile(formData: any) {
  return axios.post(UPDATE_USER_PROFILE, formData)
}

export function updateCompanyProfile(formData: any) {
  return axios.post(UPDATE_COMPANY_PROFILE, formData)
}

export function userDeleteProfile(formData: any) {
  return axios.post(DELETE_USER_PROFILE, formData)
}

export function userDeleteTeamProfile(formData: any) {
  return axios.post(DELETE_TEAM_PROFILE, formData)
}

export function changeCurrentPassword(userId: any, currentPassword: string, newPassword: string) {
  return axios.post(
    CHANGE_PASSWORD_URL,
    {
      userId,
      currentPassword,
      newPassword,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function updateEmailAddress(userId: any, newEmail: string, password: string) {
  return axios.post(
    UPDATE_EMAIL,
    {
      userId,
      newEmail,
      password,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function enable2FA(userId: any) {
  return axios.post(
    ENABLE_2FA,
    {
      userId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function disable2FA(userId: any) {
  return axios.post(
    DISABLE_2FA,
    {
      userId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function enableCompany2FA(companyId: any, userId: any) {
  return axios.post(
    ENABLE_COMPANY_2FA,
    {
      companyId,
      userId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function disableCompany2FA(companyId: any) {
  return axios.post(
    DISABLE_COMPANY_2FA,
    {
      companyId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function getAccountStats(userId: any) {
  return axios.post(
    GET_ACCOUNT_STATS,
    {
      userId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function sendInvitation(senderId: any, email: string, role: any, companyId: any) {
  return axios.post(
    SEND_INVITATION,
    {
      senderId,
      email,
      role,
      companyId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function shareCollection(senderId: any, email: string, collectionId: any) {
  return axios.post(
    SHARE_COLLECTION,
    {
      senderId,
      email,
      collectionId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function checkPaymentStatus(email: any) {
  return axios.post(
    CHECK_PAYMENT_STATUS,
    {
      email,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function googleImageUpload(email: any, profilePic: any) {
  return axios.post(
    GOOGLE_PROFILE_IMAGE,
    {
      email,
      profilePic,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

// Server should return object => { result: boolean } (Is Email in DB)
export function requestPassword(email: string) {
  return axios.post(REQUEST_PASSWORD_URL, {
    email,
  })
}

export function getUserByToken(token: string) {
  return axios.post<UserModel>(GET_USER_BY_ACCESSTOKEN_URL, {
    api_token: token,
  })
}
