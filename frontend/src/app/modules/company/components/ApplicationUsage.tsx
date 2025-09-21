import React, {useState, useEffect} from 'react'
import {useAuth} from '../../auth'
import {getCompanyUsage} from '../../document-management/api'
import {FormattedMessage} from 'react-intl'
import {useAppContext} from '../../../pages/AppContext/AppContext'

const ApplicationUsage: React.FC = () => {
  const {currentUser} = useAuth()
  const {appData} = useAppContext()
  const [loading, setLoading] = useState(true)
  const [noOfQueries, setNoOfQueries] = useState<any>('')
  const [noOfUsers, setNoOfUsers] = useState<any>('')
  const [storageUsage, setStorageUsage] = useState<any>('')
  const [recordingCount, setRecordingCount] = useState<number>(0)
  const [recordingLimit, setRecordingLimit] = useState<number>(0)

  useEffect(() => {
    getCompanyUsage(currentUser?.companyId).then((response) => {
      if (response.data.success) {
        const queryCount = response?.data?.clientStatistics?.currentQueriesCount
        setNoOfQueries(queryCount)
        setNoOfUsers(response.data.clientStatistics.userDetails.length)
        setStorageUsage(response.data.clientStatistics.totalStorage)
        setRecordingCount(response.data.clientStatistics.recordingDetails.count)
        setRecordingLimit(response.data.clientStatistics.recordingDetails.limit)
        setLoading(false)
      }
    })
  }, [])

  return (
    <div className='card mb-5 mb-xl-10'>
      <div
        className='card-header border-0 cursor-pointer'
        role='button'
        data-bs-toggle='collapse'
        data-bs-target='#kt_account_notifications'
        aria-expanded='true'
        aria-controls='kt_account_notifications'
      >
        <div className='card-title m-0'>
          <h3 className='fw-bolder m-0'>
            <FormattedMessage id='COMPANY.PROFILE.USAGE.TITLE' />
          </h3>
        </div>
      </div>

      <div id='kt_account_notifications' className='collapse show'>
        <form className='form'>
          <div className='card-body border-top px-9 pt-3 pb-4'>
            <div className='table-responsive'>
              <table className='table table-row-dashed border-gray-300 align-middle gy-6'>
                <tbody className='fs-6 fw-bold'>
                  <tr>
                    <td className='min-w-250px fs-4 fw-bolder'>
                      <FormattedMessage id='COMPANY.PROFILE.USAGE.SUBTITLE' />
                    </td>
                    <td className='w-125px'>
                      <div className='form-check form-check-solid'>
                        <label
                          className='form-check-label ps-2'
                          htmlFor='kt_settings_notification_email'
                        >
                          <FormattedMessage id='COMPANY.PROFILE.USAGE.USED' />
                        </label>
                      </div>
                    </td>
                    <td className='w-125px'>
                      <div className='form-check form-check-solid'>
                        <label
                          className='form-check-label ps-2'
                          htmlFor='kt_settings_notification_phone'
                        >
                          <FormattedMessage id='COMPANY.PROFILE.USAGE.LIMIT' />
                        </label>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td>
                      <FormattedMessage id='COMPANY.PROFILE.USAGE.NO_OF_QUERIES' />
                    </td>
                    <td>
                      {!loading && (
                        <div className='form-check form-check-solid'>
                          <label className='form-check-label ps-2'>{noOfQueries}</label>
                        </div>
                      )}
                      {loading && (
                        <div className='form-check form-check-solid'>
                          <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                        </div>
                      )}
                    </td>
                    <td>
                      {!loading && (
                        <div className='form-check form-check-solid'>
                          <label className='form-check-label ps-2'>{appData.maxQuery}</label>
                        </div>
                      )}
                      {loading && (
                        <div className='form-check form-check-solid'>
                          <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                        </div>
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td>
                      <FormattedMessage id='COMPANY.PROFILE.USAGE.NO_OF_USERS' />
                    </td>
                    <td>
                      {!loading && (
                        <div className='form-check form-check-solid'>
                          <label className='form-check-label ps-2'>{noOfUsers}</label>
                        </div>
                      )}
                      {loading && (
                        <div className='form-check form-check-solid'>
                          <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                        </div>
                      )}
                    </td>
                    <td>
                      {!loading && (
                        <div className='form-check form-check-solid'>
                          <label className='form-check-label ps-2'>{appData.maxUsers}</label>
                        </div>
                      )}
                      {loading && (
                        <div className='form-check form-check-solid'>
                          <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                        </div>
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td>
                      <FormattedMessage id='COMPANY.PROFILE.USAGE.STORAGE' />
                    </td>
                    <td>
                      {!loading && (
                        <div className='form-check form-check-solid'>
                          <label className='form-check-label ps-2'>{storageUsage}</label>
                        </div>
                      )}
                      {loading && (
                        <div className='form-check form-check-solid'>
                          <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                        </div>
                      )}
                    </td>
                    <td>
                      {!loading && (
                        <div className='form-check form-check-solid'>
                          <label className='form-check-label ps-2'>{appData.maxStorage} GB</label>
                        </div>
                      )}
                      {loading && (
                        <div className='form-check form-check-solid'>
                          <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                        </div>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <FormattedMessage id='COMPANY.PROFILE.USAGE.NO_OF_RECORDINGS' />
                    </td>
                    <td>
                      {!loading && (
                        <div className='form-check form-check-solid'>
                          <label className='form-check-label ps-2'>{recordingCount}</label>
                        </div>
                      )}
                      {loading && (
                        <div className='form-check form-check-solid'>
                          <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                        </div>
                      )}
                    </td>
                    <td>
                      {!loading && (
                        <div className='form-check form-check-solid'>
                          <label className='form-check-label ps-2'>{recordingLimit}</label>
                        </div>
                      )}
                      {loading && (
                        <div className='form-check form-check-solid'>
                          <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                        </div>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export {ApplicationUsage}
