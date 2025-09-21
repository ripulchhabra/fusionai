import {useState, useRef, useEffect} from 'react'
import {AlertDanger, AlertSuccess} from '../../alerts/Alerts'
import {useLocation, useNavigate} from 'react-router-dom'
import {getFolderTreeForFile, getMaxFileUploads} from '../api'
import {KTIcon, toAbsoluteUrl} from '../../../../_metronic/helpers'
import {useAuth} from '../../auth'
import {CurrentUploadPath} from './CurrentUploadPath'
import {FormattedMessage} from 'react-intl'
import {File} from './File'

export const DragDropFile = () => {
  // drag state
  const {state}: any = useLocation()
  const currentCommunityId = state.currentCommunity
  const currentParent = state.currentParent
  const [folderTree, setFolderTree] = useState<any>([])
  const [dragActive, setDragActive] = useState(false)
  const [successResMessage, setSuccessResMessage] = useState<string>('')
  const [failureResMessage, setFailureResMessage] = useState<string>('')
  const [checked, setChecked] = useState<boolean>(true)
  const [uploading, setUploading] = useState<boolean | string>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [maxFileUploads, setMaxFileUploads] = useState<number>(0)

  // ref
  const inputRef = useRef<any>(null)
  const {auth, isBackFromPages, setIsBackFromPages, communityList, currentCommunity, currentUser} =
    useAuth()
  const [files, setFiles] = useState<any[]>([])

  let currentCommunityTitle = ''
  communityList.forEach((community) => {
    if (currentCommunity === community.id) {
      currentCommunityTitle = community.community_name
    }
  })

  // wordpress

  const [odLoading, setodLoading] = useState(false)

  function getMimeType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase() || ''

    const mimeTypes: Record<string, string> = {
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pdf: 'application/pdf',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      txt: 'text/plain',
      mp3: 'audio/mpeg',
      mp4: 'video/mp4',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      mov: 'video/quicktime',
    }

    return mimeTypes[extension] || 'application/octet-stream'
  }

  useEffect(() => {
    const handleMessage = (event: any) => {
      const {
        statusRes,
        accessToken,
        profile,
        user,
        statusMessage,
        files,
        source,
        wordpress,
        dropbox,
        slack,
      } = event.data

      if (statusRes) {
        // Fetch files using the access token
      } else {
        // Handle the authentication failure
        console.error(statusMessage)
      }
    }

    window.addEventListener('message', handleMessage)

    // Clean up the event listener on component unmount
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  // dropbox

  // Google Drive config

  const [selectedGDFiles, setSelectedGDFiles] = useState<any[]>([])

  const handleCheckboxChangeGD = (file: any) => {
    const isFileSelected = selectedGDFiles.some((selectedFile) => selectedFile.id === file.id)

    if (isFileSelected) {
      setSelectedGDFiles(selectedGDFiles.filter((selectedFile) => selectedFile.id !== file.id))
    } else {
      setSelectedGDFiles([...selectedGDFiles, file])
    }
  }

  const navigate = useNavigate()

  useEffect(() => {
    if (auth?.user?.role == 3) {
      navigate('/error/404')
    } else {
      getFolderTreeForFile(currentParent)
        .then((response) => {
          setFolderTree(response.data.predecessFolders)
          setLoading(false)
        })
        .catch((err) => {
          console.log(err)
          setLoading(false)
        })
    }
  }, [])

  useEffect(() => {
    if (isBackFromPages) {
      navigate(`${localStorage.getItem('current-url')}`, {
        state: localStorage.getItem('current-parent'),
      })
    }
  }, [isBackFromPages])

  useEffect(() => {
    getMaxFileUploads().then((res) => {
      setMaxFileUploads(Number(res.data))
    })
  })

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

  const isValidFileType = (file: Blob) => {
    const validFileType: any = {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
      'application/pdf': true,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': true,
      'text/plain': true,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': true,
      'application/msword': true,
      'application/vnd.ms-excel': true,
      'image/jpeg': true,
      'image/jpg': true,
      'image/png': true,
      'video/mp4': true,
      'audio/mpeg': true,
      'video/quicktime': true,
      'image/mov': true,
    }
    return validFileType[file.type.toString()] ? true : false
  }

  // handle drag events
  const handleDrag = function (e: any) {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const resetAlerts = () => {
    const success: HTMLElement = document.getElementById('upload-success')!
    const fail: HTMLElement = document.getElementById('upload-fail')!
    if (fail && fail.style) {
      fail.style.display = 'none'
    }
    if (success && success.style) {
      success.style.display = 'none'
    }
  }

  // triggers when file is dropped
  const handleDrop = async function (e: any) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    resetAlerts()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      if (e.dataTransfer.files.length <= maxFileUploads) {
        if (isValidFileType(e.dataTransfer.files[0])) {
          setFiles((prevFiles) => [
            ...prevFiles,
            ...Array.from(e.dataTransfer.files).map((file) => ({
              file,
              source: 'Upload',
            })),
          ])
        } else {
          setUploading(false)
          setFailureResMessage(
            'Invalid file format, only supported format are .doc, .docx, .xlsx, .pdf, .pptx, .txt, mp3, mp4, jpg, jpeg, png and mov'
          )
          setChecked(true)
        }
      } else {
        setUploading(false)
        setFailureResMessage(`Cannot upload More than ${maxFileUploads} files at a time`)
        setChecked(true)
      }
    }
  }

  // triggers when file is selected with click
  const handleChange = async function (e: any) {
    e.preventDefault()
    setUploading('')
    if (e.target.files && e.target.files[0]) {
      if (maxFileUploads >= e.target.files.length) {
        if (isValidFileType(e.target.files[0])) {
          console.log((prevFiles: any) => [
            ...prevFiles,
            ...Array.from(e.target.files).map((file) => ({
              file,
              source: 'Upload',
            })),
          ])
          setFiles((prevFiles) => [
            ...prevFiles,
            ...Array.from(e.target.files).map((file) => ({
              file,
              source: 'Upload',
            })),
          ])
        } else {
          setUploading(false)
          setFailureResMessage(
            'Invalid file format, only supported format are .doc, .docx, .xlsx, .pdf, .pptx, .txt, mp3, mp4, jpg, jpeg, png and mov'
          )
          setChecked(true)
        }
      } else {
        setUploading(false)
        setFailureResMessage(`Cannot upload More than ${maxFileUploads} files at a time`)
        setChecked(true)
      }
    }
  }

  // triggers the input when the button is clicked
  const onButtonClick = () => {
    inputRef.current.click()
  }

  const handleGoToFiles = () => {
    navigate('/files')
    setIsBackFromPages(true)
  }

  const handleDelete = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
  }

  const handleDeleteClick = (i: number) => () => {
    handleDelete(i)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleDrag(e)
    }
  }

  return (
    <>
      {!loading && (
        <>
          <div className='d-flex flex-column w-100 px-4'>
            <div className='d-flex flex-column w-100'>
              <div className='response-box'>
                <div className='directory-path'>
                  <CurrentUploadPath
                    folderTree={folderTree}
                    currentCommunityTitle={currentCommunityTitle}
                  />
                </div>
              </div>
              {uploading ? (
                <>
                  <div className='d-flex justify-content-center' style={{marginTop: '50px'}}>
                    <div className='w-50px h-50px'>
                      <img
                        className='w-50px h-50px'
                        src={toAbsoluteUrl('/media/utils/upload-loading.gif')}
                        alt='Loading'
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div
                    role='button'
                    tabIndex={0}
                    onDragEnter={handleDrag}
                    onKeyDown={handleKeyDown}
                  >
                    <form id='form-file-upload' className='mx-auto mt-5' onSubmit={handleSubmit}>
                      <input
                        ref={inputRef}
                        type='file'
                        id='input-files-upload'
                        multiple={true}
                        onChange={handleChange}
                        style={{display: 'none'}}
                      />
                      <label
                        id='label-file-upload'
                        htmlFor='input-file-upload'
                        className={dragActive ? 'drag-active' : ''}
                      >
                        <div>
                          <span className='fs-2 fw-bold'>
                            <FormattedMessage id='DOCUMENTS.DRAG_AND_DROP.PHRASE1' />
                          </span>
                          <p> (Max {maxFileUploads})</p>
                          <br />
                          <button
                            className='btn btn-sm btn-flex fw-bold btn-primary mt-5'
                            onClick={onButtonClick}
                          >
                            <FormattedMessage id='DOCUMENTS.DRAG_AND_DROP.PHRASE2' />
                          </button>
                          <div className='mt-3'></div>
                        </div>
                      </label>
                      {dragActive && (
                        <div
                          id='drag-file-element'
                          onDragEnter={handleDrag}
                          onDragLeave={handleDrag}
                          onDragOver={handleDrag}
                          onDrop={handleDrop}
                        ></div>
                      )}
                    </form>
                  </div>
                  {files[0] && (
                    <div className={`card h-50 p-4 my-9`}>
                      <div className=' d-flex justify-content-between'>
                        <h6>Uploading {files.length} files:</h6>
                      </div>

                      {files.map((fileData: any, index: number) => (
                        <File
                          key={index}
                          index={index}
                          file={fileData.file}
                          source={
                            fileData?.source && fileData.source.trim() !== ''
                              ? fileData.source
                              : 'local'
                          }
                          currentCommunityId={currentCommunityId}
                          currentParent={currentParent}
                          onDelete={handleDeleteClick(index)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
              <div className='mt-15'></div>
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

              <div className='response-box'>
                {/* {uploading &&
                  <div id='upload-info' className={`alert alert-info show`} >
                    <div className='d-flex justify-content-center'>
                      <p className='my-auto'><FormattedMessage id='DOCUMENTS.UPDATING' /></p>
                    </div>
                  </div>
                }
                <div id='upload-success' className={`alert alert-success show`} style={{ display: "none" }} >
                  <div className='d-flex justify-content-center'>
                    <p id='upload-success-text' className='my-auto'></p>
                  </div>
                </div>

                <div id='upload-fail' className={`alert alert-danger show`} style={{ display: "none" }} >
                  <div className='d-flex justify-content-center'>
                    <p id='upload-fail-text' className='my-auto'></p>
                  </div>
                </div> */}

                <div className='mx-auto'>
                  <button
                    className={'btn btn-sm btn-flex fw-bold btn-primary'}
                    onClick={handleGoToFiles}
                    disabled={uploading == true ? true : false}
                  >
                    <KTIcon iconName='arrow-left' className='fs-2' />
                    <FormattedMessage id='BUTTON.GO_BACK' />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {loading && (
        <div
          className='d-flex justify-content-center'
          style={{marginTop: '50px', marginBottom: '50px'}}
        >
          <div className='w-50px h-50px'>
            <img
              className='w-50px h-50px'
              src={toAbsoluteUrl('/media/utils/upload-loading.gif')}
              alt='Loading'
            />
          </div>
        </div>
      )}
    </>
  )
}
