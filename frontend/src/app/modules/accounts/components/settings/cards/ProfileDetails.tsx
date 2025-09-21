import React, {useEffect, useState} from 'react'
import {toAbsoluteUrl} from '../../../../../../_metronic/helpers'
import {updateUserProfile} from '../../../../auth/core/_requests'
import * as Yup from 'yup'
import {useFormik} from 'formik'
import {useAuth} from '../../../../auth/'
import {AlertSuccess, AlertDanger} from '../../../../alerts/Alerts'
import {FormattedMessage, useIntl} from 'react-intl'
import PhoneInput, {CountryData} from 'react-phone-input-2'
import 'react-phone-input-2/lib/bootstrap.css'

const ProfileDetails: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const {currentUser, auth, setCurrentUser, saveAuth} = useAuth()
  const [image, setImage] = useState<any>('')
  const [userId] = useState(currentUser?.id)
  const [checked, setChecked] = useState<boolean>(false)
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [userMobNumb, setUserMobNumb] = useState<any>(currentUser?.mobileNumber)
  const intl = useIntl()

  const profileDetailsSchema = Yup.object().shape({
    firstname: Yup.string()
      .min(3, intl.formatMessage({id: 'PROFILE.MIN3CHAR'}))
      .max(50, intl.formatMessage({id: 'PROFILE.MAX50CHAR'}))
      .required(intl.formatMessage({id: 'PROFILE.FIRSTNAME.REQUIRED'})),
    lastname: Yup.string()
      .min(3, intl.formatMessage({id: 'PROFILE.MIN3CHAR'}))
      .max(50, intl.formatMessage({id: 'PROFILE.MAX50CHAR'}))
      .required(intl.formatMessage({id: 'PROFILE.LASTNAME.REQUIRED'})),
    // countryCode: Yup.string()
    //   .required(intl.formatMessage({ id: "PROFILE.COUNTRYCODE" }))
    //   .test('not-only-plus',intl.formatMessage({ id: "PROFILE.INVALIDCOUNTRYCODE" }),
    //   (value) => !!value && /^\+\d+$/.test(value)),
    mobileNumber: Yup.string()
      .min(10, intl.formatMessage({id: 'PROFILE.MIN10NUM'}))
      .max(14, intl.formatMessage({id: 'PROFILE.MAX10NUM'}))
      .required(intl.formatMessage({id: 'PROFILE.MOBILE.REQUIRED'})),
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

  const handleImageChange = (e: any) => {
    if (e.target.files[0]) {
      setImage(e.target.files[0])
    } else {
      setImage('')
    }
  }

  const initialValues: any = {
    firstname: currentUser?.firstname,
    lastname: currentUser?.lastname,
    mobileNumber: currentUser?.mobileNumber,
    countryCode: currentUser?.countryCode,
  }

  const formik = useFormik<any>({
    initialValues,
    validationSchema: profileDetailsSchema,
    onSubmit: (values) => {
      setLoading(true)
      setTimeout(() => {
        const formData = new FormData()

        formData.append('userId', userId ? userId.toString() : '')
        formData.append('firstname', values.firstname)
        formData.append('lastname', values.lastname)
        formData.append('mobileNumber', values.mobileNumber)
        formData.append('countryCode', values.countryCode)
        formData.append('image', image)

        updateUserProfile(formData)
          .then((response) => {
            if (response.data.success) {
              setCurrentUser((user) => {
                let updatedData = user
                updatedData = {...updatedData, ...response.data.userData}

                let newAuth = auth
                if (newAuth && newAuth.user) {
                  newAuth.user = updatedData
                }
                saveAuth(newAuth)

                return updatedData
              })
              setChecked(true)
              setSuccessMessage(response.data.message)
              setLoading(false)
              window.scrollTo(0, 0)
            } else {
              setChecked(true)
              setErrorMessage(response.data.message)
              setLoading(false)
              window.scrollTo(0, 0)
            }
          })
          .catch(() => {
            setChecked(true)
            setErrorMessage('Failed to update user profile details')
            setLoading(false)
            window.scrollTo(0, 0)
          })
      }, 1000)
    },
  })

  useEffect(() => {
    formik.setFieldValue('mobileNumber', userMobNumb)
  }, [userMobNumb])

  const handlePhoneNumberChange = (e: any, numbertype: 'Company' | 'Mobile') => {
    if (numbertype !== 'Company') {
      // this is where we'll call our future formatPhoneNumber function that we haven't written yet.
      const formattedPhoneNumber = formatPhoneNumber(e.target.value)
      // we'll set the input value using our setInputValue
      setUserMobNumb(formattedPhoneNumber)
    }
  }

  const formatPhoneNumber = (value: string) => {
    // if input value is falsy eg if the user deletes the input, then just return
    if (!value) return value

    // clean the input for any non-digit values.
    const phoneNumber = value.replace(/[^\d]/g, '')

    // phoneNumberLength is used to know when to apply our formatting for the phone number
    const phoneNumberLength = phoneNumber.length

    // we need to return the value with no formatting if its less then four digits
    // this is to avoid weird behavior that occurs if you  format the area code to early

    if (phoneNumberLength < 4) return phoneNumber

    // if phoneNumberLength is greater than 4 and less the 7 we start to return
    // the formatted number
    if (phoneNumberLength < 7) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`
    }

    // finally, if the phoneNumberLength is greater then seven, we add the last
    // bit of formatting and return it.
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`
  }

  const setDefaultImage = async () => {
    const defaultImagePath = '/media/avatars/blank.png'

    // Fetch the default image as a blob
    const response = await fetch(defaultImagePath)
    const imageBlob = await response.blob()

    // Create a file from the blob (optional, just for consistency if File object is needed)
    const imageFile = new File([imageBlob], 'blank.png', {type: 'image/png'})

    // Set the image using setImage (if it expects a File object)
    setImage(imageFile)
  }

  const handleMobileNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handlePhoneNumberChange(e, 'Mobile')
  }

  const handleCountryCodeChange = (_: string, countryData: CountryData) => {
    formik.setFieldValue('countryCode', countryData.dialCode)
    formik.setFieldTouched('countryCode', true, false)
  }

  return (
    <div className='card mb-5 mb-xl-10'>
      <div
        className='card-header border-0 cursor-pointer'
        role='button'
        data-bs-toggle='collapse'
        data-bs-target='#kt_account_profile_details'
        aria-expanded='true'
        aria-controls='kt_account_profile_details'
      >
        <div className='card-title m-0'>
          <h3 className='fw-bolder m-0'>
            <FormattedMessage id='PROFILE.USER_PROFILE_HEADER' />
          </h3>
        </div>
      </div>

      {successMessage !== '' ? <AlertSuccess message={successMessage} checked={checked} /> : null}

      {errorMessage !== '' ? <AlertDanger message={errorMessage} checked={checked} /> : null}

      <div id='kt_account_profile_details' className='collapse show'>
        <form onSubmit={formik.handleSubmit} noValidate className='form'>
          <div className='card-body border-top p-9'>
            <div className='row mb-6'>
              <label className='col-lg-4 col-form-label fw-bold fs-6'>
                <FormattedMessage id='PROFILE.AVATAR' />
              </label>
              <div className='col-lg-8'>
                <div
                  className='image-input image-input-outline'
                  data-kt-image-input='true'
                  style={{
                    backgroundImage: `url(${toAbsoluteUrl('/media/avatars/blank.png')})`,
                    marginLeft: '5px',
                  }}
                >
                  <div
                    className='image-input-wrapper w-200px h-200px'
                    style={{
                      backgroundImage: `url(${image === '' ? `${auth?.user?.avatarName}` : URL.createObjectURL(image)})`,
                    }}
                  ></div>
                  <label
                    className='btn btn-icon btn-circle btn-active-color-primary w-25px h-25px bg-body shadow'
                    data-kt-image-input-action='change'
                    data-bs-toggle='tooltip'
                    title='Change avatar'
                  >
                    <i className='bi bi-pencil-fill fs-7'></i>
                    <input
                      onChange={handleImageChange}
                      type='file'
                      name='avatar'
                      accept='.png, .jpg, .jpeg'
                    />
                    <input type='hidden' name='avatar_remove' />
                  </label>
                  <span
                    className='btn btn-icon btn-circle btn-active-color-primary w-25px h-25px bg-body shadow'
                    data-kt-image-input-action='cancel'
                    data-bs-toggle='tooltip'
                    title='Cancel avatar'
                  >
                    <i className='bi bi-x fs-2'></i>
                  </span>
                  <span
                    className='btn btn-icon btn-circle btn-active-color-primary w-25px h-25px bg-body shadow'
                    data-kt-image-input-action='remove'
                    data-bs-toggle='tooltip'
                    title='Remove avatar'
                  >
                    <i className='bi bi-x fs-2' onClick={setDefaultImage}></i>
                  </span>
                </div>
              </div>
            </div>

            <div className='row mb-6'>
              <label className='col-lg-4 col-form-label required fw-bold fs-6'>
                <FormattedMessage id='PROFILE.FULLNAME' />
              </label>

              <div className='col-lg-8'>
                <div className='row'>
                  <div className='col-lg-6 fv-row'>
                    <input
                      type='text'
                      className='form-control form-control-lg form-control-solid mb-lg-0'
                      placeholder={intl.formatMessage({id: 'PROFILE.FIRSTNAME'})}
                      {...formik.getFieldProps('firstname')}
                    />
                    {formik.touched.firstname && formik.errors.firstname && (
                      <div className='fv-help-block text-danger'>
                        <>{formik.errors.firstname}</>
                      </div>
                    )}
                  </div>

                  <div className='col-lg-6 fv-row'>
                    <input
                      type='text'
                      className='form-control form-control-lg form-control-solid'
                      placeholder={intl.formatMessage({id: 'PROFILE.LASTNAME'})}
                      {...formik.getFieldProps('lastname')}
                    />
                    {formik.touched.lastname && formik.errors.lastname && (
                      <div className='fv-help-block text-danger'>
                        <>{formik.errors.lastname}</>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className='row mb-6'>
              <label className='col-lg-4 col-form-label fw-bold fs-6'>
                <span className='required'>
                  <FormattedMessage id='PROFILE.MOBILENUM' />
                </span>
              </label>

              <div className='col-lg-8 fv-row'>
                <div className='d-flex align-items-center gap-3'>
                  {/* Country Code Display */}
                  <div className='row'>
                    <div className='col-lg-12 fv-row d-flex align-items-center'>
                      <PhoneInput
                        country={'us'} // default country
                        value={formik.values.countryCode}
                        onChange={handleCountryCodeChange}
                        inputProps={{
                          name: 'countryCode',
                          readOnly: true,
                        }}
                        inputStyle={{
                          width: '110px',
                          paddingLeft: '55px',
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

                  {/* Mobile Number Input */}
                  <div className='flex-grow-1'>
                    <input
                      type='text'
                      className='form-control form-control-lg form-control-solid'
                      placeholder={intl.formatMessage({id: 'PROFILE.MOBILENUM'})}
                      {...formik.getFieldProps('mobileNumber')}
                      onChange={handleMobileNumberChange}
                    />
                  </div>
                </div>

                {/* Error messages */}
                {formik.touched.countryCode && formik.errors.countryCode && (
                  <div className='fv-help-block text-danger mt-1 small'>
                    {typeof formik.errors.countryCode === 'string' && formik.errors.countryCode}
                  </div>
                )}
                {formik.touched.mobileNumber && formik.errors.mobileNumber && (
                  <div className='fv-help-block text-danger mt-1 small'>
                    {typeof formik.errors.mobileNumber === 'string' && formik.errors.mobileNumber}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className='card-footer d-flex justify-content-end py-6 px-9'>
            <button type='submit' className='btn btn-primary' disabled={loading}>
              {!loading && intl.formatMessage({id: 'PROFILE.SAVE_CHANGES'})}
              {loading && (
                <span className='indicator-progress' style={{display: 'block'}}>
                  {intl.formatMessage({id: 'PROFILE.PLEASE_WAIT'})}...{' '}
                  <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export {ProfileDetails}
