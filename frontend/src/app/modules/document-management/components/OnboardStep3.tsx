/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable jsx-a11y/anchor-is-valid */
import {useAuth} from '../../auth'
import {Link} from 'react-router-dom'
import {useAppContext} from '../../../pages/AppContext/AppContext'

const OnboardingStep3 = ({}) => {
  const {auth, currentCommunity} = useAuth()
  const {appData} = useAppContext()

  return (
    <>
      <div className='card mb10' style={{background: 'transparent'}}>
        <div className='card-body d-flex align-items-center py-8'>
          <div className='d-flex h-80px w-80px flex-shrink-0 flex-center position-relative d-md-flex d-none'>
            <span>
              <img alt='Logo' src={`${appData.appIcon}`} className='h-100px w-100px' />
            </span>
          </div>

          <div className='ms-md-6'>
            <p className='list-unstyled text-gray600 fwbold fs-4 p-0 m-0'>
              Hi <code className='fs-5 text-primary fw-bold mx-0'>{auth?.user?.firstname}</code>!
              I'm soooo happy to see you again! I'm ready to play fetch!
            </p>
            <br />
            <p className='list-unstyled text-gray600 fwbold fs-4 p-0 m-0'>
              In case you need a refresher on how things work, here's some notes for you:
            </p>
          </div>
        </div>
      </div>

      <div className='card' style={{background: 'transparent'}}>
        <div className='card-body d-flex align-items-center py8 py-0'>
          <div className='ms6'>
            <p className='list-unstyled text-gray600 fwbold fs-4 p-0 m-0'>
              I'm {appData.appBotName}, your personal AI that helps you get answers <u>really</u>{' '}
              fast!
            </p>
            <br />
            <p className='list-unstyled text-gray600 fwbold fs-4 p-0 m-0'>
              I dig through{' '}
              <Link to='/collections'>
                <u>Teams</u>
              </Link>{' '}
              to find these answers for you.{' '}
              <Link to='/collections'>
                <u>Teams</u>
              </Link>{' '}
              are all the important files and folders you want me to know and understand so I can be
              helpful to you and your friends.
            </p>
            <br />
            <p className='list-unstyled text-gray600 fwbold fs-4 p-0 m-0'>
              To choose a{' '}
              <Link to='/collections'>
                <u>Teams</u>
              </Link>{' '}
              to work with, click the drop down menu beneath the {appData.appName} logo at the top
              left. When you do, you'll see every available{' '}
              <Link to='/collections'>
                <u>Teams</u>
              </Link>{' '}
              you have to work with! Pick the one you want and we're off! Also, you can click{' '}
              <Link to='/collections'>
                <u>Teams</u>
              </Link>{' '}
              in the menu to manage the{' '}
              <Link to='/collections'>
                <u>Teams</u>
              </Link>{' '}
              in the application.
            </p>
            <br />
            <p className='list-unstyled text-gray600 fwbold fs-4 p-0 m-0'>
              Click{' '}
              <Link
                to='/files'
                style={!currentCommunity ? {pointerEvents: 'none', color: 'grey'} : {}}
              >
                <u>Files</u>
              </Link>{' '}
              in the menu and you can begin building your{' '}
              <Link to='/collections'>
                <u>Teams</u>
              </Link>
              . I can read <strong>Word</strong> files, <strong>Excel</strong> files,{' '}
              <strong>Text</strong> files, <strong>Powerpoints</strong>, <strong>HTML</strong>,{' '}
              <strong>PDFs</strong> and even those really poor quality, scanned twenty plus years
              ago PDFs that no one can read! Try me! You can also <strong>Add Notes</strong> which
              makes {appData.appName} the perfect tool for classes and meetings!
            </p>
            <br />
            <p className='list-unstyled text-gray600 fwbold fs-4 p-0 m-0'>
              You can add and remove{' '}
              <Link
                to='/files'
                style={!currentCommunity ? {pointerEvents: 'none', color: 'grey'} : {}}
              >
                <u>Files</u>
              </Link>
              , <strong>Notes</strong> and <strong>Folders</strong> from{' '}
              <Link to='/collections'>
                <u>Teams</u>
              </Link>{' '}
              at any time. When you remove something I <u>immediately</u> forget that information.
              When you add something it's immediately part of my memory!
            </p>
            <br />
            <p className='list-unstyled text-gray600 fwbold fs-4 p-0 m-0'>
              Click{' '}
              <Link
                to='/chat-histories'
                style={!currentCommunity ? {pointerEvents: 'none', color: 'grey'} : {}}
              >
                <u>Chat</u>
              </Link>{' '}
              when you want to play fetch with me! Simply enter your question into the prompt at the
              bottom of the screen (just like texting your best friend, which by the way, I am
              angling to become) and I'm off! You can rename a{' '}
              <Link
                to='/chat-histories'
                style={!currentCommunity ? {pointerEvents: 'none', color: 'grey'} : {}}
              >
                <u>Chat</u>
              </Link>
              , delete a{' '}
              <Link
                to='/chat-histories'
                style={!currentCommunity ? {pointerEvents: 'none', color: 'grey'} : {}}
              >
                <u>Chat</u>
              </Link>
              , add new{' '}
              <Link
                to='/chat-histories'
                style={!currentCommunity ? {pointerEvents: 'none', color: 'grey'} : {}}
              >
                <u>Chats</u>
              </Link>
              . It's all up to you!
            </p>
            <br />
            <p className='list-unstyled text-gray600 fw-bolder fs-2 p-0 m-0'>
              Now let's go play fetch!
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

export {OnboardingStep3}
