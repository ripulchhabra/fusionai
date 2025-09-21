import React, {useEffect, useState} from 'react'
import clsx from 'clsx'
import * as Yup from 'yup'
import {useFormik} from 'formik'
import {PasswordMeterComponent} from '../../../../../_metronic/assets/ts/components'
import {KTIcon, toAbsoluteUrl} from '../../../../../_metronic/helpers'
import {useAppContext} from '../../../../pages/AppContext/AppContext'
import PhoneInput, {CountryData} from 'react-phone-input-2'
import 'react-phone-input-2/lib/bootstrap.css'

interface Step2Props {
  userDetails: {
    firstname?: string
    lastname?: string
    email?: string
    countryCode: string
    mobileNumber?: string
    password?: string
  }
  signUpMethod: string
  onSignUpMethodChange: (value: string) => void
  onUserDetailsChange: (details: {[key: string]: string}) => void
  setSuccessGoogleLogin: (value: boolean) => void
  setProfilePic: (value: string) => void
  setErrorMessage: any
  setChecked: any
}

const initialValues = {
  firstname: '',
  lastname: '',
  email: '',
  countryCode: '+1',
  mobileNumber: '',
  password: '',
  changepassword: '',
}

const registrationSchema = Yup.object().shape({
  firstname: Yup.string()
    .min(3, 'Minimum 3 characters')
    .max(50, 'Maximum 50 characters')
    .required('First Name is required'),
  lastname: Yup.string()
    .min(3, 'Minimum 3 characters')
    .max(50, 'Maximum 50 characters')
    .required('Last Name is required'),
  email: Yup.string()
    .email('Wrong email format')
    .min(5, 'Minimum 5 characters')
    .max(50, 'Maximum 50 characters')
    .required('Email is required'),
  mobileNumber: Yup.string()
    .min(10, 'Minimum 10 numbers')
    .max(15, 'Maximum 15 numbers')
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

const Step2: React.FC<Step2Props> = ({
  userDetails,
  signUpMethod,
  onSignUpMethodChange,
  onUserDetailsChange,
  setSuccessGoogleLogin,
  setProfilePic,
  setErrorMessage,
  setChecked,
}) => {
  const isSelected = (type: string) => signUpMethod === type
  const [userMobNumb, setUserMobNumb] = useState<any>('')
  const {appData} = useAppContext()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const formik = useFormik({
    initialValues,
    validationSchema: registrationSchema,
    onSubmit: () => {
      // onUserDetailsChange(values)
    },
  })

  function debounce<T extends (...args: any[]) => void>(func: T, delay = 500) {
    let timeout: NodeJS.Timeout
    return (...args: Parameters<T>) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => func(...args), delay)
    }
  }

  useEffect(() => {
    if (!formik.errors.email || formik.errors.email === 'Email already registered') {
      const checkEmailExists = debounce(async (email: string) => {
        try {
          const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/user/check-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({email}),
          })
          const data = await res.json()

          if (data.exists) {
            if (formik.errors.email !== 'Email already registered')
              formik.setFieldError('email', 'Email already registered')
          } else {
            if (formik.errors.email === 'Email already registered') {
              formik.setFieldError('email', undefined)
            }
          }
        } catch (error) {
          console.error('Email check failed', error)
        }
      }, 600)
      checkEmailExists(formik.values.email)
    }
  }, [formik.values.email, formik.errors.email, formik.touched.email])

  const handlePhoneNumberChange = (e: any, numbertype: 'Mobile') => {
    if (numbertype == 'Mobile') {
      const formattedPhoneNumber = formatPhoneNumber(e.target.value)
      setUserMobNumb(formattedPhoneNumber)
    }
  }

  const formatPhoneNumber = (value: string) => {
    if (!value) return value
    const phoneNumber = value.replace(/[^\d]/g, '')
    const phoneNumberLength = phoneNumber.length
    if (phoneNumberLength < 4) return phoneNumber
    if (phoneNumberLength < 7) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`
  }

  useEffect(() => {
    formik.setFieldValue('mobileNumber', userMobNumb)
  }, [userMobNumb])

  useEffect(() => {
    PasswordMeterComponent.bootstrap()
  }, [])

  useEffect(() => {
    if (formik.isValid) {
      onUserDetailsChange(formik.values)
    }

    if (formik.touched) {
      onSignUpMethodChange('email')
    }
  }, [formik.values, formik.isValid])

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

          setProfilePic(googleData.profile.picture)

          onUserDetailsChange({
            firstname: googleData.profile.given_name,
            lastname: googleData.profile.family_name,
            email: googleData.profile.email,
          })

          googleSignInWindow.close()

          setSuccessGoogleLogin(true)
        } else {
          setChecked(true)
          setErrorMessage(event.data.statusMessage)
        }
      }
    })
  }

  const openMicrosoftSignInWindow = () => {
    onSignUpMethodChange('google')
    let microsoftSignInWindow: any
    try {
      microsoftSignInWindow =
        window.open(
          `${process.env.REACT_APP_BACKEND_URL}/auth/microsoft`,
          'googleSignInWindow',
          'width=500,height=600'
        ) ?? window
    } catch (error) {
      console.log(error)
    }

    window.addEventListener('message', (event) => {
      if (event.origin === process.env.REACT_APP_BACKEND_ORIGIN_URL) {
        if (event.data.stautsRes) {
          const microsoftData = event?.data?.profile

          setProfilePic(`${process.env.REACT_APP_API_USER_IMAGE_URL}/default.png`)

          onUserDetailsChange({
            firstname: microsoftData?.name,
            lastname: '---',
            email: microsoftData?.preferred_username,
          })

          microsoftSignInWindow.close()

          setSuccessGoogleLogin(true)
        } else {
          setChecked(true)
          setErrorMessage(event.data.statusMessage)
        }
      }
    })
  }

  useEffect(() => {
    if (userDetails) {
      formik.setFieldValue('firstname', userDetails.firstname)
      formik.setFieldValue('lastname', userDetails.lastname)
      formik.setFieldValue('email', userDetails.email)
      formik.setFieldValue('countryCode', userDetails.countryCode)
      formik.setFieldValue('mobileNumber', userDetails.mobileNumber)
      formik.setFieldValue('password', userDetails.password)
      formik.setFieldValue('changepassword', userDetails.password)
    }
  }, [])

  useEffect(() => {
    setProfilePic('')
    onUserDetailsChange({
      firstname: '',
      lastname: '',
      email: '',
      mobileNumber: '',
      password: '',
      countryCode: initialValues.countryCode,
    })
    setSuccessGoogleLogin(false)
  }, [])

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handlePhoneNumberChange(e, 'Mobile')
  }

  const handleCountryChange = (value: string, countryData: CountryData) => {
    if (countryData) {
      formik.setFieldValue('countryCode', countryData.dialCode)
      formik.setFieldTouched('countryCode', true, false)
    }
  }

  const handleToggleConfirmPassword = () => {
    setShowConfirmPassword(!showConfirmPassword)
  }

  const handleTogglePassword = () => {
    setShowPassword(!showPassword)
  }

  const handleSignUpMethodChange = (method: string) => () => {
    onSignUpMethodChange(method)
  }

  return (
    <div>
      <h2 className='fw-bolder d-flex align-items-center text-dark mb-10'>
        Choose Sign Up Method
        <i
          className='fas fa-exclamation-circle ms-2 fs-7'
          data-bs-toggle='tooltip'
          title='Billing is issued based on your selected account type'
        ></i>
      </h2>
      <div className='row formcheck'>
        <div className='mb-6'>
          <input
            type='radio'
            className='btn-check'
            name='signUpMethod'
            value='email'
            id='email'
            // checked={signUpMethod === 'email'}
            checked={isSelected('email')}
            onChange={handleSignUpMethodChange('email')}
          />
          <label
            className={`btn btn-outline btn-outline-default mb-10 p-7 d-flex align-items-center ${formik.isValid ? 'btn-outline-success' : 'btn-outline-dashed'}`}
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
                    {'is-invalid': formik.touched.firstname && formik.errors.firstname},
                    {'is-valid': formik.touched.firstname && !formik.errors.firstname}
                  )}
                />
                {formik.touched.firstname && formik.errors.firstname && (
                  <div className='fv-help-block text-danger fw-normal'>
                    <span role='alert'>{formik.errors.firstname}</span>
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
                    {'is-invalid': formik.touched.lastname && formik.errors.lastname},
                    {'is-valid': formik.touched.lastname && !formik.errors.lastname}
                  )}
                />
                {formik.touched.lastname && formik.errors.lastname && (
                  <div className='fv-help-block text-danger fw-normal'>
                    <span role='alert'>{formik.errors.lastname}</span>
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
                  {...formik.getFieldProps('email')}
                  className={clsx(
                    'form-control bg-transparent',
                    {'is-invalid': formik.touched.email && formik.errors.email},
                    {'is-valid': formik.touched.email && !formik.errors.email}
                  )}
                />
                {formik.touched.email && formik.errors.email && (
                  <div className='fv-help-block text-danger fw-normal'>
                    <span role='alert'>{formik.errors.email}</span>
                  </div>
                )}
              </div>
              {/* end::Form group */}

              {/* begin::Form group Phone number */}
              <div className='fv-row mb-8'>
                <label className='form-label fw-bolder text-dark fs-6'>Mobile Number</label>
                <div className='d-flex gap-3 align-items-center'>
                  <div className='w-50'>
                    <div className='col-lg-14 fv-row d-flex align-items-center'>
                      <PhoneInput
                        country={formik.values.countryCode === '1' ? 'us' : undefined}
                        value={formik.values.countryCode}
                        onChange={handleCountryChange}
                        inputProps={{
                          name: 'countryCode',
                          readOnly: true,
                        }}
                        inputStyle={{
                          width: '110px',
                          paddingLeft: '55px', // creates spacing between flag and code
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
                      onChange={handleMobileChange}
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
                  <div className='fv-help-block text-danger fw-normal'>
                    <span role='alert'>{formik.errors.mobileNumber}</span>
                  </div>
                )}
              </div>
              {/* end::Form group */}

              {/* begin::Form group Password */}
              <div className='fv-row mb-8' data-kt-password-meter='true'>
                <div className='mb-1'>
                  <label className='form-label fw-bolder text-dark fs-6'>Password</label>
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
                        {...formik.getFieldProps('password')}
                        className={clsx(
                          'form-control bg-transparent pe-12',
                          {'is-invalid pe-20': formik.touched.password && formik.errors.password},
                          {'is-valid pe-20': formik.touched.password && !formik.errors.password}
                        )}
                      />
                    </div>
                    {formik.touched.password && formik.errors.password && (
                      <div className='fv-help-block text-danger fw-normal'>
                        <span role='alert'>{formik.errors.password}</span>
                      </div>
                    )}
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
            </span>
          </label>
        </div>
      </div>
    </div>
  )
}

export default Step2
