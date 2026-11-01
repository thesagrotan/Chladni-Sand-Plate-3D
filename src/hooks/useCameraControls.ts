import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import type { ChladniParams } from '../types/chladni.ts';
import type { TextMaskManager } from '../utils/TextMaskManager.ts';

/** Vertical half-range of the orthographic camera at zoom=1 */
export const VRANGE = 1.05;

export interface CameraControlsRefs {
  container: MutableRefObject<HTMLDivElement | null>;
  camera: MutableRefObject<THREE.OrthographicCamera | null>;
  camData: MutableRefObject<THREE.Vector4>;
  bgMesh: MutableRefObject<THREE.Mesh | null>;
  grainMaterial: MutableRefObject<THREE.ShaderMaterial | null>;
  zoom: MutableRefObject<number>;
  pan: MutableRefObject<{ x: number; y: number }>;
  pointerSimPos: MutableRefObject<{ x: number; y: number }>;
  pointerActive: MutableRefObject<boolean>;
  params: MutableRefObject<ChladniParams>;
  renderer: MutableRefObject<THREE.WebGLRenderer | null>;
  textMask: MutableRefObject<TextMaskManager | null>;
}

export interface CameraControlsApi {
  updateCameraFrustum: () => void;
}

/**
 * Owns pan/zoom, pointer-to-simulation mapping, keyboard camera keys, and
 * window resize. All state lives in the provided refs so the animation loop
 * reads it without re-rendering.
 */
export function useCameraControls(
  refs: CameraControlsRefs
): CameraControlsApi {
  const api: CameraControlsApi = {
    updateCameraFrustum: () => {},
  };

  useEffect(() => {
    const {
      container,
      camera,
      camData,
      bgMesh,
      grainMaterial,
      zoom,
      pan,
      pointerSimPos,
      pointerActive,
      params,
    } = refs;

    const updateCameraFrustum = () => {
      const cam = camera.current;
      if (!cam) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const asp = w / h;
      const z = zoom.current;
      const px = pan.current.x;
      const py = pan.current.y;
      const baseRange = VRANGE / z;
      const halfW = asp >= 1.0 ? baseRange * asp : baseRange;
      const halfH = asp >= 1.0 ? baseRange : baseRange / asp;
      cam.left = -halfW + px;
      cam.right = halfW + px;
      cam.top = halfH + py;
      cam.bottom = -halfH + py;
      cam.updateProjectionMatrix();

      camData.current.set(px, py, halfW, halfH);

      if (bgMesh.current) {
        bgMesh.current.scale.set(halfW * 2.1, halfH * 2.1, 1);
        bgMesh.current.position.set(px, py, 0);
      }

      if (grainMaterial.current) {
        grainMaterial.current.uniforms.uZoom.value = z;
      }
    };

    const clientToSimSpace = (clientX: number, clientY: number) => {
      const element = container.current;
      const rect = element ? element.getBoundingClientRect() : { left: 0, top: 0, width: 1, height: 1 };
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
      const cam = camera.current;
      if (!cam) return { x: ndcX, y: ndcY };
      const halfW = (cam.right - cam.left) / 2;
      const halfH = (cam.top - cam.bottom) / 2;
      const cx = (cam.left + cam.right) / 2;
      const cy = (cam.bottom + cam.top) / 2;
      let sx = cx + ndcX * halfW;
      let sy = cy + ndcY * halfH;

      const cp = params.current;
      if (cp.rotationAngle !== 0) {
        const rad = -(cp.rotationAngle * Math.PI) / 180;
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);
        const rx = sx * cosA - sy * sinA;
        const ry = sx * sinA + sy * cosA;
        sx = rx;
        sy = ry;
      }
      if (cp.flipHorizontal) sx = -sx;
      if (cp.flipVertical) sy = -sy;

      return { x: sx, y: sy };
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      const panStep = (e.shiftKey ? 0.16 : 0.06) * (VRANGE / zoom.current);

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        pan.current.y += panStep;
        updateCameraFrustum();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        pan.current.y -= panStep;
        updateCameraFrustum();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        pan.current.x -= panStep;
        updateCameraFrustum();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        pan.current.x += panStep;
        updateCameraFrustum();
      } else if (
        e.key === '+' ||
        e.key === '=' ||
        e.code === 'Equal' ||
        e.code === 'NumpadAdd'
      ) {
        e.preventDefault();
        const factor = e.shiftKey ? 1.25 : 1.12;
        zoom.current = Math.min(8.0, +(zoom.current * factor).toFixed(3));
        updateCameraFrustum();
      } else if (
        e.key === '-' ||
        e.key === '_' ||
        e.code === 'Minus' ||
        e.code === 'NumpadSubtract'
      ) {
        e.preventDefault();
        const factor = e.shiftKey ? 1.25 : 1.12;
        zoom.current = Math.max(0.4, +(zoom.current / factor).toFixed(3));
        updateCameraFrustum();
      }
    };

    const onWindowPointerMove = (e: PointerEvent) => {
      const sp = clientToSimSpace(e.clientX, e.clientY);
      pointerSimPos.current = sp;
      pointerActive.current = true;
    };

    const onWindowPointerDown = (e: PointerEvent) => {
      pointerActive.current = true;
      const sp = clientToSimSpace(e.clientX, e.clientY);
      pointerSimPos.current = sp;
    };

    const onWindowPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        pointerActive.current = false;
      }
    };

    const onWindowMouseLeave = () => {
      pointerActive.current = false;
    };

    const onWindowBlur = () => {
      pointerActive.current = false;
    };

    const handleResize = () => {
      if (!container.current || !refs.renderer.current) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      refs.renderer.current.setSize(w, h);
      updateCameraFrustum();
      refs.textMask.current?.setDirty();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('pointermove', onWindowPointerMove, { passive: true });
    window.addEventListener('pointerdown', onWindowPointerDown, { passive: true });
    window.addEventListener('pointerup', onWindowPointerUp, { passive: true });
    document.addEventListener('mouseleave', onWindowMouseLeave);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('keydown', handleKeyDown);

    api.updateCameraFrustum = updateCameraFrustum;

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerdown', onWindowPointerDown);
      window.removeEventListener('pointerup', onWindowPointerUp);
      document.removeEventListener('mouseleave', onWindowMouseLeave);
      window.removeEventListener('blur', onWindowBlur);
    };
    // All inputs are stable refs; the effect binds once for the component lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return api;
}