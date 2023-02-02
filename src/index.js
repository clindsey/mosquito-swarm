const seed = 5625463739 // +(new Date())
console.log(seed)
const random = alea(seed)

const CROWD_SIZE_CBRT = 32
const STAGE_SIZE_CBRT = 40

setTimeout(async () => {
  const result = await fetch('vendor/noise2D.glsl')
  window.noise2D = await result.text()
  const renderer = new THREE.WebGLRenderer()
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.getElementById('js-app').appendChild(renderer.domElement)
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 10000)
  camera.position.copy((new THREE.Vector3(1, 1, 1)).normalize().multiplyScalar(700))
  const scene = new THREE.Scene()
  setupLights(scene)
  const composer = GPUIO.GPUComposer.initWithThreeRenderer(renderer)
  composer.undoThreeState()
  const crowd = new Crowd(
    CROWD_SIZE_CBRT,
    STAGE_SIZE_CBRT,
    composer,
  )
  scene.add(crowd)
  const gizmo = new THREE.AxesHelper(310)
  // scene.add(gizmo)
  const controls = new OrbitControls(camera, renderer.domElement)
  const stats = new Stats()
  stats.showPanel(0)
  document.body.appendChild(stats.dom)
  render(
    renderer,
    scene,
    camera,
    controls,
    composer,
    crowd,
    stats,
  )
}, 0)

function render (
  renderer,
  scene,
  camera,
  controls,
  composer,
  crowd,
  stats,
) {
  requestAnimationFrame((time) => {
    stats.begin()
    crowd.step(time)
    composer.resetThreeState()
    renderer.render(scene, camera)
    composer.undoThreeState()
    stats.end()
    render(
      renderer,
      scene,
      camera,
      controls,
      composer,
      crowd,
      stats,
    )
  })
}

function setupLights (
  scene,
) {
  const ambientLight = new THREE.AmbientLight(
    0xffffff,
    0.3
  )
  scene.add(ambientLight)
  const sunLight = new THREE.DirectionalLight(
    0xffffff,
    0.5
  )
  sunLight.position.set(
    -1,
    1,
    1,
  )
  sunLight.lookAt(
    0,
    0,
    0,
  )
  scene.add(sunLight)
  const moonLight = new THREE.DirectionalLight(
    0xffffff,
    0.3
  )
  moonLight.position.set(
    1,
    -1,
    -1,
  )
  moonLight.lookAt(
    0,
    0,
    0,
  )
  // scene.add(moonLight)
  const pointLight = new THREE.PointLight(0xffffff, 0.6, 32000)
  pointLight.position.set(0, 0, 0)
  scene.add(pointLight)
}
