import React, {useEffect} from 'react'

interface Step4Props {
  accountType: string
  signUpMethod: string
  userDetails: {
    firstname?: string
    lastname?: string
    email?: string
    mobileNumber?: string
    password?: string
  }
  companyDetails: {
    companyName?: string
    phoneNumber?: string
    orgType?: string
    mailingAddStreetName?: string
    mailingAddCityName?: string
    mailingAddStateName?: string
    mailingAddZip?: string
    billingAddStreetName?: string
    billingAddCityName?: string
    billingAddStateName?: string
    billingAddZip?: string
  }
}

const Step4: React.FC<Step4Props> = ({accountType, userDetails, companyDetails}) => {
  const data = {
    'Account Type': accountType == 'solo' ? 'Solo' : 'Team',
    'First Name': userDetails.firstname ?? 'NA',
    'Last Name': userDetails.lastname ?? 'NA',
    Email: userDetails.email ?? 'NA',
    'Mobile Number': userDetails.mobileNumber ?? 'NA',
    'Company Name': companyDetails.companyName ?? 'NA',
    'Phone Number': companyDetails.phoneNumber ?? 'NA',
    'Organization Type': companyDetails.orgType ?? 'NA',
    'Mailing Street Name': companyDetails.mailingAddStreetName ?? 'NA',
    'Mailing City Name': companyDetails.mailingAddCityName ?? 'NA',
    'Mailing State Name': companyDetails.mailingAddStateName ?? 'NA',

    'Mailing Zip Code': companyDetails.mailingAddZip ?? 'NA',
    'Billing Street Name': companyDetails.billingAddStreetName ?? 'NA',
    'Billing City Name': companyDetails.billingAddCityName ?? 'NA',
    'Billing State Name': companyDetails.billingAddStateName ?? 'NA',

    'Billing Zip Code': companyDetails.billingAddZip ?? 'NA',
  }

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div>
      <h2 className='fw-bolder d-flex align-items-center text-dark mb-10'>
        Preview Details
        {/* <p>Verify Details and Submit the form</p> */}
        <i
          className='fas fa-exclamation-circle ms-2 fs-7'
          data-bs-toggle='tooltip'
          title='Billing is issued based on your selected account type'
        ></i>
      </h2>

      <div>
        {Object.entries(data).map(([key, value]) => {
          if (value && !key.toLowerCase().includes('password')) {
            return (
              <div key={key} className='mb-2'>
                <h6 className='d-flex align-items-center text-dark justify-content-between mb-10 textuppercase textcapitalize'>
                  <strong className='capitalize'>{key}:</strong> {value}
                </h6>
              </div>
            )
          }
          return null
        })}
      </div>
    </div>
  )
}

export default Step4
