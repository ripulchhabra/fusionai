import React, {useEffect, useState} from 'react'
import {Step1, Step2, Step3, Step4} from './steps'
import {AlertDanger, AlertSuccess} from '../../alerts/Alerts'
import {useFormik} from 'formik'
import * as Yup from 'yup'
import {useAuth} from '../core/Auth'
import {register, registerGoogle, registerGoogleComp, registerNonComp} from '../core/_requests'
import {KTIcon} from '../../../../_metronic/helpers'

const initialValues = {
  acceptTerms: false,
}

const registrationSchema = Yup.object().shape({
  acceptTerms: Yup.bool().required('You must accept the terms and conditions'),
})

const Registration: React.FC = () => {
  const [step, setStep] = useState(2)
  const [accountType, setAccountType] = useState('solo')
  const [signUpMethod, setSignUpMethod] = useState('')
  const [profilePic, setProfilePic] = useState('')
  const [userDetails, setUserDetails] = useState({
    firstname: '',
    lastname: '',
    email: '',
    countryCode: '+1',
    mobileNumber: '',
    password: '',
  })
  const [companyDetails, setCompanyDetails] = useState({
    companyName: '',
    phoneNumberCountryCode: '+1',
    phoneNumber: '',
    orgType: '',
    mailingAddStreetName: '',
    mailingAddCountryName: '',
    mailingAddCityName: '',
    mailingAddStateName: '',
    mailingAddZip: '',
    billingAddStreetName: '',
    billingAddCountryName: '',
    billingAddCityName: '',
    billingAddStateName: '',
    billingAddZip: '',
  })
  const [checked, setChecked] = useState<boolean>(false)
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const {saveAuth, setCurrentUser} = useAuth()
  const [checkboxTick, setCheckboxTick] = useState<boolean>(true)
  const [successGoogleLogin, setSuccessGoogleLogin] = useState(false)
  const [acceptTerm, setAcceptTerm] = useState(false)
  const [currency, setCurrency] = useState('USD')

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

  const validateStep = () => {
    let isValid = false
    let error = ''
    switch (step) {
      case 1:
        isValid = accountType !== ''
        error = 'Please select an account type.'
        break
      case 2:
        isValid =
          signUpMethod !== 'google' &&
          Object.values(userDetails).every((value) => value.trim() !== '')
        error = 'Please fill in all required details Or sign up with Google.'
        break
      case 3:
        isValid = Object.values(companyDetails).every((value) => value.trim() !== '')
        error = 'Please fill in all required details.'
        break
      default:
        isValid = true
    }

    if (!isValid) {
      setChecked(true)
      setErrorMessage(error)
    }

    return isValid
  }

  const handleAccountTypeChange = (value: string) => {
    setAccountType(value)
  }

  const handleOtherInputChange = () => {}

  const handleSignUpMethodChange = (value: string) => {
    setSignUpMethod(value)
  }

  const handleUserDetailsChange = (details: {[key: string]: string}) => {
    setUserDetails((prevDetails) => ({...prevDetails, ...details}))
  }

  const handleCompanyDetailsChange = (details: {[key: string]: string}) => {
    setCompanyDetails((prevDetails) => ({...prevDetails, ...details}))
  }

  const handleNextStep = () => {
    if (validateStep()) {
      // setChecked(true);
      // setSuccessMessage("Validation successful!");
      switch (step) {
        case 1:
          setStep(2)
          break
        case 2:
          if (['solo'].includes(accountType)) {
            if (signUpMethod === 'google') {
              setStep(4)
            } else {
              setStep(4)
            }
          } else {
            setStep(3)
          }
          break
        case 3:
          setStep(4)
          break
        default:
          break
      }
    }
  }

  const handlePrevStep = () => {
    switch (step) {
      case 3:
        setStep(2)
        break
      case 4:
        if (['solo'].includes(accountType)) {
          setStep(2)
        } else {
          setStep(3)
        }
        break
      default:
        break
    }
  }

  const formik = useFormik({
    initialValues,
    validationSchema: registrationSchema,
    onSubmit: async ({setSubmitting}: any) => {
      setLoading(true)
      const lastName =
        userDetails.lastname == undefined || userDetails.lastname === ''
          ? '---'
          : userDetails.lastname
      try {
        if (successGoogleLogin) {
          if (['solo'].includes(accountType)) {
            registerGoogle(
              userDetails.email,
              userDetails.firstname,
              lastName,
              profilePic,
              accountType,
              signUpMethod,
              currency
            ).then((response) => {
              if (response.data.success) {
                if (response.data.payment_mode == 'on') {
                  window.location.href = response.data.sessionURL
                } else {
                  const auth = {
                    api_token: response.data.userData.auth.api_token,
                    user: response.data.userData,
                  }
                  saveAuth(auth)
                  setCurrentUser(response.data.userData)
                }
              } else {
                setErrorMessage(response.data.message)
                setChecked(true)
                setSubmitting(false)
                setLoading(false)
                window.scrollTo(0, 0)
              }
            })
          } else {
            registerGoogleComp(
              userDetails.firstname,
              lastName,
              userDetails.email,
              companyDetails.phoneNumberCountryCode,
              companyDetails.phoneNumber,
              companyDetails.companyName,
              companyDetails.orgType,
              companyDetails.mailingAddStreetName,
              companyDetails.mailingAddCountryName,
              companyDetails.mailingAddCityName,
              companyDetails.mailingAddStateName,
              companyDetails.mailingAddZip,
              companyDetails.billingAddStreetName,
              companyDetails.billingAddCountryName,
              companyDetails.billingAddCityName,
              companyDetails.billingAddStateName,
              companyDetails.billingAddZip,
              checkboxTick,
              profilePic,
              accountType,
              signUpMethod,
              currency
            ).then((response) => {
              if (response.data.success) {
                if (response.data.payment_mode == 'on') {
                  window.location.href = response.data.sessionURL
                } else {
                  const auth = {
                    api_token: response.data.userData.auth.api_token,
                    user: response.data.userData,
                  }
                  saveAuth(auth)
                  setCurrentUser(response.data.userData)
                }
              } else {
                setErrorMessage(response.data.message)
                setChecked(true)
                setSubmitting(false)
                setLoading(false)
                window.scrollTo(0, 0)
              }
            })
          }
        } else {
          if (['solo'].includes(accountType)) {
            registerNonComp(
              userDetails.firstname,
              userDetails.lastname,
              userDetails.email,
              userDetails.countryCode,
              userDetails.mobileNumber,
              userDetails.password,
              accountType,
              signUpMethod,
              currency
            ).then((response) => {
              if (response.data.success) {
                if (response.data.payment_mode == 'on') {
                  window.location.href = response.data.sessionURL
                } else {
                  const auth = {
                    api_token: response.data.userData.auth.api_token,
                    user: response.data.userData,
                  }
                  saveAuth(auth)
                  setCurrentUser(response.data.userData)
                }
              } else {
                setErrorMessage(response.data.message)
                setChecked(true)
                setSubmitting(false)
                setLoading(false)
                window.scrollTo(0, 0)
              }
            })
          } else {
            register(
              userDetails.firstname,
              userDetails.lastname,
              userDetails.email,
              companyDetails.phoneNumberCountryCode,
              companyDetails.phoneNumber,
              userDetails.countryCode,
              userDetails.mobileNumber,
              companyDetails.companyName,
              companyDetails.orgType,
              userDetails.password,
              companyDetails.mailingAddStreetName,
              companyDetails.mailingAddCountryName,
              companyDetails.mailingAddCityName,
              companyDetails.mailingAddStateName,
              companyDetails.mailingAddZip,
              companyDetails.billingAddStreetName,
              companyDetails.billingAddCountryName,
              companyDetails.billingAddCityName,
              companyDetails.billingAddStateName,
              companyDetails.billingAddZip,
              checkboxTick,
              accountType,
              signUpMethod,
              currency
            ).then((response) => {
              if (response.data.success) {
                if (response.data.payment_mode == 'on') {
                  window.location.href = response.data.sessionURL
                } else {
                  const auth = {
                    api_token: response.data.userData.auth.api_token,
                    user: response.data.userData,
                  }
                  saveAuth(auth)
                  setCurrentUser(response.data.userData)
                }
              } else {
                setErrorMessage(response.data.message)
                setChecked(true)
                setSubmitting(false)
                setLoading(false)
                window.scrollTo(0, 0)
              }
            })
          }
        }
      } catch (error) {
        console.error(error)
        setChecked(true)
        setErrorMessage('The registration details is incorrect')
        setSubmitting(false)
        setLoading(false)
      }
    },
  })

  useEffect(() => {
    if (successGoogleLogin) {
      if (['solo'].includes(accountType)) {
        setStep(4)
      } else {
        setStep(3)
      }
    }
  }, [successGoogleLogin])

  const handleAcceptTerm = () => {
    setAcceptTerm((prev) => !prev)
  }

  useEffect(() => {
    const storedFormData = sessionStorage.getItem('registrationFormData')
    if (storedFormData) {
      const {
        step,
        accountType,
        signUpMethod,
        userDetails,
        companyDetails,
        acceptTerm,
        profilePic,
        successGoogleLogin,
      } = JSON.parse(storedFormData)
      setStep(step)
      setAccountType(accountType)
      setSignUpMethod(signUpMethod)
      setUserDetails((prevDetails) => ({...prevDetails, ...userDetails}))
      setCompanyDetails((prevDetails) => ({...prevDetails, ...companyDetails}))
      setProfilePic(profilePic)
      setSuccessGoogleLogin(successGoogleLogin)
      setAcceptTerm(acceptTerm)
    }
  }, [])

  useEffect(() => {
    const formData = {
      step,
      accountType,
      signUpMethod,
      userDetails,
      companyDetails,
      acceptTerm,
      profilePic,
      successGoogleLogin,
    }
    sessionStorage.setItem('registrationFormData', JSON.stringify(formData))
  }, [
    step,
    accountType,
    signUpMethod,
    userDetails,
    companyDetails,
    acceptTerm,
    profilePic,
    successGoogleLogin,
  ])

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <Step1
            accountType={accountType}
            onAccountTypeChange={handleAccountTypeChange}
            onOtherInputChange={handleOtherInputChange}
            currency={currency}
            setCurrency={setCurrency}
          />
        )
      case 2:
        return (
          <Step2
            userDetails={userDetails}
            signUpMethod={signUpMethod}
            onSignUpMethodChange={handleSignUpMethodChange}
            onUserDetailsChange={handleUserDetailsChange}
            setSuccessGoogleLogin={setSuccessGoogleLogin}
            setProfilePic={setProfilePic}
            setErrorMessage={setErrorMessage}
            setChecked={setChecked}
          />
        )
      case 3:
        return (
          <Step3
            companyDetails={companyDetails}
            onCompanyDetailsChange={handleCompanyDetailsChange}
            checkboxTick={checkboxTick}
            setCheckboxTick={setCheckboxTick}
          />
        )
      case 4:
        return (
          <Step4
            accountType={accountType}
            signUpMethod={signUpMethod}
            userDetails={userDetails}
            companyDetails={companyDetails}
          />
        )
      default:
        return null
    }
  }

  return (
    <>
      {successMessage !== '' ? <AlertSuccess message={successMessage} checked={checked} /> : null}

      {errorMessage !== '' ? <AlertDanger message={errorMessage} checked={checked} /> : null}

      <div className='container mt-5'>
        <form
          className='form w-100 fv-plugins-bootstrap5 fv-plugins-framework'
          noValidate
          id='kt_login_signup_form'
          onSubmit={formik.handleSubmit}
        >
          {renderStep()}
          {step === 4 && (
            <div className='fv-row mb-8'>
              <label className='form-check form-check-inline' htmlFor='kt_login_toc_agree'>
                <input
                  className='form-check-input'
                  type='checkbox'
                  id='kt_login_toc_agree'
                  checked={acceptTerm}
                  onChange={handleAcceptTerm}
                  disabled={loading}
                />
                <span>
                  I Accept the{' '}
                  <a
                    href={process.env.REACT_APP_TERMS_AND_CONDITIONS}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='ms-1 link-primary'
                  >
                    Terms
                  </a>
                  .
                </span>
              </label>
              {formik.touched.acceptTerms && formik.errors.acceptTerms && (
                <div className='fv-plugins-message-container'>
                  <div className='fv-help-block'>
                    <span role='alert'>
                      <>{formik.errors.acceptTerms}</>
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className={`d-flex flex-stack gap-4`}>
            {step == 2 && (
              <a href='/auth' type='button' className='btn btn-primary text-nowrap'>
                <KTIcon iconName='arrow-left' className='fs-4 me-1' />
                Back to Login
              </a>
            )}
            {step > 2 && (
              <button
                type='button'
                className='btn btn-primary text-nowrap'
                onClick={handlePrevStep}
                disabled={formik.isSubmitting || loading}
              >
                <KTIcon iconName='arrow-left' className='fs-4 me-1' />
                Back
              </button>
            )}
            {step < 4 ? (
              <button
                type='button'
                className='btn btn-primary text-nowrap'
                onClick={handleNextStep}
              >
                Continue
                <KTIcon iconName='arrow-right' className='fs-4 ms-1' />
              </button>
            ) : (
              <div className='text-center text-nowrap'>
                <button
                  type='submit'
                  id='kt_sign_up_submit'
                  className='btn btn-lg btn-success w-100'
                  disabled={formik.isSubmitting || !formik.isValid || !acceptTerm || loading}
                >
                  {!loading && (
                    <span className='indicator-label'>
                      Submit
                      <KTIcon iconName='send' className='fs-4 ms-2 text-white' />
                    </span>
                  )}
                  {loading && (
                    <span className='indicator-progress' style={{display: 'block'}}>
                      Please wait...{' '}
                      <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </>
  )
}

export {Registration}
