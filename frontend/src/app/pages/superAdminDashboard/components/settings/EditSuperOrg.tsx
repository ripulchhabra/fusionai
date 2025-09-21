import {useEffect, useState} from 'react'
import {Dialog} from '@mui/material'
import {DialogContent} from '@mui/material'
import {DialogTitle} from '@mui/material'
import * as Yup from 'yup'
import {useFormik} from 'formik'
import {toAbsoluteUrl} from '../../../../../_metronic/helpers'
import {FormattedMessage} from 'react-intl'
import {Form} from 'react-bootstrap'
import {superAdminOrgUpdate} from '../../api'
import {Country, State} from 'country-state-city'
import PhoneInput, {CountryData} from 'react-phone-input-2'
import 'react-phone-input-2/lib/bootstrap.css'

const profileDetailsSchema = Yup.object().shape({
  phoneNumber: Yup.string()
    .min(10, 'Minimum 10 numbers')
    .max(14, 'Maximum 14 numbers')
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
  billingAddCountryName: Yup.string().required('Country  is required'),
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
    .max(6, 'Maximum 6 numbers')
    .required('Zip code is required'),
})

interface AdminOrgDetailModel {
  companyId: string
  phoneNumberCountryCode: string
  phoneNumber: string
  avatarName: string
  companyName: string
  orgType: string
  mailingAddStreetName: string
  mailingAddCountryName: string
  mailingAddCityName: string
  mailingAddStateName: string
  mailingAddZip: string
  billingAddStreetName: string
  billingAddCountryName: string
  billingAddCityName: string
  billingAddStateName: string
  billingAddZip: string
  isMailAndBillAddressSame: string
  companytwoFactorAuth: string
  userCloudIntegration: string
  userCloudIntegrationMob: string
  Dropbox: number
  Dropbox_M: number
  GoogleDrive: number
  GoogleDrive_M: number
  OneDrive: number
  OneDrive_M: number
  Slack: number
  Slack_M: number
  Wordpress: number
  Wordpress_M: number
}

