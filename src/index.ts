// src/index.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MergeModel } from './mergeModel.js';
import { GLTFExporter } from './gLTFExporter.js';
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

    const inputFile = path.join(__dirname, '../input/model.gltf');
    const outputFile = path.join(__dirname, '../output/optimized_model.gltf');
    const outputDir = path.join(__dirname, '../output');

    // Проверяем входной файл
    if (!fs.existsSync(inputFile)) {
      console.log('❌ Файл не найден:', inputFile);
      console.log('📁 Положите ваш model.gltf в папку input/');
      console.log('📁 Структура проекта:');
      console.log('   project/');
      console.log('   ├── input/');
      console.log('   │   └── model.gltf');
      console.log('   ├── output/');
      console.log('   └── src/');
      return;
    }

    // Создаем папку output если нет
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log('✅ Создана папка output');
    }

    // Загружаем GLTF с помощью three.js
    console.log('📥 Загружаем модель...');

    const data = fs.readFileSync('./input/model.gltf', 'utf-8');
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
    // Настраиваем DRACO декодер (опционально)
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('three/examples/jsm/libs/draco/');
    loader.setDRACOLoader(dracoLoader);

    const gltfData = await loader.parseAsync(gltfJson, '');
    console.log('✅ Модель загружена:');

    // Загружаем модель
    //const gltfData = await loader.loadAsync(inputFile);
    //console.log('✅ Модель загружена:');
    console.log(`   - Сцена: ${gltfData.scene.children.length} объектов`);
    console.log(`   - Анимации: ${gltfData.animations.length}`);

    // Анализируем исходную модель
    const originalStats = analyzeScene(gltfData.scene);
    console.log('📊 Статистика исходной модели:');
    console.log(`   - Мешей: ${originalStats.meshCount}`);
    console.log(`   - Вершин: ${originalStats.vertexCount}`);
    console.log(`   - Линий: ${originalStats.lineCount}`);

    // Используем ваш MergeModel класс для оптимизации
    console.log('🔄 Начинаем мердж геометрий...');
    const result = MergeModel.processModelWithMerge(gltfData.scene);

    // Анализируем оптимизированную модель
    const optimizedStats = analyzeScene(result.group);
    console.log('📊 Статистика оптимизированной модели:');
    console.log(`   - Мешей: ${optimizedStats.meshCount}`);
    console.log(`   - Вершин: ${optimizedStats.vertexCount}`);
    console.log(`   - Линий: ${optimizedStats.lineCount}`);

    // const scene = new THREE.Scene();
    // scene.add(result.group);
    // Экспортируем обратно в GLTF
    console.log('💾 Экспортируем в GLTF...');
    const exportResult = await GLTFExporter.exportGLTF(result.group, {
      binary: false, // Сохраняем как JSON (можно изменить на true для .glb)
      trs: false,
      onlyVisible: true,
    });

    // Сохраняем результат
    console.log('📁 Сохраняем файл...');
    fs.writeFileSync(outputFile, JSON.stringify(exportResult.gltf, null, 2));

    // Если есть бинарные данные, сохраняем их тоже
    if (exportResult.buffers && exportResult.buffers.length > 0) {
      exportResult.buffers.forEach((buffer, index) => {
        const bufferFile = path.join(outputDir, `buffer_${index}.bin`);
        fs.writeFileSync(bufferFile, Buffer.from(buffer));
        console.log(`   - Бинарный файл: buffer_${index}.bin`);
      });
    }

    console.log('🎉 Оптимизация завершена!');
    console.log(`📊 Сравнение результатов:`);
    console.log(`   - Мешей: ${originalStats.meshCount} → ${optimizedStats.meshCount} (${calculateReduction(originalStats.meshCount, optimizedStats.meshCount)})`);
    console.log(`   - Вершин: ${originalStats.vertexCount} → ${optimizedStats.vertexCount} (${calculateReduction(originalStats.vertexCount, optimizedStats.vertexCount)})`);
    console.log(`💾 Файл сохранен: ${outputFile}`);
  } catch (error) {
    console.log('❌ Ошибка:', error);
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
