import { useParams } from 'react-router-dom'

function Lesson() {
  const { id } = useParams()
  return <div>Lesson {id}</div>
}

export default Lesson
