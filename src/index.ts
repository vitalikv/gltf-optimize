import { GltfOptimizer } from './GltfOptimizer.js';

class Main {
  private optimizer: GltfOptimizer;

  constructor() {
    this.optimizer = new GltfOptimizer();
  }

  // оптимизация одного файла
  public async convertOneFile(nameFile: string) {
    await this.optimizer.optimize(nameFile);
  }

  // оптимизация нескольких файлов
  public async convertMultipleFiles(nameFiles: string[]) {
    await this.optimizer.optimizeMultiple(nameFiles);
  }

  // оптимизация всех файлов из папки
  public async convertAllFilesFromFolder() {
    const files = this.optimizer.getAvailableFiles();
    await this.optimizer.optimizeMultiple(files);
  }

  // очистка папки output
  public clearOutputFolder() {
    this.optimizer.clearOutput();
  }
}

const main = new Main();
main.clearOutputFolder();

const nameFiles = ['model.gltf', 'new ТРР-1-0006 Транспортер.gltf', 'A31A12-5325010-60^B.1^A.1.gltf'];
//const nameFile = 'ТРДДФ-1-000 - Двигатель - A.1.gltf';

main.convertOneFile(nameFiles[0]);
// main.convertMultipleFiles(nameFiles);
// main.convertAllFilesFromFolder();
