import {Suspense, useEffect, useState} from 'react'
import {Outlet} from 'react-router-dom'
import {I18nProvider} from '../_metronic/i18n/i18nProvider'
import {LayoutProvider, LayoutSplashScreen} from '../_metronic/layout/core'
import {MasterInit} from '../_metronic/layout/MasterInit'
import {AuthInit, useAuth} from './modules/auth'
import {getActiveCommunities} from './modules/document-management/api'
import {useAppContext} from './pages/AppContext/AppContext'

const App = () => {
  const {currentUser, setCommunityList, setCurrentCommunity, communityList, currentCommunity} =
    useAuth()
  const [loading, setLoading] = useState(false)
  const {appData} = useAppContext()

  useEffect(() => {
    const isCurrentCommunity = communityList.some((community) => community.id === currentCommunity)

    if (localStorage.getItem('çurrent-community') || isCurrentCommunity) {
      setCurrentCommunity(localStorage.getItem('çurrent-community'))
    } else {
      setCurrentCommunity(communityList[0]?.id)
    }
  }, [currentUser])

  useEffect(() => {
    if (appData) {
      const pageTitleElement = document.getElementById('pageTitle')
      if (pageTitleElement) {
        pageTitleElement.innerText = `${appData.appName} - ${appData.appTagline}`
      }
      const faviconElement = document.querySelector(
        'link[rel="shortcut icon"]'
      ) as HTMLLinkElement | null
      if (faviconElement) {
        faviconElement.href = `${appData.appIcon}`
      }
    }
  }, [appData])

  useEffect(() => {
    if (currentUser) {
      getActiveCommunities(currentUser.companyId)
        .then((response) => {
          if (response.data.success) {
            setCommunityList(response.data.communityList)
          }
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [currentUser])
  return (
    <Suspense fallback={<LayoutSplashScreen />}>
      <I18nProvider>
        <LayoutProvider>
          <AuthInit>
            {loading ? (
              <div className='text-center'>Loading...</div>
            ) : (
              <>
                <Outlet />
                <MasterInit />
              </>
            )}
          </AuthInit>
        </LayoutProvider>
      </I18nProvider>
    </Suspense>
  )
}

export {App}
