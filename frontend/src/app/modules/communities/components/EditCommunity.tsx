/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable jsx-a11y/anchor-is-valid */
import {useEffect, useState} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {FormattedMessage} from 'react-intl'
import {KTIcon} from '../../../../_metronic/helpers'
import * as Yup from 'yup'
import {useFormik} from 'formik'
import {updateCommunities, checkIfAliasExistForUpdate} from '../api'
import {useAuth} from '../../auth'

type Props = {
  show: boolean
  handleClose: () => void
  currentCommDataToEdit: any
  comIdToEdit: any
  offset: number
  limit: number
  setSuccessResMessage: any
  setFailureResMessage: any
  setChecked: any
  _setCommunityList: any
  selectedPage: any
  searchString: string
}

const communityUpdateSchema = Yup.object().shape({
  communityName: Yup.string()
    .min(3, 'Minimum 3 characters')
    .max(50, 'Maximum 50 characters')
    .required('Team Name is required'),
  communityAlias: Yup.string()
    .min(3, 'Minimum 3 characters')
    .max(50, 'Maximum 50 characters')
    .required('Team Alias is required'),
})

interface CommunityCreateModel {
  communityName: string
  communityAlias: string
}

const modalsRoot = document.getElementById('root-modals') || document.body

const EditCommunity = ({
  show,
  handleClose,
  currentCommDataToEdit,
  comIdToEdit,
  limit,
  setSuccessResMessage,
  setFailureResMessage,
  setChecked,
  _setCommunityList,
  selectedPage,
  searchString,
}: Props) => {
  const {currentUser, currentCommunity, setCommunityList, setCurrentCommunity} = useAuth()
  const [loading, setLoading] = useState<boolean>(false)
  const [isDuplicateAlias, setIsDuplicateAlias] = useState(false)

  let initialValues: CommunityCreateModel = {
    communityName: currentCommDataToEdit.community_name,
    communityAlias: currentCommDataToEdit.community_alias,
  }

  const formik = useFormik({
    initialValues,
    validationSchema: communityUpdateSchema,
    onSubmit: async (values) => {
      setLoading(true)
      checkIfAliasExistForUpdate(values.communityAlias, comIdToEdit).then((response) => {
        if (!response.data.exist) {
          updateCommunities(
            values.communityName,
            values.communityAlias,
            currentUser?.companyId,
            comIdToEdit,
            (selectedPage - 1) * limit,
            limit,
            searchString
          )
            .then((response) => {
              if (response.data.success) {
                setSuccessResMessage(response.data.message)
                if (currentCommunity == comIdToEdit) {
                  setCurrentCommunity(response.data.activeCommunities[0]['id'])
                }
                _setCommunityList(response.data.communityList)
                setCommunityList(response.data.activeCommunities)
                setChecked(true)
                setLoading(false)
              } else {
                setFailureResMessage(response.data.message)
                setChecked(true)
                setLoading(false)
              }
            })
            .then(() => {
              handleClose()
            })
            .catch(() => {
              setFailureResMessage('Failed to create a team')
              setChecked(true)
              setLoading(false)
            })
        } else {
          setLoading(false)
          setIsDuplicateAlias(true)
        }
      })
    },
  })

  useEffect(() => {
    if (currentCommDataToEdit) {
      formik.setFieldValue('communityName', currentCommDataToEdit.community_name)
      formik.setFieldValue('communityAlias', currentCommDataToEdit.community_alias)
      formik.setFieldValue('streetName', currentCommDataToEdit.street)
      formik.setFieldValue('city', currentCommDataToEdit.city)
      formik.setFieldValue('state', currentCommDataToEdit.state)
      formik.setFieldValue('zipcode', currentCommDataToEdit.zipcode)
    }
  }, [currentCommDataToEdit])

  return createPortal(
    <Modal
      id='edit_community_modal'
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-900px'
      show={show}
      onHide={handleClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <h2>
          <FormattedMessage id='BUTTON.EDIT_COMMUNITY' />
        </h2>
        {/* begin::Close */}
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={handleClose}>
          <KTIcon className='fs-1' iconName='cross' />
        </div>
        {/* end::Close */}
      </div>

      <div className='modal-body py-lg-10 px-lg-10'>
        <form
          className='form w-100 fv-plugins-bootstrap5 fv-plugins-framework'
          noValidate
          id='kt_login_signup_form'
          onSubmit={formik.handleSubmit}
        >
          {/* begin::Form group First Name */}
          <div className='fv-row mb-8'>
            <label className='form-label fw-bolder text-dark fs-4 required'>
              <FormattedMessage id='COMMUNITY.NAME' />
            </label>
            <input
              placeholder='Team Name'
              type='text'
              autoComplete='off'
              {...formik.getFieldProps('communityName')}
              className={'form-control bg-transparent'}
            />
            {formik.touched.communityName && formik.errors.communityName && (
              <div className='fv-plugins-message-container'>
                <div className='fv-help-block'>
                  <span role='alert'>{formik.errors.communityName}</span>
                </div>
              </div>
            )}
          </div>
          {/* end::Form group */}

          {/* begin::Form group First Name */}
          <div className='fv-row mb-8'>
            <label className='form-label fw-bolder text-dark fs-4 required'>
              <FormattedMessage id='COMMUNITY.ALIAS' />
            </label>
            <input
              placeholder='Team Alias'
              type='text'
              autoComplete='off'
              {...formik.getFieldProps('communityAlias')}
              className={'form-control bg-transparent'}
            />
            {formik.touched.communityAlias && formik.errors.communityAlias && (
              <div className='fv-plugins-message-container'>
                <div className='fv-help-block'>
                  <span role='alert'>{formik.errors.communityAlias}</span>
                </div>
              </div>
            )}
            {isDuplicateAlias && (
              <div className='fv-plugins-message-container'>
                <div className='fv-help-block'>
                  <span role='alert'>This team alias is taken, please try with another alias</span>
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
              className='btn btn-lg btn-primary w-50 mb-5'
              disabled={formik.isSubmitting || !formik.isValid || loading}
            >
              {!loading && (
                <span className='indicator-label'>
                  <FormattedMessage id='BUTTON.UPDATE' />
                </span>
              )}
              {loading && (
                <span className='indicator-progress' style={{display: 'block'}}>
                  <FormattedMessage id='PROFILE.PLEASE_WAIT' />
                  ... <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                </span>
              )}
            </button>
          </div>
          {/* end::Form group */}
        </form>
      </div>
    </Modal>,
    modalsRoot
  )
}

export {EditCommunity}
