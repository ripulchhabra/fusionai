import {useEffect, useState} from 'react'
import {Dialog} from '@mui/material'
import {DialogContent} from '@mui/material'
import {DialogTitle} from '@mui/material'
import * as Yup from 'yup'
import {useFormik} from 'formik'
import {getUserDynamicRole} from '../../../../modules/document-management/api'
import {toAbsoluteUrl} from '../../../../../_metronic/helpers'
import {superAdminUserUpdate} from '../../api'
import PhoneInput, {CountryData} from 'react-phone-input-2'
import 'react-phone-input-2/lib/bootstrap.css'

const adminUserDetailsSchema = Yup.object().shape({
  firstname: Yup.string().required('First Name is required'),
  lastname: Yup.string().required('Last Name is required'),
  email: Yup.string()
    .email('Wrong email format')
    .min(3, 'Minimum 3 symbols')
    .max(50, 'Maximum 50 symbols')
    .required('Email is required'),
  mobileNumber: Yup.string()
    .min(10, 'Minimum 10 numbers')
    .max(14, 'Maximum 14 numbers')
    .required('Mobile number is required'),
  password: Yup.string().min(8, 'At least 8 characters'),
})

interface AdminUserDetailModel {
  firstname: string
  lastname: string
  email: string
  countryCode: string
  mobileNumber: string
  password: string
}

