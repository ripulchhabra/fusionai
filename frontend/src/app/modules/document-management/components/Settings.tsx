import React, {useState} from 'react'
import {Popover} from '@mui/material'
import {KTIcon, checkIsActive} from '../../../../_metronic/helpers'
import clsx from 'clsx'
import {SidebarMenuItem} from '../../../../_metronic/layout/components/sidebar/sidebar-menu/SidebarMenuItem'
import {useAuth} from '../../auth'
import {useLocation} from 'react-router-dom'
import {useAppContext} from '../../../pages/AppContext/AppContext'

const Settings = () => {
  const {auth, logout, istextEditor, setIstextEditor} = useAuth()
  const {pathname} = useLocation()
  const [anchorEl, setAnchorEl] = useState(null)
  const {appData} = useAppContext()

  const handleToggle = (event: any) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleLogout = (event: any) => {
    if (istextEditor) {
      const confirmation = window.confirm(
        'You have unsaved changes. Are you sure you want to leave?'
      )
      if (!confirmation) {
        event.preventDefault()
        handleClose()
      } else {
        setIstextEditor(false)
        logout()
      }
    } else {
      logout()
    }
  }

  return (
    <>
      <div className='menu-item'>
        <a
          aria-controls='mode-popup'
          aria-haspopup='true'
          className={clsx('menu-link px-3 py-2', {active: anchorEl})}
          onClick={handleToggle}
        >
          <span className='menu-icon' data-kt-element='icon'>
            <KTIcon iconName='gear' className='fs-1 text-white' iconType='outline' />
          </span>
          <span className='menu-title text-white ms-2d-none d-lg-inline-block'>Settings</span>
        </a>
      </div>

      <Popover
        id='mode-popup'
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        PaperProps={{
          className: 'popover-bootstrap-class w-lg-250px w-200px',
          style: {backgroundColor: '#2c78bc'},
        }}
        sx={{
          '& .css-3bmhjh-MuiPaper-root-MuiPopover-paper': {
            marginTop: '15px',
          },
        }}
        disableRestoreFocus
      >
        <div
          style={checkIsActive(pathname, '/user/profile') ? {background: '#efb916'} : {}}
          onClick={handleClose}
        >
          <SidebarMenuItem
            to='/user/profile'
            icon='profile-circle'
            title='My Profile'
            fontIcon='bi-app-indicator'
            istextEditor={istextEditor}
          />
        </div>
        {(auth?.user?.role === 1 || auth?.user?.role === 2) && (
          <div
            style={checkIsActive(pathname, '/user/integration') ? {background: '#efb916'} : {}}
            onClick={handleClose}
          ></div>
        )}
        {auth?.user?.role === 1 && !['solo'].includes(auth?.user?.accountType) && (
          <>
            <div
              style={checkIsActive(pathname, '/company/profile') ? {background: '#efb916'} : {}}
              onClick={handleClose}
            >
              <SidebarMenuItem
                to='/company/profile'
                icon='briefcase'
                title='Organization Profile'
                fontIcon='bi-app-indicator'
                istextEditor={istextEditor}
              />
            </div>
            <div
              style={
                checkIsActive(pathname, '/manage-users')
                  ? {background: '#efb916'}
                  : checkIsActive(pathname, '/user-detail')
                    ? {background: '#efb916'}
                    : checkIsActive(pathname, '/invite-users')
                      ? {background: '#efb916'}
                      : {}
              }
              onClick={handleClose}
            >
              <SidebarMenuItem
                to='/manage-users'
                icon='profile-user'
                title='Users'
                fontIcon='bi-app-indicator'
                istextEditor={istextEditor}
              />
            </div>
          </>
        )}

        {appData?.paymentMode == 'on' && auth?.user?.role == 1 && (
          <div
            style={checkIsActive(pathname, '/manage-subscription') ? {background: '#efb916'} : {}}
            onClick={handleClose}
          >
            <SidebarMenuItem
              to='/manage-subscription'
              icon='dollar'
              title='Manage Subscription'
              fontIcon='bi-app-indicator'
              istextEditor={istextEditor}
            />
          </div>
        )}

        <div onClick={handleLogout}>
          <SidebarMenuItem to='#' icon='exit-right' title='Logout' fontIcon='bi-layers' />
        </div>
      </Popover>
    </>
  )
}

export {Settings}
