/* eslint-disable jsx-a11y/anchor-is-valid */
import {useEffect, useRef, useState} from 'react'
import * as Yup from 'yup'
import clsx from 'clsx'
import {Link} from 'react-router-dom'
import {useFormik} from 'formik'
import {validateCredential, login} from '../core/_requests'
import {useAuth} from '../core/Auth'
import {AlertDanger, AlertSuccess} from '../../alerts/Alerts'
import {FormattedMessage, useIntl} from 'react-intl'
import {useAppContext} from '../../../pages/AppContext/AppContext'
import {SidebarLogo} from '../../../../_metronic/layout/components/sidebar/SidebarLogo'
import unionTop from '../../../../background-images/Union.png'
import unionBottom from '../../../../background-images/Unionbottom.png'
import envelope from '../../../../background-images/envelope.png'
import lock from '../../../../background-images/lock.png'
import {themeMenuModeLSKey, themeModelSKey} from '../../../../_metronic/partials'

const initialValues = {
  email: '',
  password: '',
}

/*
  Formik+YUP+Typescript:
  https://jaredpalmer.com/formik/docs/tutorial#getfieldprops
  https://medium.com/@maurice.de.beijer/yup-validation-and-typescript-and-formik-6c342578a20e
*/

export function Login() {
  const [loading, setLoading] = useState(false)
  const {saveAuth, setCurrentUser} = useAuth()
  const [isValidated, setIsValidated] = useState<boolean>(false)
  const [loginPhase, setLoginPhase] = useState<string>('pre')
  const [otp, setOTP] = useState<any>('')

  const [checked, setChecked] = useState<boolean>(false)
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const intl = useIntl()

  const loginSchema = Yup.object().shape({
    email: Yup.string()
      .email(intl.formatMessage({id: 'PROFILE.EMAIL.WRONG_FORMAT'}))
      .min(5, intl.formatMessage({id: 'PROFILE.MIN5CHAR'}))
      .max(50, intl.formatMessage({id: 'PROFILE.MAX50CHAR'}))
      .required(intl.formatMessage({id: 'PROFILE.EMAIL.REQUIRED'})),
    password: Yup.string()
      .min(8, intl.formatMessage({id: 'PROFILE.MIN8CHAR'}))
      .max(50, intl.formatMessage({id: 'PROFILE.MAX50CHAR'}))
      .required(intl.formatMessage({id: 'PROFILE.PASSWORD.REQUIRED'})),
  })

  if (successMessage !== '') {
    setTimeout(() => {
      setChecked(false)
      setTimeout(() => {
        setSuccessMessage('')
      }, 200)
    }, 5000)
  }

  if (errorMessage !== '') {
    setTimeout(() => {
      setChecked(false)
      setTimeout(() => {
        setErrorMessage('')
      }, 200)
    }, 5000)
  }

  const clearFormData = () => {
    sessionStorage.removeItem('registrationFormData')
  }

  useEffect(() => {
    clearFormData()
  }, [])

  const formik = useFormik({
    initialValues,
    validationSchema: loginSchema,
    onSubmit: async (values, {setSubmitting}) => {
      setLoading(true)
      try {
        if (loginPhase == 'pre') {
          validateCredential(values.email, values.password).then((response) => {
            if (response.data.success) {
              if (!response.data.twoFactorAuth) {
                const auth = {
                  api_token: response.data.userData.auth.api_token,
                  user: response.data.userData,
                }
                saveAuth(auth)
                setCurrentUser(response.data.userData)
                setSubmitting(false)
                setLoading(false)
                if (localStorage.getItem('mode') == 'dark') {
                  localStorage.setItem(themeModelSKey, 'dark')
                  localStorage.setItem('current-parent', '')
                  localStorage.setItem(themeMenuModeLSKey, 'dark')
                  document.documentElement.setAttribute('data-bs-theme', 'dark')
                }
              } else {
                setIsValidated(true)
                setLoginPhase('post')
                setSubmitting(false)
                setLoading(false)
              }
            } else {
              setChecked(true)
              setErrorMessage(response.data.message)
              setSubmitting(false)
              setLoading(false)
            }
          })
        } else if (loginPhase == 'post') {
          if (otp) {
            login(values.email, values.password, otp).then((response) => {
              if (response.data.success) {
                const auth = {
                  api_token: response.data.userData.auth.api_token,
                  user: response.data.userData,
                }
                saveAuth(auth)
                setCurrentUser(response.data.userData)
                setSubmitting(false)
                setLoading(false)
                if (localStorage.getItem('mode') == 'dark') {
                  localStorage.setItem(themeModelSKey, 'dark')
                  localStorage.setItem('current-parent', '')
                  localStorage.setItem(themeMenuModeLSKey, 'dark')
                  document.documentElement.setAttribute('data-bs-theme', 'dark')
                }
              } else {
                setChecked(true)
                setErrorMessage(response.data.message)
                setSubmitting(false)
                setLoading(false)
              }
            })
          } else {
            setChecked(true)
            setErrorMessage('Enter OTP')
            setSubmitting(false)
            setLoading(false)
          }
        }
      } catch (error) {
        setChecked(true)
        saveAuth(undefined)
        setErrorMessage('The login details are incorrect')
        setSubmitting(false)
        setLoading(false)
      }
    },
  })

  const handleOtpChange = (e: any) => {
    setOTP(e.target.value)
  }

  const resendOTP = () => {
    const email = formik.getFieldMeta('email').value
    const password = formik.getFieldMeta('password').value

    validateCredential(email, password).then((response) => {
      if (response.data.success) {
        setChecked(true)
        setSuccessMessage('OTP sent to your inbox')
      } else {
        setChecked(true)
        setErrorMessage('Failed to resend OTP')
      }
    })
  }

  const {appData} = useAppContext()

  const sidebarRef = useRef<HTMLDivElement>(null)

  const handleResendOTP = () => {
    resendOTP()
  }

  return (
    <div className='container bg-transparent mob-center'>
      <div className='login-logo-shift'>
        <SidebarLogo sidebarRef={sidebarRef} />
      </div>
      <div className='row mobile-d-flex'>
        <div className='col-6 d-flex align-items-center justify-content-center'>
          <img src={appData.appIcon} alt='Logo' className='img-fluid' />
        </div>
        <div className='col-6 d-flex align-items-center justify-content-center'>
          <form
            className='form rounded shadow-sm p-10 bg-white main-form'
            onSubmit={formik.handleSubmit}
            noValidate
            id='kt_login_signin_form'
          >
            <img src={unionTop} alt='union' className='union-top' />
            {/* begin::Heading */}
            <div className='text-center fw-bolder fs-1 text-nowrap'>
              <h1>
                Welcome to <span className='text-capitalize'>{appData.appName}</span>
              </h1>
            </div>
            <div
              className={`row mx-15 mt-8 mb-8 d-flex justify-content-center align-items-center
              ${appData?.googleAuth !== 'enabled' ? 'margin-mobile' : ''}  
            `}
            >
              <div className='col-6 border-bottom login-margin'>
                <div className='text-center'>
                  <h3 className='text-primary fw-bolder text-nowrap'>
                    <span className='border-bottom border-primary border-5 pb-2'>
                      <FormattedMessage id='AUTH.LOGIN' />
                    </span>
                  </h3>
                </div>
              </div>
              {appData?.signUpMode === 'enabled' && (
                <div className={`col-6 border-bottom signup-margin`} style={{pointerEvents: 'all'}}>
                  <div className='text-center text-nowrap'>
                    <h3 className='text-dark fw-bolder'>
                      <Link to='/auth/registration' className='text-decoration-none text-dark'>
                        <FormattedMessage id='AUTH.SIGNUP' />
                      </Link>
                    </h3>
                  </div>
                </div>
              )}
            </div>
            {/* begin::Heading */}

            {successMessage !== '' ? (
              <AlertSuccess message={successMessage} checked={checked} />
            ) : null}

            {errorMessage !== '' ? <AlertDanger message={errorMessage} checked={checked} /> : null}

            {!isValidated && (
              <>
                {/* begin::Form group */}
                <div style={{position: 'relative'}} className='fv-row mb-7'>
                  <input
                    placeholder={intl.formatMessage({id: 'AUTH.EMAIL'})}
                    {...formik.getFieldProps('email')}
                    className={clsx(
                      'form-control bg-light form-custom-input',
                      {'is-invalid': formik.touched.email && formik.errors.email},
                      {
                        'is-valid': formik.touched.email && !formik.errors.email,
                      }
                    )}
                    type='email'
                    name='email'
                    autoComplete='off'
                  />
                  {!formik.touched.email && formik.validateOnChange && (
                    <img src={envelope} className='input-icon' />
                  )}
                  {formik.touched.email && formik.errors.email && (
                    <div className='login-msg-container'>
                      <div className='fv-help-block'>
                        <span role='alert'>{formik.errors.email}</span>
                      </div>
                    </div>
                  )}
                </div>
                {/* end::Form group */}

                {/* begin::Form group */}
                <div style={{position: 'relative'}} className='fv-row mb-3'>
                  <input
                    placeholder='Password'
                    type='password'
                    autoComplete='off'
                    {...formik.getFieldProps('password')}
                    className={clsx(
                      'form-control bg-light form-custom-input',
                      {
                        'is-invalid': formik.touched.password && formik.errors.password,
                      },
                      {
                        'is-valid': formik.touched.password && !formik.errors.password,
                      }
                    )}
                  />
                  {!formik.touched.password &&
                    formik.values.password.length === 0 &&
                    formik.validateOnChange && <img src={lock} className='input-icon' />}
                  {formik.touched.password && formik.errors.password && (
                    <div className='login-msg-container'>
                      <div className='fv-help-block'>
                        <span role='alert'>{formik.errors.password}</span>
                      </div>
                    </div>
                  )}
                </div>
                {/* end::Form group */}

                {/* begin::Wrapper */}
                <div className='d-flex flex-stack flex-wrap gap-3 fs-base fw-semibold mb-7'>
                  <div />

                  {/* begin::Link */}
                  <Link
                    to='/auth/forgot-password'
                    className='text-decoration-none text-dark fw-bold'
                  >
                    <FormattedMessage id='AUTH.FORGOT_PASSWORD' /> ?
                  </Link>
                  {/* end::Link */}
                </div>
                {/* end::Wrapper */}
              </>
            )}

            {isValidated && (
              <>
                <div className='fv-row mb-3'>
                  <label className='form-label fw-bolder text-dark fs-6 mb-0'>
                    <FormattedMessage id='AUTH.ENTER_OTP' />
                  </label>
                  <input
                    type='text'
                    className={clsx('form-control bg-transparent')}
                    value={otp}
                    onChange={handleOtpChange}
                  />
                </div>

                {/* begin::Wrapper */}
                <div className='d-flex flex-stack flex-wrap gap-3 fs-base fw-semibold mb-8'>
                  {/* begin::Link */}
                  <span onClick={handleResendOTP} className='cursor-pointer link-primary'>
                    <FormattedMessage id='AUTH.RESEND_OTP' />
                  </span>
                  {/* end::Link */}
                </div>
                {/* end::Wrapper */}
              </>
            )}

            {/* begin::Action */}

            <div className='text-gray-500 text-center fw-semibold fs-6 mt-7'>
              <button
                type='submit'
                id='kt_sign_in_submit'
                className='btn btn-primary custom-btn'
                disabled={formik.isSubmitting || !formik.isValid || loading}
              >
                {!loading && (
                  <span className='indicator-label fs-4 d-flex align-items-center justify-content-center'>
                    Login Now
                    <i className='fa-solid fa-circle-arrow-right fs-1 ms-4'></i>
                  </span>
                )}
                {loading && (
                  <span className='indicator-progress' style={{display: 'block'}}>
                    <FormattedMessage id='PROFILE.PLEASE_WAIT' />
                    ...
                    <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                  </span>
                )}
              </button>
            </div>
            {/* end::Action */}

            <p className='text-primary pt-4 fs-5 text-justify'>
              <FormattedMessage id='AUTH.LOGIN.TERMS' />
            </p>
            <img src={unionBottom} alt='union' className='union-bottom' />
          </form>
        </div>
      </div>
    </div>
  )
}
