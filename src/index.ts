import fs from 'fs';

// Простая функция масштабирования GLTF
async function scaleGltf() {
  try {
    console.log('🔧 Масштабируем GLTF модель...');

    const inputFile = './input/model.gltf';
    const outputFile = './output/scaled_model.gltf';
    const scale = 1.0;

    // Проверяем есть ли входной файл
    if (!fs.existsSync(inputFile)) {
      console.log('❌ Файл не найден:', inputFile);
      console.log('📁 Положите ваш model.gltf в папку input/');
      return;
    }

    // Читаем и парсим GLTF
    const data = fs.readFileSync(inputFile, 'utf8');
    const gltf = JSON.parse(data);

    // Масштабируем все узлы
    if (gltf.nodes) {
      gltf.nodes.forEach((node: any) => {
        if (node.scale) {
          node.scale = node.scale.map((s: number) => s * scale);
        } else {
          node.scale = [scale, scale, scale];
        }
      });
      console.log(`✅ Масштабировано узлов: ${gltf.nodes.length}`);
    }

    // Создаем папку output если нет
    if (!fs.existsSync('./output')) {
      fs.mkdirSync('./output', { recursive: true });
    }

    // Сохраняем результат
    fs.writeFileSync(outputFile, JSON.stringify(gltf, null, 2));
    console.log('🎉 Файл сохранен:', outputFile);
  } catch (error) {
    console.log('❌ Ошибка:', error);
  }
}

// Запускаем сразу
scaleGltf();
