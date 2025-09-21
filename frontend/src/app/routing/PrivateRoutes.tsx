import {lazy, FC, Suspense} from 'react'
import {Route, Routes, Navigate} from 'react-router-dom'
import {MasterLayout} from '../../_metronic/layout/MasterLayout'
import TopBarProgress from 'react-topbar-progress-indicator'
import {getCSSVariableValue} from '../../_metronic/assets/ts/_utils'
import {WithChildren} from '../../_metronic/helpers'
import {VerifyUser} from '../modules/auth/components/EmailVerification'
import {DocumentMangement} from '../modules/document-management/DocumentManagement'
import {DragDropFile} from '../modules/document-management/components/DragAndDrop'
import {TextEditor} from '../modules/document-management/components/TextEditor'
import {DocumentUpdater} from '../modules/document-management/components/DocumentUpdater'
import {useAuth} from '../modules/auth'
import AdminPage from '../pages/superAdminDashboard/AdminPage'
import {useAppContext} from '../pages/AppContext/AppContext'
import {Documents} from '../modules/widgets/components/Documents'
import {DocumentSummarizer} from '../modules/document-management/components/DocumentSummarizer'
import NotificationsPage from '../modules/apps/notifications/NotificationPage'

const PrivateRoutes = () => {
  const AccountPage = lazy(() => import('../modules/accounts/AccountPage'))
  const InviteUsers = lazy(() => import('../modules/invitations/InviteUsers'))
  const ChatPage = lazy(() => import('../modules/apps/chat/ChatPage'))
  const CommunityList = lazy(() => import('../modules/communities/CommunitiesList'))
  const UserDetailPage = lazy(() => import('../modules/invitations/UserDetailPage'))
  const ManageSubscription = lazy(
    () => import('../modules/manage-subscription/ManageSubscriptionPage')
  )

  const {auth, communityList} = useAuth()
  const {appData} = useAppContext()

  return (
    <Routes>
      <Route element={<MasterLayout />}>
        {/* Redirect to Dashboard after success login/registartion */}
        <Route
          path='auth/*'
          element={
            auth?.user?.role == 4 ? (
              <Navigate to='/admin' />
            ) : communityList.length === 0 ? (
              <Navigate to='/dashboard' />
            ) : (
              <Navigate to='/collections' />
            )
          }
        />
        {/* Pages */}
        <Route
          path='dashboard'
          element={
            <SuspensedView>
              <DocumentMangement />
            </SuspensedView>
          }
        />
        <Route path='upload-document' element={<DragDropFile />} />
        <Route path='create-document' element={<TextEditor />} />
        <Route path='update-document' element={<DocumentUpdater />} />
        <Route path='summarize-document' element={<DocumentSummarizer />} />
        {/* <Route path='view-document' element={<DocumentViewer />} /> */}
        <Route path='verify-account' element={<VerifyUser />} />

        {/* Lazy Modules */}

        <Route
          path='admin/*'
          element={
            <SuspensedView>
              <AdminPage />
            </SuspensedView>
          }
        />

        {appData?.paymentMode == 'on' && auth?.user?.role == 1 && (
          <Route
            path='manage-subscription'
            element={
              <SuspensedView>
                <ManageSubscription />
              </SuspensedView>
            }
          />
        )}

        <Route
          path='chat-histories/*'
          element={
            <SuspensedView>
              <ChatPage />
            </SuspensedView>
          }
        />

        <Route
          path='notifications'
          element={
            <SuspensedView>
              <NotificationsPage />
            </SuspensedView>
          }
        />

        <Route
          path='files/*'
          element={
            <SuspensedView>
              <Documents />
            </SuspensedView>
          }
        />

        <Route
          path='user/*'
          element={
            <SuspensedView>
              <AccountPage />
            </SuspensedView>
          }
        />

        <Route
          path='invite-users'
          element={
            <SuspensedView>
              <InviteUsers />
            </SuspensedView>
          }
        />
        <Route
          path='collections'
          element={
            <SuspensedView>
              <CommunityList />
            </SuspensedView>
          }
        />
        <Route
          path='user-detail'
          element={
            <SuspensedView>
              <UserDetailPage />
            </SuspensedView>
          }
        />

        {/* Page Not Found */}
        <Route path='*' element={<Navigate to='/error/404' />} />
      </Route>
    </Routes>
  )
}

const SuspensedView: FC<WithChildren> = ({children}) => {
  const baseColor = getCSSVariableValue('--bs-primary')
  TopBarProgress.config({
    barColors: {
      '0': baseColor,
    },
    barThickness: 1,
    shadowBlur: 5,
  })
  return <Suspense fallback={<TopBarProgress />}>{children}</Suspense>
}

export {PrivateRoutes}
