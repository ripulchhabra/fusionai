import React, {useEffect, useState} from 'react'
import {toAbsoluteUrl} from '../../../../_metronic/helpers'
import {updateCompanyProfile} from '../../auth/core/_requests'
import * as Yup from 'yup'
import {useFormik} from 'formik'
import {useAuth} from '../../auth/'
import clsx from 'clsx'
import {AlertSuccess, AlertDanger} from '../../alerts/Alerts'
import {FormattedMessage} from 'react-intl'
import {Country, State} from 'country-state-city'
import PhoneInput, {CountryData} from 'react-phone-input-2'
import 'react-phone-input-2/lib/bootstrap.css'

const profileDetailsSchema = Yup.object().shape({
  phoneNumber: Yup.string()
    .min(10, 'Minimum 10 numbers')
    .max(14, 'Maximum 14 numbers')
    .required('Company phone number is required'),
  // phoneNumberCountryCode: Yup.string()
  //   .test('not-only-plus','Invalid Country code',
  //   (value) => !!value && /^\+\d+$/.test(value))
  //   .required('Country Code is required'),
  companyName: Yup.string()
    .min(3, 'Minimum 3 characters')
    .max(50, 'Maximum 50 characters')
    .required('Company name is required'),
  orgType: Yup.string()
    .min(3, 'Minimum 3 characters')
    .max(50, 'Maximum 50 characters')
    .required('Organization type is required'),
  mailingAddStreetName: Yup.string()
    .min(3, 'Minimum 3 characters')
    .max(50, 'Maximum 50 characters')
    .required('Street name/number is required'),
  mailingAddCountryName: Yup.string().required('Country is required'),
  mailingAddCityName: Yup.string()
    .min(3, 'Minimum 3 characters')
    .max(50, 'Maximum 50 characters')
    .required('City is required'),
  mailingAddStateName: Yup.string()
    .min(2, 'Minimum 2 characters')
    .max(50, 'Maximum 50 characters')
    .required('State is required'),
  mailingAddZip: Yup.string()
    .min(5, 'Minimum 5 numbers')
    .max(6, 'Maximum 6 numbers')
    .required('Zip code is required'),
  billingAddStreetName: Yup.string()
    .min(3, 'Minimum 3 characters')
    .max(50, 'Maximum 50 characters')
    .required('Street name/number is required'),
  billingAddCountryName: Yup.string().required('Country is required'),
  billingAddCityName: Yup.string()
    .min(3, 'Minimum 3 characters')
    .max(50, 'Maximum 50 characters')
    .required('City is required'),
  billingAddStateName: Yup.string()
    .min(2, 'Minimum 2 characters')
    .max(50, 'Maximum 50 characters')
    .required('State is required'),
  billingAddZip: Yup.string()
    .min(5, 'Minimum 5 numbers')
    .max(6, 'Maximum 5 numbers')
    .required('Zip code is required'),
})

