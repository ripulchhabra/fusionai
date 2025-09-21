import axios from 'axios'

const API_URL = process.env.REACT_APP_BACKEND_URL

export const INVITATION_LIST = `${API_URL}/invitation/list`
export const DELETE_INVITATIONS = `${API_URL}/invitations/delete`
export const DELETE_INVITATION = `${API_URL}/invitation/delete`
export const RESEND_INVITATION = `${API_URL}/invitation/resend`
export const GET_INVITATION = `${API_URL}/invitation/get`
export const CREATE_USER = `${API_URL}/user/create-account-for-invited-user`
export const DECLINE_INVITATION = `${API_URL}/invitation/decline`
export const GET_USER_DETAIL = `${API_URL}/admin/get-user-detail`
export const GET_SUPERADMIN_DETAIL = `${API_URL}/admin/get-superAdmin-detail`
export const VERIFY_USER_ACCOUNT = `${API_URL}/admin/verify-account`
export const BLACKLIST_USER = `${API_URL}/admin/blacklist-user`
export const WHITELIST_USER = `${API_URL}/admin/whitelist-user`
export const ENABLE_USER_2FA_FOR_ADMIN = `${API_URL}/admin/enable-user-2fa`
export const DISABLE_USER_2FA_FOR_ADMIN = `${API_URL}/admin/disable-user-2fa`
export const ADMIN_USER_UPDATE = `${API_URL}/admin/update-profile`
export const ADMIN_USER_PASSWORD_UPDATE = `${API_URL}/admin/change-password`

export function getInvitationList(
  searchString: string,
  offset: number,
  limit: number,
  companyId: any
) {
  return axios.post(
    INVITATION_LIST,
    {
      offset,
      limit,
      companyId,
      searchString,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function deleteInvitations(invitationIds: Array<any>, companyId: any, limit: number) {
  return axios.post(
    DELETE_INVITATIONS,
    {
      invitationIds,
      companyId,
      limit,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function deleteInvitation(invitationId: any, companyId: any, limit: number) {
  return axios.post(
    DELETE_INVITATION,
    {
      invitationId,
      companyId,
      limit,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function resendInvitation(email: string, companyId: any, offset: number, limit: number) {
  return axios.post(
    RESEND_INVITATION,
    {
      email,
      companyId,
      offset,
      limit,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function getInvitationDataByEmail(email: any, token: any) {
  return axios.post(
    GET_INVITATION,
    {
      email,
      token,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function createAccountForInvitedUsers(
  firstname: string,
  lastname: string,
  email: string,
  countryCode: any,
  mobileNumber: any,
  password: string,
  companyId: any,
  role: any,
  token: any,
  signUpMethod: any
) {
  return axios.post(
    CREATE_USER,
    {
      firstname,
      lastname,
      email,
      countryCode,
      mobileNumber,
      password,
      companyId,
      role,
      token,
      signUpMethod,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function createAccountForSuperInvitedUsers(
  firstname: string,
  lastname: string,
  email: string,
  companyId: any,
  role: any,
  token: any,
  signUpMethod: any,
  profilePic: any
) {
  return axios.post(
    CREATE_USER,
    {
      firstname,
      lastname,
      email,
      companyId,
      role,
      token,
      signUpMethod,
      profilePic,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function declineInvitation(email: any, token: any) {
  return axios.post(
    DECLINE_INVITATION,
    {
      email,
      token,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function getUserDetailForAdmin(userId: any) {
  return axios.post(
    GET_USER_DETAIL,
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

export function getSuperAdminDetailForAdmin(userId: any) {
  return axios.post(
    GET_SUPERADMIN_DETAIL,
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

export function verifyUserAccountForAdmin(userId: any) {
  return axios.post(
    VERIFY_USER_ACCOUNT,
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

export function blacklistUserAccount(userId: any) {
  return axios.post(
    BLACKLIST_USER,
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

export function whitelistUserAccount(userId: any) {
  return axios.post(
    WHITELIST_USER,
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

export function enableUser2FAOptionForAdmin(userId: any) {
  return axios.post(
    ENABLE_USER_2FA_FOR_ADMIN,
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

export function disableUser2FAOptionForAdmin(userId: any) {
  return axios.post(
    DISABLE_USER_2FA_FOR_ADMIN,
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

export function adminUserPasswordUpdate(userId: any, newPassword: string) {
  return axios.post(
    ADMIN_USER_PASSWORD_UPDATE,
    {
      userId,
      newPassword,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function adminUserUpdate(formData: any) {
  return axios.post(ADMIN_USER_UPDATE, formData)
}
