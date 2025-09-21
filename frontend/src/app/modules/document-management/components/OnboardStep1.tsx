/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable jsx-a11y/anchor-is-valid */
import {FormattedMessage} from 'react-intl'
import {useAuth} from '../../auth'
import {useAppContext} from '../../../pages/AppContext/AppContext'

type Props = {
  setNextStep: any
}

const OnboardingStep1 = ({setNextStep}: Props) => {
  const {auth} = useAuth()
  const {appData} = useAppContext()

  return (
    <>
      <div className='card mb-10' style={{background: 'transparent'}}>
        <div className='card-body d-flex align-items-center py-8'>
          <div className='d-flex h-80px w-80px flex-shrink-0 flex-center position-relative d-md-flex d-none'>
            <span>
              <img alt='Logo' src={`${appData.appIcon}`} className='h-100px w-100px' />
            </span>
          </div>

          <div className='ms-6'>
            <p className='list-unstyled text-gray600 fwbold fs-4 p-0 m-0'>
              Hi! I'm {appData.appBotName}. And I loooove to play fetch!
            </p>
            <br />
            <p className='list-unstyled text-gray600 fwbold fs-4 p-0 m-0'>
              But it doesn't look like I have anything to fetch just yet{' '}
              <code className='fs-5 text-primary fw-bold mx-0'>{auth?.user?.firstname}</code>. In
              order for me to fetch something, it first needs to be in a <strong>Teams</strong>.
              Let's add one now!
            </p>
          </div>
        </div>
      </div>

      <div className='card bg-gray-400'>
        <div className='card-body d-flex align-items-center py-8'>
          <div className='ms-md-6'>
            <p className='list-unstyled text-gray600 fwbold fs-4 p-0 m-0'>
              A <strong>Team</strong> is how you organize your information for {appData.appBotName}{' '}
              to access. Each <strong>Team</strong> is a unique repository that contains files,
              folders, and notes that {appData.appBotName} can access for you on demand!
            </p>
            <br />
            <p className='list-unstyled text-gray600 fwbold fs-4 p-0 m-0'>
              A <strong>Team</strong> can represent many different things. It could be used to
              organize class materials (notes, handouts, research) or represent a department (HR,
              Marketing, Sales) or even be a place for essential household information (finances,
              insurance, estate plans). The critical thing is each <strong>Team</strong> is
              information you find vital and you want {appData.appBotName} to know.
            </p>
            <br />
            <p className='list-unstyled text-gray600 fwbold fs-4 p-0 m-0'>
              Finally, each <strong>Team</strong> you create is private, separate, and secure. That
              means that information in one <strong>Team</strong> is kept wholly separate from any
              other <strong>Team</strong> you add. Each <strong>Team</strong> is essentially a new{' '}
              <strong>{appData.appBotName} AI</strong> you've trained to become an expert on just
              those materials!
            </p>
          </div>
        </div>
        <div className='text-center cardfooter ms-6 px-8 mb-8'>
          <button
            type='button'
            className='btn btn-lg w50 col-12'
            style={{background: '#efb916'}}
            onClick={setNextStep}
          >
            <span className='indicator-label fw-bolder'>
              <FormattedMessage id='ONBOARDING.ONE' />
            </span>
          </button>
        </div>
      </div>
    </>
  )
}

export {OnboardingStep1}
