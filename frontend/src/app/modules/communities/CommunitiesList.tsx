import {useState, useEffect} from 'react'
import {KTCard} from '../../../_metronic/helpers'
import {CommunityListHeader} from './components/CommunityListHeader'
import {CommunityListTable} from './components/CommunityTable'
import {CreateCommunity} from './components/CreateCommunity'
import {useAuth} from '../auth'
import {AlertDanger, AlertSuccess} from '../alerts/Alerts'
import {EditCommunity} from './components/EditCommunity'
import {getCommunityList, getSharedCommunityList} from './api'

const CommunityList = () => {
  const [loading, setLoading] = useState<boolean>(true)
  const [showCreateCommunityModal, setShowCreateCommunityModal] = useState<boolean>(false)
  const [showCommunityUpdateModal, setShowCommunityUpdateModal] = useState<boolean>(false)

  const [offset] = useState<number>(0)
  const [limit] = useState<number>(10)
  const [communityList, setCommunityList] = useState<Array<any>>([])
  const [sharedCommunityList, setSharedCommunityList] = useState<Array<any>>([])
  const {currentUser, setCurrentParent} = useAuth()
  const [selectedPage, setSelectedPage] = useState<any>(1)
  const [currentPage, setCurrentPage] = useState<any>(1)
  const [totNumOfPage, setTotNumOfPage] = useState<any>(0)
  const [noOfRecords, setNoOfRecords] = useState<any>(0)
  const [warnings, setWarnings] = useState<string>('')
  const [searchString, setSearchString] = useState<string>('')
  const [successResMessage, setSuccessResMessage] = useState<string>('')
  const [failureResMessage, setFailureResMessage] = useState<string>('')
  const [checked, setChecked] = useState<boolean>(true)
  const [checked1, setChecked1] = useState<boolean>(true)
  const [deleteRecord, setDeleteRecord] = useState<Array<string>>([])
  const [selectedAll, setSelectedAll] = useState<boolean>(false)
  const [deleting, setDeleting] = useState<boolean>(false)
  const [comIdToEdit, setComIdToEdit] = useState<any>(null)
  const [currentCommDataToEdit, setCurrentCommDataToEdit] = useState<any>({})

  let responseSuccessMessage = localStorage.getItem('responsesuccessmsg')
  let responseFailureMessage = localStorage.getItem('responsefailuresmsg')

  const [resSuccessMessage, setResSuccessMessage] = useState(responseSuccessMessage)
  const [resFailureMessage, setResFailureMessage] = useState(responseFailureMessage)

  if (warnings != '') {
    setTimeout(() => {
      setTimeout(() => {
        setWarnings('')
      }, 300)
    }, 5000)
  }

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

  if (responseSuccessMessage) {
    setTimeout(() => {
      localStorage.removeItem('responsesuccessmsg')
      setChecked1(false)
      setTimeout(() => {
        setResSuccessMessage('')
      }, 300)
    }, 5000)
  }

  if (responseFailureMessage) {
    setTimeout(() => {
      localStorage.removeItem('responsefailuresmsg')
      setChecked1(false)
      setTimeout(() => {
        setResFailureMessage('')
      }, 300)
    }, 5000)
  }

  useEffect(() => {
    if (searchString?.length > 2) {
      getCommunityList(searchString, currentUser?.companyId, offset, limit)
        .then((response) => {
          if (response.data.success) {
            let final: any[] = []
            response.data.communityList.forEach((a: any) => {
              a['isShared'] = false
              final = [...final, a]
            })
            setCommunityList([...final])
            setTotNumOfPage(response.data.totalPageNum)
            setNoOfRecords(response.data.noOfRecords + sharedCommunityList.length)
            setSelectedPage(1)
            setCurrentPage(1)
            setLoading(false)
          }
        })
        .catch((err) => {
          console.log(err)
        })
    } else if (searchString.length === 0) {
      getCommunityList('', currentUser?.companyId, offset, limit)
        .then((response) => {
          if (response.data.success) {
            let final: any[] = []
            response.data.communityList.forEach((a: any) => {
              a['isShared'] = false
              final = [...final, a]
            })
            setCommunityList([...final, ...sharedCommunityList])
            setTotNumOfPage(response.data.totalPageNum)
            setNoOfRecords(response.data.noOfRecords + sharedCommunityList.length)
            setSelectedPage(1)
            setCurrentPage(1)
            setLoading(false)
          }
        })
        .catch((err) => {
          console.log(err)
        })
    }
  }, [searchString, sharedCommunityList])

  useEffect(() => {
    getSharedCommunityList()
      .then((res) => {
        let final: any[] = []
        res.data.sharedCommunityList.forEach((a: any) => {
          a['isShared'] = true
          final = [...final, a]
        })
        setSharedCommunityList([...communityList, ...final])
      })
      .catch((err) => {
        console.log(err)
      })
  }, [])

  const handleChangeSelection = (id: string, selectOption: boolean) => {
    const findCommunity = communityList.find((community: any) => {
      return community.id === id
    })
    findCommunity.selected = selectOption
    return findCommunity
  }

  const fetchNextData = (pageNum: any) => {
    if (pageNum > 0 && pageNum <= totNumOfPage) {
      setLoading(true)
      if (deleteRecord.length > 0) {
        setSelectedAll(false)
        const newCommunityList: Array<any> = []
        communityList.map((community: any) => {
          newCommunityList.push(handleChangeSelection(community.id, false))
        })
        setCommunityList([...sharedCommunityList, ...newCommunityList])
        setDeleteRecord([])
      }
      const skip = (parseInt(pageNum) - 1) * limit

      getCommunityList(searchString, currentUser?.companyId, skip, limit).then((response) => {
        if (response.data.success) {
          let final: any[] = []
          response.data.communityList.forEach((a: any) => {
            a['isShared'] = false
            final = [...final, a]
          })
          setCommunityList([...sharedCommunityList, ...final])
          setTotNumOfPage(response.data.totalPageNum)
          setNoOfRecords(response.data.noOfRecords + sharedCommunityList.length)
          setLoading(false)
          setSelectedPage(pageNum)
          setCurrentPage(pageNum)
        }
      })
    } else {
      setWarnings('Invalid page number provided, please check it.')
    }
  }

  const handleSearchBarChange = (event: any) => {
    setSearchString(event.target.value)
  }

  const getCommmunityDetail = (id: any) => {
    return new Promise<any>((resolve, reject) => {
      try {
        const findCommunity = communityList.find((community: any) => {
          return community.id === id
        })

        resolve(findCommunity)
      } catch (error) {
        reject(error)
      }
    })
  }

  const showUpdateModal = (cid: any) => {
    setComIdToEdit(cid)
    getCommmunityDetail(cid)
      .then((comData: any) => {
        if (comData) {
          setCurrentCommDataToEdit(comData)
        }
      })
      .then(() => setShowCommunityUpdateModal(true))
  }

  useEffect(() => {
    setCurrentParent(4)
  }, [])

  const handleCloseCommunityModal = () => {
    setShowCommunityUpdateModal(false)
  }

  const handleCloseCreateCommunityModal = () => {
    setShowCreateCommunityModal(false)
  }

  return (
    <div style={{minWidth: '375px'}}>
      {successResMessage !== undefined && successResMessage !== null && successResMessage !== '' ? (
        <AlertSuccess message={successResMessage} checked={checked} />
      ) : null}

      {failureResMessage !== undefined && failureResMessage !== null && failureResMessage !== '' ? (
        <AlertDanger message={failureResMessage} checked={checked} />
      ) : null}

      {resSuccessMessage !== null && resSuccessMessage !== undefined && resSuccessMessage !== '' ? (
        <AlertSuccess message={resSuccessMessage} checked={checked1} />
      ) : null}

      {resFailureMessage !== null && resFailureMessage !== undefined && resFailureMessage !== '' ? (
        <AlertDanger message={resFailureMessage} checked={checked1} />
      ) : null}

      <KTCard>
        <CommunityListHeader
          setShowCreateCommunityModal={setShowCreateCommunityModal}
          handleSearchBarChange={handleSearchBarChange}
          searchString={searchString}
        />
        <CommunityListTable
          loading={loading}
          showCreateCommunityModal={showCreateCommunityModal}
          setShowCreateCommunityModal={setShowCreateCommunityModal}
          showCommunityUpdateModal={showCommunityUpdateModal}
          setShowCommunityUpdateModal={setShowCommunityUpdateModal}
          communityList={communityList}
          setCommunityList={setCommunityList}
          totNumOfPage={totNumOfPage}
          setTotNumOfPage={setTotNumOfPage}
          selectedPage={selectedPage}
          setSelectedPage={setSelectedPage}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          successResMessage={successResMessage}
          setSuccessResMessage={setSuccessResMessage}
          failureResMessage={failureResMessage}
          setFailureResMessage={setFailureResMessage}
          deleteRecord={deleteRecord}
          setDeleteRecord={setDeleteRecord}
          selectedAll={selectedAll}
          setSelectedAll={setSelectedAll}
          deleting={deleting}
          setDeleting={setDeleting}
          limit={limit}
          setChecked={setChecked}
          setChecked1={setChecked1}
          setResSuccessMessage={setResSuccessMessage}
          setResFailureMessage={setResFailureMessage}
          setNoOfRecords={setNoOfRecords}
          noOfRecords={noOfRecords}
          fetchNextData={fetchNextData}
          showUpdateModal={showUpdateModal}
          searchString={searchString}
        />
      </KTCard>
      <CreateCommunity
        show={showCreateCommunityModal}
        handleClose={handleCloseCreateCommunityModal}
        offset={offset}
        limit={limit}
        setSuccessResMessage={setSuccessResMessage}
        setFailureResMessage={setFailureResMessage}
        setChecked={setChecked}
        _setCommunityList={setCommunityList}
        setSelectedPage={setSelectedPage}
        setCurrentPage={setCurrentPage}
        setTotNumOfPage={setTotNumOfPage}
        setNoOfRecords={setNoOfRecords}
      />
      <EditCommunity
        show={showCommunityUpdateModal}
        handleClose={handleCloseCommunityModal}
        currentCommDataToEdit={currentCommDataToEdit}
        comIdToEdit={comIdToEdit}
        offset={offset}
        limit={limit}
        setSuccessResMessage={setSuccessResMessage}
        setFailureResMessage={setFailureResMessage}
        setChecked={setChecked}
        _setCommunityList={setCommunityList}
        selectedPage={selectedPage}
        searchString={searchString}
      />
    </div>
  )
}

export default CommunityList
