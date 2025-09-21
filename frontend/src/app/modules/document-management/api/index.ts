import axios from 'axios'

const API_URL = process.env.REACT_APP_BACKEND_URL

export const CREATE_FOLDER = `${API_URL}/file-manager/create-folder`
export const GET_ROOT_FOLDERS = `${API_URL}/file-manager/get-root-folders`
export const GET_CHILD_FILES_AND_FOLDERS = `${API_URL}/file-manager/get-child-folders`
export const GET_ACTIVE_COMMUNITIES = `${API_URL}/community/get-active-communities`
export const GET_FOLDER_DATA = `${API_URL}/file-manager/get-folder`
export const DELETE_FOLDER = `${API_URL}/file-manager/delete-folder`
export const UPDATE_FOLDER = `${API_URL}/file-manager/update-folder`
export const UPLOAD_DOCUMENT = `${API_URL}/file-manager/upload-file`
export const CREATE_DOCUMENT = `${API_URL}/file-manager/create-file`
export const UPDATE_DOCUMENT = `${API_URL}/file-manager/update-file`
export const UPDATE_FILE_NAME = `${API_URL}/file-manager/update-filename`
export const DELETE_FILE = `${API_URL}/file-manager/delete-file`
export const GET_FILE = `${API_URL}/file-manager/get-file`
export const SEARCH_FILES_AND_FOLDERS = `${API_URL}/file-manager/search-files-and-folders`
export const GET_COMPANY_USAGE = `${API_URL}/get/company/statistics`
export const GET_USER_CHAT_HISTORIES = `${API_URL}/chat/get-histories`
export const RENAME_CHAT_HISTORY = `${API_URL}/chat/rename`
export const DELETE_CHAT_HISTORY = `${API_URL}/chat/delete`
export const GET_CHAT_MESSAGES = `${API_URL}/chat/get-messages`
export const ADD_MESSAGE_TO_CHAT = `${API_URL}/chat/add-message`
export const CREATE_NEW_CHAT = `${API_URL}/chat/create`
export const GET_FOLDER_TREE_FOR_FILE = `${API_URL}/file-manager/get-folder-tree`
export const CANCEL_SUBSCRIPTION = `${API_URL}/user/admin/cancel-subscription`
export const REMOVE_USER = `${API_URL}/super-admin/delete-user-data`
export const GET_SUBSCRIPTION_DETAILS = `${API_URL}/get/subscription-details`
export const GET_USER_DYNAMIC_ROLES = `${API_URL}/user-role`
export const UPLOAD_AUDIO = `${API_URL}/file-manager/upload-audio-file`
export const GET_FILE_SUMMARY = `${API_URL}/summarize-document`
export const GET_SUMMARY_DATA = `${API_URL}/get-summary-data`
export const UPDATE_SUMMARY_FILE_NAME = `${API_URL}/update-summary-filename`
export const GET_NOTIFICATION = `${API_URL}/notifications`
export const UPDATE_NOTIFICATION = `${API_URL}/notifications/viewed`
export const DELETE_NOTIFICATION = `${API_URL}/notification`
export const GET_JOB_ID = `${API_URL}/file-manager/get-job-id`
export const GET_JOB_STATUS = `${API_URL}/file-manager/get-job-status`
export const GET_MAX_FILE_UPLOADS = `${API_URL}/file-manager/get-max-file-uploads`
export const RETRY_FILE_UPLOAD = `${API_URL}/file-manager/retry-job`
export const GET_ALL_FOLDERS = `${API_URL}/file-manager/get-all-folders`
export const GET_ALL_TEAMS = `${API_URL}/file-manager/get-all-teams`
export const GET_USER_CHAT_HISTORIES_FOR_SPECIFIC_SCOPE = `${API_URL}/chat/get-histories-for-specific-scope`
export const GET_RECORDING_PROMPT_TIME = `${API_URL}/file-manager/get-recording-prompt-time`
export const GET_RECORDING_LIMIT = `${API_URL}/file-manager/get-recording-limit`
export const UPDATE_USER_INTEGRATION = `${API_URL}/user/integration/update`
export const GET_GOOGLE_DRIVE_FILES = `${API_URL}/user/googleDrive/files`
export const GET_ONE_DRIVE_FILES = `${API_URL}/user/oneDrive/files`
export const GET_DROPBOX_FILES = `${API_URL}/user/dropbox/files`
export const GET_WORDPRESS_FILES = `${API_URL}/user/wordpress/files`
export const GET_SLACK_FILES = `${API_URL}/user/slack/files`

