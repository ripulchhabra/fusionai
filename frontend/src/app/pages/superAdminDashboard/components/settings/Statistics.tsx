import {KTCard, KTIcon, toAbsoluteUrl} from '../../../../../_metronic/helpers'
import {useEffect, useState} from 'react'
import {
  getClientStatistics,
  getCompanyStatistics,
  getLastMonthData,
  getRecordingCount,
  insertLastMonthData,
} from '../../api'
import {useLocation, useNavigate} from 'react-router-dom'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

interface MonthlyCount {
  year: number
  month: number
  queryCount?: number
  tokenSum?: number
  communityCount?: number
  userCount?: number
  storageUsed?: string
}

const Statistics = () => {
  const {state}: any = useLocation()
  const navigate = useNavigate()
  const [clientList, setClientList] = useState<any>([])
  const [dataByMonth, setDataByMonth] = useState<any>([])
  const [filteredClients, setFilteredClients] = useState<any>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonthYear, setSelectedMonthYear] = useState<{
    month: number | null
    year: number | null
  }>({month: null, year: null})
  const [selectedDate, setSelectedDate] = useState(new Date())
  const minDate = new Date(clientList?.companyDetails?.created)
  const maxDate = new Date()

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (state?.data == 'team') {
          const data: any = await getCompanyStatistics(state?.companyId)
          setClientList(data?.data?.clientStatistics)
        } else {
          const data: any = await getClientStatistics(state?.userId)
          setClientList(data?.data?.clientStatistics)
        }
      } catch (error) {
        console.error('Error fetching user role:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  useEffect(() => {
    const fetchLastMonthData = async () => {
      try {
        const data: any = await getLastMonthData(state?.companyId)
        setDataByMonth(data?.data?.res)
      } catch (error) {
        console.error('Error fetching user role:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLastMonthData()
  }, [])

  useEffect(() => {
    const currentDate = new Date()
    const firstDayOfNextMonth = new Date(currentDate)
    firstDayOfNextMonth.setMonth(firstDayOfNextMonth.getMonth() + 1)
    firstDayOfNextMonth.setDate(1)

    if (Object.keys(filteredClients).length > 0) {
      const tokenCount = getTokensByMonth(clientList?.tokenDetails)
      const queryCount = getQueryByMonth(clientList?.queryDetails)
      const communityCount = getDataByMonth(clientList?.communityDetails)
      const userCount = getDataByMonth(clientList?.userDetails)
      const storageCount = getStorageByMonth(clientList?.storageDetails)
      const mergeCount = mergeCounts(
        queryCount,
        tokenCount,
        communityCount,
        userCount,
        storageCount
      )

      let filteredMergeCount = mergeCount.filter((item: any) => {
        const matchingEntry = dataByMonth.find(
          (dataItem: any) =>
            dataItem.statId == clientList?.companyDetails?.companyId &&
            dataItem.monthName == getMonthName(item.month) &&
            dataItem.year == item.year
        )

        return !matchingEntry
      })

      filteredMergeCount.sort((a, b) => {
        if (a.year !== b.year) {
          return a.year - b.year
        } else {
          return a.month - b.month
        }
      })

      filteredMergeCount.map(async (item: any) => {
        try {
          const date = new Date(item?.year, item?.month - 1, 1)
          const recording = await getRecordingCount(clientList?.companyDetails?.companyId, date)
          const recordingCount = recording.data.count + ''
          const lastMonthData = {
            statId: clientList?.companyDetails?.companyId,
            name:
              state?.data === 'team'
                ? state?.companyName
                : `${clientList?.userDetails?.firstname} ${clientList?.userDetails?.lastname}`,
            plan: state?.data === 'solo' ? clientList?.userDetails?.accountType : 'team',
            numberofCollections: item?.communityCount ? item.communityCount : '0',
            numberofUsers: item?.userCount ? item.userCount : '0',
            storageUsed: item?.storageUsed ? item.storageUsed : '0 Bytes',
            numberofQueries: item?.queryCount ? item.queryCount : '0',
            recordingCount: recordingCount ? recordingCount : '0',
            monthName: getMonthName(item?.month),
            year: item?.year,
          }

          insertLastMonthData(lastMonthData)
        } catch (e) {
          console.log(e)
        }
      })
    }
  }, [filteredClients])

  const getTokensByMonth = (tokenDetails: any[]) => {
    if (!tokenDetails || !Array.isArray(tokenDetails)) {
      return []
    }

    const sumByMonth: {[key: string]: number} = {}
    const currentDate = new Date()
    const currentYear = currentDate.getFullYear()
    const currentMonth = currentDate.getMonth()

    tokenDetails.forEach((tokenDetail) => {
      const tokenDate = new Date(tokenDetail.created)
      const year = tokenDate.getFullYear()
      const month = tokenDate.getMonth()

      if (!(year === currentYear && month === currentMonth)) {
        const key = `${year}-${month + 1}`

        if (!sumByMonth[key]) {
          sumByMonth[key] = tokenDetail.token
        } else {
          sumByMonth[key] += tokenDetail.token
        }
      }
    })

    const result = Object.entries(sumByMonth).map(([key, sum]) => {
      const [year, month] = key.split('-')
      return {
        year: parseInt(year),
        month: parseInt(month),
        sum: sum,
      }
    })

    return result
  }

  const getQueryByMonth = (details: any[]) => {
    if (!details || !Array.isArray(details)) {
      return []
    }

    const countsByMonth: {[key: string]: number} = {}
    const currentDate = new Date()
    const currentYear = currentDate.getFullYear()
    const currentMonth = currentDate.getMonth()

    details.forEach((item) => {
      const itemDate = new Date(item.created)
      const year = itemDate.getFullYear()
      const month = itemDate.getMonth()

      if (!(year === currentYear && month === currentMonth)) {
        const key = `${year}-${month + 1}`

        if (!countsByMonth[key]) {
          countsByMonth[key] = 1
        } else {
          countsByMonth[key]++
        }
      }
    })

    const result = Object.entries(countsByMonth).map(([key, count]) => {
      const [year, month] = key.split('-')
      return {
        year: parseInt(year),
        month: parseInt(month),
        count: count,
      }
    })

    return result
  }

  const getStorageByMonth = (storageDetails: any[]) => {
    if (!storageDetails || !Array.isArray(storageDetails)) {
      return []
    }

    const sumByMonth: {[key: string]: number} = {}
    const currentDate = new Date()
    const currentYear = currentDate.getFullYear()
    const currentMonth = currentDate.getMonth()

    let minYear = currentYear
    let minMonth = currentMonth

    storageDetails.forEach((storageDetail) => {
      const storageDate = new Date(storageDetail.created)
      const year = storageDate.getFullYear()
      const month = storageDate.getMonth()

      if (year < minYear || (year === minYear && month < minMonth)) {
        minYear = year
        minMonth = month
      }

      if (!(year === currentYear && month === currentMonth)) {
        for (let y = minYear; y <= currentYear; y++) {
          const startMonth = y === minYear ? minMonth : 0
          const endMonth = y === currentYear ? currentMonth - 1 : 11

          for (let m = startMonth; m <= endMonth; m++) {
            const key = `${y}-${m + 1}`

            if (!sumByMonth[key]) {
              sumByMonth[key] = storageDetail.size
            } else {
              sumByMonth[key] += storageDetail.size
            }
          }
        }
      }
    })

    const result = Object.entries(sumByMonth).map(([key, sum]) => {
      const [year, month] = key.split('-')
      return {
        year: parseInt(year),
        month: parseInt(month),
        sum: sum,
      }
    })

    return result
  }

  const getDataByMonth = (details: any[]) => {
    if (!details || !Array.isArray(details)) {
      return []
    }

    const countsByMonth: {[key: string]: number} = {}
    const currentDate = new Date()
    const currentYear = currentDate.getFullYear()
    const currentMonth = currentDate.getMonth()

    let minYear = currentYear
    let minMonth = currentMonth

    details.forEach((item) => {
      const itemDate = new Date(item.created)
      const year = itemDate.getFullYear()
      const month = itemDate.getMonth()

      if (year < minYear || (year === minYear && month < minMonth)) {
        minYear = year
        minMonth = month
      }

      if (!(year === currentYear && month === currentMonth)) {
        for (let y = minYear; y <= currentYear; y++) {
          const startMonth = y === minYear ? minMonth : 0
          const endMonth = y === currentYear ? currentMonth - 1 : 11

          for (let m = startMonth; m <= endMonth; m++) {
            const key = `${y}-${m + 1}`

            if (!countsByMonth[key]) {
              countsByMonth[key] = 1
            } else {
              countsByMonth[key]++
            }
          }
        }
      }
    })

    const result = Object.entries(countsByMonth).map(([key, count]) => {
      const [year, month] = key.split('-')
      return {
        year: parseInt(year),
        month: parseInt(month),
        count: count,
      }
    })

    return result
  }

  const formatFileSize = (bytes: any) => {
    if (bytes == 0) return '0 Bytes'
    const k = 1000,
      decimalPoint = 2,
      sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
      i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimalPoint)) + ' ' + sizes[i]
  }

  const getMonthName = (monthNumber: number): string => {
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ]

    if (monthNumber >= 1 && monthNumber <= 12) {
      return monthNames[monthNumber - 1]
    } else {
      return 'Invalid Month'
    }
  }

  const mergeCounts = (
    queryCount: any[],
    tokenCount: any[],
    communityCount: any[],
    userCount: any[],
    storageCount: any[]
  ): MonthlyCount[] => {
    const mergedCounts: MonthlyCount[] = []

    queryCount.forEach((queryEntry) => {
      mergedCounts.push({
        year: queryEntry.year,
        month: queryEntry.month,
        queryCount: Math.floor(queryEntry.count / 2),
      })
    })

    tokenCount.forEach((tokenEntry) => {
      const existingEntry = mergedCounts.find(
        (entry) => entry.year === tokenEntry.year && entry.month === tokenEntry.month
      )

      if (existingEntry) {
        existingEntry.tokenSum = tokenEntry.sum
      } else {
        mergedCounts.push({
          year: tokenEntry.year,
          month: tokenEntry.month,
          tokenSum: tokenEntry.sum,
        })
      }
    })

    communityCount.forEach((communityEntry) => {
      const existingEntry = mergedCounts.find(
        (entry) => entry.year === communityEntry.year && entry.month === communityEntry.month
      )

      if (existingEntry) {
        existingEntry.communityCount = communityEntry.count
      } else {
        mergedCounts.push({
          year: communityEntry.year,
          month: communityEntry.month,
          communityCount: communityEntry.count,
        })
      }
    })

    userCount.forEach((userEntry) => {
      const existingEntry = mergedCounts.find(
        (entry) => entry.year === userEntry.year && entry.month === userEntry.month
      )

      if (existingEntry) {
        existingEntry.userCount = userEntry.count
      } else {
        mergedCounts.push({
          year: userEntry.year,
          month: userEntry.month,
          userCount: userEntry.count,
        })
      }
    })

    storageCount.forEach((storageEntry) => {
      const existingEntry = mergedCounts.find(
        (entry) => entry.year === storageEntry.year && entry.month === storageEntry.month
      )

      if (existingEntry) {
        existingEntry.storageUsed = formatFileSize(storageEntry.sum)
      } else {
        mergedCounts.push({
          year: storageEntry.year,
          month: storageEntry.month,
          storageUsed: formatFileSize(storageEntry.sum),
        })
      }
    })

    return mergedCounts
  }

  const getTokensMonthToDate = (tokenDetails: any): number => {
    if (!tokenDetails || !Array.isArray(tokenDetails)) {
      return 0
    }

    const currentDate = new Date()
    const currentMonth = currentDate.getMonth()
    const currentYear = currentDate.getFullYear()

    const tokensMonthToDate = tokenDetails.reduce((sum, token) => {
      const tokenDate = new Date(token.created)
      if (tokenDate.getMonth() === currentMonth && tokenDate.getFullYear() === currentYear) {
        return sum + (token.token || 0)
      }
      return sum
    }, 0)

    return tokensMonthToDate
  }

  useEffect(() => {
    setFilteredClients({
      communityCount: clientList?.communityDetails?.length,
      userCount: clientList?.userDetails?.length,
      storageDetails: clientList?.totalStorage || '0 Bytes',
      queriesMonthToDate: clientList?.currentQueriesCount,
      tokenCount: getTokensMonthToDate(clientList?.tokenDetails),
      recordingsCount: clientList?.recordingDetails?.count,
    })
  }, [clientList])

  useEffect(() => {
    if (selectedMonthYear.month !== null && selectedMonthYear.year !== null) {
      const filteredData = dataByMonth.filter((item: any) => {
        const monthName =
          selectedMonthYear.month !== null ? getMonthName(selectedMonthYear.month) : ''
        return item.monthName == monthName && item.year == selectedMonthYear.year
      })

      if (filteredData?.length > 0) {
        setFilteredClients({
          communityCount: filteredData[0]?.numberofCollections || 0,
          userCount: filteredData[0]?.numberofUsers || 0,
          storageDetails: filteredData[0]?.storageUsed || '0 Bytes',
          queriesMonthToDate: filteredData[0]?.numberofQueries || 0,
          recordingsCount: filteredData[0]?.numberOfRecordings || 0,
        })
      } else {
        const currentDate = new Date()
        if (
          selectedMonthYear.month === currentDate.getMonth() + 1 &&
          selectedMonthYear.year === currentDate.getFullYear()
        ) {
          setFilteredClients({
            communityCount: clientList?.communityDetails?.length,
            userCount: clientList?.userDetails?.length,
            storageDetails: clientList?.totalStorage || '0 Bytes',
            queriesMonthToDate: clientList?.currentQueriesCount,
            tokenCount: getTokensMonthToDate(clientList?.tokenDetails),
            recordingsCount: clientList?.recordingDetails.count,
          })
        } else {
          setFilteredClients({
            communityCount: '0',
            userCount: '0',
            storageDetails: '0 Bytes',
            queriesMonthToDate: '0',
            tokenCount: '0',
            recordingsCount: '0',
          })
        }
      }
    }
  }, [selectedMonthYear, dataByMonth, clientList])

  const handleDateChange = (date: Date) => {
    setSelectedDate(date)
    const selectedMonth = date.getMonth() + 1
    const selectedYear = date.getFullYear()

    setSelectedMonthYear({
      month: selectedMonth,
      year: selectedYear,
    })
  }

  const handleNavigateBack = () => {
    navigate(-1)
  }

  return (
    <>
      {!loading ? (
        <>
          <KTCard>
            <div className='card-header d-flex justify-content-between align-items-center'>
              <div className='card-title'>
                <div className='fw-bolder fs-1'>
                  {state?.data == 'team' ? (
                    <>{state?.companyName}'s Statistics</>
                  ) : (
                    <>{clientList?.userDetails?.firstname}'s Statistics</>
                  )}
                </div>
              </div>
              <div
                className='card-title cursor-pointer'
                onClick={handleNavigateBack}
                data-bs-toggle='tooltip'
                title='Close'
              >
                <KTIcon iconName='cross' className='fs-1' />
              </div>
            </div>
            <div className='card-header border-0'>
              <div className='card-title'>
                <div className='user-manager-header'>
                  <DatePicker
                    selected={selectedDate}
                    onChange={handleDateChange}
                    dateFormat='MMMM yyyy'
                    showMonthYearPicker
                    className='form-control'
                    minDate={minDate}
                    maxDate={maxDate}
                  />
                </div>
              </div>
            </div>
            <div className='card-body gap-8 d-flex justify-content-between alignitems flex-column'>
              <div className='d-flex justify-content-between align-items-center flex-wrap'>
                <span className='fw-bold card-subtitle fs-5'>{'Number of Teams'}</span>
                <span className='fw-bold card-text fs-5 text-muted'>
                  {filteredClients?.communityCount} Teams
                </span>
              </div>
              {state?.data == 'team' && (
                <div className='d-flex justify-content-between align-items-center flex-wrap'>
                  <span className='fw-bold card-subtitle fs-5'>{'Number of Users'}</span>
                  <span className='fw-bold card-text fs-5 text-muted'>
                    {filteredClients?.userCount} Users
                  </span>
                </div>
              )}
              <div className='d-flex justify-content-between align-items-center flex-wrap'>
                <span className='fw-bold card-subtitle fs-5'>{'Storage Used'}</span>
                <span className='fw-bold card-text fs-5 text-muted '>
                  {filteredClients?.storageDetails}
                </span>
              </div>
              <div className='d-flex justify-content-between align-items-center flex-wrap'>
                <span className='fw-bold card-subtitle fs-5'>{'Queries Used'}</span>
                <span className='fw-bold card-text fs-5 text-muted'>
                  {filteredClients?.queriesMonthToDate} Queries
                </span>
              </div>
              <div className='d-flex justify-content-between align-items-center flex-wrap'>
                <span className='fw-bold card-subtitle fs-5'>{'Number of Recordings'}</span>
                <span className='fw-bold card-text fs-5 text-muted'>
                  {filteredClients?.recordingsCount || 0} Recordings
                </span>
              </div>
            </div>
          </KTCard>
        </>
      ) : (
        <div className='d-flex justify-content-center mx-auto my-auto'>
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

export {Statistics}