const CompanyProfile: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const {currentUser, auth, setCurrentUser, saveAuth} = useAuth()
  const [image, setImage] = useState<any>('')
  const [userId] = useState(currentUser?.id)
  const [companyId] = useState(currentUser?.companyId)
  const [checked, setChecked] = useState<boolean>(false)
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [compPhoneNumb, setCompPhoneNumb] = useState<any>(currentUser?.phoneNumber)
  const [countries, setCountries] = useState<any[]>([])
  const [mailingStates, setMailingStates] = useState<any[]>([])
  const [billingStates, setBillingStates] = useState<any[]>([])

  const [checkboxTick, setCheckboxTick] = useState<any>(currentUser?.isMailAndBillAddressSame)

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
    setImage(e.target.files[0])
  }

  useEffect(() => {
    const countryList = Country.getAllCountries()
    setCountries(countryList)
  }, [])

  const handleCountryChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
    addressType: 'mailing' | 'billing'
  ) => {
    const countryCode = e.target.value
    const stateList = State.getStatesOfCountry(countryCode)

    if (addressType === 'mailing') {
      formik.setFieldValue('mailingAddCountryName', countryCode)
      setMailingStates(stateList)
      formik.setFieldValue('mailingAddStateName', '') // Reset state when country change
    } else {
      formik.setFieldValue('billingAddCountryName', countryCode)
      setBillingStates(stateList)
      if (checkboxTick) {
        formik.setFieldValue('mailingAddCountryName', countryCode)
      }
      formik.setFieldValue('billingAddStateName', '') // Reset state when country changes
    }
  }

  const isOtherOrgType = (type: string | undefined) => {
    if (!type) return false
    if (type == 'Company' || type == 'Non Profit') return false
    return true
  }

  const [isOtherSelected, setIsOtherSelected] = useState<boolean>(
    isOtherOrgType(currentUser?.orgType)
  )
  const [orgType, setOrgType] = useState<string | undefined>(currentUser?.orgType)

  const initialValues: any = {
    phoneNumber: currentUser?.phoneNumber,
    phoneNumberCountryCode: currentUser?.phoneNumberCountryCode,
    companyName: currentUser?.companyName,
    orgType: currentUser?.orgType,
    mailingAddStreetName: currentUser?.mailingAddress.addressLine,
    mailingAddCountryName: currentUser?.mailingAddress.country,
    mailingAddCityName: currentUser?.mailingAddress.city,
    mailingAddStateName: currentUser?.mailingAddress.state,
    mailingAddZip: currentUser?.mailingAddress.postCode,
    billingAddStreetName: currentUser?.billingAddress?.addressLine,
    billingAddCountryName: currentUser?.billingAddress?.country,
    billingAddCityName: currentUser?.billingAddress?.city,
    billingAddStateName: currentUser?.billingAddress?.state,
    billingAddZip: currentUser?.billingAddress?.postCode,
  }

  const formik = useFormik<any>({
    initialValues,
    validationSchema: profileDetailsSchema,
    onSubmit: (values) => {
      setLoading(true)
      setTimeout(() => {
        const formData = new FormData()

        console.log(values.firstname)
        formData.append('userId', userId ? userId.toString() : '')
        formData.append('companyId', companyId ? companyId.toString() : '')
        formData.append('phoneNumber', values.phoneNumber)
        formData.append('phoneNumberCountryCode', values.phoneNumberCountryCode)
        formData.append('companyName', values.companyName)
        formData.append('orgType', values.orgType)
        formData.append('mailingAddStreetName', values.mailingAddStreetName)
        formData.append('mailingAddCountryName', values.mailingAddCountryName)
        formData.append('mailingAddCityName', values.mailingAddCityName)
        formData.append('mailingAddStateName', values.mailingAddStateName)
        formData.append('mailingAddZip', values.mailingAddZip)
        formData.append('billingAddStreetName', values.billingAddStreetName)
        formData.append('billingAddCountryName', values.billingAddCountryName)
        formData.append('billingAddCityName', values.billingAddCityName)
        formData.append('billingAddStateName', values.billingAddStateName)
        formData.append('billingAddZip', values.billingAddZip)
        formData.append('isMailAndBillAddressSame', checkboxTick)
        formData.append('image', image)

        updateCompanyProfile(formData)
          .then((response) => {
            if (response.data.success) {
              setCurrentUser((user) => {
                let updatedData = user
                updatedData = {...updatedData, ...response.data.companyData}

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
            setErrorMessage('Failed to update profile details')
            setLoading(false)
            window.scrollTo(0, 0)
          })
      }, 1000)
    },
  })

  useEffect(() => {
    formik.setFieldValue('phoneNumber', compPhoneNumb)
  }, [compPhoneNumb])

  const handlePhoneNumberChange = (e: any, numbertype: 'Company' | 'Mobile') => {
    if (numbertype == 'Company') {
      const formattedPhoneNumber = formatPhoneNumber(e.target.value)
      setCompPhoneNumb(formattedPhoneNumber)
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

  const updateOrgType = (_type: string) => {
    if (_type == 'Other') {
      setOrgType(_type)
      formik.setFieldValue('orgType', '')
      setIsOtherSelected(true)
    } else {
      setIsOtherSelected(false)
      formik.setFieldValue('orgType', _type)
      setOrgType(_type)
    }
  }

  const autoFillBillingAddress = (event: any) => {
    if (event.target.checked) {
      const streetName = formik.getFieldMeta('billingAddStreetName')
      const country = formik.getFieldMeta('billingAddCountryName')
      const city = formik.getFieldMeta('billingAddCityName')
      const state = formik.getFieldMeta('billingAddStateName')
      const zipcode = formik.getFieldMeta('billingAddZip')

      if (
        streetName.value == '' ||
        city.value == '' ||
        state.value == '' ||
        country.value == '' ||
        zipcode.value == ''
      ) {
        return
      }

      formik.setFieldValue('mailingAddStreetName', streetName.value)
      formik.setFieldValue('mailingAddCountryName', country.value)
      formik.setFieldValue('mailingAddCityName', city.value)
      formik.setFieldValue('mailingAddStateName', state.value)
      formik.setFieldValue('mailingAddZip', zipcode.value)
      setCheckboxTick(true)
    } else {
      setCheckboxTick(false)
    }
  }

  const handleStreetNameChange = (event: any, addressType: 'mailing' | 'billing') => {
    if (addressType == 'billing') {
      if (checkboxTick) {
        formik.setFieldValue('billingAddStreetName', event.target.value)
        formik.setFieldValue('mailingAddStreetName', event.target.value)
      } else {
        formik.setFieldValue('billingAddStreetName', event.target.value)
      }
    } else if (addressType == 'mailing') {
      formik.setFieldValue('mailingAddStreetName', event.target.value)
    }
  }

  const handleCityNameChange = (event: any, addressType: 'mailing' | 'billing') => {
    if (addressType == 'billing') {
      if (checkboxTick) {
        formik.setFieldValue('billingAddCityName', event.target.value)
        formik.setFieldValue('mailingAddCityName', event.target.value)
      } else {
        formik.setFieldValue('billingAddCityName', event.target.value)
      }
    } else if (addressType == 'mailing') {
      formik.setFieldValue('mailingAddCityName', event.target.value)
    }
  }

  const handleStateNameChange = (event: any, addressType: 'mailing' | 'billing') => {
    if (addressType == 'billing') {
      if (checkboxTick) {
        formik.setFieldValue('mailingAddStateName', event.target.value)
        formik.setFieldValue('billingAddStateName', event.target.value)
      } else {
        formik.setFieldValue('billingAddStateName', event.target.value)
      }
    } else if (addressType == 'mailing') {
      formik.setFieldValue('mailingAddStateName', event.target.value)
    }
  }

  useEffect(() => {
    if (formik.values.billingAddCountryName) {
      const stateList = State.getStatesOfCountry(formik.values.billingAddCountryName)
      setBillingStates(stateList)

      if (!formik.values.billingAddStateName && stateList.length > 0) {
        formik.setFieldValue('billingAddStateName', stateList[0].name) // or isoCode
      }
    }
    if (formik.values.mailingAddCountryName) {
      const stateList = State.getStatesOfCountry(formik.values.mailingAddCountryName)
      setMailingStates(stateList)

      if (!formik.values.mailingAddStateName && stateList.length > 0) {
        formik.setFieldValue('mailingAddStateName', stateList[0].name) // or isoCode
      }
    }
  }, [])

  const handleZipCodeChange = (event: any, addressType: 'mailing' | 'billing') => {
    if (addressType == 'billing') {
      if (checkboxTick) {
        formik.setFieldValue('mailingAddZip', event.target.value)
        formik.setFieldValue('billingAddZip', event.target.value)
      } else {
        formik.setFieldValue('billingAddZip', event.target.value)
      }
    } else if (addressType == 'mailing') {
      formik.setFieldValue('mailingAddZip', event.target.value)
    }
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

  const handleMailingZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleZipCodeChange(e, 'mailing')
  }

  const handleMailingStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    handleStateNameChange(e, 'mailing')
  }

  const handleMailingCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    handleCountryChange(e, 'mailing')
  }

  const handleMailingCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleCityNameChange(e, 'mailing')
  }

  const handleMailingStreetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleStreetNameChange(e, 'mailing')
  }

  const handleBillingZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleZipCodeChange(e, 'billing')
  }

  const handleBillingStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    handleStateNameChange(e, 'billing')
  }

  const handleBillingCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleCityNameChange(e, 'billing')
  }

  const handleBillingCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    handleCountryChange(e, 'billing')
  }

  const handleBillingStreetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleStreetNameChange(e, 'billing')
  }

  const handleCompanyPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handlePhoneNumberChange(e, 'Company')
  }

  const handlePhoneCodeChange = (_: string, countryData: CountryData) => {
    formik.setFieldValue('phoneNumberCountryCode', countryData.dialCode)
    formik.setFieldTouched('phoneNumberCountryCode', true, false)
  }

  const handleOrgTypeChange = (type: string) => () => {
    updateOrgType(type)
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
            <FormattedMessage id='COMPANY.PROFILE.TITLE' />
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
                <FormattedMessage id='COMPANY.PROFILE.LOGO' />
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
                      backgroundImage: `url(${image === '' ? `${auth?.user?.companyLogo}` : URL.createObjectURL(image)})`,
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
                <FormattedMessage id='COMPANY.PROFILE.NAME' />
              </label>

              <div className='col-lg-8 fv-row'>
                <input
                  type='text'
                  className='form-control form-control-lg form-control-solid'
                  placeholder='Company name'
                  {...formik.getFieldProps('companyName')}
                />
                {formik.touched.companyName && formik.errors.companyName && (
                  <div className='fv-help-block text-danger mt-1'>
                    <>{formik.errors.companyName}</>
                  </div>
                )}
              </div>
            </div>

            <div className='row mb-6'>
              <label className='col-lg-4 col-form-label fw-bold fs-6'>
                <span className='required'>
                  <FormattedMessage id='COMPANY.PROFILE.PHONE' />
                </span>
              </label>
              <div className='col-lg-8 fv-row d-flex'>
                <div className='d-flex align-items-center gap-3'></div>

                {/* Country Code Input */}
                <div>
                  <div className='col-lg-14 fv-row d-flex align-items-center'>
                    <PhoneInput
                      country={formik.values.phoneNumberCountryCode === '1' ? 'us' : undefined}
                      value={formik.values.phoneNumberCountryCode}
                      onChange={handlePhoneCodeChange}
                      inputProps={{
                        name: 'phoneNumberCountryCode',
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

                {/* Phone Number Input */}
                <div className='flex-grow-1'>
                  <input
                    type='text'
                    className='form-control form-control-lg form-control-solid'
                    placeholder='Company phone number'
                    {...formik.getFieldProps('phoneNumber')}
                    onChange={handleCompanyPhoneChange}
                  />
                </div>
              </div>

              {/* Error messages */}
              {formik.touched.phoneNumberCountryCode && formik.errors.phoneNumberCountryCode && (
                <div className='fv-help-block text-danger mt-1 small'>
                  {typeof formik.errors.phoneNumberCountryCode === 'string' &&
                    formik.errors.phoneNumberCountryCode}
                </div>
              )}
              {formik.touched.phoneNumber && formik.errors.phoneNumber && (
                <div className='fv-help-block text-danger mt-1 small'>
                  {typeof formik.errors.phoneNumber === 'string' && formik.errors.phoneNumber}
                </div>
              )}
            </div>

            {/*begin::Form Group */}
            <div className='fv-row mb-8 org-type'>
              <label className='form-label fw-bolder text-dark fs-6'>
                <FormattedMessage id='COMPANY.PROFILE.TYPE' />
              </label>
              <div>
                {/*begin:Option */}
                <label className='d-flex align-items-center justify-content-between mb-6 cursor-pointer'>
                  <span className='d-flex align-items-center me-2'>
                    <span className='d-flex flex-column'>
                      <span className='fw-bold text-muted fs-6'>
                        <FormattedMessage id='AUTH.REGISTER.ORG_TYPE.TYPE1' />
                      </span>
                    </span>
                  </span>

                  <span className='form-check form-check-custom form-check-solid'>
                    <input
                      className='form-check-input'
                      type='radio'
                      name='orgType'
                      value='Company'
                      checked={orgType === 'Company' && !isOtherSelected}
                      onChange={handleOrgTypeChange('Company')}
                    />
                  </span>
                </label>
                {/*end::Option */}

                {/*begin:Option */}
                <label className='d-flex align-items-center justify-content-between mb-6 cursor-pointer'>
                  <span className='d-flex align-items-center me-2'>
                    <span className='d-flex flex-column'>
                      <span className='fw-bold text-muted fs-6'>
                        <FormattedMessage id='AUTH.REGISTER.ORG_TYPE.TYPE2' />
                      </span>
                    </span>
                  </span>

                  <span className='form-check form-check-custom form-check-solid'>
                    <input
                      className='form-check-input'
                      type='radio'
                      name='orgType'
                      value='Non Profit'
                      checked={orgType === 'Non Profit' && !isOtherSelected}
                      onChange={handleOrgTypeChange('Non Profit')}
                    />
                  </span>
                </label>
                {/*end::Option */}

                {/*begin:Option */}
                <label className='d-flex align-items-center justify-content-between mb-6 cursor-pointer'>
                  <span className='d-flex align-items-center me-2'>
                    <span className='d-flex flex-column'>
                      <span className='fw-bold text-muted fs-6'>
                        <FormattedMessage id='AUTH.REGISTER.ORG_TYPE.TYPE3' />
                      </span>
                    </span>
                  </span>

                  <span className='form-check form-check-custom form-check-solid'>
                    <input
                      className='form-check-input'
                      type='radio'
                      name='appType'
                      value='Other'
                      checked={isOtherSelected}
                      onChange={handleOrgTypeChange('Other')}
                    />
                  </span>
                </label>
                {/*end::Option */}

                {isOtherSelected && (
                  <>
                    <input
                      type='text'
                      placeholder='Organization type'
                      autoComplete='off'
                      {...formik.getFieldProps('orgType')}
                      className='form-control form-control-lg form-control-solid'
                    />

                    <>
                      {formik.touched.orgType && formik.errors.orgType && (
                        <div className='fv-help-block text-danger fw-normal'>
                          <span role='alert'>
                            <>{formik.errors.orgType}</>
                          </span>
                        </div>
                      )}
                    </>
                  </>
                )}
              </div>
            </div>
            {/*end::Form Group */}

            <label
              className='btn btn-outline btn-outline-dashed btn-outline-default p-7 d-flex align-items-center mb-10'
              htmlFor='kt_create_account_form_account_type_personal'
            >
              <span className='w-100 fw-bold text-start'>
                <span className='text-dark fw-bolder d-block fs-4 mb-2'>
                  <FormattedMessage id='AUTH.REGISTER.BILLING_ADDRESS' />
                </span>
                <div className='row mb-6'>
                  <label className='col-lg-4 col-form-label fw-bold fs-6'>
                    <span className='required'>
                      <FormattedMessage id='COMMUNITY.ADDRESS.STREET' />
                    </span>
                  </label>

                  <div className='col-lg-8 fv-row'>
                    <input
                      type='text'
                      className='form-control form-control-lg form-control-solid'
                      placeholder='Street Name'
                      {...formik.getFieldProps('billingAddStreetName')}
                      onChange={handleBillingStreetChange}
                    />

                    {formik.touched.billingAddStreetName && formik.errors.billingAddStreetName && (
                      <div className='fv-help-block text-danger mt-1 small fw-normal'>
                        <>{formik.errors.billingAddStreetName}</>
                      </div>
                    )}
                  </div>
                </div>

                <div className='row mb-6'>
                  <label className='col-lg-4 col-form-label fw-bold fs-6'>
                    <span className='required'>
                      <FormattedMessage id='COMMUNITY.ADDRESS.COUNTRY' />
                    </span>
                  </label>

                  <div className='col-lg-8 fv-row'>
                    <select
                      name='billingAddCountryName'
                      className={clsx(
                        'form-control form-control-lg form-control-solid',
                        {
                          'is-invalid':
                            formik.touched.billingAddCountryName &&
                            formik.errors.billingAddCountryName,
                        },
                        {
                          'is-valid':
                            formik.touched.billingAddCountryName &&
                            !formik.errors.billingAddCountryName,
                        }
                      )}
                      value={formik.values.billingAddCountryName}
                      onChange={handleBillingCountryChange}
                      onBlur={formik.handleBlur}
                    >
                      <option value=''>Select a country</option>
                      {countries.map((country) => (
                        <option key={country.isoCode} value={country.isoCode}>
                          {country.name}
                        </option>
                      ))}
                    </select>

                    {formik.touched.billingAddCountryName &&
                      formik.errors.billingAddCountryName && (
                        <div className='fv-help-block text-danger mt-1 small fw-normal'>
                          {typeof formik.errors.billingAddCountryName === 'string' && (
                            <span>{formik.errors.billingAddCountryName}</span>
                          )}
                        </div>
                      )}
                  </div>
                </div>

                <div className='row mb-6'>
                  <label className='col-lg-4 col-form-label fw-bold fs-6'>
                    <span className='required'>
                      <FormattedMessage id='COMMUNITY.ADDRESS.CITY' />
                    </span>
                  </label>

                  <div className='col-lg-8 fv-row'>
                    <input
                      type='text'
                      className='form-control form-control-lg form-control-solid'
                      placeholder='City Name'
                      {...formik.getFieldProps('billingAddCityName')}
                      onChange={handleBillingCityChange}
                    />

                    {formik.touched.billingAddCityName && formik.errors.billingAddCityName && (
                      <div className='fv-help-block text-danger mt-1 small fw-normal'>
                        <>{formik.errors.billingAddCityName}</>
                      </div>
                    )}
                  </div>
                </div>

                <div className='row mb-6'>
                  <label className='col-lg-4 col-form-label fw-bold fs-6'>
                    <span className='required'>
                      <FormattedMessage id='COMMUNITY.ADDRESS.STATE' />
                    </span>
                  </label>

                  <div className='col-lg-8 fv-row'>
                    <select
                      value={formik.getFieldMeta('billingAddStateName').value}
                      className='form-select form-select-lg form-select-solid'
                      name='states'
                      onChange={handleBillingStateChange}
                    >
                      <option value=''>Select a State</option>
                      {billingStates.map((s) => (
                        <option key={s.isoCode} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    {formik.touched.billingAddStateName && formik.errors.billingAddStateName && (
                      <div className='fv-help-block text-danger mt-1 small fw-normal'>
                        {typeof formik.errors.billingAddStateName === 'string' && (
                          <span>{formik.errors.billingAddStateName}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className='row mb-6'>
                  <label className='col-lg-4 col-form-label fw-bold fs-6'>
                    <span className='required'>
                      <FormattedMessage id='COMMUNITY.ADDRESS.ZIP' />
                    </span>
                  </label>

                  <div className='col-lg-8 fv-row'>
                    <input
                      type='text'
                      className='form-control form-control-lg form-control-solid'
                      placeholder='Zipcode'
                      {...formik.getFieldProps('billingAddZip')}
                      onChange={handleBillingZipChange}
                    />

                    {formik.touched.billingAddZip && formik.errors.billingAddZip && (
                      <div className='fv-help-block text-danger mt-1 small fw-normal'>
                        <>{formik.errors.billingAddZip}</>
                      </div>
                    )}
                  </div>
                </div>
              </span>
            </label>

            <label
              className='btn btn-outline btn-outline-dashed btn-outline-default p-7 d-flex align-items-center mb-10'
              htmlFor='kt_create_account_form_account_type_personal'
            >
              <span className='w-100 fw-bold text-start'>
                <span className='text-dark fw-bolder d-block fs-4 mb-2'>
                  <FormattedMessage id='AUTH.REGISTER.MAILING_ADDRESS' />
                </span>

                <div className='fv-row'>
                  <input
                    className='form-check-input me-5'
                    onChange={autoFillBillingAddress}
                    type='checkbox'
                    checked={checkboxTick}
                  />
                  <label className='form-label fw-bolder text-dark fs-6'>
                    <FormattedMessage id='AUTH.REGISTER.ADDRESS.SAME' />
                  </label>
                </div>

                {!checkboxTick && (
                  <>
                    <div className='row mb-6'>
                      <label className='col-lg-4 col-form-label fw-bold fs-6'>
                        <span className='required'>
                          <FormattedMessage id='COMMUNITY.ADDRESS.STREET' />
                        </span>
                      </label>

                      <div className='col-lg-8 fv-row'>
                        <input
                          type='text'
                          className='form-control form-control-lg form-control-solid'
                          placeholder='Street Name'
                          {...formik.getFieldProps('mailingAddStreetName')}
                          onChange={handleMailingStreetChange}
                        />

                        {formik.touched.mailingAddStreetName &&
                          formik.errors.mailingAddStreetName && (
                            <div className='fv-help-block text-danger mt-1 fw-normal'>
                              <>{formik.errors.mailingAddStreetName}</>
                            </div>
                          )}
                      </div>
                    </div>

                    <div className='row mb-6'>
                      <label className='col-lg-4 col-form-label fw-bold fs-6'>
                        <span className='required'>
                          <FormattedMessage id='COMMUNITY.ADDRESS.CITY' />
                        </span>
                      </label>

                      <div className='col-lg-8 fv-row'>
                        <input
                          type='text'
                          className='form-control form-control-lg form-control-solid'
                          placeholder='City Name'
                          {...formik.getFieldProps('mailingAddCityName')}
                          onChange={handleMailingCityChange}
                        />

                        {formik.touched.mailingAddCityName && formik.errors.mailingAddCityName && (
                          <div className='fv-help-block text-danger mt-1 fw-normal'>
                            <>{formik.errors.mailingAddCityName}</>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className='row mb-6'>
                      <label className='col-lg-4 col-form-label fw-bold fs-6'>
                        <span className='required'>
                          <FormattedMessage id='COMMUNITY.ADDRESS.COUNTRY' />
                        </span>
                      </label>

                      <div className='col-lg-8 fv-row'>
                        <select
                          name='mailingAddCountryName'
                          className={clsx(
                            'form-control form-control-lg form-control-solid',
                            {
                              'is-invalid':
                                formik.touched.mailingAddCountryName &&
                                formik.errors.mailingAddCountryName,
                            },
                            {
                              'is-valid':
                                formik.touched.mailingAddCountryName &&
                                !formik.errors.mailingAddCountryName,
                            }
                          )}
                          value={formik.values.mailingAddCountryName}
                          onChange={handleMailingCountryChange}
                          onBlur={formik.handleBlur}
                        >
                          <option value=''>Select a Country</option>
                          {countries.map((country) => (
                            <option key={country.isoCode} value={country.isoCode}>
                              {country.name}
                            </option>
                          ))}
                        </select>

                        {formik.touched.mailingAddCountryName &&
                          formik.errors.mailingAddCountryName && (
                            <div className='fv-help-block text-danger mt-1 fw-normal'>
                              {typeof formik.errors.mailingAddCountryName === 'string' && (
                                <span>{formik.errors.mailingAddCountryName}</span>
                              )}
                            </div>
                          )}
                      </div>
                    </div>

                    <div className='row mb-6'>
                      <label className='col-lg-4 col-form-label fw-bold fs-6'>
                        <span className='required'>
                          <FormattedMessage id='COMMUNITY.ADDRESS.STATE' />
                        </span>
                      </label>

                      <div className='col-lg-8 fv-row'>
                        <select
                          value={formik.getFieldMeta('mailingAddStateName').value}
                          className='form-select form-select-lg form-select-solid'
                          name='states'
                          onChange={handleMailingStateChange}
                        >
                          <option value=''>Select a State</option>
                          {mailingStates.map((s) => (
                            <option key={s.isoCode} value={s.name}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        {formik.touched.mailingAddStateName &&
                          formik.errors.mailingAddStateName && (
                            <div className='fv-help-block text-danger mt-1 fw-normal'>
                              {typeof formik.errors.mailingAddStateName === 'string' && (
                                <span>{formik.errors.mailingAddStateName}</span>
                              )}
                            </div>
                          )}
                      </div>
                    </div>

                    <div className='row mb-6'>
                      <label className='col-lg-4 col-form-label fw-bold fs-6'>
                        <span className='required'>
                          <FormattedMessage id='COMMUNITY.ADDRESS.ZIP' />
                        </span>
                      </label>

                      <div className='col-lg-8 fv-row'>
                        <input
                          type='text'
                          className='form-control form-control-lg form-control-solid'
                          placeholder='Zipcode'
                          {...formik.getFieldProps('mailingAddZip')}
                          onChange={handleMailingZipChange}
                        />

                        {formik.touched.mailingAddZip && formik.errors.mailingAddZip && (
                          <div className='fv-help-block text-danger mt-1 fw-normal'>
                            <>{formik.errors.mailingAddZip}</>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </span>
            </label>
          </div>

          <div className='card-footer d-flex justify-content-end py-6 px-9'>
            <button type='submit' className='btn btn-primary' disabled={loading}>
              {!loading && <FormattedMessage id='PROFILE.SAVE_CHANGES' />}
              {loading && (
                <span className='indicator-progress' style={{display: 'block'}}>
                  <FormattedMessage id='PROFILE.PLEASE_WAIT' />
                  ... <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export {CompanyProfile}
