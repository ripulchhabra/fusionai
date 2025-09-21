import {useState, useEffect} from 'react'
import {useLocation, useNavigate} from 'react-router-dom'
import * as Yup from 'yup'
import {Link} from 'react-router-dom'
import {useFormik} from 'formik'
import {useAuth} from '../auth/core/Auth'
import {AlertDanger, AlertSuccess} from '../alerts/Alerts'
import {shareCollection} from '../auth/core/_requests'

const invitationSchema = Yup.object().shape({
  email: Yup.string()
    .email('Wrong email format')
    .min(5, 'Minimum 5 characters')
    .max(50, 'Maximum 50 characters')
    .required('Email is required'),
})

const initialValues = {
  email: '',
}

export default function ShareCourse() {
  const [loading, setLoading] = useState(false)
  const {currentUser, auth} = useAuth()
  const navigate = useNavigate()
  const [checked, setChecked] = useState<boolean>(false)
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')

  const {state}: any = useLocation()

  useEffect(() => {
    if (auth?.user?.role !== 1 && auth?.user?.role !== 2) {
      navigate('/error/500')
    }
  }, [auth, navigate])

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
  const formik = useFormik({
    initialValues,
    validationSchema: invitationSchema,
    onSubmit: async (values) => {
      setLoading(true)
      shareCollection(currentUser?.id, values.email, state.communityId)
        .then((response) => {
          if (response.data.message) {
            setSuccessMessage(response.data.message)
            setChecked(true)
            setLoading(false)
          } else {
            setErrorMessage(response.data.message)
            setChecked(true)
            setLoading(false)
          }
        })
        .catch(() => {
          setErrorMessage('Failed to send invitation')
          setChecked(true)
          setLoading(false)
        })
    },
  })

  return (
    <div className='d-flex flex-center flex-column flex-column-fluid p-10 pb-lg-20'>
      <div className='w-lg-500px bg-body rounded shadow-sm p-10 p-lg-15 mx-auto'>
        <form className='form w-100' onSubmit={formik.handleSubmit} noValidate>
          <div className='text-center mb-11'>
            <h1 className='text-dark fw-bolder mb-3'>Share {state.communityName} Course</h1>
          </div>

          {successMessage !== '' ? (
            <AlertSuccess message={successMessage} checked={checked} />
          ) : null}

          {errorMessage !== '' ? <AlertDanger message={errorMessage} checked={checked} /> : null}

          <div className='fv-row mb-8'>
            <label className='form-label fs-6 fw-bolder text-dark'>User Email</label>
            <input
              placeholder='Email'
              {...formik.getFieldProps('email')}
              className='form-control bg-transparent'
              type='email'
              name='email'
              autoComplete='off'
            />
            {formik.touched.email && formik.errors.email && (
              <div className='fv-plugins-message-container'>
                <span role='alert'>{formik.errors.email}</span>
              </div>
            )}
          </div>
          <div className='d-grid mb-10'>
            <button
              type='submit'
              className='btn btn-primary'
              disabled={formik.isSubmitting || !formik.isValid || loading}
            >
              {!loading && <span className='indicator-label'>Share Course</span>}
              {loading && (
                <span className='indicator-progress' style={{display: 'block'}}>
                  Sharing...
                  <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                </span>
              )}
            </button>
            <Link to='/'>
              <button
                type='button'
                id='kt_login_signup_form_cancel_button'
                className='mt-5 btn btn-lg btn-light-primary w-100 mb-5'
              >
                Back
              </button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
