import {FC} from 'react'
import {FormattedMessage} from 'react-intl'

const InvalidToken: FC = () => {
  return (
    <>
      {/* begin::Title */}
      <h1 className='fw-bolder fs-2qx text-gray-900 mb-4'>
        <FormattedMessage id='INVITATION.INVALID_TOKEN' />
      </h1>
      {/* end::Title */}

      {/* begin::Text */}
      <div className='fw-semibold fs-6 text-gray-500 mb-7'>
        <FormattedMessage id='INVITATION.INVALID_TOKEN.SUB' />
      </div>
      {/* end::Text */}
    </>
  )
}

export {InvalidToken}
