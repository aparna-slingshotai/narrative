import GrassField from './GrassField'
import Sky from './Sky'
import PineForest from './PineForest'
import CameraRig from './CameraRig'
import Ground from './Ground'
import PathWalker from './PathWalker'
import River from './River'
import { useControls } from 'leva'
import { useFogControls, usePathControls } from '../hooks/useSceneControls'

export default function Scene() {
  const { groundColor } = useControls('Ground', {
    groundColor: { value: '#5d4f9c', label: 'color' },
  })
  const fog = useFogControls()
  usePathControls()

  return (
    <>
      <CameraRig />
      <PathWalker />
      <ambientLight intensity={1.0} />
      <directionalLight position={[5, 8, 3]} intensity={0.7} color="#e8eafc" />
      <hemisphereLight args={['#ece5f5', '#4a3d8f', 0.5]} />

      <Sky />
      <Ground color={groundColor} fogColor={fog.fogColor} fogNear={fog.fogNear} fogFar={fog.fogFar} />
      <River />
      <PineForest />
      <GrassField />
    </>
  )
}
