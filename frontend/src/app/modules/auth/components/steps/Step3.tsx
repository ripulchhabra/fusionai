import React, {useEffect, useState} from 'react'
import {useFormik} from 'formik'
import * as Yup from 'yup'
import clsx from 'clsx'
import {Country, State} from 'country-state-city'
import PhoneInput, {CountryData} from 'react-phone-input-2'
import 'react-phone-input-2/lib/bootstrap.css'

interface Step3Props {
  companyDetails: {
    companyName?: string
    phoneNumberCountryCode: string
    phoneNumber?: string
    orgType?: string
    mailingAddStreetName?: string
    mailingAddCountryName?: string
    mailingAddCityName?: string
    mailingAddStateName?: string
    mailingAddZip?: string
    billingAddStreetName?: string
    billingAddCountryName?: string
    billingAddCityName?: string
    billingAddStateName?: string
    billingAddZip?: string
  }
  onCompanyDetailsChange: (details: {[key: string]: string}) => void
  checkboxTick: any
  setCheckboxTick: any
}

const initialValues = {
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
}

const registrationSchema = Yup.object().shape({
  phoneNumber: Yup.string()
    .min(10, 'Minimum 10 numbers')
    .max(15, 'Maximum 15 numbers')
    .required('Company phone number is required'),
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
  mailingAddStateName: Yup.string().required('State is required'),
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
  billingAddStateName: Yup.string().required('State is required'),
  billingAddZip: Yup.string()
    .min(5, 'Minimum 5 numbers')
    .max(6, 'Maximum 6 numbers')
    .required('Zip code is required'),
})

