import React, {useState, useRef, useEffect} from 'react'
import {useAuth} from '../../auth'
import {getAllFolders, uploadAudio, getRecordingPromptTime, getRecordingLimit} from '../api'
import Modal from 'react-bootstrap/Modal'
import Button from 'react-bootstrap/Button'
import {FormattedMessage} from 'react-intl'
import {KTIcon} from '../../../../_metronic/helpers'

const AudioRecorder = () => {
  const [recording, setRecording] = useState(false)
  const [audioChunks, setAudioChunks] = useState<Blob[]>([])
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | undefined>(undefined)
  const [duration, setDuration] = useState(0)
  const [recordingPromptTime, setRecordingPromptTime] = useState<number>(1)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [recordingName, setRecordingName] = useState('')
  const [showPromptModal, setShowPromptModal] = useState(false)
  const responseTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const {communityList} = useAuth()
  const [uploading, setUploading] = useState<boolean>(false)
  const [foldersList, setFoldersList] = useState<any[]>([])
  const [folder, setFolder] = useState<string | undefined>('4')
  const [teams, setTeams] = useState<any>([])
  const [team, setTeam] = useState<string | undefined>(undefined)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [showStartRecordingPrompt, setShowStartRecordingPrompt] = useState(false)
  const [currentRecordCount, setCurrentRecordCount] = useState<number>(0)
  const [recordLimit, setRecordLimit] = useState<number>(0)

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (recording) {
        const message = 'Recording is ongoing. Are you sure you want to leave?'
        event.returnValue = message
        return message
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [recording])

  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const promptUser = (delay: number) => {
      timeoutId = setTimeout(() => {
        setShowPromptModal(true)
        responseTimeoutRef.current = setTimeout(
          () => {
            handlePromptResponse(false)
          },
          120 * 60 * 1000
        )
        promptUser(30 * 60 * 1000)
      }, delay)
    }

    if (recording) {
      promptUser(recordingPromptTime * 60 * 1000)
    }

    return () => {
      clearTimeout(timeoutId)
      if (responseTimeoutRef.current) {
        clearTimeout(responseTimeoutRef.current)
      }
    }
  }, [recording, recordingPromptTime])

  const startRecording = () => {
    setShowModal(true)
  }

  const handleStartRecording = (e: any) => {
    e.preventDefault()
    if (team && recordingName !== '') {
      setShowModal(false)
      navigator.mediaDevices
        .getUserMedia({audio: true})
        .then((stream) => {
          const recorder = new MediaRecorder(stream)
          recorder.ondataavailable = (e) => {
            setAudioChunks((prev) => [...prev, e.data])
          }
          recorder.onstart = () => {
            setDuration(0)
            timerRef.current = setInterval(() => {
              setDuration((prev) => prev + 1000)
            }, 1000)
          }
          recorder.start()
          setMediaRecorder(recorder)
          setRecording(true)
          setShowStartRecordingPrompt(true)
        })
        .catch((err) => console.error('Error accessing microphone:', err))
    } else {
      setErrorMessage('Fill all details')
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
      setRecording(false)
      setDuration(0)
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (mediaRecorder.stream) {
        mediaRecorder.stream.getTracks().forEach((track) => track.stop())
      }
    }
  }

  const handleChange = async function () {
    setUploading(true)
    let formData = new FormData()
    const audioFile = new Blob(audioChunks, {type: 'audio/wav'})
    formData.append('file', audioFile)
    formData.append('parentId', folder ? folder : '')
    formData.append('communityId', team ? team : '')
    const fileName = `${recordingName}.wav`

    uploadAudio(team, folder, fileName, formData)
      .then((response) => {
        if (response.data.success) {
          setAudioChunks([])
          setUploading(false)
          window.location.reload()
        } else {
          setAudioChunks([])
          setUploading(false)
        }
      })
      .catch((err) => {
        console.log(err)
        setAudioChunks([])
        setUploading(false)
      })
    setRecordingName('')
  }

  useEffect(() => {
    if (audioChunks.length > 0) {
      handleChange()
    }
  }, [audioChunks])

  useEffect(() => {
    setTimeout(() => {
      if (errorMessage !== '') setErrorMessage('')
    }, 5000)
  }, [errorMessage])

  useEffect(() => {
    if (team) {
      getAllFolders(team).then((res) => {
        setFoldersList(res.data.folders)
      })
    }
  }, [team])

  useEffect(() => {
    setTeams(communityList)
    if (communityList[0]) {
      setTeam(communityList[0].id)
    }
  }, [communityList])

  const handlePromptResponse = (response: boolean) => {
    setShowPromptModal(false)
    if (response) {
      if (responseTimeoutRef.current) {
        clearTimeout(responseTimeoutRef.current)
      }
    } else {
      stopRecording()
    }
  }

  useEffect(() => {
    getRecordingPromptTime()
      .then((res) => {
        setRecordingPromptTime(Number(res.data))
      })
      .catch((err) => {
        console.log(err)
      })
  }, [])

  useEffect(() => {
    if (showModal) {
      getRecordingLimit(team)
        .then((res) => {
          setCurrentRecordCount(res.data.count)
          setRecordLimit(res.data.limit)
        })
        .catch((err) => {
          console.log(err)
        })
    }
  }, [showModal])

  const [showInfo, setShowInfo] = useState(false)

  const handleFolderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFolder(e.target.value)
  }

  const handleTeamChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTeam(e.target.value)
  }

  const handleRecordingNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRecordingName(e.target.value)
  }

  const handleHideInfo = () => {
    setShowInfo(false)
  }

  const handleCloseRecordingPrompt = () => {
    setShowStartRecordingPrompt(false)
  }

  const handleYesResponse = () => handlePromptResponse(true)

  const handleNoResponse = () => {
    handlePromptResponse(false)
  }

  const handleCloseModal = () => {
    setShowModal(false)
  }

  const handleShowInfo = () => {
    setShowInfo(true)
  }

  return (
    <div className='d-flex cursor-pointer px-5'>
      {!recording && audioChunks.length === 0 && (
        <div>
          {communityList.length === 0 ? (
            <span className={`menu-title text-white`}></span>
          ) : (
            <>
              {new URL(process.env.REACT_APP_BACKEND_ORIGIN_URL || 'http://localhost').protocol ===
                'https:' ||
              new URL(process.env.REACT_APP_BACKEND_ORIGIN_URL || 'http://localhost').hostname ===
                'localhost' ? (
                <span onClick={startRecording} className={`menu-title text-white`}>
                  <i className='bi bi-mic text-white fs-4 me-2'></i>Record
                </span>
              ) : (
                <span onClick={handleShowInfo} className={`menu-title text-white`}>
                  <i className='bi bi-mic text-white fs-4 me-2'></i>Record
                </span>
              )}
            </>
          )}
        </div>
      )}
      {recording && (
        <div onClick={stopRecording} className='d-flex align-items-center'>
          <span className='d-flex align-items-center justify-content-center'>
            <span
              className='bullet bullet-dot bg-danger translate-middle animation-blink ms-2 align-self-center'
              style={{height: '12px', width: '12px', position: 'relative', top: '6px'}}
            />
            <span className={`menu-title text-white`}>Recording</span>
          </span>
        </div>
      )}
      {uploading && (
        <div>
          <span className='spinner-border spinner-border-sm align-middle me-2 text-white'></span>
          <span className={`menu-title text-white`}>Uploading</span>
        </div>
      )}
      <Modal
        show={showModal}
        onHide={handleCloseModal}
        id='create_community_modal'
        tabIndex={-1}
        aria-hidden='true'
        dialogClassName='modal-dialog modal-dialog-centered mw-900px'
        backdrop={true}
      >
        <div className='modal-header'>
          <h2>
            <FormattedMessage id='DOCUMENTS.START_RECORDING' />
          </h2>
          <div
            className='btn btn-sm btn-icon btn-active-color-primary'
            onClick={handleCloseModal}
            data-bs-toggle='tooltip'
            title='Close'
          >
            <KTIcon className='fs-1' iconName='cross' />
          </div>
        </div>
        <form onSubmit={handleStartRecording}>
          <Modal.Body>
            <div className='form-group my-2 px-5'>
              <p className='fw-bolder text-dark fs-4 text-end my-2'>
                <FormattedMessage id='COMPANY.PROFILE.USAGE.CURRENT_MONTH_USAGE' /> :{' '}
                {currentRecordCount} / {recordLimit} <FormattedMessage id='DOCUMENTS.RECORDINGS' />
              </p>
              <label htmlFor='recordingName' className='fw-bolder text-dark fs-4 required my-2'>
                <FormattedMessage id='DOCUMENTS.RECORDING_NAME' />
              </label>
              <input
                type='text'
                placeholder='Recording Name'
                className='form-control'
                id='recordingName'
                value={recordingName}
                onChange={handleRecordingNameChange}
                required
              />
            </div>
            <div className='form-group my-2 p-5'>
              <label htmlFor='team' className='fw-bolder text-dark fs-4 my-2'>
                Team
              </label>
              <select
                className='form-select'
                id='tean'
                value={team}
                onChange={handleTeamChange}
                required
              >
                {teams.map((team: any) => (
                  <option key={team.id} value={team.id}>
                    {team.community_name}
                  </option>
                ))}
              </select>
            </div>
            {team && (
              <div className='form-group my-2 px-5 pb-5'>
                <label htmlFor='collection' className='fw-bolder text-dark fs-4'>
                  Folder
                </label>
                <select
                  className='form-select'
                  id='collection'
                  value={folder}
                  onChange={handleFolderChange}
                  required
                >
                  <option value='4'>Select a Folder</option>
                  {foldersList.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {errorMessage !== '' && (
              <p className='text-center text-danger mt-5 p-1 border border-danger rounded'>
                {errorMessage}
              </p>
            )}
          </Modal.Body>
          <Modal.Footer className='d-flex justify-content-center w-100'>
            <Button
              variant='primary'
              type='submit'
              className='w-50'
              disabled={recordingName == '' || !team || currentRecordCount >= recordLimit}
            >
              Start Recording
            </Button>
          </Modal.Footer>
        </form>
      </Modal>

      <Modal show={showPromptModal} onHide={handleNoResponse}>
        <Modal.Header>
          <Modal.Title>Continue Recording?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <FormattedMessage id='DOCUMENTS.RECORDING_PROMPT_1' /> {Math.floor(duration / 60000)}
          <FormattedMessage id='DOCUMENTS.RECORDING_PROMPT_2' />
        </Modal.Body>
        <Modal.Footer>
          <Button variant='secondary' onClick={handleNoResponse}>
            No
          </Button>
          <Button variant='primary' onClick={handleYesResponse}>
            Yes
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showStartRecordingPrompt} onHide={handleCloseRecordingPrompt}>
        <Modal.Header>
          <Modal.Title>
            <span className='fw-bolder text-dark fs-3'>Recording Started</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <span className='fw-bolder text-dark fs-4'>
            <FormattedMessage id='DOCUMENTS.RECORDING_INSTRUCTION' />
          </span>
        </Modal.Body>
        <Modal.Footer>
          <Button variant='primary' onClick={handleCloseRecordingPrompt}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showInfo} onHide={handleHideInfo}>
        <Modal.Header>
          <Modal.Title>
            <span className='fw-bolder text-dark fs-3'>
              The recording feature works on a secure protocol.
            </span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Footer>
          <Button variant='primary' onClick={handleHideInfo}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export {AudioRecorder}
