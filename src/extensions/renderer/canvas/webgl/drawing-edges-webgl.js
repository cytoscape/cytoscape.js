export function createEdgeShaderProgram(gl) {
  const vertexShaderSource = `#version 300 es
    precision highp float;

    uniform mat3 uMatrix;

    in vec2 aVertexPosition;
    // in vec3 aVertexColor;

    out vec4 vVertexColor;

    void main(void) {
      // vVertexColor = vec4(aVertexColor, 1.0);
      vVertexColor = vec4(0.0, 1.0, 0.0, 1.0);
      gl_Position  = vec4(uMatrix * vec3(aVertexPosition, 1.0), 1.0);
    }
  `;

  const fragmentShaderSource = `#version 300 es
    precision highp float;

    in vec4 vVertexColor;
    out vec4 fragColor;

    void main(void) {
      fragColor = vVertexColor;
    }
  `;

  const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);

  program.aVertexPosition = gl.getAttribLocation(program,  'aVertexPosition');
  // program.aVertexColor = gl.getAttribLocation(program,  'aVertexColor');
  program.uMatrix = gl.getUniformLocation(program, 'uMatrix');

  return program;
}