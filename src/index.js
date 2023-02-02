const random = Math.random

const BOID_COUNT_CBRT = 32
const STAGE_SIZE = 20

setTimeout(() => {
  const renderer = new THREE.WebGLRenderer()
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.getElementById('js-app').appendChild(renderer.domElement)
  const camera = new THREE.PerspectiveCamera(27, window.innerWidth / window.innerHeight, 5, 35000)
  camera.position.z = 2750
  const geometry = new THREE.BufferGeometry()
  const scene = new THREE.Scene()
  const positions = []
  const colors = []
  const color = new THREE.Color()
  const width = BOID_COUNT_CBRT
  const height = BOID_COUNT_CBRT
  const depth = BOID_COUNT_CBRT
  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (x + y * width + z * width * height) * 3
        positions[index + 0] = x * STAGE_SIZE - (width * STAGE_SIZE) / 2
        positions[index + 1] = y * STAGE_SIZE - (height * STAGE_SIZE) / 2
        positions[index + 2] = z * STAGE_SIZE - (depth * STAGE_SIZE) / 2
        color.setRGB(x / width, y / height, z / depth)
        colors[index + 0] = color.r
        colors[index + 1] = color.g
        colors[index + 2] = color.b
      }
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeBoundingSphere()
  const material = new THREE.PointsMaterial({
    size: 15,
    vertexColors: true,
  })
  const points = new THREE.Points(geometry, material)
  scene.add(points)
  const gizmo = new THREE.AxesHelper(310)
  scene.add(gizmo)
  const controls = new THREE.OrbitControls(camera, renderer.domElement)
  render(
    renderer,
    scene,
    camera,
    controls,
  )
}, 0)

function render (
  renderer,
  scene,
  camera,
  controls,
) {
  requestAnimationFrame(() => {
    render(
      renderer,
      scene,
      camera,
      controls,
    )
  })
  renderer.render(scene, camera)
}
