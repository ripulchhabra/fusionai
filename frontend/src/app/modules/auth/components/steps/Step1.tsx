import React from 'react'
import {useAppContext} from '../../../../pages/AppContext/AppContext'

interface Step1Props {
  accountType: string
  onAccountTypeChange: (value: string) => void
  onOtherInputChange: (value: string) => void
  currency: string
  setCurrency: (value: string) => void
}

const Step1: React.FC<Step1Props> = ({accountType, onAccountTypeChange, currency, setCurrency}) => {
  const isSelected = (type: string) => accountType === type
  const {appData} = useAppContext()

  const handleAccountTypeChange = (type: string) => () => {
    onAccountTypeChange(type)
  }

  return (
    <div>
      <h2 className='fw-bolder d-flex align-items-center text-dark mb-10'>
        Choose Account Type
        <i
          className='fas fa-exclamation-circle ms-2 fs-7'
          data-bs-toggle='tooltip'
          title='Billing is issued based on your selected account type'
        ></i>
      </h2>
      <div className='row formcheck mb-4' style={{paddingLeft: 0}}>
        <div className='mb-6'>
          <input
            type='radio'
            className='btn-check'
            name='accountType'
            value='solo'
            id='solo'
            checked={isSelected('solo')}
            onChange={handleAccountTypeChange('solo')}
          />
          <label
            className={`card border rounded ${isSelected('solo') ? 'bg-light-primary shadow' : 'border-dotted border-dark'}`}
            htmlFor='solo'
          >
            <span className='card-body'>
              <h5 className='card-title mb-2 fs-4 fw-bolder d-flex flex-wrap'>
                <span>Solo&nbsp;</span>
              </h5>
              <span className='card-text mb-2'>
                {appData.appName ?? 'AI Bot'} plan that is perfect for students and individuals. No
                limit to the number of Teams (AI assistants) you can build. Single user plan.
              </span>
            </span>
          </label>
        </div>
      </div>
    </div>
  )
}

export default Step1
