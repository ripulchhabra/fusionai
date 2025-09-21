import {useEffect, useState} from 'react'
import {Dialog} from '@mui/material'
import {DialogContent} from '@mui/material'
import {DialogTitle} from '@mui/material'
import * as Yup from 'yup'
import {useFormik} from 'formik'
import {toAbsoluteUrl} from '../../../../../_metronic/helpers'
import {superAdminSoloUserUpdate} from '../../api'
import {Form} from 'react-bootstrap'
import PhoneInput, {CountryData} from 'react-phone-input-2'
import 'react-phone-input-2/lib/bootstrap.css'

const UserDetailsSchema = Yup.object().shape({
  firstname: Yup.string().required('First Name is required'),
  lastname: Yup.string().required('Last Name is required'),
  email: Yup.string()
    .email('Wrong email format')
    .min(3, 'Minimum 3 symbols')
    .max(50, 'Maximum 50 symbols')
    .required('Email is required'),
  mobileNumber: Yup.string()
    .min(14, 'Minimum 10 numbers')
    .max(14, 'Maximum 10 numbers')
    .required('Mobile number is required'),
  password: Yup.string().min(8, 'At least 8 characters'),
})

interface UserDetailModel {
  firstname: string
  lastname: string
  email: string
  countryCode: string
  mobileNumber: string
  userId: string
  companyId: string
  twoFactorAuth: string
  accountBlocked: string
  password: string
  userCloudIntegration: number
  userCloudIntegrationMob: number
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

export const EditUser = (props: any) => {
  const [loading, setLoading] = useState<boolean>(false)
  const [image, setImage] = useState<any>('')
  const [userMobNumb, setUserMobNumb] = useState<any>('')
  const [user2FA, setUser2FA] = useState<boolean>(props.userDetail.twoFactorAuth ? true : false)
  const [userCloudIntegration, setuserCloudIntegration] = useState<boolean>(
    props.userDetail.userCloudIntegration == 1 ? true : false
  )
  const [userCloudIntegrationMob, setuserCloudIntegrationMob] = useState<boolean>(
    props.userDetail.userCloudIntegrationMob == 1 ? true : false
  )
  const [Dropbox, setDropbox] = useState<boolean>(props.userDetail?.Dropbox == 1 ? true : false)
  const [Dropbox_M, setDropbox_M] = useState<boolean>(
    props.userDetail?.Dropbox_M == 1 ? true : false
  )
  const [GoogleDrive, setGoogleDrive] = useState<boolean>(
    props.userDetail?.GoogleDrive == 1 ? true : false
  )
  const [GoogleDrive_M, setGoogleDrive_M] = useState<boolean>(
    props.userDetail?.GoogleDrive_M == 1 ? true : false
  )
  const [OneDrive, setOneDrive] = useState<boolean>(props.userDetail?.OneDrive == 1 ? true : false)
  const [OneDrive_M, setOneDrive_M] = useState<boolean>(
    props.userDetail?.OneDrive_M == 1 ? true : false
  )
  const [Slack, setSlack] = useState<boolean>(props.userDetail?.Slack == 1 ? true : false)
  const [Slack_M, setSlack_M] = useState<boolean>(props.userDetail?.Slack_M == 1 ? true : false)
  const [Wordpress, setWordpress] = useState<boolean>(
    props.userDetail?.Wordpress == 1 ? true : false
  )
  const [Wordpress_M, setWordpress_M] = useState<boolean>(
    props.userDetail?.Wordpress_M == 1 ? true : false
  )
  const initialValues: UserDetailModel = {
    userId: props.userDetail.userId,
    countryCode: props.userDetail.countryCode,
    mobileNumber: props.userDetail.mobileNumber,
    companyId: props.userDetail.companyId,
    email: props.userDetail.email,
    firstname: props.userDetail.firstname,
    lastname: props.userDetail.lastname,
    twoFactorAuth: props.userDetail.twoFactorAuth,
    accountBlocked: props.userDetail.accountBlocked,
    password: '********',
    userCloudIntegration: props.userDetail.userCloudIntegration,
    userCloudIntegrationMob: props.userDetail.userCloudIntegrationMob,
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
    validationSchema: UserDetailsSchema,
    onSubmit: (values) => {
      setLoading(true)
      setTimeout(() => {
        const formData = new FormData()
        formData.append('userId', props.userDetail.userId)
        formData.append('role', props.userDetail.role)
        formData.append('companyId', props.userDetail.companyId)
        formData.append('firstname', values.firstname)
        formData.append('lastname', values.lastname)
        formData.append('email', values.email)
        formData.append('countryCode', values.countryCode)
        formData.append('mobileNumber', values.mobileNumber)
        formData.append('twoFactorAuth', user2FA ? '1' : '0')
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
        formData.append('image', image)

        if (values.password != '********' && !values.password.includes('*')) {
          formData.append('password', values.password)
        } else {
          formData.append('password', '')
        }

        superAdminSoloUserUpdate(formData)
          .then((response) => {
            if (response.data.success) {
              window.location.reload()
              setLoading(false)
            } else {
              setLoading(false)
            }
          })
          .then(() => {
            props.setShowUserUpdateDialog(false)
          })
          .catch((err) => {
            console.log(err)
            props.setShowUserUpdateDialog(false)
            setLoading(false)
          })
      }, 1000)
    },
  })

