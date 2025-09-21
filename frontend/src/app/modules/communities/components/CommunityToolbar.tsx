import {FormattedMessage} from 'react-intl'
import {KTIcon} from '../../../../_metronic/helpers'

const CommunityToolbar = (props: any) => {
  const handleOpenCreateCommunityModal = () => {
    props.setShowCreateCommunityModal(true)
  }

  return (
    <div className='d-flex justify-content-end' data-kt-user-table-toolbar='base'>
      {/* begin::Add user */}
      <button type='button' className='btn btn-primary' onClick={handleOpenCreateCommunityModal}>
        <KTIcon iconName='plus' className='fs-2' />
        <FormattedMessage id='BUTTON.CREATE_COMMUNITY' />
      </button>
      {/* end::Add user */}
    </div>
  )
}

export {CommunityToolbar}