const Step3: React.FC<Step3Props> = ({
  companyDetails,
  onCompanyDetailsChange,
  checkboxTick,
  setCheckboxTick,
}) => {
  const [compPhoneNumb, setCompPhoneNumb] = useState<any>('')
  const [orgType, setOrgType] = useState<string>('')
  const [isOtherSelected, setIsOtherSelected] = useState<boolean>(false)
  const [countries, setCountries] = useState<any[]>([])
  const [mailingStates, setMailingStates] = useState<any[]>([])
  const [billingStates, setBillingStates] = useState<any[]>([])

  useEffect(() => {
    const countryList = Country.getAllCountries()
    setCountries(countryList)
  }, [])

  useEffect(() => {
    if (companyDetails.mailingAddCountryName) {
      setMailingStates(State.getStatesOfCountry(companyDetails.mailingAddCountryName))
    }
    if (companyDetails.billingAddCountryName) {
      setBillingStates(State.getStatesOfCountry(companyDetails.billingAddCountryName))
    }
  }, [companyDetails.mailingAddCountryName, companyDetails.billingAddCountryName])

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

  const formik = useFormik({
    initialValues,
    validationSchema: registrationSchema,
    onSubmit: () => {
      // onCompanyDetailsChange(values)
    },
  })

  const handlePhoneNumberChange = (e: any, numbertype: 'Company') => {
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

  useEffect(() => {
    formik.setFieldValue('phoneNumber', compPhoneNumb)
  }, [compPhoneNumb])

  const autoFillBillingAddress = (event: any) => {
    if (event.target.checked) {
      const streetName = formik.getFieldMeta('billingAddStreetName')
      const countryName = formik.getFieldMeta('billingAddCountryName')
      const city = formik.getFieldMeta('billingAddCityName')
      const state = formik.getFieldMeta('billingAddStateName')
      const zipcode = formik.getFieldMeta('billingAddZip')

      if (
        streetName.value == '' ||
        countryName.value == '' ||
        city.value == '' ||
        state.value == '' ||
        zipcode.value == ''
      ) {
        return
      }

      formik.setFieldValue('mailingAddStreetName', streetName.value)
      formik.setFieldValue('mailingAddCountryName', countryName.value)
      formik.setFieldValue('mailingAddCityName', city.value)
      formik.setFieldValue('mailingAddStateName', state.value)
      formik.setFieldValue('mailingAddZip', zipcode.value)
      setCheckboxTick(true)
    } else {
      setCheckboxTick(false)
      formik.setFieldValue('mailingAddStreetName', '')
      formik.setFieldValue('mailingAddCountryName', '')
      formik.setFieldValue('mailingAddCityName', '')
      formik.setFieldValue('mailingAddStateName', '')
      formik.setFieldValue('mailingAddZip', '')
    }
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

  useEffect(() => {
    if (formik.isValid) {
      onCompanyDetailsChange(formik.values)
    }
  }, [formik.values, formik.isValid])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    if (companyDetails) {
      formik.setFieldValue('companyName', companyDetails.companyName)
      formik.setFieldValue('phoneNumberCountryCode', companyDetails.phoneNumberCountryCode)
      formik.setFieldValue('phoneNumber', companyDetails.phoneNumber)
      formik.setFieldValue('orgType', companyDetails.orgType)
      updateOrgType(companyDetails.orgType ?? '')
      formik.setFieldValue('mailingAddStreetName', companyDetails.mailingAddStreetName)
      formik.setFieldValue('mailingAddCityName', companyDetails.mailingAddCityName)
      formik.setFieldValue('mailingAddStateName', companyDetails.mailingAddStateName)
      formik.setFieldValue('mailingAddZip', companyDetails.mailingAddZip)
      formik.setFieldValue('billingAddStreetName', companyDetails.billingAddStreetName)
      formik.setFieldValue('billingAddCityName', companyDetails.billingAddCityName)
      formik.setFieldValue('billingAddStateName', companyDetails.billingAddStateName)
      formik.setFieldValue('billingAddZip', companyDetails.billingAddZip)
    }
  }, [])

  const handleMailingZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleZipCodeChange(e, 'mailing')
  }

  const handleMailingStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    handleStateNameChange(e, 'mailing')
  }

  const handleMailingCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleCityNameChange(e, 'mailing')
  }

  const handleMailingCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    handleCountryChange(e, 'mailing')
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
    <div>
      <h2 className='fw-bolder d-flex align-items-center text-dark mb-10'>
        Company Details
        <i
          className='fas fa-exclamation-circle ms-2 fs-7'
          data-bs-toggle='tooltip'
          title='Billing is issued based on your selected account type'
        ></i>
      </h2>
      <label
        className={`btn btn-outline btn-outline-default mb-10 p-7 d-flex align-items-center ${formik.isValid ? 'btn-outline-success' : 'btn-outline-dashed'}`}
        htmlFor='kt_create_account_form_account_type_personal'
      >
        <span className='w-100 fw-bold text-start'>
          {/* begin::Form group Company Name */}
          <div className='fv-row mb-8'>
            <label className='form-label fw-bolder text-dark fs-6'>
              Company / Organization Name
            </label>
            <input
              placeholder='Company name'
              type='text'
              autoComplete='off'
              {...formik.getFieldProps('companyName')}
              className={clsx(
                'form-control bg-transparent',
                {'is-invalid': formik.touched.companyName && formik.errors.companyName},
                {'is-valid': formik.touched.companyName && !formik.errors.companyName}
              )}
            />
            {formik.touched.companyName && formik.errors.companyName && (
              <div className='fv-help-block text-danger fw-normal'>
                <span role='alert'>{formik.errors.companyName}</span>
              </div>
            )}
          </div>
          {/* end::Form group */}

          {/* begin::Form group Phone number */}
          <div className='mb-8'>
            <label className='form-label fw-bolder text-dark fs-6 mb-2'>Company Phone Number</label>
            <div className='d-flex gap-3'>
              {/* Display selected country code */}
              <div className='w-50'>
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

              {/* Phone number input */}
              <div className='flex-grow-1 position-relative'>
                <input
                  placeholder='Company phone number'
                  type='text'
                  value={formik.values.phoneNumber}
                  onChange={handleCompanyPhoneChange}
                  onBlur={formik.handleBlur}
                  name='phoneNumber'
                  className={clsx(
                    'form-control bg-transparent',
                    {'is-invalid': formik.touched.phoneNumber && formik.errors.phoneNumber},
                    {'is-valid': formik.touched.phoneNumber && !formik.errors.phoneNumber}
                  )}
                />
              </div>
            </div>
            {formik.touched.phoneNumber && formik.errors.phoneNumber && (
              <div className='fv-help-block text-danger fw-normal'>
                <span role='alert'>{formik.errors.phoneNumber}</span>
              </div>
            )}
          </div>
          {/* end::Form group */}

          {/*begin::Form Group */}
          <div className='fv-row mb-8 mt-3'>
            <label className='form-label fw-bolder text-dark fs-6'>
              Company / Organization Type
            </label>
            <div>
              {/*begin:Option */}
              <label className='d-flex align-items-center justify-content-between mb-6 cursor-pointer'>
                <span className='d-flex align-items-center me-2'>
                  <span className='d-flex flex-column'>
                    <span className='fw-bold text-muted fs-6'>Company</span>
                  </span>
                </span>

                <span className='form-check form-check-custom form-check-solid'>
                  <input
                    className='form-check-input'
                    type='radio'
                    name='orgType'
                    value='Company'
                    checked={orgType === 'Company'}
                    onChange={handleOrgTypeChange('Company')}
                  />
                </span>
              </label>
              {/*end::Option */}

              {/*begin:Option */}
              <label className='d-flex align-items-center justify-content-between mb-6 cursor-pointer'>
                <span className='d-flex align-items-center me-2'>
                  <span className='d-flex flex-column'>
                    <span className='fw-bold text-muted fs-6'>Non Profit</span>
                  </span>
                </span>

                <span className='form-check form-check-custom form-check-solid'>
                  <input
                    className='form-check-input'
                    type='radio'
                    name='orgType'
                    value='Non Profit'
                    checked={orgType === 'Non Profit'}
                    onChange={handleOrgTypeChange('Non Profit')}
                  />
                </span>
              </label>
              {/*end::Option */}

              {/*begin:Option */}
              <label className='d-flex align-items-center justify-content-between mb-6 cursor-pointer'>
                <span className='d-flex align-items-center me-2'>
                  <span className='d-flex flex-column'>
                    <span className='fw-bold text-muted fs-6'>Other</span>
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
                    className={clsx(
                      'mt-2 form-control bg-transparent',
                      {'is-invalid': formik.touched.orgType && formik.errors.orgType},
                      {'is-valid': formik.touched.orgType && !formik.errors.orgType}
                    )}
                  />
                  <>
                    {formik.touched.orgType && formik.errors.orgType && (
                      <div className='fv-plugins-message-container'>
                        <div className='fv-help-block'>
                          <span role='alert'>{formik.errors.orgType}</span>
                        </div>
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
              <span className='text-dark fw-bolder d-block fs-4 mb-5'>Billing Address</span>
              {/* begin::Form group Street Name */}
              <div className='fv-row mb-8'>
                <label className='form-label fw-bolder text-dark fs-6'>Street Name</label>
                <input
                  placeholder='Street name'
                  type='text'
                  autoComplete='off'
                  {...formik.getFieldProps('billingAddStreetName')}
                  onChange={handleBillingStreetChange}
                  className={clsx(
                    'form-control bg-transparent',
                    {
                      'is-invalid':
                        formik.touched.billingAddStreetName && formik.errors.billingAddStreetName,
                    },
                    {
                      'is-valid':
                        formik.touched.billingAddStreetName && !formik.errors.billingAddStreetName,
                    }
                  )}
                />
                {formik.touched.billingAddStreetName && formik.errors.billingAddStreetName && (
                  <div className='fv-help-block text-danger fw-normal'>
                    <span role='alert'>{formik.errors.billingAddStreetName}</span>
                  </div>
                )}
              </div>
              {/* end::Form group */}
              {/* begin::Form group Country */}
              <div className='fv-row mb-8'>
                <label className='form-label fw-bolder text-dark fs-6'>Country</label>
                <select
                  name='billingAddCountryName'
                  className={clsx(
                    'form-select form-select-lg form-select-solid mb-6',
                    {
                      'is-invalid':
                        formik.touched.billingAddCountryName && formik.errors.billingAddCountryName,
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
                  <option value=''>Select a Country</option>
                  {countries.map((c) => (
                    <option key={c.isoCode} value={c.isoCode}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {formik.touched.billingAddCountryName && formik.errors.billingAddCountryName && (
                  <div className='fv-help-block text-danger fw-normal'>
                    <span role='alert'>{formik.errors.billingAddCountryName}</span>
                  </div>
                )}
              </div>
              {/* end::Form group */}
              {/* begin::Form group Street Name */}
              <div className='fv-row mb-8'>
                <label className='form-label fw-bolder text-dark fs-6'>City</label>
                <input
                  placeholder='City name'
                  type='text'
                  autoComplete='off'
                  {...formik.getFieldProps('billingAddCityName')}
                  onChange={handleBillingCityChange}
                  className={clsx(
                    'form-control bg-transparent',
                    {
                      'is-invalid':
                        formik.touched.billingAddCityName && formik.errors.billingAddCityName,
                    },
                    {
                      'is-valid':
                        formik.touched.billingAddCityName && !formik.errors.billingAddCityName,
                    }
                  )}
                />
                {formik.touched.billingAddCityName && formik.errors.billingAddCityName && (
                  <div className='fv-help-block text-danger fw-normal'>
                    <span role='alert'>{formik.errors.billingAddCityName}</span>
                  </div>
                )}
              </div>
              {/* end::Form group */}
              {/* begin::Form group Street Name */}
              <div className='fv-row mb-8'>
                <label className='form-label fw-bolder text-dark fs-6'>State</label>
                <select
                  value={formik.getFieldMeta('billingAddStateName').value}
                  className='form-select form-select-lg form-select-solid'
                  name='states'
                  onChange={handleBillingStateChange}
                >
                  {billingStates.map((s) => (
                    <option key={s.isoCode} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              {/* end::Form group */}
              {/* begin::Form group Street Name */}
              <div className='fv-row mb-8'>
                <label className='form-label fw-bolder text-dark fs-6'>Zipcode</label>
                <input
                  placeholder='Zipcode'
                  type='text'
                  autoComplete='off'
                  {...formik.getFieldProps('billingAddZip')}
                  onChange={handleBillingZipChange}
                  className={clsx(
                    'form-control bg-transparent',
                    {'is-invalid': formik.touched.billingAddZip && formik.errors.billingAddZip},
                    {'is-valid': formik.touched.billingAddZip && !formik.errors.billingAddZip}
                  )}
                />
                {formik.touched.billingAddZip && formik.errors.billingAddZip && (
                  <div className='fv-help-block text-danger fw-normal'>
                    <span role='alert'>{formik.errors.billingAddZip}</span>
                  </div>
                )}
              </div>
              {/* end::Form group */}
            </span>
          </label>

          <label
            className='btn btn-outline btn-outline-dashed btn-outline-default p-7 d-flex align-items-center mb-10'
            htmlFor='kt_create_account_form_account_type_personal'
          >
            <span className='w-100 fw-bold text-start'>
              <span className='text-dark fw-bolder d-block fs-4 mb-5'>Mailing Address</span>

              <div className='fv-row mb-8'>
                <input
                  className='form-check-input me-5'
                  onChange={autoFillBillingAddress}
                  type='checkbox'
                  checked={checkboxTick}
                />
                <label className='form-label fw-bolder text-dark fs-6'>
                  Same as billing address
                </label>
              </div>

              {!checkboxTick && (
                <>
                  {/* begin::Form group Street Name */}
                  <div className='fv-row mb-8'>
                    <label className='form-label fw-bolder text-dark fs-6'>Street Name</label>
                    <input
                      placeholder='Street name'
                      type='text'
                      autoComplete='off'
                      {...formik.getFieldProps('mailingAddStreetName')}
                      onChange={handleMailingStreetChange}
                      className={clsx(
                        'form-control bg-transparent',
                        {
                          'is-invalid':
                            formik.touched.mailingAddStreetName &&
                            formik.errors.mailingAddStreetName,
                        },
                        {
                          'is-valid':
                            formik.touched.mailingAddStreetName &&
                            !formik.errors.mailingAddStreetName,
                        }
                      )}
                    />
                    {formik.touched.mailingAddStreetName && formik.errors.mailingAddStreetName && (
                      <div className='fv-help-block text-danger fw-normal'>
                        <span role='alert'>{formik.errors.mailingAddStreetName}</span>
                      </div>
                    )}
                  </div>
                  {/* end::Form group */}
                  {/* begin::Form group Country */}
                  <div className='fv-row mb-8'>
                    <label className='form-label fw-bolder text-dark fs-6'>Country</label>
                    <select
                      name='mailingAddCountryName'
                      className={clsx(
                        'form-select form-select-lg form-select-solid mb-6',
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
                      {countries.map((c) => (
                        <option key={c.isoCode} value={c.isoCode}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {formik.touched.mailingAddCountryName &&
                      formik.errors.mailingAddCountryName && (
                        <div className='fv-help-block text-danger fw-normal'>
                          <span role='alert'>{formik.errors.mailingAddCountryName}</span>
                        </div>
                      )}
                  </div>
                  {/* end::Form group */}
                  {/* begin::Form group Street Name */}
                  <div className='fv-row mb-8'>
                    <label className='form-label fw-bolder text-dark fs-6'>City</label>
                    <input
                      placeholder='City name'
                      type='text'
                      autoComplete='off'
                      {...formik.getFieldProps('mailingAddCityName')}
                      onChange={handleMailingCityChange}
                      className={clsx(
                        'form-control bg-transparent',
                        {
                          'is-invalid':
                            formik.touched.mailingAddCityName && formik.errors.mailingAddCityName,
                        },
                        {
                          'is-valid':
                            formik.touched.mailingAddCityName && !formik.errors.mailingAddCityName,
                        }
                      )}
                    />
                    {formik.touched.mailingAddCityName && formik.errors.mailingAddCityName && (
                      <div className='fv-plugins-message-container'>
                        <div className='fv-help-block'>
                          <span role='alert'>{formik.errors.mailingAddCityName}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* end::Form group */}
                  {/* begin::Form group Street Name */}
                  <div className='fv-row mb-8'>
                    <label className='form-label fw-bolder text-dark fs-6'>State</label>
                    <select
                      value={formik.getFieldMeta('mailingAddStateName').value}
                      className='form-select form-select-lg form-select-solid'
                      name='states'
                      onChange={handleMailingStateChange}
                    >
                      {mailingStates.map((s) => (
                        <option key={s.isoCode} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* end::Form group */}
                  {/* begin::Form group Street Name */}
                  <div className='fv-row mb-8'>
                    <label className='form-label fw-bolder text-dark fs-6'>Zipcode</label>
                    <input
                      placeholder='Zipcode'
                      type='text'
                      autoComplete='off'
                      {...formik.getFieldProps('mailingAddZip')}
                      onChange={handleMailingZipChange}
                      className={clsx(
                        'form-control bg-transparent',
                        {'is-invalid': formik.touched.mailingAddZip && formik.errors.mailingAddZip},
                        {'is-valid': formik.touched.mailingAddZip && !formik.errors.mailingAddZip}
                      )}
                    />
                    {formik.touched.mailingAddZip && formik.errors.mailingAddZip && (
                      <div className='fv-help-block text-danger fw-normal'>
                        <span role='alert'>{formik.errors.mailingAddZip}</span>
                      </div>
                    )}
                  </div>
                  {/* end::Form group */}
                </>
              )}
            </span>
          </label>
        </span>
      </label>
    </div>
  )
}

export default Step3
