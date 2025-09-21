/* eslint-disable react/jsx-no-target-blank */
/* eslint-disable jsx-a11y/anchor-is-valid */
import {useState, useEffect} from 'react'
import {useFormik} from 'formik'
import * as Yup from 'yup'
import clsx from 'clsx'
import {useNavigate} from 'react-router-dom'
import {
  getInvitationDataByEmail,
  createAccountForInvitedUsers,
  createAccountForSuperInvitedUsers,
} from './api'
import {useAuth} from '../auth'
import {PasswordMeterComponent} from '../../../_metronic/assets/ts/components'
import {AlertSuccess, AlertDanger} from '../alerts/Alerts'
import {KTIcon, toAbsoluteUrl} from '../../../_metronic/helpers'
import {useAppContext} from '../../pages/AppContext/AppContext'
import PhoneInput, {CountryData} from 'react-phone-input-2'
import 'react-phone-input-2/lib/bootstrap.css'

const params = new URLSearchParams(window.location.search)

const token: string | null = params.get('token')
const email: string | null = params.get('email')

const registrationSchema = Yup.object().shape({
  firstname: Yup.string()
    .min(3, 'Minimum 3 characters')
    .max(50, 'Maximum 50 characters')
    .required('First Name is required'),
  lastname: Yup.string()
    .min(3, 'Minimum 3 characters')
    .max(50, 'Maximum 50 characters')
    .required('Last Name is required'),
  countryCode: Yup.string()
    .test('not-only-plus', 'Invalid Country code', (value) => !!value && /^\+\d+$/.test(value))
    .required('Country code is required'),
  mobileNumber: Yup.string()
    .min(10, 'Minimum 10 numbers')
    .max(14, 'Maximum 10 numbers')
    .required('Mobile number is required'),
  password: Yup.string()
    .min(8, 'Minimum 8 characters')
    .max(50, 'Maximum 50 characters')
    .required('Password is required'),
  changepassword: Yup.string()
    .min(8, 'Minimum 8 characters')
    .max(50, 'Maximum 50 characters')
    .required('Password confirmation is required')
    .oneOf([Yup.ref('password')], "Password and Confirm Password didn't match"),
})

