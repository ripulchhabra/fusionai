import {useEffect} from 'react'
import {FormattedMessage} from 'react-intl'
import {AlertDanger} from '../../alerts/Alerts'
import {CommunityListTableRow} from './CommunityTableRow'
import {DeleteConfirmationBoxForCommunity} from './DeleteConfirmationBox'
import {useAuth} from '../../auth'
import {deleteCommunities, activateCommunity, deactivateCommunity} from '../api'
import {NoOfRecords} from '../../custom/NoOfRecords'
import {Pagination} from '../../custom/Pagination'

const CommunityListTable = (props: any) => {
  const {currentUser, setCommunityList, setCurrentCommunity, currentCommunity} = useAuth()

  useEffect(() => {
    if (props.invitationList) {
      if (props.deleteRecord.length !== props.invitationList.length) {
        props.setSelectedAll(false)
      }
      if (
        props.deleteRecord.length === props.invitationList.length &&
        props.invitationList.length > 0
      ) {
        props.setSelectedAll(true)
      }
    }
  }, [props.deleteRecord])

  const handleChangeSelected = async (id: string) => {
    let newCommunityList: Array<any> = []
    props.communityList.map((community: any) => {
      if (community.id != id) {
        newCommunityList = [...newCommunityList, community]
      } else {
        const newCommunity = community
        const selected = !newCommunity.selected
        newCommunity.selected = selected
        newCommunityList.push(newCommunity)
      }
    })
    props.setCommunityList(newCommunityList)
  }

  const handleChange = async (e: any) => {
    await handleChangeSelected(e.target.value)
    if (e.target.checked) {
      props.setDeleteRecord((record: any) => {
        return [...record, e.target.value]
      })
    } else {
      props.setDeleteRecord((record: any) => {
        const newRecord = record.filter((rec: any) => {
          return rec !== e.target.value
        })
        return newRecord
      })
    }
  }

  const openDialog = (id: string) => {
    const element: HTMLElement = document.getElementById(id)!
    element.style.display = 'block'
  }

  const closeDialog = (id: string) => {
    const element: HTMLElement = document.getElementById(id)!
    element.style.display = 'none'
  }

  const openDialogForSingleDeletion = (id: string) => {
    const element: HTMLElement = document.getElementById(id)!
    element.style.display = 'block'
  }

  const closeDialogForSingleDeletion = (id: string) => {
    const element: HTMLElement = document.getElementById(id)!
    element.style.display = 'none'
  }

  const handleBulkDeletion = () => {
    props.setDeleting(true)
    deleteCommunities(props.deleteRecord, currentUser?.companyId, props.limit)
      .then((response: any) => {
        if (response.data.success) {
          localStorage.setItem('responsesuccessmsg', response.data.message)
          window.location.reload()
        } else {
          if (response.data.message) {
            localStorage.setItem('responsefailuresmsg', response.data.message)
            window.location.reload()
          } else {
            localStorage.setItem('responsefailuresmsg', 'Failed to delete users')
            window.location.reload()
          }
        }
      })
      .then(() => {
        props.setDeleteRecord([])
        closeDialog('delete-communities')
        props.setDeleting(false)
        if (props.selectedAll) {
          props.setSelectedAll(false)
        }
      })
  }

  const handleActivate = (communityId: any) => {
    props.setDeleting(true)
    activateCommunity(communityId, currentUser?.companyId, props.limit, 0, props.searchString)
      .then((response: any) => {
        if (response.data.success) {
          props.setCommunityList(response.data.communityList)
          props.setTotNumOfPage(response.data.totalPageNum)
          props.setNoOfRecords(response.data.noOfRecords)
          setCommunityList(response.data.activeCommunities)
          props.setSelectedPage(1)
          props.setCurrentPage(1)
          props.setSuccessResMessage(response.data.message)
          props.setChecked(true)
        } else {
          if (response.data.message) {
            props.setFailureResMessage(response.data.message)
            props.setChecked(true)
          }
        }
      })
      .then(() => {
        closeDialogForSingleDeletion(`activate-community-${communityId}`)
        props.setDeleting(false)
      })
  }

  const handleDeactivate = (communityId: any) => {
    props.setDeleting(true)
    deactivateCommunity(communityId, currentUser?.companyId, props.limit, 0, props.searchString)
      .then((response: any) => {
        if (response.data.success) {
          if (currentCommunity == communityId) {
            setCurrentCommunity(response.data.activeCommunities[0]['id'])
          }
          props.setCommunityList(response.data.communityList)
          props.setTotNumOfPage(response.data.totalPageNum)
          props.setNoOfRecords(response.data.noOfRecords)
          setCommunityList(response.data.activeCommunities)
          props.setSelectedPage(1)
          props.setCurrentPage(1)
          props.setSuccessResMessage(response.data.message)
          props.setChecked(true)
        } else {
          if (response.data.message) {
            props.setFailureResMessage(response.data.message)
            props.setChecked(true)
          }
        }
      })
      .then(() => {
        closeDialogForSingleDeletion(`deactivate-community-${communityId}`)
        props.setDeleting(false)
      })
  }

  const handleDeactivateClick = (id: string) => () => {
    handleDeactivate(id)
  }

  const handleCloseDeletionDialog = (dialogId: string) => () => {
    closeDialogForSingleDeletion(dialogId)
  }

  const handleActivateClick = (id: string) => () => {
    handleActivate(id)
  }

  const handleOpenDialog = (dialogId: string) => () => {
    openDialog(dialogId)
  }

  return (
    <>
      <div id='community-table' className='card'>
        {props.warnings != '' && (
          <AlertDanger message={props.warnings} checked={props.showWarnings} />
        )}
        {props.deleteRecord.length > 0 && (
          <div className='card-header border-0 pt-6'>
            <div className='card-toolbar'>
              <div className='d-flex justify-content-end'>
                {props.deleteRecord.length > 0 && (
                  <div className='d-flex justify-content-end align-items-center'>
                    <div className='fw-bolder me-5'>
                      <span className='me-2'>{props.deleteRecord.length}</span>Selected
                    </div>
                    <button
                      type='button'
                      onClick={handleOpenDialog('delete-communities')}
                      className='btn btn-danger'
                    >
                      Delete Selected
                    </button>
                  </div>
                )}
                <DeleteConfirmationBoxForCommunity
                  closeDialog={closeDialog}
                  deleting={props.deleting}
                  handleBulkDeletion={handleBulkDeletion}
                />
              </div>
            </div>
          </div>
        )}
        <div className='card-body p-1 p-md-5'>
          <table
            className='table mb-10 align-middle table-row-dashed fs-6 gy-5 px-2'
            id='kt_table_users'
          >
            <thead className='pe-5'>
              <tr className='text-start text-muted fw-bolder fs-7 text-uppercase gs-0 text-md-start'>
                <th className='min-w-50px p-1 p-lg-2'>
                  <FormattedMessage id='COMMUNITY.NAME' />
                </th>
                <th className='min-w-50px p-1 p-lg-2'>
                  <FormattedMessage id='COMMUNITY.STATUS' />
                </th>
                <th className='text-start min-w-50px p-0 p-lg-2'>
                  <FormattedMessage id='COMMUNITY.NO_OF_FILES' />
                </th>
                <th className='text-start min-w-50px p-1 p-lg-2'>
                  <FormattedMessage id='COMMUNITY.LAST_UPDATED' />
                </th>
                <th className='min-w-10px text-end p-1 p-lg-2'>
                  <FormattedMessage id='COMMUNITY.ACTIONS' />
                </th>
              </tr>
            </thead>
            {/* {!props.loading &&  */}
            <tbody className='text-gray-600 fw-bold'>
              <>
                {props.communityList.map((data: any) => (
                  <>
                    <CommunityListTableRow
                      id={data.id}
                      communityName={data.community_name}
                      communityAlias={data.community_alias}
                      active={data.active == 1 ? true : false}
                      street={data.street}
                      noOfFiles={data.noOfFiles}
                      city={data.city}
                      state={data.state}
                      zip={data.zipcode}
                      created={data.updated}
                      updated={data.updated}
                      setShowCommunityUpdateModal={props.setShowCommunityUpdateModal}
                      openDialogForSingleDeletion={openDialogForSingleDeletion}
                      handleChange={handleChange}
                      showUpdateModal={props.showUpdateModal}
                      isShared={currentUser?.companyId !== data.companyId}
                    />

                    <div
                      id={`activate-community-${data.id}`}
                      style={{display: 'none'}}
                      className='modal'
                    >
                      <span
                        onClick={handleCloseDeletionDialog(`activate-community-${data.id}`)}
                        className='close'
                        title='Close Modal'
                      >
                        &times;
                      </span>
                      <form className='modal-content bg-white'>
                        <div className='px-7 py-7'>
                          <h3>
                            <FormattedMessage id='COMMUNITY.ACTIVATE' />
                          </h3>
                          <p className='font-size-15'>
                            <FormattedMessage id='COMMUNITY.ACTIVATE.CONFIRMATION' />
                          </p>

                          <div className='d-flex'>
                            <button
                              onClick={handleCloseDeletionDialog(`activate-community-${data.id}`)}
                              type='button'
                              className='btn btn-primary'
                            >
                              <FormattedMessage id='BUTTON.CANCEL' />
                            </button>
                            <button
                              onClick={handleActivateClick(data.id)}
                              type='button'
                              className='btn btn-danger ms-3'
                            >
                              <FormattedMessage id='BUTTON.ACTIVATE' />
                              {props.deleting && (
                                <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                              )}
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                    <div
                      id={`deactivate-community-${data.id}`}
                      style={{display: 'none'}}
                      className='modal'
                    >
                      <span
                        onClick={handleCloseDeletionDialog(`deactivate-community-${data.id}`)}
                        className='close'
                        title='Close Modal'
                      >
                        &times;
                      </span>
                      <form className='modal-content bg-white'>
                        <div className='px-7 py-7'>
                          <h3>
                            <FormattedMessage id='COMMUNITY.DEACTIVATE' />
                          </h3>
                          <p className='font-size-15'>
                            <FormattedMessage id='COMMUNITY.DEACTIVATE.CONFIRMATION' />
                          </p>

                          <div className='d-flex'>
                            <button
                              onClick={handleCloseDeletionDialog(`deactivate-community-${data.id}`)}
                              type='button'
                              className='btn btn-primary'
                            >
                              <FormattedMessage id='BUTTON.CANCEL' />
                            </button>
                            <button
                              onClick={handleDeactivateClick(data.id)}
                              type='button'
                              className='btn btn-danger ms-3'
                            >
                              <FormattedMessage id='BUTTON.DEACTIVATE' />
                              {props.deleting && (
                                <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                              )}
                            </button>
                          </div>
                          <p className='font-size-15 mt-4'>
                            <FormattedMessage id='COMMUNITY.DEACTIVATE.NOTE' />
                          </p>
                        </div>
                      </form>
                    </div>
                  </>
                ))}
              </>
            </tbody>
            {/* } */}
          </table>
        </div>
      </div>
      {!props.loading && props.noOfRecords > 0 && (
        <div className='px-15 user-pagination mt-5 mb-5'>
          <NoOfRecords
            totalNoOfRecords={props.noOfRecords}
            selectedPage={props.selectedPage}
            limit={props.limit}
            entityName='teams'
          />

          {props.totNumOfPage > 1 && (
            <Pagination
              totalNumberOfPages={props.totNumOfPage}
              fetchNextData={props.fetchNextData}
              selectedPage={props.selectedPage}
              setSelectedPage={props.setSelectedPage}
              currentPage={props.currentPage}
              setCurrentPage={props.setCurrentPage}
            />
          )}
        </div>
      )}
    </>
  )
}

export {CommunityListTable}
