// src/GLTFExporter.ts
import * as THREE from 'three';
import { GLTFExporter as ThreeGLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export class GLTFExporter {
  public static async exportGLTF(scene: THREE.Object3D, options: any = {}): Promise<{ gltf: object; buffers: ArrayBuffer[] }> {
    return new Promise((resolve, reject) => {
      const exporter = new ThreeGLTFExporter();

      const exportOptions = {
        binary: false,
        trs: false,
        onlyVisible: true,
        truncateDrawRange: true,
        maxTextureSize: 2048,
        animations: [],
        ...options,
      };

      exporter.parse(
        scene,
        (result: any) => {
          if (result instanceof ArrayBuffer) {
            resolve({
              gltf: this.arrayBufferToGLTF(result),
              buffers: [result],
            });
          } else if (result.json) {
            resolve({
              gltf: result.json,
              buffers: result.buffers || [],
            });
          } else {
            resolve({
              gltf: result,
              buffers: [],
            });
          }
        },
        (error: any) => {
          reject(error);
        },
        exportOptions
      );
    });
  }

  private static arrayBufferToGLTF(arrayBuffer: ArrayBuffer): object {
    // Конвертируем ArrayBuffer в JSON объект
    const decoder = new TextDecoder('utf-8');
    const jsonString = decoder.decode(arrayBuffer);
    return JSON.parse(jsonString);
  }
}
