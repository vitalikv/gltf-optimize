import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MergeModel } from './mergeModel.js';
//import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFExporter } from './GLTFExporter.js';
import { AnalyzeScene } from './AnalyzeScene.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export class GltfOptimizer {
  private loader: GLTFLoader;
  private dracoLoader: DRACOLoader;
  private exporter;

  constructor() {
    const loadingManager = new THREE.LoadingManager(
      () => {
        console.log('Модель загружена');
      },
      (itemUrl: string, itemsLoaded: number, itemsTotal: number) => {
        const progressRatio = itemsLoaded / itemsTotal;
        console.log(`Прогресс загрузки: ${(progressRatio * 100).toFixed(1)}%`);
      },
      (err: any) => {
        console.log('Ошибка загрузки:', err);
      }
    );

    this.loader = new GLTFLoader(loadingManager);

    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath('three/examples/jsm/libs/draco/');
    this.loader.setDRACOLoader(this.dracoLoader);

    this.exporter = new GLTFExporter();
  }

  public async optimize(inputFileName: string): Promise<boolean> {
    try {
      const inputFile = path.join(__dirname, '../input/' + inputFileName);
      const outputFile = path.join(__dirname, '../output/' + inputFileName);
      const outputDir = path.join(__dirname, '../output');

      if (!fs.existsSync(inputFile)) {
        console.log('Файл не найден:', inputFile);
        return false;
      }

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log('Создана папка output');
      }

      console.log('Загружаем модель');

      const data = fs.readFileSync(inputFile, 'utf-8');
      const gltfJson = JSON.parse(data);

      const gltfData = await this.loader.parseAsync(gltfJson, '');

      console.log(`Сцена: ${gltfData.scene.children.length} объектов`);
      console.log(`Анимации: ${gltfData.animations.length}`);

      const originalStats = AnalyzeScene.calculateCount({ scene: gltfData.scene });
      console.log('Статистика исходной модели:');
      console.log(`   - Мешей: ${originalStats.meshCount}`);
      console.log(`   - Вершин: ${originalStats.vertexCount}`);
      console.log(`   - Линий: ${originalStats.lineCount}`);

      console.log('Начинаем мердж геометрий...');
      const result = MergeModel.processModelWithMerge(gltfData.scene);

      const optimizedStats = AnalyzeScene.calculateCount({ scene: result.group });
      console.log('Статистика оптимизированной модели:');
      console.log(`   - Мешей: ${optimizedStats.meshCount}`);
      console.log(`   - Вершин: ${optimizedStats.vertexCount}`);
      console.log(`   - Линий: ${optimizedStats.lineCount}`);

      const scene = new THREE.Scene();
      scene.add(result.group);

      console.log('Экспортируем в GLTF...');
      const exportResult = await this.exporter.parseAsync(scene, {
        binary: false,
        trs: false,
        onlyVisible: true,
        bufferBaseName: inputFileName,
      });

      console.log('Сохраняем файл...');
      fs.writeFileSync(outputFile, JSON.stringify(exportResult, null, 2));

      console.log('Оптимизация завершена!');
      console.log(`Сравнение результатов:`);
      console.log(`   - Мешей: ${originalStats.meshCount} → ${optimizedStats.meshCount} (${AnalyzeScene.calculateReduction(originalStats.meshCount, optimizedStats.meshCount)})`);
      console.log(`   - Вершин: ${originalStats.vertexCount} → ${optimizedStats.vertexCount} (${AnalyzeScene.calculateReduction(originalStats.vertexCount, optimizedStats.vertexCount)})`);
      console.log(`Файл сохранен: ${outputFile}`);

      return true;
    } catch (error) {
      console.log('Ошибка оптимизации:', error);
      if (error instanceof Error) {
        console.log('   - Сообщение:', error.message);
        console.log('   - Стек:', error.stack);
      }
      return false;
    }
  }

  // оптимизация несколько файлов
  public async optimizeMultiple(fileNames: string[]): Promise<void> {
    for (const fileName of fileNames) {
      console.log(`Обрабатываем файл: ${fileName}`);
      const success = await this.optimize(fileName);
      if (success) {
        console.log(`${fileName} - успешно оптимизирован`);
      } else {
        console.log(`${fileName} - ошибка оптимизации`);
      }
    }
  }

  // получаем список всех GLTF файлов в папке input
  public getAvailableFiles(): string[] {
    const inputDir = path.join(__dirname, '../input');

    if (!fs.existsSync(inputDir)) {
      console.log('Папка input не существует');
      return [];
    }

    const files = fs.readdirSync(inputDir);
    const gltfFiles = files.filter((file) => file.toLowerCase().endsWith('.gltf') || file.toLowerCase().endsWith('.glb'));

    console.log(`Найдено ${gltfFiles.length} GLTF файлов:`);
    gltfFiles.forEach((file) => console.log(`   - ${file}`));

    return gltfFiles;
  }

  // очистка папки output
  public clearOutput() {
    const outputDir = path.join(__dirname, '../output');

    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true });
      console.log('Папка output очищена');
    } else {
      console.log('Папка output не существует');
    }
  }

  // очистка ресурсов
  public dispose() {
    this.dracoLoader.dispose();
  }
}
