import {FormattedMessage} from 'react-intl'

const DeleteConfirmationBoxForCommunity = (props: any) => {
  const handleCloseDialog = (dialogId: string) => () => {
    props.closeDialog(dialogId)
  }

  return (
    <div id={`delete-communities`} style={{display: 'none'}} className='modal'>
      <span onClick={handleCloseDialog('delete-communities')} className='close' title='Close Modal'>
        &times;
      </span>
      <form className='modal-content'>
        <div className='px-7 py-7'>
          <h3 className='text-center'>
            <FormattedMessage id='COMMUNITY.DELETE' />
          </h3>

          <p className='font-size-15 text-center'>
            <FormattedMessage id='COMMUNITY.DELETE.CONFIRM' />
          </p>

          <div className='d-flex justify-content-center'>
            <button
              onClick={handleCloseDialog('delete-communities')}
              type='button'
              className='btn btn-primary'
            >
              Cancel
            </button>
            <button
              onClick={props.handleBulkDeletion}
              type='button'
              className='btn btn-danger ms-3'
            >
              Delete
              {props.deleting && (
                <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export {DeleteConfirmationBoxForCommunity}
