import * as THREE from 'three';

export class AnalyzeScene {
  public static calculateCount({ scene }) {
    let meshCount = 0;
    let vertexCount = 0;
    let lineCount = 0;

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        meshCount++;
        if (child.geometry.attributes.position) {
          vertexCount += child.geometry.attributes.position.count;
        }
      }
      if ((child instanceof THREE.Line || child instanceof THREE.LineSegments) && child.geometry) {
        lineCount++;
        if (child.geometry.attributes.position) {
          vertexCount += child.geometry.attributes.position.count;
        }
      }
    });

    return { meshCount, vertexCount, lineCount };
  }

  public static calculateReduction(original: number, optimized: number) {
    const reduction = ((original - optimized) / original) * 100;
    if (reduction > 0) {
      return `уменьшение на ${reduction.toFixed(1)}%`;
    } else if (reduction < 0) {
      return `увеличение на ${Math.abs(reduction).toFixed(1)}%`;
    } else {
      return 'без изменений';
    }
  }
}
