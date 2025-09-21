import {Navigate, Route, Routes, Outlet} from 'react-router-dom'
import {Settings} from './components/settings/Settings'

const AccountPage: React.FC = () => {
  return (
    <Routes>
      <Route
        element={
          <>
            <Outlet />
          </>
        }
      >
        <Route
          path='profile'
          element={
            <>
              <Settings />
            </>
          }
        />
        <Route index element={<Navigate to='/user/profile' />} />
      </Route>
    </Routes>
  )
}

export default AccountPage