export const UserUpdate = (props: any) => {
  const [loading, setLoading] = useState<boolean>(false)
  const [image, setImage] = useState<any>('')
  const [role, setRole] = useState<string>('')
  const [userMobNumb, setUserMobNumb] = useState<any>('')
  const [roleID, setRoleID] = useState<any>([])

  useEffect(() => {
    getUserDynamicRole().then((response) => {
      if (response.data.success) {
        setRoleID(response.data.roleData)
      }
    })
  }, [])

  const initialValues: AdminUserDetailModel = {
    firstname: '',
    lastname: '',
    email: '',
    countryCode: '+1',
    mobileNumber: '',
    password: '********',
  }

  const handleImageChange = (e: any) => {
    setImage(e.target.files[0])
  }

  const formik = useFormik({
    initialValues,
    validationSchema: adminUserDetailsSchema,
    onSubmit: (values) => {
      setLoading(true)
      setTimeout(() => {
        const formData = new FormData()
        formData.append('userId', props.userID)
        formData.append('companyId', props.companyId)
        formData.append('firstname', values.firstname)
        formData.append('lastname', values.lastname)
        formData.append('email', values.email)
        formData.append('countryCode', values.countryCode)
        formData.append('mobileNumber', values.mobileNumber)
        formData.append('role', role)
        formData.append('image', image)
        if (values.password != '********' && !values.password.includes('*')) {
          formData.append('password', values.password)
        } else {
          formData.append('password', '')
        }

        superAdminUserUpdate(formData)
          .then((response) => {
            if (response.data.success) {
              props.setUserDetail((oldUserData: any) => {
                let newUserData = oldUserData
                newUserData.firstname = response.data.userData.firstname
                newUserData.lastname = response.data.userData.lastname
                newUserData.email = response.data.userData.email
                newUserData.countryCode = response.data.userData.countryCode
                newUserData.mobileNumber = response.data.userData.mobileNumber
                newUserData.avatarName = response.data.userData.avatarName
                newUserData.role = response.data.userData.role

                return newUserData
              })
              setLoading(false)
            } else {
              setLoading(false)
            }
          })
          .then(() => {
            props.setShowUserUpdateDialog(false)
            window.location.reload()
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
      setRole(props?.userDetail?.userRole)
    }
  }, [props.userDetail])

  const handlePhoneCountryChange = (_: string, countryData: CountryData) => {
    formik.setFieldValue('countryCode', countryData.dialCode)
    formik.setFieldTouched('countryCode', true, false)
  }

  const handleOrgTypeChange = () => {
    setRole('3')
  }

  const handleRoleChangeTo2 = () => {
    setRole('2')
  }

  const handleRoleChangeTo1 = () => {
    setRole('1')
  }

  const handleCloseClick = () => {
    props.setShowUserUpdateDialog(false)
  }

  const handleCloseKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      props.setShowUserUpdateDialog(false)
    }
  }

  const handleClose = () => {
    props.setShowUserUpdateDialog(false)
  }

  return (
    <Dialog
      open={props.showUserUpdateDialog}
      onClose={handleClose}
      aria-labelledby='form-dialog-title'
      PaperProps={{className: 'bg-light text-dark'}}
    >
      <DialogTitle className='px-5 text-center fw-bolder text-muted' id='form-dialog-title'>
        <div className='modal-header' id='kt_modal_update_user_header'>
          <h2 className='fw-bolder'>Update User</h2>
          <div
            role='button'
            tabIndex={0}
            className='btn btn-icon btn-sm btn-active-icon-primary'
            onClick={handleCloseClick}
            onKeyDown={handleCloseKeyDown}
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
                        <i className='bi bi-x fs-2'></i>
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
                      + {formik.errors.firstname}
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
                          onChange={handlePhoneCountryChange}
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
                    <div className='flex-grow-1'>
                      <input
                        type='text'
                        className='form-control form-control-solid'
                        placeholder='Mobile Number'
                        {...formik.getFieldProps('mobileNumber')}
                        onChange={
                          handlePhoneNumberChange.bind(
                            null,
                            'Mobile'
                          ) as unknown as React.ChangeEventHandler<HTMLInputElement>
                        }
                      />
                    </div>
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

                {/*begin::Form Group */}
                <div className='fv-row mb-8'>
                  <label className='form-label fw-bold text-dark fs-6'>User Role</label>
                  <div>
                    {/*begin:Option */}
                    <label className='d-flex align-items-center justify-content-between mb-6 cursor-pointer'>
                      <span className='d-flex align-items-center me-2'>
                        <span className='d-flex flex-column'>
                          <span className='fw-bold text-muted fs-6'>{roleID[0]?.role}</span>
                        </span>
                      </span>
                      <span className='form-check form-check-custom form-check-solid'>
                        <input
                          className='form-check-input'
                          type='radio'
                          name='orgType'
                          value={roleID[0]?.role}
                          checked={role == '1'}
                          onChange={handleRoleChangeTo1}
                        />
                      </span>
                    </label>
                    {/*end::Option */}

                    {/*begin:Option */}
                    <label className='d-flex align-items-center justify-content-between mb-6 cursor-pointer'>
                      <span className='d-flex align-items-center me-2'>
                        <span className='d-flex flex-column'>
                          <span className='fw-bold text-muted fs-6'>{roleID[1]?.role}</span>
                        </span>
                      </span>
                      <span className='form-check form-check-custom form-check-solid'>
                        <input
                          className='form-check-input'
                          type='radio'
                          name='orgType'
                          value={roleID[1]?.role}
                          checked={role == '2'}
                          onChange={handleRoleChangeTo2}
                        />
                      </span>
                    </label>
                    {/*end::Option */}

                    {/*begin:Option */}
                    <label className='d-flex align-items-center justify-content-between mb-6 cursor-pointer'>
                      <span className='d-flex align-items-center me-2'>
                        <span className='d-flex flex-column'>
                          <span className='fw-bold text-muted fs-6'>{roleID[2]?.role}</span>
                        </span>
                      </span>
                      <span className='form-check form-check-custom form-check-solid'>
                        <input
                          className='form-check-input'
                          type='radio'
                          name='orgType'
                          value={roleID[2]?.role}
                          checked={role == '3'}
                          onChange={handleOrgTypeChange}
                        />
                      </span>
                    </label>
                    {/*end::Option */}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className='modal-footer flex-center'>
            <button
              type='reset'
              className='btn btn-light me-3'
              onClick={() => props.setShowUserUpdateDialog(false)}
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
