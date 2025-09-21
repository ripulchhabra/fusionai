import {FC, useState, useEffect, createContext, useContext, Dispatch, SetStateAction} from 'react'
import {LayoutSplashScreen} from '../../../../_metronic/layout/core'
import {AuthModel, UserModel} from './_models'
import * as authHelper from './AuthHelpers'
import {WithChildren} from '../../../../_metronic/helpers'
import {themeMenuModeLSKey, themeModelSKey} from '../../../../_metronic/partials'

type AuthContextProps = {
  auth: AuthModel | undefined
  saveAuth: (auth: AuthModel | undefined) => void
  currentUser: UserModel | undefined
  communityList: Array<any>
  currentCommunity: any
  isSharedCommunity: boolean
  setCurrentUser: Dispatch<SetStateAction<UserModel | undefined>>
  setCurrentCommunity: Dispatch<SetStateAction<any>>
  setCommunityList: Dispatch<SetStateAction<any>>
  setIsSharedCommunity: Dispatch<SetStateAction<any>>
  isBackFromPages: boolean
  onHomePage: boolean
  setIsBackFromPages: Dispatch<SetStateAction<any>>
  setOnHomePage: Dispatch<SetStateAction<any>>
  logout: () => void
  successMsg: string
  setSuccessMsg: any
  errMsg: string
  setErrMsg: any
  uploadStatusMessage: string
  setUploadStatusMessage: any
  responseCount: number
  setResponseCount: any
  istextEditor: any
  setIstextEditor: any
  currentParent: any
  setCurrentParent: any
  historyIds: any
  setHistoryIds: any
}

const initAuthContextPropsState = {
  auth: authHelper.getAuth(),
  saveAuth: () => {},
  currentUser: undefined,
  communityList: [],
  currentCommunity: undefined,
  isSharedCommunity: false,
  setCurrentUser: () => {},
  setCurrentCommunity: () => {},
  setIsSharedCommunity: () => {},
  setCommunityList: () => {},
  isBackFromPages: false,
  onHomePage: false,
  setOnHomePage: () => {},
  setIsBackFromPages: () => {},
  logout: () => {},
  successMsg: '',
  setSuccessMsg: () => {},
  errMsg: '',
  setErrMsg: () => {},
  uploadStatusMessage: '',
  setUploadStatusMessage: () => {},
  responseCount: 0,
  setResponseCount: () => {},
  istextEditor: false,
  setIstextEditor: () => {},
  currentParent: false,
  setCurrentParent: () => {},
  historyIds: false,
  setHistoryIds: () => {},
}

const AuthContext = createContext<AuthContextProps>(initAuthContextPropsState)

const useAuth = () => {
  return useContext(AuthContext)
}

const AuthProvider: FC<WithChildren> = ({children}) => {
  const [auth, setAuth] = useState<AuthModel | undefined>(authHelper.getAuth())
  const [currentUser, setCurrentUser] = useState<UserModel | undefined>()
  const [currentCommunity, setCurrentCommunity] = useState<any>(authHelper.getCurrentCommunity())
  const [isSharedCommunity, setIsSharedCommunity] = useState<boolean>(false)
  const [communityList, setCommunityList] = useState<Array<any>>([])
  const [isBackFromPages, setIsBackFromPages] = useState<boolean>(false)
  const [onHomePage, setOnHomePage] = useState<boolean>(false)
  const [successMsg, setSuccessMsg] = useState<string>('')
  const [errMsg, setErrMsg] = useState<string>('')
  const [uploadStatusMessage, setUploadStatusMessage] = useState<string>('')
  const [responseCount, setResponseCount] = useState<number>(0)
  const [istextEditor, setIstextEditor] = useState<boolean>(false)
  const [currentParent, setCurrentParent] = useState<any>(
    localStorage.getItem('current-parent') ? localStorage.getItem('current-parent') : 4
  )
  const [historyIds, setHistoryIds] = useState<any>([4])
  const saveAuth = (auth: AuthModel | undefined) => {
    setAuth(auth)
    if (auth) {
      authHelper.setAuth(auth)
    } else {
      authHelper.removeAuth()
    }
  }

  const logout = () => {
    saveAuth(undefined)
    setCurrentUser(undefined)
    setCurrentCommunity('')
    setIsSharedCommunity(false)
    setCommunityList([])
    localStorage.setItem(themeModelSKey, 'light')
    localStorage.setItem(themeMenuModeLSKey, 'light')
    document.documentElement.setAttribute('data-bs-theme', 'light')
    localStorage.removeItem('çurrent-community')
    localStorage.removeItem('current-parent')
  }

  return (
    <AuthContext.Provider
      value={{
        auth,
        saveAuth,
        currentUser,
        currentCommunity,
        isSharedCommunity,
        communityList,
        setCurrentUser,
        setCurrentCommunity,
        setIsSharedCommunity,
        setCommunityList,
        isBackFromPages,
        onHomePage,
        setIsBackFromPages,
        setOnHomePage,
        logout,
        successMsg,
        setSuccessMsg,
        errMsg,
        setErrMsg,
        uploadStatusMessage,
        setUploadStatusMessage,
        responseCount,
        setResponseCount,
        istextEditor,
        setIstextEditor,
        currentParent,
        setCurrentParent,
        historyIds,
        setHistoryIds,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

const AuthInit: FC<WithChildren> = ({children}) => {
  const {auth, logout, setCurrentUser, communityList} = useAuth()
  const [showSplashScreen, setShowSplashScreen] = useState(true)

  useEffect(() => {
    if (auth && auth.api_token) {
      setCurrentUser(auth.user)
      let timeout: number
      if (communityList.length === 0) {
        timeout = window.setTimeout(() => {
          setShowSplashScreen(false)
        }, 3000)
      } else {
        setShowSplashScreen(false)
      }

      return () => {
        clearTimeout(timeout)
      }
    } else {
      logout()
      setShowSplashScreen(false)
    }
  }, [])

  return showSplashScreen ? <LayoutSplashScreen /> : <>{children}</>
}

export {AuthProvider, AuthInit, useAuth}
