import {useAuth} from '../../auth'
import {CommunitySearchComponent} from './CommunitySearchComponent'
import {CommunityToolbar} from './CommunityToolbar'

const CommunityListHeader = (props: any) => {
  const {currentUser} = useAuth()

  return (
    <div className='card-header border-0 pt-6 px-3'>
      <CommunitySearchComponent
        searchString={props.searchString}
        handleSearchBarChange={props.handleSearchBarChange}
        noOfRecords={props.noOfRecords}
      />
      {currentUser?.role === 1 && (
        <div className='card-toolbar'>
          <CommunityToolbar
            noOfRecords={props.noOfRecords}
            setShowCreateCommunityModal={props.setShowCreateCommunityModal}
          />
        </div>
      )}
    </div>
  )
}

export {CommunityListHeader}
