export function DropdownMenu1(props: any) {
  const handleOpenSingleDeletion = () => {
    props.openDialogForSingleDeletion(`delete-invitation-${props.id}`)
  }

  const handleResendInvitation = () => {
    props.resendInvitation(props.email)
  }

  return (
    <>
      {/*begin::Navigation*/}
      <span className='navi navi-hover' style={{paddingLeft: 0}}>
        <button
          type='button'
          className='navi-item py-2 text-dark btn btn-link w-100 text-start'
          style={{textDecoration: 'none', listStyleType: 'none'}}
          onClick={handleResendInvitation}
        >
          <span className='navi-link'>
            <span className='navi-text ms-6 text-dark'>
              Resend
              {props.resending && (
                <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
              )}
            </span>
          </span>
        </button>
        <div className='separator'></div>
        <button
          type='button'
          className='navi-item py-2 text-dark btn btn-link w-100 text-start'
          style={{textDecoration: 'none', listStyleType: 'none'}}
          onClick={handleOpenSingleDeletion}
        >
          <span className='navi-link'>
            <span className='navi-text ms-6 text-dark'>Delete</span>
          </span>
        </button>
      </span>
      {/*end::Navigation*/}
    </>
  )
}
