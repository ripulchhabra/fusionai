/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable jsx-a11y/anchor-is-valid */
import {useState} from 'react'
import {FormattedMessage} from 'react-intl'
import * as Yup from 'yup'
import {useFormik} from 'formik'
import {useAuth} from '../../auth'
import {checkIfAliasExist, createCommunity} from '../../communities/api'

type Props = {
  setSuccessResMessage: any
  setFailureResMessage: any
  setChecked: any
}

const communityCreationSchema = Yup.object().shape({
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

const Onboarding = ({setSuccessResMessage, setFailureResMessage, setChecked}: Props) => {
  const [loading, setLoading] = useState<boolean>(false)
  const [isDuplicateAlias, setIsDuplicateAlias] = useState(false)
  const [offset] = useState<number>(0)
  const [limit] = useState<number>(10)
  const {setCommunityList, currentUser} = useAuth()

  const initialValues: CommunityCreateModel = {
    communityName: '',
    communityAlias: '',
  }

  const formik = useFormik({
    initialValues,
    validationSchema: communityCreationSchema,
    onSubmit: async (values) => {
      setLoading(true)
      checkIfAliasExist(values.communityAlias, currentUser?.companyId)
        .then((response) => {
          if (!response.data.exist) {
            createCommunity(
              currentUser?.companyId,
              currentUser?.id,
              values.communityName,
              values.communityAlias,
              offset,
              limit
            )
              .then((response) => {
                if (response.data.success) {
                  setSuccessResMessage(response.data.message)
                  setCommunityList(response.data.communityList)
                  setCommunityList(response.data.activeCommunities)
                  setChecked(true)
                  setLoading(false)
                  setIsDuplicateAlias(false)
                } else {
                  setFailureResMessage(response.data.message)
                  setChecked(true)
                  setLoading(false)
                  setIsDuplicateAlias(false)
                }
              })
              .then(() => {
                formik.resetForm()
              })
              .catch(() => {
                setFailureResMessage('Failed to create a team')
                setChecked(true)
                setLoading(false)
                setIsDuplicateAlias(false)
              })
          } else {
            setIsDuplicateAlias(true)
            setLoading(false)
          }
        })
        .catch(() => {
          //
        })
    },
  })

  const handleCommunityAliasChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    formik.setFieldValue('communityAlias', event.target.value)
    if (isDuplicateAlias) setIsDuplicateAlias(false)
  }

  return (
    <div className='card shadow px-8 pt-12 mt-4'>
      <div className='card-title'>
        <h2>
          <FormattedMessage id='BUTTON.CREATE_COMMUNITY' />
        </h2>
      </div>

      <div className='card-body py-lg-10 px-lg-10'>
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
              onChange={handleCommunityAliasChange}
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
              className='btn btn-lg mb-5 col-12 mt-3'
              style={{background: '#efb916'}}
              disabled={formik.isSubmitting || !formik.isValid || loading}
            >
              {!loading && (
                <span className='indicator-label fw-bolder'>
                  <FormattedMessage id='ONBOARDING.TWO' />
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
    </div>
  )
}

export {Onboarding}
