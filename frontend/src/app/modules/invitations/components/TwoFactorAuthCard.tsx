import {FormattedMessage} from 'react-intl'
import {KTIcon} from '../../../../_metronic/helpers'
import {enableUser2FAOptionForAdmin, disableUser2FAOptionForAdmin} from '../api'

export const TwoFactorAuthCard = (props: any) => {
  const enableUser2FA = () => {
    enableUser2FAOptionForAdmin(props.userID)
      .then((response) => {
        if (response.data.success) {
          props.setUserDetail((user: any) => {
            let updated = user
            updated.twoFactorAuth = true
            return updated
          })
          props.setSuccessResMessage(response.data.message)
          props.setChecked(true)
        } else {
          props.setFailureResMessage(response.data.message)
          props.setChecked(true)
        }
      })
      .catch((err) => {
        console.log(err)
        props.setFailureResMessage('Failed to enable 2FA due to internal error')
        props.setChecked(true)
      })
  }

  const disableUser2FA = () => {
    disableUser2FAOptionForAdmin(props.userID)
      .then((response) => {
        if (response.data.success) {
          props.setUserDetail((user: any) => {
            let updated = user
            updated.twoFactorAuth = false
            return updated
          })
          props.setSuccessResMessage(response.data.message)
          props.setChecked(true)
        } else {
          props.setFailureResMessage(response.data.message)
          props.setChecked(true)
        }
      })
      .catch((err) => {
        console.log(err)
        props.setFailureResMessage('Failed to disable 2FA due to internal error')
        props.setChecked(true)
      })
  }

  return (
    <>
      <div className='card pt-4 pb-6 mb-xl-9'>
        <div className='card-header border-0'>
          <div className='card-title'>
            <h2>
              <FormattedMessage id='COMPANY.PROFILE.2FA' />
            </h2>
          </div>
        </div>
        <div className='card-body pt-0 pb-5'>
          <div className='notice d-flex bg-light-primary rounded border-primary border border-dashed p-6'>
            <KTIcon iconName='shield-tick' className='fs-2tx text-primary me-4' />
            <div className='d-flex flex-stack flex-grow-1 flex-wrap flex-md-nowrap'>
              <div className='mb-3 mb-md-0 fw-bold'>
                <h4 className='text-gray-800 fw-bolder'>
                  <FormattedMessage id='PROFILE.SECURE_USER_ACCOUNT' />
                </h4>
                <div className='fs-6 text-gray-600 pe-7'>
                  Two-factor authentication adds an extra layer of security to the user accounts. To
                  log in, in addition, the user needs to provide a 4 digit code
                </div>
              </div>

              {props.userDetail.twoFactorAuth && (
                <button className='btn btn-secondary me-2 px-6' onClick={disableUser2FA}>
                  <FormattedMessage id='PROFILE.DISABLE' />
                </button>
              )}
              {!props.userDetail.twoFactorAuth && (
                <button className='btn btn-primary me-2 px-6' onClick={enableUser2FA}>
                  <FormattedMessage id='PROFILE.ENABLE' />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
