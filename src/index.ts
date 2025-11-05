import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MergeModel } from './mergeModel.js';
//import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFExporter } from './GLTFExporter.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// В самом начале index.ts, до импортов
if (typeof ProgressEvent === 'undefined') {
  (global as any).ProgressEvent = class ProgressEvent extends Event {
    lengthComputable: boolean = false;
    loaded: number = 0;
    total: number = 0;

    constructor(type: string, init?: ProgressEventInit) {
      super(type);
      if (init) {
        this.lengthComputable = init.lengthComputable || false;
        this.loaded = init.loaded || 0;
        this.total = init.total || 0;
      }
    }
  };
}

async function optimizeGltf() {
  try {
    console.log('🔧 Начинаем оптимизацию GLTF модели...');

    // const nameFile = 'model.gltf';
    //const nameFile = 'new ТРР-1-0006 Транспортер.gltf';
    //const nameFile = 'ТРДДФ-1-000 - Двигатель - A.1.gltf';
    const nameFile = 'A31A12-5325010-60^B.1^A.1.gltf';

    const inputFile = path.join(__dirname, '../input/' + nameFile);
    const outputFile = path.join(__dirname, '../output/' + nameFile);
    const outputDir = path.join(__dirname, '../output');

    // Проверяем входной файл
    if (!fs.existsSync(inputFile)) {
      console.log(' Файл не найден:', inputFile);
      return;
    }

    // Создаем папку output если нет
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log('Создана папка output');
    }

    console.log(' Загружаем модель...');

    const data = fs.readFileSync(inputFile, 'utf-8');
    const gltfJson = JSON.parse(data);

    const loadManag = new THREE.LoadingManager(
      () => {
        console.log('emit load');
      },
      (itemUrl: string, itemsLoaded: number, itemsTotal: number) => {
        const progressRatio = itemsLoaded / itemsTotal;
        console.log(progressRatio);
      },
      (err: any) => {
        console.log('Loader err:', err);
      }
    );

    const loader = new GLTFLoader(loadManag);

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('three/examples/jsm/libs/draco/');
    loader.setDRACOLoader(dracoLoader);

    const gltfData = await loader.parseAsync(gltfJson, '');
    console.log(' Модель загружена:');

    console.log(`   - Сцена: ${gltfData.scene.children.length} объектов`);
    console.log(`   - Анимации: ${gltfData.animations.length}`);

    // Анализируем исходную модель
    const originalStats = analyzeScene(gltfData.scene);
    console.log(' Статистика исходной модели:');
    console.log(`   - Мешей: ${originalStats.meshCount}`);
    console.log(`   - Вершин: ${originalStats.vertexCount}`);
    console.log(`   - Линий: ${originalStats.lineCount}`);

    console.log(' Начинаем мердж геометрий...');
    const result = MergeModel.processModelWithMerge(gltfData.scene);
    //const result = { group: gltfData.scene };

    const optimizedStats = analyzeScene(result.group);
    console.log(' Статистика оптимизированной модели:');
    console.log(`   - Мешей: ${optimizedStats.meshCount}`);
    console.log(`   - Вершин: ${optimizedStats.vertexCount}`);
    console.log(`   - Линий: ${optimizedStats.lineCount}`);

    const scene = new THREE.Scene();
    scene.add(result.group);

    console.log('Экспортируем в GLTF...');
    const exporter = new GLTFExporter();
    const exportResult = await exporter.parseAsync(scene, { binary: false, trs: false, onlyVisible: true, bufferBaseName: nameFile });

    // Сохраняем результат
    console.log('Сохраняем файл...');
    fs.writeFileSync(outputFile, JSON.stringify(exportResult, null, 2));

    console.log('Оптимизация завершена!');
    console.log(`Сравнение результатов:`);
    console.log(`   - Мешей: ${originalStats.meshCount} → ${optimizedStats.meshCount} (${calculateReduction(originalStats.meshCount, optimizedStats.meshCount)})`);
    console.log(`   - Вершин: ${originalStats.vertexCount} → ${optimizedStats.vertexCount} (${calculateReduction(originalStats.vertexCount, optimizedStats.vertexCount)})`);
    console.log(` Файл сохранен: ${outputFile}`);
  } catch (error) {
    console.log(' Ошибка:', error);
    if (error instanceof Error) {
      console.log('   - Сообщение:', error.message);
      console.log('   - Стек:', error.stack);
    }
  }
}

// Вспомогательные функции
function analyzeScene(scene: THREE.Object3D): { meshCount: number; vertexCount: number; lineCount: number } {
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

function calculateReduction(original: number, optimized: number): string {
  const reduction = ((original - optimized) / original) * 100;
  if (reduction > 0) {
    return `уменьшение на ${reduction.toFixed(1)}%`;
  } else if (reduction < 0) {
    return `увеличение на ${Math.abs(reduction).toFixed(1)}%`;
  } else {
    return 'без изменений';
  }
}

// Запускаем оптимизацию
optimizeGltf();
