import {storeCurrentCommunity, useAuth} from '../../auth'

function SelectCommunities(props: any) {
  const {istextEditor, setCurrentParent} = useAuth()

  const handleChange = (event: any) => {
    if (istextEditor) {
      const confirmation = window.confirm(
        'You have unsaved changes. Are you sure you want to change team?'
      )
      if (!confirmation) {
        event.preventDefault()
      } else {
        event.preventDefault()
        props.setCurrentCommunity(event.target.value)
        setCurrentParent(4)
        storeCurrentCommunity(event.target.value)
      }
    } else {
      event.preventDefault()
      props.setCurrentCommunity(event.target.value)
      setCurrentParent(4)
      storeCurrentCommunity(event.target.value)
    }
  }

  return (
    <>
      <div className='form-group row'>
        <select
          className='form-control form-control-lg form-control-solid community-select'
          name='sort'
          onChange={handleChange}
          value={props.currentCommunity ? props.currentCommunity : ''}
          style={{border: '1px solid rgb(184, 169, 169)'}}
        >
          <option value='' disabled={props.currentCommunity !== ''}>
            Select Team
          </option>
          {props.communityList.length > 0 && (
            <>
              {props.communityList.map((list: any) => (
                <option key={list.id} value={list.id}>
                  {list.community_name} / {list.community_alias}
                </option>
              ))}
            </>
          )}
        </select>
      </div>
    </>
  )
}

export {SelectCommunities}
