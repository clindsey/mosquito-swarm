class VerletIntegrationProgram extends GPUIO.GPUProgram {
  constructor (
    composer,
  ) {
    super(composer, {
      name: 'verletIntegrationProgram',
      uniforms: [{
        name: 'u_positions',
        value: 0,
        type: GPUIO.INT,
      }, {
        name: 'u_velocities',
        value: 1,
        type: GPUIO.INT,
      }],
      fragmentShader: `
        in vec2 v_uv;

        uniform sampler2D u_positions;
        uniform sampler2D u_velocities;

        out vec4 out_result;

        void main () {
          vec4 velocity = texture(u_velocities, v_uv);
          vec4 position = texture(u_positions, v_uv);
          out_result = vec4(position.xyz + velocity.xyz, position.w);
        }
      `,
    })
  }
}
