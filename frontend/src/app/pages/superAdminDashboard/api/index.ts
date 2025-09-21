import axios from 'axios'

const API_URL = process.env.REACT_APP_BACKEND_URL

export const GET_ROLE = `${API_URL}/get-admin-role`
export const GET_ENV = `${API_URL}/get-admin-env`
export const UPDATE_ENV = `${API_URL}/update-admin-env`
export const UPDATE_EMAIL_TEMPLATE = `${API_URL}/update-template`
export const GET_CLIENTS = `${API_URL}/get/clients`
export const GET_TEMPLATES = `${API_URL}/get/email-templates`
export const GET_CLIENT_STATISTICS = `${API_URL}/get/user/statistics`
export const GET_COMPANY_STATISTICS = `${API_URL}/get/company/statistics`
export const GET_CLIENT_USERS = `${API_URL}/get/user/users`
export const ADMIN_USER_UPDATE = `${API_URL}/super-admin/update-profile`
export const USER_UPDATE = `${API_URL}/super-admin/update-user-profile`
export const SUPER_ADMIN_DELETE_USER = `${API_URL}/super-admin/delete-user`
export const SUPER_ADMIN_DELETE_TEAM_ACCOUNT = `${API_URL}/super-admin/delete-team-account`
export const ADMIN_ORG_UPDATE = `${API_URL}/super-admin/company/update-profile`
export const SUPER_ADMIN_UPDATE = `${API_URL}/super-admin/update-super-profile`
export const CREATE_USER = `${API_URL}/user/create-account-for-super-user`
export const SUPER_EMAIL = `${API_URL}/super-user-email`
export const REMOVE_SUPER_USER = `${API_URL}/remove-suoer-user`
export const REMOVE_USER = `${API_URL}/super-admin/delete-user-data`
export const LAST_MONTH_DATA = `${API_URL}/last-month-data`
export const GET_LAST_MONTH_DATA = `${API_URL}/get-last-month-data`
export const GET_RECORDING_COUNT = `${API_URL}/get-recording-count`

export function getAdminRole(userId: any) {
  return axios.post(
    GET_ROLE,
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

export function getAdminENV() {
  return axios.post(GET_ENV, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export function updateAdminENV(formData: any) {
  return axios.post(UPDATE_ENV, formData)
}

export function updateEmailTemplate(id: any, subject: any, template: any, fileName: any) {
  return axios.post(UPDATE_EMAIL_TEMPLATE, {id, subject, template, fileName})
}

export function getClients() {
  return axios.post(GET_CLIENTS, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export function getTemplates() {
  return axios.post(GET_TEMPLATES, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export function getClientStatistics(userId: any) {
  return axios.post(
    GET_CLIENT_STATISTICS,
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

export function getCompanyStatistics(companyId: any) {
  return axios.post(
    GET_COMPANY_STATISTICS,
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

export function getClientUsers(companyId: any) {
  return axios.post(
    GET_CLIENT_USERS,
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

export function superAdminUserUpdate(formData: any) {
  return axios.post(ADMIN_USER_UPDATE, formData)
}

export function superAdminSoloUserUpdate(formData: any) {
  return axios.post(USER_UPDATE, formData)
}

export function superAdminDeleteUser(formData: any) {
  return axios.post(SUPER_ADMIN_DELETE_USER, formData)
}

export function superAdminDeleteTeamAccount(formData: any) {
  return axios.post(SUPER_ADMIN_DELETE_TEAM_ACCOUNT, formData)
}

export function superAdminOrgUpdate(formData: any) {
  return axios.post(ADMIN_ORG_UPDATE, formData)
}

export function createAccountForSuperUsers(
  firstname: string,
  lastname: string,
  email: string,
  countryCode: string,
  mobileNumber: any,
  password: string,
  companyId: any,
  role: any
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
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function superAdminUpdate(formData: any) {
  return axios.post(SUPER_ADMIN_UPDATE, formData)
}

export function getSuperEmail() {
  return axios.post(SUPER_EMAIL)
}

export function removeSuperUser(userId: any, companyId: any) {
  return axios.post(
    REMOVE_SUPER_USER,
    {
      userId,
      companyId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function removeUser(userId: any, companyId: any, role: any) {
  return axios.post(
    REMOVE_USER,
    {
      userId,
      companyId,
      role,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function getLastMonthData(companyId: any) {
  return axios.post(
    GET_LAST_MONTH_DATA,
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

export function insertLastMonthData(lastMonthData: any) {
  return axios.post(LAST_MONTH_DATA, lastMonthData)
}

export function getRecordingCount(companyId: any, date: any) {
  return axios.post(
    GET_RECORDING_COUNT,
    {companyId, date},
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}