  useEffect(() => {
    formik.setFieldValue('mobileNumber', userMobNumb)
  }, [userMobNumb])

  const handlePhoneNumberChange = (e: any, numbertype: 'Company' | 'Mobile') => {
    if (numbertype !== 'Company') {
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
    if (props.userDetail) {
      formik.setFieldValue('firstname', props.userDetail.firstname)
      formik.setFieldValue('lastname', props.userDetail.lastname)
      formik.setFieldValue('email', props.userDetail.email)
      formik.setFieldValue('countryCode', props.userDetail.countryCode)
      formik.setFieldValue('mobileNumber', props.userDetail.mobileNumber)
    }
  }, [props.userDetail])

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

  const handleWordpressChangeM = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked
    setWordpress_M(checked)
    formik.setFieldValue('Wordpress_M', checked ? 1 : 0)
  }

  const handleSlackChangeM = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked
    setSlack_M(checked)
    formik.setFieldValue('Slack_M', checked ? 1 : 0)
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

  const handleUser2FAChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUser2FA(e.target.checked)
    formik.setFieldValue('twoFactorAuth', e.target.checked ? 1 : 0)
  }

  const handleCountryCodeChange = (_: string, countryData: CountryData) => {
    formik.setFieldValue('countryCode', countryData.dialCode)
    formik.setFieldTouched('countryCode', true, false)
  }

  const handleCloseUserUpdateDialog = () => {
    props.setShowUserUpdateDialog(false)
  }

  const handleMobilePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handlePhoneNumberChange(e, 'Mobile')
  }

  return (
    <Dialog
      open={props.showUserUpdateDialog}
      onClose={() => props.setShowUserUpdateDialog(false)}
      aria-labelledby='form-dialog-title'
      PaperProps={{className: 'bg-light text-dark'}}
    >
      <DialogTitle className='px-5 text-center fw-bolder text-muted' id='form-dialog-title'>
        <div className='modal-header' id='kt_modal_update_user_header'>
          <h2 className='fw-bolder'>Update User</h2>
          <div
            className='btn btn-icon btn-sm btn-active-icon-primary'
            onClick={handleCloseUserUpdateDialog}
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
                    <span>Update Avatar</span>
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
                          backgroundImage: `url(${image === '' ? `${props.userDetail?.avatarName}` : URL.createObjectURL(image)})`,
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
                  <label className='required fs-6 fw-bold mb-2'>First Name</label>
                  <input
                    type='text'
                    className='form-control form-control-solid'
                    placeholder='First Name'
                    {...formik.getFieldProps('firstname')}
                  />
                  {formik.touched.firstname && formik.errors.firstname && (
                    <div className='fv-help-block text-danger mt-1 fw-normal'>
                      {formik.errors.firstname}
                    </div>
                  )}
                </div>

                <div className='fv-row mb-7'>
                  <label className='required fs-6 fw-bold mb-2'>Last Name</label>
                  <input
                    type='text'
                    className='form-control form-control-solid'
                    placeholder='Last Name'
                    {...formik.getFieldProps('lastname')}
                  />
                  {formik.touched.lastname && formik.errors.lastname && (
                    <div className='fv-help-block text-danger mt-1 fw-normal'>
                      {formik.errors.lastname}
                    </div>
                  )}
                </div>

                <div className='fv-row mb-7'>
                  <label className='required fs-6 fw-bold mb-2'>Mobile Number</label>
                  <div className='d-flex align-items-center gap-3'>
                    <div className='w-50'>
                      <div className='col-lg-14 fv-row d-flex align-items-center'>
                        <PhoneInput
                          country={formik.values.countryCode === '1' ? 'us' : undefined}
                          value={formik.values.countryCode}
                          onChange={handleCountryCodeChange}
                          inputProps={{
                            name: 'countryCode',
                            readOnly: true,
                          }}
                          inputStyle={{
                            width: '110px',
                            paddingLeft: '55px', // space between flag and dial code
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
                        placeholder='Mobile Number'
                        {...formik.getFieldProps('mobileNumber')}
                        onChange={handleMobilePhoneChange}
                      />
                    </div>
                    {formik.touched.countryCode && formik.errors.countryCode && (
                      <div className='fv-help-block text-danger mt-1 fw-normal'>
                        {formik.errors.countryCode}
                      </div>
                    )}
                    {formik.touched.mobileNumber && formik.errors.mobileNumber && (
                      <div className='fv-help-block text-danger mt-1 fw-normal'>
                        {formik.errors.mobileNumber}
                      </div>
                    )}
                  </div>
                </div>

                <div className='fv-row mb-7'>
                  <label className='required fs-6 fw-bold mb-2'>
                    <span>Email</span>
                    <i
                      className='fas fa-exclamation-circle ms-1 fs-7'
                      data-bs-toggle='tooltip'
                      title='Email address must be active'
                    ></i>
                  </label>
                  <input
                    type='email'
                    className='form-control form-control-solid'
                    placeholder='Email'
                    {...formik.getFieldProps('email')}
                  />
                  {formik.touched.email && formik.errors.email && (
                    <div className='fv-help-block text-danger mt-1 fw-normal'>
                      {formik.errors.email}
                    </div>
                  )}
                </div>

                <div className='fv-row mb-7'>
                  <label className='required fs-6 fw-bold mb-2'>Password</label>
                  <input
                    type='text'
                    className='form-control form-control-solid'
                    placeholder='New Password'
                    {...formik.getFieldProps('password')}
                  />
                  {formik.touched.password && formik.errors.password && (
                    <div className='fv-help-block text-danger mt-1 fw-normal'>
                      {formik.errors.password}
                    </div>
                  )}
                </div>

                <div className='fv-row mb-7'>
                  <label className='required fs-6 fw-bold mb-2'>Two Factor Authentication</label>
                  <Form.Check
                    type='switch'
                    id='default2FA'
                    className='col-lg-4 col-form-label fw-bold fs-6'
                    checked={user2FA === true}
                    onChange={handleUser2FAChange}
                  />
                  {formik.touched.twoFactorAuth && formik.errors.twoFactorAuth && (
                    <div className='fv-help-block text-danger mt-1 fw-normal'>
                      {formik.errors.twoFactorAuth}
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
              onClick={handleCloseUserUpdateDialog}
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
