import * as THREE from 'three';

const CAMERA_MODES = ['isometric', 'thirdPerson', 'free'];
const CAMERA_LABELS = { isometric: 'Isometric', thirdPerson: 'Third person', free: 'Free camera' };

export class CameraController {
  constructor(camera, player, isBlocked = () => false) {
    this.camera = camera;
    this.player = player;
    this.isBlocked = isBlocked;
    this.mode = 'isometric';
    this.modeIndex = 0;
    this.yaw = Math.PI / 4;
    this.followYawOffset = 0;
    this.pitch = 0.84;
    this.distance = 53;
    this.focus = new THREE.Vector3(player.position.x, player.position.y, player.position.z);
    this.freeFocus = this.focus.clone();
    this.position = camera.position.clone();
    this.onModeChange = () => {};
  }

  get label() { return CAMERA_LABELS[this.mode]; }

  cycle() {
    this.modeIndex = (this.modeIndex + 1) % CAMERA_MODES.length;
    this.mode = CAMERA_MODES[this.modeIndex];
    if (this.mode === 'isometric') {
      this.yaw = Math.PI / 4;
      this.pitch = 0.84;
      this.camera.zoom = 1;
    }
    if (this.mode === 'thirdPerson') {
      this.yaw = this.player.rotation.y + Math.PI;
      this.followYawOffset = 0;
      this.pitch = 0.38;
      this.camera.zoom = 1.15;
    }
    if (this.mode === 'free') this.freeFocus.copy(this.focus);
    this.camera.updateProjectionMatrix();
    this.onModeChange(this.label);
    return this.mode;
  }

  orbit(deltaX, deltaY) {
    this.yaw -= deltaX * 0.007;
    if (this.mode === 'thirdPerson') this.followYawOffset -= deltaX * 0.007;
    this.pitch = THREE.MathUtils.clamp(this.pitch + deltaY * 0.005, 0.23, 1.25);
  }

  pan(deltaX, deltaY, viewportHeight) {
    const unitsPerPixel = (this.camera.top - this.camera.bottom) / this.camera.zoom / Math.max(viewportHeight, 1);
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const up = new THREE.Vector3(Math.sin(this.yaw) * Math.sin(this.pitch), 0, Math.cos(this.yaw) * this.pitch);
    this.freeFocus.addScaledVector(right, -deltaX * unitsPerPixel);
    this.freeFocus.addScaledVector(up, deltaY * unitsPerPixel);
    this.freeFocus.x = THREE.MathUtils.clamp(this.freeFocus.x, -66, 66);
    this.freeFocus.z = THREE.MathUtils.clamp(this.freeFocus.z, -60, 60);
  }

  zoom(delta) {
    // Full zoom range: 0.22 = whole-campus / tiny-character view,
    // 5.0 = close-up. Smaller zoom value = further out / smaller character.
    this.camera.zoom = THREE.MathUtils.clamp(this.camera.zoom - delta * 0.001, 0.22, 5.0);
    this.camera.updateProjectionMatrix();
  }

  pinch(scale) {
    this.camera.zoom = THREE.MathUtils.clamp(this.camera.zoom * scale, 0.22, 5.0);
    this.camera.updateProjectionMatrix();
  }

  update(delta) {
    const player = this.player;
    const target = this.mode === 'free'
      ? this.freeFocus
      : new THREE.Vector3(player.position.x, player.position.y, player.position.z);
    if (this.mode === 'thirdPerson') {
      const desiredYaw = player.rotation.y + Math.PI + this.followYawOffset;
      const angle = Math.atan2(Math.sin(desiredYaw - this.yaw), Math.cos(desiredYaw - this.yaw));
      this.yaw += angle * Math.min(1, delta * 3.2);
    }
    const pitch = this.mode === 'thirdPerson' ? Math.max(this.pitch, 0.35) : this.pitch;
    const distance = this.mode === 'thirdPerson' ? 12.5 : this.distance;
    const horizontal = Math.cos(pitch) * distance;
    const offset = new THREE.Vector3(Math.sin(this.yaw) * horizontal, Math.sin(pitch) * distance, Math.cos(this.yaw) * horizontal);
    let desiredPosition = target.clone().add(offset);
    if (this.mode !== 'free' && this.isBlocked(desiredPosition.x, desiredPosition.z)) {
      for (let step = 5; step >= 1; step--) {
        const candidate = target.clone().addScaledVector(offset, step / 6);
        if (!this.isBlocked(candidate.x, candidate.z)) { desiredPosition = candidate; break; }
      }
    }
    const smoothing = Math.min(1, delta * 5.5);
    this.focus.lerp(target, smoothing);
    this.position.lerp(desiredPosition, smoothing);
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.focus);
  }
}