export function slackDriveFiles(userId: any) {
  return axios.post(
    `${GET_SLACK_FILES}`,
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

export function wordpressFiles(userId: any) {
  return axios.post(
    `${GET_WORDPRESS_FILES}`,
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

export function dropboxFiles(userId: any) {
  return axios.post(
    `${GET_DROPBOX_FILES}`,
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

export function oneDriveFiles(userId: any) {
  return axios.post(
    `${GET_ONE_DRIVE_FILES}`,
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

export function googleDriveFiles(userId: any) {
  return axios.post(
    `${GET_GOOGLE_DRIVE_FILES}`,
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

export function updateUserIntegration(userId: any, id: any, updates: any) {
  return axios.post(
    `${UPDATE_USER_INTEGRATION}`,
    {
      userId,
      id,
      updates,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function getAllFolders(communityId: any) {
  return axios.get(`${GET_ALL_FOLDERS}/${communityId}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export function getRecordingPromptTime() {
  return axios.get(`${GET_RECORDING_PROMPT_TIME}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export function getRecordingLimit(communityId: any) {
  return axios.post(
    `${GET_RECORDING_LIMIT}`,
    {
      communityId: communityId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function getAllTeams(companyId: any) {
  return axios.get(`${GET_ALL_TEAMS}/${companyId}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export function getUserChatHisoriesForSpecificScope(
  userId: any,
  communityId: any,
  fileId: any,
  type: any
) {
  return axios.post(
    GET_USER_CHAT_HISTORIES_FOR_SPECIFIC_SCOPE,
    {
      userId,
      communityId,
      fileId,
      type,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function getUserDynamicRole() {
  return axios.post(GET_USER_DYNAMIC_ROLES, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export function getJobId() {
  return axios.get(GET_JOB_ID, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export function getJobStatus(id: number) {
  return axios.get(`${GET_JOB_STATUS}/${id}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export function getMaxFileUploads() {
  return axios.get(`${GET_MAX_FILE_UPLOADS}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export function retryFileUpload(id: number) {
  return axios.get(`${RETRY_FILE_UPLOAD}/${id}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export function getSubscriptionDetail(userId: any) {
  return axios.post(
    GET_SUBSCRIPTION_DETAILS,
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

export function deleteSubscription(userId: any) {
  return axios.post(
    CANCEL_SUBSCRIPTION,
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

export function createFolder(folderName: string, tooltip: string, parentId: any, communityId: any) {
  return axios.post(
    CREATE_FOLDER,
    {
      folderName,
      tooltip,
      parentId,
      communityId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function getRootFoldersForCommunity(communityId: any) {
  return axios.post(
    GET_ROOT_FOLDERS,
    {
      communityId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function getChildFoldersAndFiles(parentId: any, communityId: any) {
  return axios.post(
    GET_CHILD_FILES_AND_FOLDERS,
    {
      parentId,
      communityId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function getActiveCommunities(companyId: any) {
  return axios.post(
    GET_ACTIVE_COMMUNITIES,
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

export function deleteFolder(folderId: any, parentId: any, communityId: any, searchString: string) {
  return axios.post(
    DELETE_FOLDER,
    {
      folderId,
      parentId,
      communityId,
      searchString,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

function extractResponseData(str: string) {
  const chunkResArray: Array<string> = str.split('$')
  const chunkRes = chunkResArray[chunkResArray.length - 2]
  const resData = chunkRes.split('&%&')
  console.log(resData)
  const res = {
    successStatus: resData[0],
    message: resData[1],
  }

  return res
}

export function uploadDocument(
  communityId: any,
  parentId: any,
  fileName: any,
  formData: any,
  source: any
) {
  return axios.post(
    UPLOAD_DOCUMENT +
      `?communityId=${communityId}&parentId=${parentId}&fileName=${fileName}&source=${source}`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onDownloadProgress(progressEvent) {
        extractResponseData(progressEvent.target.response)
      },
    }
  )
}

export function createDocument(
  communityId: any,
  parentId: any,
  userId: any,
  htmlString: string,
  fileName: string
) {
  return axios.post(
    CREATE_DOCUMENT,
    {
      communityId,
      parentId,
      userId,
      htmlString,
      fileName,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
      onDownloadProgress(progressEvent) {
        const {successStatus, message} = extractResponseData(progressEvent.target.response)

        if (successStatus == '1') {
          const info: HTMLElement = document.getElementById('create-info')!
          const success: HTMLElement = document.getElementById('create-success')!
          const fail: HTMLElement = document.getElementById('create-fail')!
          const successText: HTMLElement = document.getElementById('create-success-text')!
          // const successLogo: HTMLElement = document.getElementById("create-success-logo")!
          // const failLogo: HTMLElement = document.getElementById("create-fail-logo")!

          info.style.display = 'none'
          fail.style.display = 'none'
          // failLogo.style.display = "none"
          success.style.display = 'block'
          successText.innerText = message
          // successLogo.style.display = "block"
        } else {
          const info: HTMLElement = document.getElementById('create-info')!
          const success: HTMLElement = document.getElementById('create-success')!
          const fail: HTMLElement = document.getElementById('create-fail')!
          const failText: HTMLElement = document.getElementById('create-fail-text')!
          // const successLogo: HTMLElement = document.getElementById("create-success-logo")!
          // const failLogo: HTMLElement = document.getElementById("create-fail-logo")!

          info.style.display = 'none'
          fail.style.display = 'block'
          // successLogo.style.display = "none"
          success.style.display = 'none'
          failText.innerText = message
          // failLogo.style.display = "block"
        }
      },
    }
  )
}

export function updateDocument(
  communityId: any,
  parentId: any,
  userId: any,
  htmlString: string,
  fileName: string,
  fileId: any
) {
  return axios.post(
    UPDATE_DOCUMENT,
    {
      communityId,
      parentId,
      userId,
      htmlString,
      fileName,
      fileId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
      onDownloadProgress(progressEvent) {
        const {successStatus, message} = extractResponseData(progressEvent.target.response)

        if (successStatus == '1') {
          const info: HTMLElement = document.getElementById('update-info')!
          const success: HTMLElement = document.getElementById('update-success')!
          const fail: HTMLElement = document.getElementById('update-fail')!
          const successText: HTMLElement = document.getElementById('update-success-text')!
          info.style.display = 'none'
          fail.style.display = 'none'
          success.style.display = 'block'
          successText.innerText = message
        } else {
          const info: HTMLElement = document.getElementById('update-info')!
          const success: HTMLElement = document.getElementById('update-success')!
          const fail: HTMLElement = document.getElementById('update-fail')!
          const failText: HTMLElement = document.getElementById('update-fail-text')!

          info.style.display = 'none'
          fail.style.display = 'block'
          success.style.display = 'none'
          failText.innerText = message
        }
      },
    }
  )
}

export function deleteFile(fileId: any, parentId: any, communityId: any, searchString: string) {
  return axios.post(
    DELETE_FILE,
    {
      fileId,
      parentId,
      communityId,
      searchString,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function getFolderData(folderId: any) {
  return axios.post(
    GET_FOLDER_DATA,
    {
      folderId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function updateFolder(
  folderId: any,
  folderName: string,
  folderDescription: any,
  parentId: any,
  communityId: any,
  searchString: string
) {
  return axios.post(
    UPDATE_FOLDER,
    {
      folderId,
      folderName,
      folderDescription,
      parentId,
      communityId,
      searchString,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function getDocxFile(fileId: any, communityId: any) {
  return axios.post(
    GET_FILE,
    {
      fileId,
      communityId,
      fileType: 'docx',
    },
    {
      responseType: 'arraybuffer',
      headers: {
        Accept: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    }
  )
}

export function getDocFile(fileId: any, communityId: any) {
  return axios.post(
    GET_FILE,
    {
      fileId,
      communityId,
      fileType: 'doc',
    },
    {
      responseType: 'arraybuffer',
      headers: {
        Accept: 'application/msword',
      },
    }
  )
}

export function getPDFFile(fileId: any, communityId: any) {
  return axios.post(
    GET_FILE,
    {
      fileId,
      communityId,
      fileType: 'pdf',
    },
    {
      responseType: 'arraybuffer',
      headers: {
        Accept: 'application/pdf',
      },
    }
  )
}

export function getXlsxFile(fileId: any, communityId: any) {
  return axios.post(
    GET_FILE,
    {
      fileId,
      communityId,
      fileType: 'xlsx',
    },
    {
      responseType: 'arraybuffer',
      headers: {
        Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    }
  )
}

export function getNotifications() {
  return axios.get(GET_NOTIFICATION, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
export function updateNotifications() {
  return axios.put(UPDATE_NOTIFICATION, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
export function deleteNotification(id: number) {
  return axios.delete(`${DELETE_NOTIFICATION}/${id}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export function getXlsFile(fileId: any, communityId: any) {
  return axios.post(
    GET_FILE,
    {
      fileId,
      communityId,
      fileType: 'xls',
    },
    {
      responseType: 'arraybuffer',
      headers: {
        Accept: 'application/vnd.ms-excel',
      },
    }
  )
}

export function getTextFile(fileId: any, communityId: any) {
  return axios.post(
    GET_FILE,
    {
      fileId,
      communityId,
      fileType: 'txt',
    },
    {
      responseType: 'arraybuffer',
      headers: {
        Accept: 'text/plain;charset=utf-8',
      },
    }
  )
}

export function getPPTXFile(fileId: any, communityId: any) {
  return axios.post(
    GET_FILE,
    {
      fileId,
      communityId,
      fileType: 'pptx',
    },
    {
      responseType: 'arraybuffer',
      headers: {
        Accept: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      },
    }
  )
}

export function getHTMLFile(fileId: any, communityId: any) {
  return axios.post(
    GET_FILE,
    {
      fileId,
      communityId,
      fileType: 'html',
    },
    {
      responseType: 'arraybuffer',
      headers: {
        Accept: 'text/html',
      },
    }
  )
}

export function getImageFile(fileId: any, communityId: any) {
  return axios.post(
    GET_FILE,
    {
      fileId,
      communityId,
      fileType: 'jpg',
    },
    {
      responseType: 'arraybuffer',
      headers: {
        Accept: '*',
      },
    }
  )
}

export function getVideoFile(fileId: any, communityId: any) {
  return axios.post(
    GET_FILE,
    {
      fileId,
      communityId,
      fileType: 'mp4',
    },
    {
      responseType: 'arraybuffer',
      headers: {
        Accept: '*',
      },
    }
  )
}

export function getAudioFile(fileId: any, communityId: any) {
  return axios.post(
    GET_FILE,
    {
      fileId,
      communityId,
      fileType: 'mp3',
    },
    {
      responseType: 'arraybuffer',
      headers: {
        Accept: '*',
      },
    }
  )
}

export function searchFilesAndFolders(searchString: any, communityId: any) {
  return axios.post(
    SEARCH_FILES_AND_FOLDERS,
    {
      searchString,
      communityId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function getCompanyUsage(companyId: any) {
  return axios.post(
    GET_COMPANY_USAGE,
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

// *************************** Chat APIs **************************************

export function getUserChatHisories(userId: any, communityId: any) {
  return axios.post(
    GET_USER_CHAT_HISTORIES,
    {
      userId,
      communityId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function renameChatHistory(
  chatId: any,
  newChatName: string,
  communityId: any,
  fileId: any,
  type: any
) {
  return axios.post(
    RENAME_CHAT_HISTORY,
    {
      chatId,
      newChatName,
      communityId,
      fileId,
      type,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function deleteChatHistory(chatId: any, communityId: any, fileId: any, type: any) {
  return axios.post(
    DELETE_CHAT_HISTORY,
    {
      chatId,
      communityId,
      fileId,
      type,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function getChatMessages(chatId: any) {
  return axios.post(
    GET_CHAT_MESSAGES,
    {
      chatId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function addMessagesToChat(
  chatId: any,
  communityId: any,
  message: any,
  companyId: any,
  userId: any
) {
  return axios.post(
    ADD_MESSAGE_TO_CHAT,
    {
      chatId,
      communityId,
      message,
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

export function createNewChatApi(communityId: any, type: any, fileId: any) {
  return axios.post(
    CREATE_NEW_CHAT,
    {
      communityId,
      type,
      fileId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function updateFilename(fileName: string, fileId: any, parentId: any, communityId: any) {
  return axios.post(
    UPDATE_FILE_NAME,
    {
      fileName,
      fileId,
      parentId,
      communityId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function getFolderTreeForFile(parentId: any) {
  return axios.post(
    GET_FOLDER_TREE_FOR_FILE,
    {
      parentId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function uploadAudio(communityId: any, parentId: any, fileName: any, formData: any) {
  return axios.post(
    UPLOAD_AUDIO + `?communityId=${communityId}&parentId=${parentId}&fileName=${fileName}`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onDownloadProgress(progressEvent) {
        const {successStatus, message} = extractResponseData(progressEvent.target.response)

        if (successStatus == '1') {
          const success: HTMLElement = document.getElementById('upload-success')!
          const fail: HTMLElement = document.getElementById('upload-fail')!
          const successText: HTMLElement = document.getElementById('upload-success-text')!

          fail.style.display = 'none'
          success.style.display = 'block'
          successText.innerText = message
        } else {
          const success: HTMLElement = document.getElementById('upload-success')!
          const fail: HTMLElement = document.getElementById('upload-fail')!
          const failText: HTMLElement = document.getElementById('upload-fail-text')!

          fail.style.display = 'block'
          success.style.display = 'none'
          failText.innerText = message
        }
      },
    }
  )
}

export function getFileSummary(fileId: any, communityId: any) {
  return axios.post(
    GET_FILE_SUMMARY,
    {
      fileId,
      communityId,
      fileType: 'html',
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function getSummaryData(fileId: any) {
  return axios.post(
    GET_SUMMARY_DATA,
    {
      fileId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function updateSummaryFilename(
  fileName: string,
  fileId: any,
  parentId: any,
  communityId: any
) {
  return axios.post(
    UPDATE_SUMMARY_FILE_NAME,
    {
      fileName,
      fileId,
      parentId,
      communityId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}