export const EditSuperOrg = (props: any) => {
  const [loading, setLoading] = useState<boolean>(false)
  const [image, setImage] = useState<any>('')
  const [compPhoneNumb, setCompPhoneNumb] = useState<any>(props.orgDetail.phoneNumber)
  const isOtherOrgType = (type: string | undefined) => {
    if (!type) return false
    if (type == 'Company' || type == 'Non Profit') return false
    return true
  }

  const [isOtherSelected, setIsOtherSelected] = useState<boolean>(
    isOtherOrgType(props.orgDetail.orgType)
  )
  const [orgType, setOrgType] = useState<string | undefined>(props.orgDetail.orgType)
  const [checkboxTick, setCheckboxTick] = useState<any>(props.orgDetail.isMailAndBillAddressSame)
  const [company2FA, setCompany2FA] = useState<boolean>(props.orgDetail.companytwoFactorAuth)
  const [userCloudIntegration, setuserCloudIntegration] = useState<boolean>(
    props.orgDetail.userCloudIntegration == 1 ? true : false
  )
  const [userCloudIntegrationMob, setuserCloudIntegrationMob] = useState<boolean>(
    props.orgDetail.userCloudIntegrationMob == 1 ? true : false
  )
  const [Dropbox, setDropbox] = useState<boolean>(props.orgDetail?.Dropbox == 1 ? true : false)
  const [Dropbox_M, setDropbox_M] = useState<boolean>(
    props.orgDetail?.Dropbox_M == 1 ? true : false
  )
  const [GoogleDrive, setGoogleDrive] = useState<boolean>(
    props.orgDetail?.GoogleDrive == 1 ? true : false
  )
  const [GoogleDrive_M, setGoogleDrive_M] = useState<boolean>(
    props.orgDetail?.GoogleDrive_M == 1 ? true : false
  )
  const [OneDrive, setOneDrive] = useState<boolean>(props.orgDetail?.OneDrive == 1 ? true : false)
  const [OneDrive_M, setOneDrive_M] = useState<boolean>(
    props.orgDetail?.OneDrive_M == 1 ? true : false
  )
  const [Slack, setSlack] = useState<boolean>(props.orgDetail?.Slack == 1 ? true : false)
  const [Slack_M, setSlack_M] = useState<boolean>(props.orgDetail?.Slack_M == 1 ? true : false)
  const [Wordpress, setWordpress] = useState<boolean>(
    props.orgDetail?.Wordpress == 1 ? true : false
  )
  const [Wordpress_M, setWordpress_M] = useState<boolean>(
    props.orgDetail?.Wordpress_M == 1 ? true : false
  )

  const [countries, setCountries] = useState<any[]>([])
  const [mailingStates, setMailingStates] = useState<any[]>([])
  const [billingStates, setBillingStates] = useState<any[]>([])

  const initialValues: AdminOrgDetailModel = {
    companyId: props.orgDetail.companyId,
    phoneNumber: props.orgDetail.phoneNumber,
    phoneNumberCountryCode: props.orgDetail.phoneNumberCountryCode,
    avatarName: props.orgDetail.avatarName,
    companyName: props.orgDetail.companyName,
    orgType: props.orgDetail.orgType,
    mailingAddStreetName: props.orgDetail.mailingAddStreetName,
    mailingAddCountryName: props.orgDetail.mailingAddCountryName,
    mailingAddCityName: props.orgDetail.mailingAddCityName,
    mailingAddStateName: props.orgDetail.mailingAddStateName,
    mailingAddZip: props.orgDetail.mailingAddZip,
    billingAddStreetName: props.orgDetail.billingAddStreetName,
    billingAddCountryName: props.orgDetail.billingAddCountryName,
    billingAddCityName: props.orgDetail.billingAddCityName,
    billingAddStateName: props.orgDetail.billingAddStateName,
    billingAddZip: props.orgDetail.billingAddZip,
    isMailAndBillAddressSame: props.orgDetail.isMailAndBillAddressSame,
    companytwoFactorAuth: props.orgDetailcompanytwoFactorAuth,
    userCloudIntegration: props.orgDetail.userCloudIntegration,
    userCloudIntegrationMob: props.orgDetail.userCloudIntegrationMob,
    Dropbox: props.userDetail?.Dropbox ?? 0,
    Dropbox_M: props.userDetail?.Dropbox_M ?? 0,
    GoogleDrive: props.userDetail?.GoogleDrive ?? 0,
    GoogleDrive_M: props.userDetail?.GoogleDrive_M ?? 0,
    OneDrive: props.userDetail?.OneDrive ?? 0,
    OneDrive_M: props.userDetail?.OneDrive_M ?? 0,
    Slack: props.userDetail?.Slack ?? 0,
    Slack_M: props.userDetail?.Slack_M ?? 0,
    Wordpress: props.userDetail?.Wordpress ?? 0,
    Wordpress_M: props.userDetail?.Wordpress_M ?? 0,
  }

  const handleImageChange = (e: any) => {
    setImage(e.target.files[0])
  }

  const formik = useFormik({
    initialValues,
    validationSchema: profileDetailsSchema,
    onSubmit: (values) => {
      setLoading(true)
      setTimeout(() => {
        const formData = new FormData()
        formData.append('companyId', values.companyId)
        formData.append('companyName', values.companyName)
        formData.append('phoneNumberCountryCode', values.phoneNumberCountryCode)
        formData.append('phoneNumber', values.phoneNumber)
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
        formData.append('companytwoFactorAuth', company2FA ? '1' : '0')
        formData.append('userCloudIntegration', userCloudIntegration ? '1' : '0')
        formData.append('userCloudIntegrationMob', userCloudIntegrationMob ? '1' : '0')
        formData.append('Dropbox', Dropbox ? '1' : '0')
        formData.append('Dropbox_M', Dropbox_M ? '1' : '0')
        formData.append('GoogleDrive', GoogleDrive ? '1' : '0')
        formData.append('GoogleDrive_M', GoogleDrive_M ? '1' : '0')
        formData.append('OneDrive', OneDrive ? '1' : '0')
        formData.append('OneDrive_M', OneDrive_M ? '1' : '0')
        formData.append('Slack', Slack ? '1' : '0')
        formData.append('Slack_M', Slack_M ? '1' : '0')
        formData.append('Wordpress', Wordpress ? '1' : '0')
        formData.append('Wordpress_M', Wordpress_M ? '1' : '0')
        formData.append('userId', props.orgDetail.userId)
        formData.append('image', image)

        superAdminOrgUpdate(formData)
          .then((response) => {
            if (response.data.success) {
              window.location.reload()
              setLoading(false)
            } else {
              setLoading(false)
            }
          })
          .then(() => {
            props.setShowOrgUpdateDialog(false)
          })
          .catch((err) => {
            console.log(err)
            props.setShowOrgUpdateDialog(false)
            setLoading(false)
          })
      }, 1000)
    },
  })

  useEffect(() => {
    formik.setFieldValue('phoneNumber', compPhoneNumb)
  }, [compPhoneNumb])

  const handlePhoneNumberChange = (
    numbertype: 'Company' | 'Mobile',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
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
      formik.setFieldValue('mailingAddStreetName', countryName.value)
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

  const handleStreetNameChange = (
    addressType: 'mailing' | 'billing',
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
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

  const handleCityNameChange = (
    addressType: 'mailing' | 'billing',
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
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

  const handleStateNameChange = (
    addressType: 'mailing' | 'billing',
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
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

  const handleZipCodeChange = (
    addressType: 'mailing' | 'billing',
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
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
    if (props.orgDetail.billingAddStreetName) {
      formik.setFieldValue('billingAddStreetName', props.orgDetail.billingAddStreetName)
      formik.setFieldValue('billingAddCountryName', props.orgDetail.billingAddCountryName)
      formik.setFieldValue('billingAddCityName', props.orgDetail.billingAddCityName)
      formik.setFieldValue('billingAddStateName', props.orgDetail.billingAddStateName)
      formik.setFieldValue('billingAddZip', props.orgDetail.billingAddZip)
    }
    if (props.orgDetail.mailingAddStreetName) {
      formik.setFieldValue('mailingAddStreetName', props.orgDetail.mailingAddStreetName)
      formik.setFieldValue('mailingAddCountryName', props.orgDetail.mailingAddCountryName)
      formik.setFieldValue('mailingAddCityName', props.orgDetail.mailingAddCityName)
      formik.setFieldValue('mailingAddStateName', props.orgDetail.mailingAddStateName)
      formik.setFieldValue('mailingAddZip', props.orgDetail.mailingAddZip)
    }
  }, [props.orgDetail])

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

  useEffect(() => {
    const countryList = Country.getAllCountries()
    setCountries(countryList)
  }, [])

  const handleCountryChange = (
    addressType: 'mailing' | 'billing',
    e: React.ChangeEvent<HTMLSelectElement>
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

  const handleWordpressChangeM = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWordpress_M(e.target.checked)
    formik.setFieldValue('Wordpress_M', e.target.checked ? 1 : 0)
  }

  const handleSlackChangeM = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlack_M(e.target.checked)
    formik.setFieldValue('Slack_M', e.target.checked ? 1 : 0)
  }

  const handleDropboxChangeM = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDropbox_M(e.target.checked)
    formik.setFieldValue('Dropbox_M', e.target.checked ? 1 : 0)
  }

  const handleOneDriveChangeM = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOneDrive_M(e.target.checked)
    formik.setFieldValue('OneDrive_M', e.target.checked ? 1 : 0)
  }

  const handleGoogleDriveChangeM = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGoogleDrive_M(e.target.checked)
    formik.setFieldValue('GoogleDrive_M', e.target.checked ? 1 : 0)
  }

  const handleUserCloudIntegrationMobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setuserCloudIntegrationMob(e.target.checked)
    formik.setFieldValue('userCloudIntegrationMob', e.target.checked ? 1 : 0)
  }

  const handleWordpressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWordpress(e.target.checked)
    formik.setFieldValue('Wordpress', e.target.checked ? 1 : 0)
  }

  const handleSlackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlack(e.target.checked)
    formik.setFieldValue('Slack', e.target.checked ? 1 : 0)
  }

  const handleDropboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDropbox(e.target.checked)
    formik.setFieldValue('Dropbox', e.target.checked ? 1 : 0)
  }

  const handleOneDriveChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOneDrive(e.target.checked)
    formik.setFieldValue('OneDrive', e.target.checked ? 1 : 0)
  }

  const handleGoogleDriveChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGoogleDrive(e.target.checked)
    formik.setFieldValue('GoogleDrive', e.target.checked ? 1 : 0)
  }

  const handleUserCloudIntegrationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setuserCloudIntegration(e.target.checked)
    formik.setFieldValue('userCloudIntegration', e.target.checked ? 1 : 0)
  }

  const handleCompany2FAChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCompany2FA(e.target.checked)
    formik.setFieldValue('companytwoFactorAuth', e.target.checked ? 1 : 0)
  }

  const handlePhoneCountryChange = (_: string, countryData: CountryData) => {
    formik.setFieldValue('phoneNumberCountryCode', countryData.dialCode)
    formik.setFieldTouched('phoneNumberCountryCode', true, false)
  }

  const handleCloseOrgUpdateDialog = () => {
    props.setShowOrgUpdateDialog(false)
  }

  const handleMailingZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleZipCodeChange('mailing', e)
  }

  const handleMailingStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    handleStateNameChange('mailing', e)
  }

  const handleMailingCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleCityNameChange('mailing', e)
  }

  const handleMailingCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    handleCountryChange('mailing', e)
  }

  const handleMailingStreetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleStreetNameChange('mailing', e)
  }

  const handleBillingZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleZipCodeChange('billing', e)
  }

  const handleBillingStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    handleStateNameChange('billing', e)
  }

  const handleBillingCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    handleCountryChange('billing', e)
  }

  const handleBillingCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleCityNameChange('billing', e)
  }

  const handleBillingStreetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleStreetNameChange('billing', e)
  }

  const handleOtherOrgTypeChange = () => {
    updateOrgType('Other')
  }

  const handleNonProfitOrgTypeChange = () => {
    updateOrgType('Non Profit')
  }

  const handleCompanyOrgTypeChange = () => {
    updateOrgType('Company')
  }

  const handleCompanyPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handlePhoneNumberChange('Company', e)
  }

  return (
    <Dialog
      open={props.showOrgUpdateDialog}
      onClose={handleCloseOrgUpdateDialog}
      aria-labelledby='form-dialog-title'
      PaperProps={{className: 'bg-light text-dark'}}
    >
      <DialogTitle className='px-5 text-center fw-bolder text-muted' id='form-dialog-title'>
        <div className='modal-header' id='kt_modal_update_user_header'>
          <h2 className='fw-bolder'>Update Organisation</h2>
          <div
            className='btn btn-icon btn-sm btn-active-icon-primary'
            onClick={handleCloseOrgUpdateDialog}
          >
            <span className='svg-icon svg-icon-1' data-bs-toggle='tooltip' title='Close'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                xmlnsXlink='http://www.w3.org/1999/xlink'
                width='24px'
                height='24px'
                viewBox='0 0 24 24'
                version='1.1'
              >
                <g
                  transform='translate(12.000000, 12.000000) rotate(-45.000000) translate(-12.000000, -12.000000) translate(4.000000, 4.000000)'
                  fill='#000000'
                >
                  <rect fill='#A9A9A9' x='0' y='7' width='16' height='2' rx='1' />
                  <rect
                    fill='#A9A9A9'
                    opacity='0.5'
                    transform='translate(8.000000, 8.000000) rotate(-270.000000) translate(-8.000000, -8.000000)'
                    x='0'
                    y='7'
                    width='16'
                    height='2'
                    rx='1'
                  />
                </g>
              </svg>
            </span>
          </div>
        </div>
      </DialogTitle>
      <DialogContent>
        <form
          style={{width: '380px'}}
          className='form'
          onSubmit={formik.handleSubmit}
          id='kt_modal_update_user_form'
        >
          <div className='modal-body px-5'>
            <div
              className='d-flex flex-column scroll-y me-n7 pe-7'
              id='kt_modal_update_user_scroll'
              data-kt-scroll='true'
              data-kt-scroll-activate='{default: false, lg: true}'
              data-kt-scroll-max-height='auto'
              data-kt-scroll-dependencies='#kt_modal_update_user_header'
              data-kt-scroll-wrappers='#kt_modal_update_user_scroll'
              data-kt-scroll-offset='300px'
            >
              <div id='kt_modal_update_user_user_info' className='show'>
                <div className='mb-7'>
                  <label className='fs-6 fw-bold mb-2 me-5'>
                    <span>Organization Logo</span>
                    <i
                      className='fas fa-exclamation-circle ms-1 fs-7'
                      data-bs-toggle='tooltip'
                      title='Allowed file types: png, jpg, jpeg.'
                    ></i>
                  </label>
                  <div className='mt-5'>
                    <div
                      className='image-input image-input-outline'
                      data-kt-image-input='true'
                      style={{
                        backgroundImage: `url(${toAbsoluteUrl('/media/avatars/blank.png')})`,
                        marginLeft: '5px',
                      }}
                    >
                      <div
                        className='image-input-wrapper w-125px h-125px'
                        style={{
                          backgroundImage: `url(${image === '' ? `${props.orgDetail?.avatarName}` : URL.createObjectURL(image)})`,
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

                <div className='fv-row mb-7'>
                  <label className='required fs-6 fw-bold mb-2'>Company / Organization Name</label>
                  <input
                    type='text'
                    className='form-control form-control-solid'
                    placeholder='Organisation Name'
                    {...formik.getFieldProps('companyName')}
                  />
                  {formik.touched.companyName && formik.errors.companyName && (
                    <div className='fv-plugins-message-container'>
                      <div className='fv-help-block'>{formik.errors.companyName}</div>
                    </div>
                  )}
                </div>
              </div>

              <div className='fv-row mb-7'>
                <div className='fv-row mb-7'>
                  <label className='required fs-6 fw-bold mb-2'>Company Phone Number</label>
                  <div className='d-flex align-items-center gap-3'>
                    <div className='w-50'>
                      <div className='col-lg-14 fv-row d-flex align-items-center'>
                        <PhoneInput
                          country={formik.values.phoneNumberCountryCode === '1' ? 'us' : undefined}
                          value={formik.values.phoneNumberCountryCode}
                          onChange={handlePhoneCountryChange}
                          inputProps={{
                            name: 'phoneNumberCountryCode',
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
                    <div className='flex-grow-1'>
                      <input
                        type='text'
                        className='form-control form-control-solid'
                        placeholder='Company Number'
                        {...formik.getFieldProps('phoneNumber')}
                        onChange={handleCompanyPhoneChange}
                      />
                    </div>
                  </div>
                  {formik.touched.phoneNumber && formik.errors.phoneNumber && (
                    <div className='fv-plugins-message-container'>
                      <div className='fv-help-block'>{formik.errors.phoneNumber}</div>
                    </div>
                  )}
                </div>

                {/* company type  */}
                <div className='fv-row mb-7 org-type'>
                  <label className='form-label fw-bolder text-dark fs-6 required text-nowrap'>
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
                          onChange={handleCompanyOrgTypeChange}
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
                          onChange={handleNonProfitOrgTypeChange}
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
                          onChange={handleOtherOrgTypeChange}
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
                            <div className='fv-plugins-message-container'>
                              <div className='fv-help-block'>
                                <span role='alert'>
                                  <>{formik.errors.orgType}</>
                                </span>
                              </div>
                            </div>
                          )}
                        </>
                      </>
                    )}
                  </div>
                </div>

                {/* billing address  */}
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

                        {formik.touched.billingAddStreetName &&
                          formik.errors.billingAddStreetName && (
                            <div className='fv-plugins-message-container'>
                              <div className='fv-help-block'>
                                <>{formik.errors.billingAddStreetName}</>
                              </div>
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
                          <div className='fv-plugins-message-container'>
                            <div className='fv-help-block'>
                              <>{formik.errors.billingAddCityName}</>
                            </div>
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
                          className='form-control form-control-lg form-control-solid'
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
                            <div className='fv-plugins-message-container'>
                              <div className='fv-help-block'>
                                {typeof formik.errors.billingAddCountryName === 'string' && (
                                  <span>{formik.errors.billingAddCountryName}</span>
                                )}
                              </div>
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
                          {billingStates.map((s) => (
                            <option key={s.isoCode} value={s.name}>
                              {s.name}
                            </option>
                          ))}
                        </select>
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
                          <div className='fv-plugins-message-container'>
                            <div className='fv-help-block'>
                              <>{formik.errors.billingAddZip}</>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </span>
                </label>

                {/* mailing address  */}
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
                                <div className='fv-plugins-message-container'>
                                  <div className='fv-help-block'>
                                    <>{formik.errors.mailingAddStreetName}</>
                                  </div>
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
                              className='form-control form-control-lg form-control-solid'
                              value={formik.values.mailingAddCountryName}
                              onChange={handleMailingCountryChange}
                              onBlur={formik.handleBlur}
                            >
                              <option value=''>Select a country</option>
                              {countries.map((country) => (
                                <option key={country.isoCode} value={country.isoCode}>
                                  {country.name}
                                </option>
                              ))}
                            </select>

                            {formik.touched.mailingAddCountryName &&
                              formik.errors.mailingAddCountryName && (
                                <div className='fv-plugins-message-container'>
                                  <div className='fv-help-block'>
                                    {typeof formik.errors.mailingAddCountryName === 'string' && (
                                      <span>{formik.errors.mailingAddCountryName}</span>
                                    )}
                                  </div>
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

                            {formik.touched.mailingAddCityName &&
                              formik.errors.mailingAddCityName && (
                                <div className='fv-plugins-message-container'>
                                  <div className='fv-help-block'>
                                    <>{formik.errors.mailingAddCityName}</>
                                  </div>
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
                              {mailingStates.map((s) => (
                                <option key={s.isoCode} value={s.name}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
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
                              <div className='fv-plugins-message-container'>
                                <div className='fv-help-block'>
                                  <>{formik.errors.mailingAddZip}</>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </span>
                </label>

                <div className='fv-row mb-7'>
                  <label className='required fs-6 fw-bold mb-2'>Two Factor Authentication</label>
                  <Form.Check
                    type='switch'
                    id='default2FA'
                    className='col-lg-4 col-form-label fw-bold fs-6'
                    checked={company2FA === true}
                    onChange={handleCompany2FAChange}
                  />
                  {formik.touched.companytwoFactorAuth && formik.errors.companytwoFactorAuth && (
                    <div className='fv-plugins-message-container'>
                      <div className='fv-help-block'>{formik.errors.companytwoFactorAuth}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className='modal-footer flex-center'>
            <button
              type='reset'
              className='btn btn-light me-3'
              onClick={handleCloseOrgUpdateDialog}
            >
              Discard
            </button>
            <button type='submit' className='btn btn-primary'>
              <span className='indicator-label'>Submit</span>
              {loading && (
                <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
