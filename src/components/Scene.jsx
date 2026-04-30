import GrassField from './GrassField'
import Sky from './Sky'
import WillowTree from './WillowTree'
import CameraRig from './CameraRig'
import Ground from './Ground'
import { useControls } from 'leva'
import { useFogControls } from '../hooks/useSceneControls'

export default function Scene() {
  const { groundColor } = useControls('Ground', {
    groundColor: { value: '#3e6f24', label: 'color' },
  })
  const fog = useFogControls()

  return (
    <>
      <CameraRig />
      <ambientLight intensity={0.85} />
      <directionalLight position={[5, 8, 3]} intensity={1.0} color="#fff2d0" />
      <hemisphereLight args={['#a8d2ff', '#3e6f24', 0.6]} />

      <Sky />
      <Ground color={groundColor} fogColor={fog.fogColor} fogNear={fog.fogNear} fogFar={fog.fogFar} />
      <WillowTree />
      <GrassField />
    </>
  )
}
