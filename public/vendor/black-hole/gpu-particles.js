(() => {
  'use strict';

  const MAX_PARTICLES = 24_000;

  const VERTEX_SHADER = `#version 300 es
    precision highp float;
    uniform float time_seconds;
    uniform vec2 viewport_size;
    uniform float point_scale;
    out vec3 particle_color;
    out float particle_alpha;

    uint hash_u32(uint value) {
      value ^= value >> 16u;
      value *= 0x7feb352du;
      value ^= value >> 15u;
      value *= 0x846ca68bu;
      value ^= value >> 16u;
      return value;
    }

    float hash01(uint value) {
      return float(hash_u32(value)) * (1.0 / 4294967295.0);
    }

    void main() {
      uint id = uint(gl_VertexID) + 1u;
      float h0 = hash01(id * 0x9e3779b9u);
      float h1 = hash01(id * 0x85ebca6bu + 17u);
      float h2 = hash01(id * 0xc2b2ae35u + 31u);
      float h3 = hash01(id * 0x27d4eb2fu + 47u);
      float h4 = hash01(id * 0x165667b1u + 61u);

      float radius = mix(0.1, 0.96, pow(h0, 0.78));
      float orbit_rate = mix(0.012, 0.052, h2) / max(radius, 0.14);
      float angle = h1 * 6.28318530718 + time_seconds * orbit_rate;
      float turbulence = sin(angle * 3.0 + h3 * 12.0 + time_seconds * 0.07);
      float aspect = max(viewport_size.x / max(viewport_size.y, 1.0), 1.0);

      vec2 position = vec2(
        cos(angle) * (radius + turbulence * 0.012) / aspect,
        sin(angle) * radius * mix(0.16, 0.31, h3)
      );
      position.y += (h4 - 0.5) * mix(0.025, 0.12, radius);
      gl_Position = vec4(position, 0.0, 1.0);

      float inner_fade = smoothstep(0.1, 0.24, radius);
      float outer_fade = 1.0 - smoothstep(0.74, 0.98, radius);
      float flicker = 0.72 + 0.28 * sin(time_seconds * mix(0.45, 1.1, h1) + h2 * 18.0);
      particle_alpha = inner_fade * outer_fade * mix(0.018, 0.09, h4) * flicker;
      vec3 cold = vec3(0.34, 0.62, 0.96);
      vec3 warm = vec3(1.0, 0.48, 0.12);
      particle_color = mix(cold, warm, smoothstep(0.18, 0.82, h2));
      gl_PointSize = mix(0.7, 2.6, h3 * h3)
        * point_scale
        * clamp(viewport_size.y / 720.0, 0.72, 1.45);
    }`;

  const FRAGMENT_SHADER = `#version 300 es
    precision highp float;
    in vec3 particle_color;
    in float particle_alpha;
    layout(location=0) out vec4 frag_color;

    void main() {
      vec2 point = gl_PointCoord * 2.0 - 1.0;
      float radius2 = dot(point, point);
      if (radius2 > 1.0) discard;
      float glow = (1.0 - radius2) * (1.0 - radius2);
      float energy = particle_alpha * glow;
      // The host scene uses a physically scaled HDR exposure (~0.014 for the
      // homepage plate), so billboard energy must live in the same HDR range
      // before bloom/tone mapping rather than being authored as LDR opacity.
      frag_color = vec4(particle_color * energy * 32.0, energy);
    }`;

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || 'GPU particle shader compilation failed.';
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  function createProgram(gl) {
    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) || 'GPU particle program linking failed.';
      gl.deleteProgram(program);
      throw new Error(message);
    }
    return program;
  }

  class GpuParticleField {
    constructor(gl, { count = 0, pointScale = 1 } = {}) {
      this.gl = gl;
      this.count = Math.min(MAX_PARTICLES, Math.max(0, Math.trunc(Number(count) || 0)));
      this.pointScale = Math.max(0.5, Math.min(2, Number(pointScale) || 1));
      this.program = createProgram(gl);
      this.vao = gl.createVertexArray();
      this.timeUniform = gl.getUniformLocation(this.program, 'time_seconds');
      this.viewportUniform = gl.getUniformLocation(this.program, 'viewport_size');
      this.pointScaleUniform = gl.getUniformLocation(this.program, 'point_scale');
    }

    setCount(count) {
      this.count = Math.min(MAX_PARTICLES, Math.max(0, Math.trunc(Number(count) || 0)));
    }

    draw({ timeSeconds = 0, width = 1, height = 1 } = {}) {
      if (!this.count) return;
      const gl = this.gl;
      gl.useProgram(this.program);
      gl.uniform1f(this.timeUniform, Number(timeSeconds) || 0);
      gl.uniform2f(this.viewportUniform, Math.max(1, width), Math.max(1, height));
      gl.uniform1f(this.pointScaleUniform, this.pointScale);
      gl.bindVertexArray(this.vao);
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArrays(gl.POINTS, 0, this.count);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
    }

    dispose() {
      this.gl.deleteVertexArray(this.vao);
      this.gl.deleteProgram(this.program);
      this.count = 0;
    }
  }

  globalThis.BlackHoleGpuParticles = Object.freeze({
    GpuParticleField,
    MAX_PARTICLES,
    VERTEX_SHADER,
    FRAGMENT_SHADER,
  });
})();
