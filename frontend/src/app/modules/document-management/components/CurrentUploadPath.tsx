export const CurrentUploadPath = (props: any) => {
  return (
    <div className='d-flex flex-wrap mb-6 ms-4'>
      {props.folderTree.map((folder: any) => (
        <>
          <span className='fs-3 fw-bold'>
            {folder.name == 'Root' ? props.currentCommunityTitle : folder.name}
          </span>
          <span className='fw-bold fs-3 mx-1'>/</span>
        </>
      ))}
    </div>
  )
}
