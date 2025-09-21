/* eslint-disable react-hooks/exhaustive-deps */
import {KTIcon} from '../../../../_metronic/helpers'

const InvitationSearchComponent = (props: any) => {
  return (
    <div className='card-title'>
      <div className='user-manager-header'>
        {/* begin::Search */}
        <div className='d-flex align-items-center position-relative my-1'>
          <KTIcon iconName='magnifier' className='fs-1 position-absolute ms-6' />
          <input
            type='text'
            data-kt-user-table-filter='search'
            className='form-control form-control-solid w-250px ps-14'
            placeholder='Search user (min 3 chars)'
            value={props.searchString}
            onChange={props.handleSearchBarChange}
          />
        </div>
        {/* end::Search */}
      </div>
    </div>
  )
}

export {InvitationSearchComponent}
