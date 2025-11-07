import { readdirSync, statSync, unlinkSync, existsSync, rmSync } from 'fs';
import { join, relative, resolve, extname } from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const project_root = resolve(__dirname, '..');

// АГРЕССИВНЫЕ настройки для достижения 25MB
const config = {
    jpeg: { quality: 75 },  // было 100
    webp: { quality: 80 },   // было lossless
    png: { quality: 80 },    // было 100
    gif: { quality: 80 },    // было 100
    avif: { quality: 80 }    // было lossless
};

const resize_config = {
    width: 800,  // было 1280
    height: 800, // было 1280
    fit: sharp.fit.inside,
    withoutEnlargement: true
};

// Папки для полного удаления (если не критичны)
const dirs_to_remove = [
    'static/images/temp',
    'static/images/changelog', // 74 PNG - можно удалить если не нужны
    'static/images/testimonials', // 23 файла
    'static/images/heroes/photos', // 5 PNG
    'local-fonts' // TTF файлы - используйте только woff2
];

// Папки для агрессивной оптимизации
const dirs_to_optimize = [
    'static/images',
    'src/routes'
];

function* walk_directory(dir) {
    try {
        const files = readdirSync(dir);
        for (const file of files) {
            const pathToFile = join(dir, file);
            const isDirectory = statSync(pathToFile).isDirectory();
            if (isDirectory) {
                yield* walk_directory(pathToFile);
            } else {
                yield pathToFile;
            }
        }
    } catch (error) {
        console.error(`Error accessing directory ${dir}:`, error.message);
    }
}

function is_image(file) {
    const ext = extname(file).toLowerCase().slice(1);
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif'].includes(ext);
}

async function convert_to_webp(file) {
    try {
        const ext = extname(file).toLowerCase();
        if (ext === '.svg') return; // SVG не конвертируем
        
        const webpPath = file.replace(ext, '.webp');
        if (webpPath === file) return; // уже webp
        
        const image = sharp(file);
        const meta = await image.metadata();
        
        if (!meta.width || !meta.height) return;
        
        // Конвертируем PNG/JPG в WebP
        await image
            .resize(resize_config)
            .webp({ quality: 80 })
            .toFile(webpPath);
        
        const originalSize = statSync(file).size;
        const webpSize = statSync(webpPath).size;
        
        if (webpSize < originalSize * 0.7) { // WebP меньше на 30%+
            console.log(`✅ Converted ${relative(project_root, file)} -> WebP (saved ${((1 - webpSize/originalSize) * 100).toFixed(1)}%)`);
            unlinkSync(file); // Удаляем оригинал
        } else {
            unlinkSync(webpPath); // WebP не лучше, удаляем его
        }
    } catch (error) {
        console.error(`Error converting ${file}:`, error.message);
    }
}

async function optimize_image(file) {
    try {
        const ext = extname(file).toLowerCase();
        if (ext === '.svg') return; // SVG пропускаем
        
        const image = sharp(file);
        const meta = await image.metadata();
        const format = meta.format;
        
        if (!format || !config[format]) return;
        
        const originalSize = statSync(file).size;
        
        // Агрессивная оптимизация
        await image
            .resize(resize_config)
            [format](config[format])
            .toFile(file);
        
        const newSize = statSync(file).size;
        const saved = ((1 - newSize/originalSize) * 100).toFixed(1);
        
        if (saved > 5) {
            console.log(`✅ Optimized ${relative(project_root, file)} (saved ${saved}%)`);
        }
        
        // Пытаемся конвертировать в WebP
        if (['png', 'jpg', 'jpeg'].includes(format)) {
            await convert_to_webp(file);
        }
    } catch (error) {
        console.error(`Error optimizing ${file}:`, error.message);
    }
}

async function remove_directories() {
    console.log('\n🗑️  Removing unnecessary directories...\n');
    
    for (const dir of dirs_to_remove) {
        const fullPath = join(project_root, dir);
        if (existsSync(fullPath)) {
            console.log(`Removing: ${dir}`);
            try {
                rmSync(fullPath, { recursive: true, force: true });
                console.log(`✅ Removed: ${dir}`);
            } catch (error) {
                console.error(`❌ Failed to remove ${dir}:`, error.message);
            }
        }
    }
}

async function cleanup_temp_files() {
    console.log('\n🧹 Cleaning up temporary files...\n');
    let count = 0;
    
    // Удаляем .optimized файлы
    for (const file of walk_directory(project_root)) {
        if (file.endsWith('.optimized')) {
            try {
                unlinkSync(file);
                count++;
            } catch (error) {
                // Ignore errors
            }
        }
    }
    
    if (count > 0) {
        console.log(`✅ Removed ${count} .optimized files`);
    }
}

async function main() {
    console.log('🚀 Starting AGGRESSIVE optimization to reach 25MB...\n');
    
    // 1. Удаляем временные файлы
    await cleanup_temp_files();
    
    // 2. Удаляем ненужные папки
    await remove_directories();
    
    // 3. Агрессивная оптимизация изображений
    console.log('\n📸 Optimizing images...\n');
    
    let optimizedCount = 0;
    for (const dir of dirs_to_optimize) {
        const fullPath = join(project_root, dir);
        if (!existsSync(fullPath)) continue;
        
        for (const file of walk_directory(fullPath)) {
            if (is_image(file)) {
                await optimize_image(file);
                optimizedCount++;
            }
        }
    }
    
    console.log(`\n✅ Aggressive optimization complete!`);
    console.log(`📊 Processed ${optimizedCount} images`);
}

await main();

