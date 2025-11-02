import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export class MergeModel {
  private static readonly tempVector = new THREE.Vector3();

  public static processModelWithMerge(model: THREE.Object3D) {
    const { mergedMeshes, mergedLines } = this.mergeGeometriesWithMaterials(model);
    this.disposeHierarchy(model);

    const group = new THREE.Group();
    const groupMeshes = new THREE.Group();
    const groupLines = new THREE.Group();

    if (mergedMeshes.length > 0) groupMeshes.add(...mergedMeshes);
    if (mergedLines.length > 0) groupLines.add(...mergedLines);

    group.add(groupMeshes, groupLines);

    return { group };
  }

  private static mergeGeometriesWithMaterials(model: THREE.Object3D): {
    mergedMeshes: THREE.Mesh[];
    mergedLines: (THREE.Line | THREE.LineSegments)[];
  } {
    const meshEntries: { mesh: THREE.Mesh; worldMatrix: THREE.Matrix4 }[] = [];
    const lineEntries: { line: THREE.Line | THREE.LineSegments; worldMatrix: THREE.Matrix4; isLineSegments: boolean }[] = [];

    model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        child.updateWorldMatrix(true, false);
        meshEntries.push({
          mesh: child,
          worldMatrix: child.matrixWorld.clone(),
        });
      }

      if ((child instanceof THREE.Line || child instanceof THREE.LineSegments) && child.geometry) {
        child.updateWorldMatrix(true, false);
        lineEntries.push({
          line: child,
          worldMatrix: child.matrixWorld.clone(),
          isLineSegments: child instanceof THREE.LineSegments,
        });
      }
    });

    const mergedMeshes: THREE.Mesh[] = [];
    if (meshEntries.length > 0) {
      const meshResults = this.mergeMeshGeometries(meshEntries);
      mergedMeshes.push(...meshResults);
    }

    const mergedLines: (THREE.Line | THREE.LineSegments)[] = [];
    if (lineEntries.length > 0) {
      const lineResults = this.mergeLineGeometries(lineEntries);
      mergedLines.push(...lineResults);
    }

    return { mergedMeshes, mergedLines };
  }

  private static mergeMeshGeometries(meshEntries: { mesh: THREE.Mesh; worldMatrix: THREE.Matrix4 }[]) {
    const materialGroups = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[]; originalUuids: string[]; originalParentUuids: string[] }>();

    meshEntries.forEach(({ mesh, worldMatrix }) => {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

      materials.forEach((material, idx) => {
        material.clippingPlanes = [new THREE.Plane()];

        const key = material.uuid || `mat_${idx}`;

        if (!materialGroups.has(key)) {
          materialGroups.set(key, {
            material: material,
            geometries: [],
            originalUuids: [],
            originalParentUuids: [],
          });
        }

        const geometry = this.prepareGeometry(mesh.geometry, worldMatrix);
        const originalUuid = mesh.uuid;
        const originalParentUuid = mesh.parent?.uuid || '';

        geometry.userData = {
          uuid: originalUuid,
          parentUuid: originalParentUuid,
          originalUserData: mesh.userData,
        };

        materialGroups.get(key)!.geometries.push(geometry);
        materialGroups.get(key)!.originalUuids.push(originalUuid);
        materialGroups.get(key)!.originalParentUuids.push(originalParentUuid);
      });
    });

    const mergedMeshes: THREE.Mesh[] = [];
    materialGroups.forEach((group) => {
      if (group.geometries.length === 0) return;

      const mergedGeometry = BufferGeometryUtils.mergeGeometries(group.geometries, true);

      if (mergedGeometry && mergedGeometry.attributes.position && mergedGeometry.attributes.position.count > 0) {
        const mergedMesh = new THREE.Mesh(mergedGeometry, group.material);
        mergedMeshes.push(mergedMesh);

        this.setGeomAttribute({
          geometries: group.geometries,
          mergedGeometry,
          originalUuids: group.originalUuids,
          originalParentUuids: group.originalParentUuids,
        });

        group.geometries.forEach((geom) => geom.dispose());
      }
    });

    return mergedMeshes;
  }

  private static mergeLineGeometries(lineEntries: { line: THREE.Line | THREE.LineSegments; worldMatrix: THREE.Matrix4; isLineSegments: boolean }[]): (THREE.Line | THREE.LineSegments)[] {
    const lineMaterialGroups = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[]; isLineSegments: boolean; originalUuids: string[]; originalParentUuids: string[] }>();

    lineEntries.forEach(({ line, worldMatrix, isLineSegments }) => {
      const materials = Array.isArray(line.material) ? line.material : [line.material];

      materials.forEach((material, idx) => {
        const typeKey = isLineSegments ? 'segments' : 'line';
        const key = `${material.uuid || `line_mat_${idx}`}_${typeKey}`;

        if (!lineMaterialGroups.has(key)) {
          lineMaterialGroups.set(key, {
            material: material,
            geometries: [],
            isLineSegments: isLineSegments,
            originalUuids: [],
            originalParentUuids: [],
          });
        }

        const geometry = this.prepareLineGeometry(line.geometry, worldMatrix);
        const originalUuid = line.uuid;
        const originalParentUuid = line.parent?.uuid || '';

        geometry.userData = {
          uuid: originalUuid,
          parentUuid: originalParentUuid,
          originalUserData: line.userData,
        };

        lineMaterialGroups.get(key)!.geometries.push(geometry);
        lineMaterialGroups.get(key)!.originalUuids.push(originalUuid);
        lineMaterialGroups.get(key)!.originalParentUuids.push(originalParentUuid);
      });
    });

    const mergedLines: (THREE.Line | THREE.LineSegments)[] = [];
    lineMaterialGroups.forEach((group) => {
      if (group.geometries.length === 0) return;

      const mergedGeometry = BufferGeometryUtils.mergeGeometries(group.geometries, true);

      if (mergedGeometry && mergedGeometry.attributes.position && mergedGeometry.attributes.position.count > 0) {
        const lineMaterial = new THREE.LineBasicMaterial({
          vertexColors: true,
          color: (group.material as any).color || 0xffffff,
        });

        let mergedLine: THREE.Line | THREE.LineSegments;
        if (group.isLineSegments) {
          mergedLine = new THREE.LineSegments(mergedGeometry, lineMaterial);
        } else {
          mergedLine = new THREE.Line(mergedGeometry, lineMaterial);
        }

        mergedLines.push(mergedLine);
        this.setGeomAttribute({
          geometries: group.geometries,
          mergedGeometry,
          originalUuids: group.originalUuids,
          originalParentUuids: group.originalParentUuids,
        });

        group.geometries.forEach((geom) => geom.dispose());
      }
    });

    return mergedLines;
  }

  private static prepareGeometry(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4) {
    const clonedGeo = geometry.clone();
    clonedGeo.applyMatrix4(matrix);

    if (clonedGeo.index) {
      clonedGeo.toNonIndexed();
    }

    return clonedGeo;
  }

  private static prepareLineGeometry(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4) {
    const clonedGeo = geometry.clone();

    if (clonedGeo.attributes.position) {
      const positionAttribute = clonedGeo.attributes.position;
      const positions = positionAttribute.array;

      for (let i = 0; i < positions.length; i += 3) {
        this.tempVector.set(positions[i], positions[i + 1], positions[i + 2]);
        this.tempVector.applyMatrix4(matrix);
        positions[i] = this.tempVector.x;
        positions[i + 1] = this.tempVector.y;
        positions[i + 2] = this.tempVector.z;
      }
      positionAttribute.needsUpdate = true;
    }

    if (clonedGeo.index) {
      clonedGeo.toNonIndexed();
    }

    return clonedGeo;
  }

  private static setGeomAttribute({ geometries, mergedGeometry, originalUuids = [], originalParentUuids = [] }: { geometries: THREE.BufferGeometry[]; mergedGeometry: THREE.BufferGeometry; originalUuids: string[]; originalParentUuids: string[] }) {
    mergedGeometry.userData = {
      groups: mergedGeometry.groups,
      uuids: originalUuids,
      parentUuids: originalParentUuids,
      objectCount: geometries.length,
    };
  }

  private static disposeHierarchy(node: THREE.Object3D) {
    if (node instanceof THREE.Mesh || node instanceof THREE.Line || node instanceof THREE.LineSegments) {
      if (node.geometry) node.geometry.dispose();
      if (node.material) {
        if (Array.isArray(node.material)) {
          node.material.forEach((m) => m.dispose());
        } else {
          node.material.dispose();
        }
      }
    }

    for (let i = node.children.length - 1; i >= 0; i--) {
      this.disposeHierarchy(node.children[i]);
    }
  }
}