export function CreateAccount() {
  const [loading, setLoading] = useState(false)
  const [fetchingInv, setFetchingInv] = useState<boolean>(true)
  const [checked, setChecked] = useState<boolean>(false)
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [invitationData, setInvitationData] = useState<any>({})
  const navigate = useNavigate()
  const {saveAuth, setCurrentUser} = useAuth()
  const {appData} = useAppContext()
  const [signUpMethod, setSignUpMethod] = useState<any>('email')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const onSignUpMethodChange = (value: string) => {
    setSignUpMethod(value)
  }

  useEffect(() => {
    getInvitationDataByEmail(email, token)
      .then((response) => {
        if (response.data.success && response.data.status == 'valid') {
          setInvitationData(response.data.invitationData)
          setFetchingInv(false)
        } else {
          if (response.data.status == 'invalid') {
            navigate('/status/invalid-invitation')
          } else if (response.data.status == 'expired') {
            navigate('/status/expired-invitation')
          } else if (response.data.status == 'declined') {
            navigate('/status/declined-invitation')
          } else if (response.data.status == 'registered') {
            navigate('/status/registered-invitation')
          } else if (response.data.status == 'invalid-token') {
            navigate('/status/invalid-token')
          }
        }
      })
      .catch((err) => console.log(err))
  }, [])

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

  const initialValues = {
    firstname: '',
    lastname: '',
    mobileNumber: '',
    countryCode: '+1',
    password: '',
    changepassword: '',
  }

  const formik = useFormik({
    initialValues,
    validationSchema: registrationSchema,
    onSubmit: async (values, {setStatus, setSubmitting}) => {
      setLoading(true)
      createAccountForInvitedUsers(
        values.firstname,
        values.lastname,
        invitationData.email,
        values.countryCode,
        values.mobileNumber,
        values.password,
        invitationData.company,
        invitationData.role,
        token,
        'email'
      ).then((response) => {
        if (response.data.success) {
          const auth = {
            api_token: response.data.userData.auth.api_token,
            user: response.data.userData,
          }
          saveAuth(auth)
          setCurrentUser(response.data.userData)
        } else {
          setErrorMessage(response.data.message)
          setChecked(true)
          setSubmitting(false)
          setLoading(false)
        }
      })
    },
  })

  useEffect(() => {
    PasswordMeterComponent.bootstrap()
  }, [])

  const openGoogleSignInWindow = () => {
    onSignUpMethodChange('google')
    const googleSignInWindow =
      window.open(
        `${process.env.REACT_APP_BACKEND_URL}/auth/google`,
        'googleSignInWindow',
        'width=500,height=600'
      ) ?? window

    window.addEventListener('message', (event) => {
      if (event.origin === process.env.REACT_APP_BACKEND_ORIGIN_URL) {
        if (event.data.stautsRes) {
          const googleData = event.data

          if (googleData.profile.email === invitationData.email) {
            const socialLastName =
              googleData.profile.family_name === undefined || googleData.profile.family_name === ''
                ? '---'
                : googleData.profile.family_name
            createAccountForSuperInvitedUsers(
              googleData.profile.given_name,
              socialLastName,
              invitationData.email,
              invitationData.company,
              invitationData.role,
              token,
              'google',
              googleData.profile.picture
            ).then((response) => {
              if (response.data.success) {
                const auth = {
                  api_token: response.data.userData.auth.api_token,
                  user: response.data.userData,
                }
                saveAuth(auth)
                setCurrentUser(response.data.userData)
              } else {
                setErrorMessage(response.data.message)
                setChecked(true)
              }
            })
          } else {
            setErrorMessage('Wrong Google Email Selected.')
            setChecked(true)
            setTimeout(() => {
              window.location.reload()
            }, 4000)
          }

          googleSignInWindow.close()
        } else {
          setChecked(true)
          setErrorMessage(event.data.statusMessage)
        }
      }
    })
  }

  const openMicrosoftSignInWindow = () => {
    onSignUpMethodChange('google')
    const microsoftSignInWindow =
      window.open(
        `${process.env.REACT_APP_BACKEND_URL}/auth/microsoft`,
        'googleSignInWindow',
        'width=500,height=600'
      ) ?? window

    window.addEventListener('message', (event) => {
      if (event.origin === process.env.REACT_APP_BACKEND_ORIGIN_URL) {
        if (event.data.stautsRes) {
          const microsoftData = event?.data?.profile

          if (microsoftData?.preferred_username === invitationData.email) {
            createAccountForSuperInvitedUsers(
              microsoftData?.name,
              '---',
              invitationData.email,
              invitationData.company,
              invitationData.role,
              token,
              'google',
              `${process.env.REACT_APP_API_USER_IMAGE_URL}/default.png`
            ).then((response) => {
              if (response.data.success) {
                const auth = {
                  api_token: response.data.userData.auth.api_token,
                  user: response.data.userData,
                }
                saveAuth(auth)
                setCurrentUser(response.data.userData)
              } else {
                setErrorMessage(response.data.message)
                setChecked(true)
              }
            })
          } else {
            setErrorMessage('Wrong Microsoft Email Selected.')
            setChecked(true)
            setTimeout(() => {
              window.location.reload()
            }, 4000)
          }

          microsoftSignInWindow.close()
        } else {
          setChecked(true)
          setErrorMessage(event.data.statusMessage)
        }
      }
    })
  }

  const handleMobileNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '') // Keep only digits
    formik.setFieldValue('mobileNumber', val)
  }

  const handleCountryChange = (_value: string, countryData: CountryData): void => {
    formik.setFieldValue('countryCode', `+${countryData.dialCode}`)
    formik.setFieldTouched('countryCode', true, false)
  }

  const handleToggleConfirmPassword = () => {
    setShowConfirmPassword(!showConfirmPassword)
  }

  const handleTogglePassword = () => {
    setShowPassword(!showPassword)
  }

  const handleSignUpMethodEmail = () => {
    onSignUpMethodChange('email')
  }

  const handleSignUpMethodGoogle = () => {
    onSignUpMethodChange('google')
  }

  return (
    <>
      {!fetchingInv && (
        <form
          className='form w-100 fv-plugins-bootstrap5 fv-plugins-framework'
          noValidate
          id='kt_login_signup_form'
          onSubmit={formik.handleSubmit}
        >
          {/* begin::Heading */}
          <div className='text-center mb-11'>
            {/* begin::Title */}
            <h1 className='text-dark fw-bolder mb-3'>Create Account</h1>
            {/* end::Title */}
          </div>
          {/* end::Heading */}

          {successMessage !== '' ? (
            <AlertSuccess message={successMessage} checked={checked} />
          ) : null}

          {errorMessage !== '' ? <AlertDanger message={errorMessage} checked={checked} /> : null}

          {appData?.googleAuth === 'enabled' && (
            <>
              <div className='d-flex justify-content-center align-items-center gap-2'>
                <div className='mb6'>
                  <input
                    type='radio'
                    className='btn-check'
                    name='signUpMethod'
                    value='google'
                    id='google'
                    checked={signUpMethod === 'google'}
                    onChange={handleSignUpMethodGoogle}
                  />
                  <button
                    type='button'
                    className={`btn btn-flex btn-outline btn-text-gray-700 btn-active-color-primary flex-center text-nowrap w-100 ${signUpMethod === 'google' ? '' : 'bg-state-light'}`}
                    onClick={openGoogleSignInWindow}
                  >
                    <img
                      alt='Logo'
                      src={toAbsoluteUrl('/media/svg/brand-logos/google-icon.svg')}
                      className='h-15px me-3'
                    />
                    Sign Up with Google
                  </button>
                </div>

                <div className='mb6'>
                  <input
                    type='radio'
                    className='btn-check'
                    name='signUpMethod'
                    value='google'
                    id='microsoft'
                    checked={signUpMethod === 'google'}
                    onChange={handleSignUpMethodGoogle}
                  />
                  <button
                    type='button'
                    className={`btn btn-flex btn-outline btn-text-gray-700 btn-active-color-primary flex-center text-nowrap w-100 ${signUpMethod === 'google' ? '' : 'bg-state-light'}`}
                    onClick={openMicrosoftSignInWindow}
                  >
                    <img
                      alt='Logo'
                      src={toAbsoluteUrl('/media/svg/brand-logos/microsoft-5.svg')}
                      className='h-15px me-3'
                    />
                    Sign Up with Microsoft
                  </button>
                </div>
              </div>

              {/* begin::Separator */}
              <div className='separator separator-content my8 mt-8'>
                <span className='w-125px fw-semibold fs-7'>Or with Email</span>
              </div>
              {/* end::Separator */}
            </>
          )}

          <input
            type='radio'
            className='btn-check'
            name='signUpMethod'
            value='email'
            id='email'
            checked={signUpMethod === 'email'}
            onChange={handleSignUpMethodEmail}
          />
          <label
            className={`btn p7 px-0 d-flex align-items-center ${formik.isValid ? 'btnoutline btn-success-light' : 'btn-outlinedashed'}`}
            htmlFor='email'
          >
            <span className='w-100 fw-bold text-start'>
              {/* begin::Form group First Name */}
              <div className='fv-row mb-8'>
                <label className='form-label fw-bolder text-dark fs-6'>First Name</label>
                <input
                  placeholder='First Name'
                  type='text'
                  autoComplete='off'
                  {...formik.getFieldProps('firstname')}
                  className={clsx(
                    'form-control bg-transparent',
                    {
                      'is-invalid': formik.touched.firstname && formik.errors.firstname,
                    },
                    {
                      'is-valid': formik.touched.firstname && !formik.errors.firstname,
                    }
                  )}
                />
                {formik.touched.firstname && formik.errors.firstname && (
                  <div className='fv-plugins-message-container'>
                    <div className='fv-help-block'>
                      <span role='alert'>{formik.errors.firstname}</span>
                    </div>
                  </div>
                )}
              </div>
              {/* end::Form group */}

              {/* begin::Form group First Name */}
              <div className='fv-row mb-8'>
                <label className='form-label fw-bolder text-dark fs-6'>Last Name</label>
                <input
                  placeholder='Last Name'
                  type='text'
                  autoComplete='off'
                  {...formik.getFieldProps('lastname')}
                  className={clsx(
                    'form-control bg-transparent',
                    {
                      'is-invalid': formik.touched.lastname && formik.errors.lastname,
                    },
                    {
                      'is-valid': formik.touched.lastname && !formik.errors.lastname,
                    }
                  )}
                />
                {formik.touched.lastname && formik.errors.lastname && (
                  <div className='fv-plugins-message-container'>
                    <div className='fv-help-block'>
                      <span role='alert'>{formik.errors.lastname}</span>
                    </div>
                  </div>
                )}
              </div>
              {/* end::Form group */}

              {/* begin::Form group Email */}
              <div className='fv-row mb-8'>
                <label className='form-label fw-bolder text-dark fs-6'>Email</label>
                <input
                  placeholder='Email'
                  type='email'
                  autoComplete='off'
                  value={invitationData.email}
                  className='form-control bg-transparent'
                  disabled={true}
                />
              </div>
              {/* end::Form group */}

              {/* begin::Form group Phone number */}
              <div className='fv-row mb-8'>
                <label className='form-label fw-bolder text-dark fs-6'>Mobile Number</label>
                <div className='d-flex gap-3 align-items-center'>
                  <div className='w-50'>
                    <div className='col-lg-14 fv-row d-flex align-items-center'>
                      <PhoneInput
                        country={formik.values.countryCode === '+1' ? 'us' : undefined}
                        value={formik.values.countryCode}
                        onChange={handleCountryChange}
                        inputProps={{
                          name: 'countryCode',
                          readOnly: true,
                        }}
                        inputStyle={{
                          width: '110px',
                          paddingLeft: '55px', // spacing between flag and code
                          height: '38px',
                          backgroundColor: '#f8f9fa',
                          border: '1px solid #ced4da',
                          borderRadius: '4px',
                          fontSize: '14px',
                          cursor: 'pointer',
                        }}
                        buttonStyle={{
                          marginLeft: '0px',
                          border: 'none',
                          background: 'transparent',
                        }}
                        containerStyle={{
                          width: '110px',
                          position: 'relative',
                        }}
                        dropdownStyle={{
                          zIndex: 1000,
                        }}
                      />
                    </div>
                  </div>

                  {/* Mobile number input */}
                  <div className='flex-grow-1 position-relative'>
                    <input
                      placeholder='Mobile number'
                      type='text'
                      value={formik.values.mobileNumber}
                      onChange={handleMobileNumberChange}
                      onBlur={formik.handleBlur}
                      name='mobileNumber'
                      className={clsx(
                        'form-control bg-transparent',
                        {'is-invalid': formik.touched.mobileNumber && formik.errors.mobileNumber},
                        {'is-valid': formik.touched.mobileNumber && !formik.errors.mobileNumber}
                      )}
                    />
                  </div>
                </div>
                {formik.touched.countryCode && formik.errors.countryCode && (
                  <div className='fv-help-block text-danger mt-1 fw-normal'>
                    {formik.errors.countryCode}
                  </div>
                )}
                {formik.touched.mobileNumber && formik.errors.mobileNumber && (
                  <div className='fv-plugins-message-container'>
                    <div className='fv-help-block'>
                      <span role='alert'>{formik.errors.mobileNumber}</span>
                    </div>
                  </div>
                )}
              </div>
              {/* end::Form group */}

              {/* begin::Form group Password */}
              <div className='fv-row mb-8' data-kt-password-meter='true'>
                <div className='mb-1'>
                  <label className='form-label fw-bolder text-dark fs-6'>Password</label>
                  <div className='position-relative mb-3'>
                    <div className='position-relative mb-3'>
                      <div className='d-flex align-items-center justify-content-end position-relative my-1'>
                        <span
                          className={clsx(
                            'position-absolute me-3',
                            {'me-10': formik.touched.password && formik.errors.password},
                            {'me-10': formik.touched.password && !formik.errors.password}
                          )}
                          onClick={handleTogglePassword}
                        >
                          {showPassword ? (
                            <KTIcon iconName='eye-slash' className='fs-1' />
                          ) : (
                            <KTIcon iconName='eye' className='fs-1' />
                          )}
                        </span>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder='Password'
                          autoComplete='off'
                          maxLength={50}
                          {...formik.getFieldProps('password')}
                          className={clsx(
                            'form-control bg-transparent pe-12',
                            {'is-invalid pe-20': formik.touched.password && formik.errors.password},
                            {'is-valid pe-20': formik.touched.password && !formik.errors.password}
                          )}
                        />
                      </div>
                      {formik.touched.password && formik.errors.password && (
                        <div className='fv-plugins-message-container'>
                          <div className='fv-help-block'>
                            <span role='alert'>{formik.errors.password}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* begin::Meter */}
                  <div
                    className='d-flex align-items-center mb-3'
                    data-kt-password-meter-control='highlight'
                  >
                    <div className='flex-grow-1 bg-secondary bg-active-success rounded h-5px me-2'></div>
                    <div className='flex-grow-1 bg-secondary bg-active-success rounded h-5px me-2'></div>
                    <div className='flex-grow-1 bg-secondary bg-active-success rounded h-5px me-2'></div>
                    <div className='flex-grow-1 bg-secondary bg-active-success rounded h-5px'></div>
                  </div>
                  {/* end::Meter */}
                </div>
                <div className='text-muted'>
                  Use 8 or more characters with a mix of letters, numbers & symbols.
                </div>
              </div>
              {/* end::Form group */}

              {/* begin::Form group Confirm password */}
              <div className='fv-row mb-8'>
                <label className='form-label fw-bolder text-dark fs-6'>Confirm Password</label>
                <div className='d-flex align-items-center justify-content-end position-relative my-1'>
                  <span
                    className={clsx(
                      'position-absolute me-3',
                      {'me-10': formik.touched.changepassword && formik.errors.changepassword},
                      {'me-10': formik.touched.changepassword && !formik.errors.changepassword}
                    )}
                    onClick={handleToggleConfirmPassword}
                  >
                    {showConfirmPassword ? (
                      <KTIcon iconName='eye-slash' className='fs-1' />
                    ) : (
                      <KTIcon iconName='eye' className='fs-1' />
                    )}
                  </span>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder='Password confirmation'
                    autoComplete='off'
                    maxLength={50}
                    {...formik.getFieldProps('changepassword')}
                    className={clsx(
                      'form-control bg-transparent pe-12',
                      {
                        'is-invalid pe-20':
                          formik.touched.changepassword && formik.errors.changepassword,
                      },
                      {
                        'is-valid pe-20':
                          formik.touched.changepassword && !formik.errors.changepassword,
                      }
                    )}
                  />
                </div>
                {formik.touched.changepassword && formik.errors.changepassword && (
                  <div className='fv-plugins-message-container'>
                    <div className='fv-help-block'>
                      <span role='alert'>{formik.errors.changepassword}</span>
                    </div>
                  </div>
                )}
              </div>
              {/* end::Form group */}

              {/* begin::Form group */}
              <div className='text-center'>
                <button
                  type='submit'
                  id='kt_sign_up_submit'
                  className='btn btn-lg btn-primary w-100 mb-5'
                  //   disabled={formik.isSubmitting || !formik.isValid || loading}
                >
                  {!loading && <span className='indicator-label'>Join Organization</span>}
                  {loading && (
                    <span className='indicator-progress' style={{display: 'block'}}>
                      Please wait...{' '}
                      <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                    </span>
                  )}
                </button>
              </div>
              {/* end::Form group */}
            </span>
          </label>
        </form>
      )}
      {fetchingInv && (
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
