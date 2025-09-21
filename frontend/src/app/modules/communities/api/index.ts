import axios from 'axios'

const API_URL = process.env.REACT_APP_BACKEND_URL

export const CREATE_COMMUNITY = `${API_URL}/community/create`
export const UPDATE_COMMUNITY = `${API_URL}/community/update`
export const GET_COMMUNITY_LIST = `${API_URL}/community/get`
export const DELETE_COMMUNITY = `${API_URL}/community/delete`
export const ACTIVATE_COMMUNITY = `${API_URL}/community/activate`
export const DEACTIVATE_COMMUNITY = `${API_URL}/community/deactivate`
export const DELETE_COMMUNITIES = `${API_URL}/community/delete`
export const CHECK_ALIAS_EXIST = `${API_URL}/community/check-alias-exist`
export const CHECK_ALIAS_EXIST_FOR_UPDATE = `${API_URL}/community/check-alias-exist-for-update`
export const GET_SHARED_COMMUNITY_LIST = `${API_URL}/community/get-shared-community`

export function getSharedCommunityList() {
  return axios.get(GET_SHARED_COMMUNITY_LIST, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export function createCommunity(
  companyId: any,
  creator: any,
  communityName: string,
  communityAlias: string,
  offset: number,
  limit: number
) {
  return axios.post(
    CREATE_COMMUNITY,
    {
      companyId,
      creator,
      communityName,
      communityAlias,
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

export function getCommunityList(
  searchString: string,
  companyId: any,
  offset: number,
  limit: number
) {
  return axios.post(
    GET_COMMUNITY_LIST,
    {
      searchString,
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

export function deleteCommunity(
  communityId: any,
  companyId: any,
  limit: number,
  offset: any,
  searchString: string
) {
  return axios.post(
    DELETE_COMMUNITY,
    {
      communityId,
      companyId,
      limit,
      offset,
      searchString,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function activateCommunity(
  communityId: any,
  companyId: any,
  limit: number,
  offset: any,
  searchString: string
) {
  return axios.post(
    ACTIVATE_COMMUNITY,
    {
      communityId,
      companyId,
      limit,
      offset,
      searchString,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function deactivateCommunity(
  communityId: any,
  companyId: any,
  limit: number,
  offset: any,
  searchString: string
) {
  return axios.post(
    DEACTIVATE_COMMUNITY,
    {
      communityId,
      companyId,
      limit,
      offset,
      searchString,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function deleteCommunities(communityIds: Array<any>, companyId: any, limit: number) {
  return axios.post(
    DELETE_COMMUNITIES,
    {
      communityIds,
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

export function updateCommunities(
  communityName: string,
  communityAlias: string,
  companyId: any,
  communityId: any,
  offset: any,
  limit: any,
  searchString: string
) {
  return axios.post(
    UPDATE_COMMUNITY,
    {
      communityName,
      communityAlias,
      companyId,
      communityId,
      offset,
      limit,
      searchString,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function checkIfAliasExist(alias: any, companyId: any) {
  return axios.post(
    CHECK_ALIAS_EXIST,
    {
      alias,
      companyId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function checkIfAliasExistForUpdate(alias: any, communityId: any) {
  return axios.post(
    CHECK_ALIAS_EXIST_FOR_UPDATE,
    {
      alias,
      communityId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}
