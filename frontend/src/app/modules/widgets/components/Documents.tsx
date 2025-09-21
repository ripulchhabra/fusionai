/* eslint-disable jsx-a11y/anchor-is-valid */
import React, {useEffect, useState} from 'react'
import {KTIcon} from '../../../../_metronic/helpers'
import {Buttons} from '../../document-management/components/Buttons'
import {useAuth} from '../../auth'
import {Navigate} from 'react-router-dom'
import {
  deleteFile,
  deleteFolder,
  getChildFoldersAndFiles,
  getFolderData,
  getRootFoldersForCommunity,
  searchFilesAndFolders,
} from '../../document-management/api'
import {ActiveDirectoryPath} from '../../document-management/components/ActiveDirectoryPath'
import {Folders} from '../../document-management/components/Folders'
import {Files} from '../../document-management/components/Files'
import {CreateFolderDialog} from '../../document-management/components/CreateFolderDialog'
import {UpdateFolderDialog} from '../../document-management/components/UpdateFolderDialog'
import {DocViewerDialog} from '../../document-management/components/DocViewerDialog'
import {AlertDanger, AlertSuccess} from '../../alerts/Alerts'
import {FormattedMessage} from 'react-intl'

export function Documents() {
  const [deleting, setDeleting] = useState<boolean>(false)
  const {
    currentCommunity,
    communityList,
    auth,
    setOnHomePage,
    isBackFromPages,
    setIsBackFromPages,
    currentParent,
    setCurrentParent,
    isSharedCommunity,
  } = useAuth()
  const [openDialog, setOpenDialog] = useState<boolean>(false)
  const [folderTree, setFolderTree] = useState<Array<any>>([])
  const [searchString, setSearchString] = useState<string>('')
  const [activeFoldersAndFilesList, setActiveFoldersAndFilesList] = useState<Array<any>>([])
  const [fetchingFolds, settFetchingFolds] = useState<boolean>(true)
  const [folderIdToEdit, setFolderIdToEdit] = useState<any>(null)
  const [currentFolderDataToEdit, setCurrentFolderDataToEdit] = useState<any>({})
  const [openEditDialog, setEditOpenDialog] = useState<boolean>(false)
  const [successResMessage, setSuccessResMessage] = useState<string>('')
  const [failureResMessage, setFailureResMessage] = useState<string>('')
  const [checked, setChecked] = useState<boolean>(true)
  const [fetchingFile, settFetchingFile] = useState<boolean>(false)
  const [fileId, setFileId] = useState<any>(null)
  const [fileType, setFileType] = useState<any>(null)
  const [fileName, setFileName] = useState<any>(null)
  const [openDocViewer, setOpenDocViewer] = useState<boolean>(false)
  const [selectedDocs, setSelectedDocs] = useState<Array<any>>([])
  const [blob, setBlob] = useState<any>('')

  let currentCommunityTitle = ''
  communityList.forEach((community) => {
    if (currentCommunity === community.id) {
      currentCommunityTitle = community.community_name
    }
  })

  const _searchFilesAndFolders = (event: any) => {
    setSearchString(event.target.value)

    if (event.target.value != '') {
      if (searchString?.length >= 2) {
        searchFilesAndFolders(event.target.value, currentCommunity)
          .then((response) => {
            if (response.data.success) {
              setActiveFoldersAndFilesList(response.data.filesAndFolders)
              setFolderTree(response.data.predecessFolders)
            }
          })
          .catch((err) => {
            console.log(err)
          })
      }
    } else {
      getRootFoldersForCommunity(currentCommunity).then((response) => {
        if (response.data.success) {
          setActiveFoldersAndFilesList(response.data.filesAndFolders)
          setCurrentParent(4)
        }
        settFetchingFolds(false)
      })
    }
  }

  const showUpdateModal = (fid: any) => {
    setFolderIdToEdit(fid)
    getFolderData(fid)
      .then((response: any) => {
        if (response.data.success) {
          setCurrentFolderDataToEdit(response.data.folderData)
        }
      })
      .then(() => setEditOpenDialog(true))
  }

  function closeSideBar() {}

  if (successResMessage) {
    setTimeout(() => {
      setChecked(false)
      setTimeout(() => {
        setSuccessResMessage('')
      }, 200)
    }, 5000)
  }

  if (failureResMessage) {
    setTimeout(() => {
      setChecked(false)
      setTimeout(() => {
        setFailureResMessage('')
      }, 200)
    }, 5000)
  }

  const handleClose = () => {
    setOpenDialog(false)
  }

  const handleUpdateClose = () => {
    setEditOpenDialog(false)
  }

  const handleDocViewerClose = () => {
    setOpenDocViewer(false)
  }

  const closeDialogForFolderOrFileDeletion = (id: string) => {
    const element: HTMLElement = document.getElementById(id)!
    element.style.display = 'none'
  }

  const openDialogForFolderOrFileDeletion = (id: string) => {
    const element: HTMLElement = document.getElementById(id)!
    element.style.display = 'flex'
  }

  const handleFolderDeletion = (folderId: any) => {
    setDeleting(true)
    deleteFolder(folderId, currentParent, currentCommunity, searchString)
      .then((response) => {
        if (response.data.success) {
          setActiveFoldersAndFilesList(response.data.filesAndFolders)
          setSuccessResMessage(response.data.message)
          setChecked(true)
        } else {
          setFailureResMessage(response.data.message)
          setChecked(true)
        }
        setDeleting(false)
      })
      .then(() => {
        closeDialogForFolderOrFileDeletion(`delete-folder-${folderId}`)
      })
      .catch(() => {
        setFailureResMessage('Failed to delete folder')
        setChecked(true)
        setDeleting(false)
      })
  }

  const handleFileDeletion = (fileId: any) => {
    setDeleting(true)
    deleteFile(fileId, currentParent, currentCommunity, searchString)
      .then((response) => {
        if (response.data.success) {
          setDeleting(false)
          setActiveFoldersAndFilesList(response.data.filesAndFolders)
          setSuccessResMessage(response.data.message)
          setChecked(true)
        } else {
          setDeleting(false)
          setFailureResMessage(response.data.message)
          setChecked(true)
        }
      })
      .then(() => {
        closeDialogForFolderOrFileDeletion(`delete-file-${fileId}`)
      })
      .catch(() => {
        setDeleting(false)
        setFailureResMessage('Failed to delete file')
        setChecked(true)
      })
  }

  useEffect(() => {
    setOnHomePage(false)
    return () => setOnHomePage(false)
  }, [])

  useEffect(() => {
    if (currentParent) {
      if (searchString.length > 0) {
        setSearchString('')
      }
      getChildFoldersAndFiles(currentParent, currentCommunity).then((response) => {
        if (response.data.success) {
          setActiveFoldersAndFilesList(response.data.filesAndFolders)
          setFolderTree(response.data.predecessFolders)
          if (isBackFromPages) {
            setIsBackFromPages(false)
            settFetchingFolds(false)
          }
        }
      })
    }
  }, [currentParent])

  useEffect(() => {
    if (currentCommunity && !isBackFromPages) {
      settFetchingFolds(true)
      getRootFoldersForCommunity(currentCommunity).then((response) => {
        if (response.data.success) {
          setActiveFoldersAndFilesList(response.data.filesAndFolders)
          setFolderTree([])
        }
        settFetchingFolds(false)
      })
    }
  }, [currentCommunity])

  const createFileDeletionHandler = (id: string) => () => handleFileDeletion(id)

  const createCloseHandler = (id: string) => () =>
    closeDialogForFolderOrFileDeletion(`delete-file-${id}`)

  const createFolderDeletionHandler = (id: string) => () => handleFolderDeletion(id)

  const createFolderCloseHandler = (id: string) => () =>
    closeDialogForFolderOrFileDeletion(`delete-folder-${id}`)

  const createSetParentHandler = (id: number) => () => setCurrentParent(id)

  return (
    <>
      <div id='main'>
        {successResMessage !== undefined &&
        successResMessage !== null &&
        successResMessage !== '' ? (
          <AlertSuccess message={successResMessage} checked={checked} />
        ) : null}

        {failureResMessage !== undefined &&
        failureResMessage !== null &&
        failureResMessage !== '' ? (
          <AlertDanger message={failureResMessage} checked={checked} />
        ) : null}
      </div>

      {communityList.length !== 0 ? (
        currentCommunity ? (
          <div>
            <div
              id='document_management'
              className='d-flex flex-column h-100 row tab-p0 card flex-wrap py-5 '
              style={{overflowX: 'auto', marginLeft: '0px', marginRight: '0px', marginTop: '0px'}}
            >
              <div className='d-flex justify-content-between  mt6 mx-lg-2 folder-opt-align flex-wrap p-5'>
                <h2 className='d-flex align-items-center  mb-6'>
                  <span
                    className='text-hover-primary cursor-pointer'
                    onClick={createSetParentHandler(4)}
                  >
                    {currentCommunityTitle}
                  </span>
                  <span className=''>
                    {communityList.length > 0 && (
                      <>
                        {communityList.map((list: any) => {
                          return (
                            <>
                              {list.id == currentCommunity && currentParent !== 4 && (
                                <span key={list.id} className=''>
                                  <ActiveDirectoryPath
                                    folderTree={folderTree}
                                    setCurrentParent={setCurrentParent}
                                  />
                                </span>
                              )}
                            </>
                          )
                        })}
                      </>
                    )}
                  </span>
                </h2>
                <span className='d-flex flex-stack flex-wrap gap-4'>
                  <label className='font-size-lg text-dark-75 font-weight-bold'>
                    <div className='d-flex align-items-center position-relative'>
                      <KTIcon iconName='magnifier' className='fs-1 position-absolute ms-6' />
                      <input
                        type='text'
                        className='form-control form-control-solid w-250px ps-14'
                        placeholder='Search by folder / file name (min 3 chars)'
                        value={searchString}
                        onChange={_searchFilesAndFolders}
                      />
                    </div>
                  </label>
                  <span className=''>
                    {(auth?.user?.role != 3 || isSharedCommunity) && (
                      <>
                        <Buttons
                          setOpenDialog={setOpenDialog}
                          currentParent={currentParent}
                          currentCommunity={currentCommunity}
                          folderTree={folderTree}
                        />
                      </>
                    )}
                  </span>
                </span>
              </div>
              <div className='p-5'>
                <table
                  className='table mb-6 align-middle table-row-dashed fs-6 gy-5 '
                  id='kt_table_users'
                >
                  <thead className='pe-5'>
                    <tr className='text-start text-muted fw-bolder fs-7 text-uppercase gs-0'>
                      <th className='min-w-50px p-1 p-lg-2'>
                        <FormattedMessage id='DOCUMENT.TABLE.NAME' />
                      </th>
                      <th className='min-w-50px  p-lg-2'>
                        <FormattedMessage id='COMMUNITY.OWNER' />
                      </th>
                      <th className='min-w-50px  p-lg-2'>
                        <FormattedMessage id='COMMUNITY.SIZE' />
                      </th>
                      <th className='min-w-50px  p-lg-2'>
                        <FormattedMessage id='COMMUNITY.LAST_UPDATED' />
                      </th>
                      <th className='min-w-50px  p-lg-2 text-lg-end'>
                        <FormattedMessage id='COMMUNITY.ACTIONS' />
                      </th>
                    </tr>
                  </thead>
                  <tbody className='text-gray-600 fw-bold' style={{height: '55px'}}>
                    {!fetchingFolds && (
                      <>
                        {activeFoldersAndFilesList.map((data: any) => (
                          <>
                            {data.isFile == 0 ? (
                              <>
                                <Folders
                                  id={data.id}
                                  title={data.name}
                                  tooltip={data.tooltip}
                                  isDefault={data.isDefault}
                                  openDialogForFolderOrFileDeletion={
                                    openDialogForFolderOrFileDeletion
                                  }
                                  setCurrentParent={setCurrentParent}
                                  showUpdateModal={showUpdateModal}
                                  created={data.created}
                                  isShared={isSharedCommunity}
                                  creator={data.creator}
                                  folderTree={folderTree}
                                  owner={data.ownerName}
                                  avatarName={data.avatarName}
                                />
                                <div
                                  id={`delete-folder-${data.id}`}
                                  style={{display: 'none'}}
                                  className='modal'
                                >
                                  <span
                                    onClick={createFolderCloseHandler(data.id)}
                                    className='close'
                                    title='Close Modal'
                                  >
                                    &times;
                                  </span>
                                  <form
                                    className='modal-content bg-light w-75 w-md-50'
                                    style={{height: 'fit-content', marginTop: '150px'}}
                                  >
                                    <div className='px-7 py-7'>
                                      <h3>Delete Folder</h3>
                                      <p className='font-size-15'>
                                        This action cannot be undone, are you sure that you want to
                                        delete the
                                        <span className='mx-1 fw-bolder'>{data.name}</span>
                                        folder and it's contents?
                                      </p>

                                      <div className='d-flex justify-content-center'>
                                        <button
                                          onClick={createCloseHandler(data.id)}
                                          type='button'
                                          className='btn btn-primary'
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          onClick={createFolderDeletionHandler(data.id)}
                                          type='button'
                                          className='btn btn-danger ms-3'
                                        >
                                          Delete
                                          {deleting && (
                                            <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </form>
                                </div>
                              </>
                            ) : (
                              <>
                                <Files
                                  id={data.id}
                                  title={data.name}
                                  parent={data.parentId}
                                  openDialogForFolderOrFileDeletion={
                                    openDialogForFolderOrFileDeletion
                                  }
                                  currentCommunity={currentCommunity}
                                  currentParent={currentParent}
                                  setChecked={setChecked}
                                  setSuccessResMessage={setSuccessResMessage}
                                  setFailureResMessage={setFailureResMessage}
                                  fetchingFile={fetchingFile}
                                  settFetchingFile={settFetchingFile}
                                  setFileId={setFileId}
                                  setFileType={setFileType}
                                  setFileName={setFileName}
                                  showDocViewer={setOpenDocViewer}
                                  folderTree={folderTree}
                                  created={data.created}
                                  size={data.size}
                                  isShared={isSharedCommunity}
                                  creator={data.creator}
                                  owner={data.ownerName}
                                  avatarName={data.avatarName}
                                />
                                <div
                                  id={`delete-file-${data.id}`}
                                  style={{display: 'none'}}
                                  className='modal'
                                >
                                  <span
                                    onClick={createCloseHandler(data.id)}
                                    className='close'
                                    title='Close Modal'
                                  >
                                    &times;
                                  </span>
                                  <form
                                    className='modal-content bg-light w-75 w-md-50'
                                    style={{height: 'fit-content', marginTop: '150px'}}
                                  >
                                    <div className='px-7 py-7'>
                                      <h3>Delete File?</h3>
                                      <p className='font-size-15'>
                                        This action cannot be undone, are you sure that you want to
                                        delete the
                                        <span className='mx-1 fw-bolder'>{data.name}</span> file?
                                      </p>

                                      <div className='d-flex justify-content-center'>
                                        <button
                                          onClick={createCloseHandler(data.id)}
                                          type='button'
                                          className='btn btn-primary'
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          onClick={createFileDeletionHandler(data.id)}
                                          type='button'
                                          className='btn btn-danger ms-3'
                                        >
                                          Delete
                                          {deleting && (
                                            <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </form>
                                </div>
                              </>
                            )}
                          </>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          communityList.length !== 0 && <Navigate to='/dashboard' />
        )
      ) : (
        <Navigate to='/dashboard' />
      )}

      <CreateFolderDialog
        show={openDialog}
        handleClose={handleClose}
        setActiveFoldersAndFilesList={setActiveFoldersAndFilesList}
        setChecked={setChecked}
        setSuccessResMessage={setSuccessResMessage}
        setFailureResMessage={setFailureResMessage}
        currentParent={currentParent}
        currentCommunity={currentCommunity}
        closeSideBar={closeSideBar}
      />
      <UpdateFolderDialog
        show={openEditDialog}
        handleClose={handleUpdateClose}
        folderIdToEdit={folderIdToEdit}
        currentFolderDataToEdit={currentFolderDataToEdit}
        setActiveFoldersAndFilesList={setActiveFoldersAndFilesList}
        setChecked={setChecked}
        setSuccessResMessage={setSuccessResMessage}
        setFailureResMessage={setFailureResMessage}
        currentParent={currentParent}
        currentCommunity={currentCommunity}
        searchString={searchString}
        closeSideBar={closeSideBar}
      />
      <DocViewerDialog
        selectedDocs={selectedDocs}
        setSelectedDocs={setSelectedDocs}
        blob={blob}
        setBlob={setBlob}
        show={openDocViewer}
        handleClose={handleDocViewerClose}
        currentParent={currentParent}
        currentCommunity={currentCommunity}
        fileId={fileId}
        fileType={fileType}
        fileName={fileName}
      />
    </>
  )
}
