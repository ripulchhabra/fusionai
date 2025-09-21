import React, {useEffect, useState} from 'react'
import {KTCard} from '../../../../../../_metronic/helpers'
import ReactApexChart from 'react-apexcharts'
import {useAuth} from '../../../../auth'
import {
  getClientStatistics,
  getCompanyStatistics,
} from '../../../../../pages/superAdminDashboard/api'

const UserStats = () => {
  const {currentUser} = useAuth()
  const [loading, setLoading] = useState(true)
  const [storageWithNumber, setStorageWithNumber] = useState<any>([])
  const [size, setSize] = React.useState({
    series: (storageWithNumber?.sourceWithNumber ?? [])
      .filter((item: any) => item.source !== null)
      .map((item: any) => item.size),
    options: {
      chart: {
        width: 380,
        type: 'pie' as 'pie',
      },
      labels: (storageWithNumber?.sourceWithNumber ?? [])
        .filter((item: any) => item.source !== null)
        .map((item: any) => item.source),
      dataLabels: {
        enabled: true,
        style: {
          fontSize: '14px',
          fontWeight: 'bold',
          colors: ['#fff'], // Labels in white for better visibility
        },
        dropShadow: {
          enabled: true,
          top: 1,
          left: 1,
          blur: 1,
          opacity: 0.5,
        },
        formatter: function (val: number) {
          return `${val.toFixed(1)}%` // Format as a percentage
        },
      },
      plotOptions: {
        pie: {
          dataLabels: {
            offset: -5, // Move labels towards the center of each slice
            minAngleToShowLabel: 10, // Only show labels if slice angle is greater than this
          },
        },
      },
      tooltip: {
        enabled: true,
        y: {
          formatter: function (val: number, opts: any) {
            const sourceData = storageWithNumber?.sourceWithNumber.filter(
              (item: any) => item.source !== null
            )
            const count = sourceData[opts.seriesIndex]?.count
            return `${val} kb (${count})`
          },
        },
      },
      responsive: [
        {
          breakpoint: 480,
          options: {
            chart: {
              width: 150,
            },
            legend: {
              position: 'bottom',
            },
          },
        },
      ],
    },
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (currentUser?.accountType === 'team') {
          const data: any = await getCompanyStatistics(currentUser?.companyId)
          setStorageWithNumber(data?.data?.clientStatistics)
        } else {
          const data: any = await getClientStatistics(currentUser?.id)
          setStorageWithNumber(data?.data?.clientStatistics)
        }
      } catch (error) {
        setStorageWithNumber([])
        console.error('Error fetching user role:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [currentUser])

  useEffect(() => {
    setSize({
      series: (storageWithNumber?.sourceWithNumber ?? [])
        .filter((item: any) => item.source !== null)
        .map((item: any) => item.size),
      options: {
        chart: {
          width: 380,
          type: 'pie' as 'pie',
        },
        labels: (storageWithNumber?.sourceWithNumber ?? [])
          .filter((item: any) => item.source !== null)
          .map((item: any) => item.source),
        dataLabels: {
          enabled: true,
          style: {
            fontSize: '14px',
            fontWeight: 'bold',
            colors: ['#fff'], // Labels in white for better visibility
          },
          dropShadow: {
            enabled: true,
            top: 1,
            left: 1,
            blur: 1,
            opacity: 0.5,
          },
          formatter: function (val: number) {
            return `${val.toFixed(1)}%` // Format as a percentage
          },
        },
        plotOptions: {
          pie: {
            dataLabels: {
              offset: -5, // Move labels towards the center of each slice
              minAngleToShowLabel: 10, // Only show labels if slice angle is greater than this
            },
          },
        },
        tooltip: {
          enabled: true,
          y: {
            formatter: function (val: number, opts: any) {
              const sourceData = storageWithNumber?.sourceWithNumber.filter(
                (item: any) => item.source !== null
              )
              const count = sourceData[opts.seriesIndex]?.count
              return `${val} kb (${count})`
            },
          },
        },
        responsive: [
          {
            breakpoint: 768, // Tablet and small screens
            options: {
              chart: {
                width: 300,
              },
              legend: {
                position: 'bottom',
              },
            },
          },
          {
            breakpoint: 480, // Mobile devices
            options: {
              chart: {
                width: 250,
              },
              legend: {
                position: 'bottom',
              },
            },
          },
        ],
      },
    })
  }, [storageWithNumber])

  return (
    <KTCard className='mt-5 d-flex justify-content-between align-items-center'>
      <div className='card-header'>
        <div className='card-title'>
          <div className='fw-bolder fs-1'>{currentUser?.firstname}'s File Distribution Report</div>
        </div>
      </div>
      <div className='d-flex flex-column align-items-center'>
        {!loading &&
          (storageWithNumber?.sourceWithNumber?.length > 0 &&
          storageWithNumber?.sourceWithNumber?.[0]?.source != null ? (
            <ReactApexChart options={size.options} series={size.series} type='pie' width={400} />
          ) : (
            'No File Uploaded'
          ))}
      </div>
    </KTCard>
  )
}

export default UserStats
