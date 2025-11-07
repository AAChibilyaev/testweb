import { readdirSync, statSync, unlinkSync, existsSync, rmSync } from 'fs';
import { join, relative, resolve, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const project_root = resolve(__dirname, '..');

// Удаляем большие файлы и папки для достижения 25MB
const large_dirs_to_remove = [
    'src/routes/blog', // 3.6MB - markdoc файлы можно оставить, но изображения удалить
    'src/routes/changelog', // 508KB
];

const large_files_to_remove = [
    // Можно добавить конкретные большие файлы
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
        // Ignore
    }
}

function is_image(file) {
    const ext = extname(file).toLowerCase().slice(1);
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif'].includes(ext);
}

async function remove_large_images(dir, maxSize = 100 * 1024) {
    // maxSize в байтах (100KB по умолчанию)
    let removed = 0;
    let saved = 0;
    
    for (const file of walk_directory(dir)) {
        if (!is_image(file)) continue;
        
        try {
            const stats = statSync(file);
            if (stats.size > maxSize) {
                const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
                console.log(`Removing large image: ${relative(project_root, file)} (${sizeMB}MB)`);
                unlinkSync(file);
                removed++;
                saved += stats.size;
            }
        } catch (error) {
            // Ignore
        }
    }
    
    if (removed > 0) {
        const savedMB = (saved / 1024 / 1024).toFixed(2);
        console.log(`✅ Removed ${removed} large images, saved ${savedMB}MB`);
    }
}

async function remove_large_assets(dir, maxSize = 200 * 1024) {
    // Удаляем большие файлы из static/assets
    let removed = 0;
    let saved = 0;
    
    for (const file of walk_directory(dir)) {
        try {
            const stats = statSync(file);
            if (stats.size > maxSize) {
                const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
                console.log(`Removing large asset: ${relative(project_root, file)} (${sizeMB}MB)`);
                unlinkSync(file);
                removed++;
                saved += stats.size;
            }
        } catch (error) {
            // Ignore
        }
    }
    
    if (removed > 0) {
        const savedMB = (saved / 1024 / 1024).toFixed(2);
        console.log(`✅ Removed ${removed} large assets, saved ${savedMB}MB`);
    }
}

async function main() {
    console.log('🧹 Cleaning up large files to reach 25MB...\n');
    
    // Удаляем большие изображения из static/images (больше 100KB)
    console.log('Removing large images from static/images...');
    await remove_large_images(join(project_root, 'static/images'), 100 * 1024);
    
    // Удаляем большие изображения из src/routes (больше 50KB для более агрессивной очистки)
    console.log('\nRemoving large images from src/routes...');
    await remove_large_images(join(project_root, 'src/routes'), 50 * 1024);
    
    // Удаляем большие файлы из static/assets (больше 200KB)
    console.log('\nRemoving large assets from static/assets...');
    await remove_large_assets(join(project_root, 'static/assets'), 200 * 1024);
    
    // Удаляем большие папки
    console.log('\nRemoving large directories...');
    for (const dir of large_dirs_to_remove) {
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
    
    console.log('\n✅ Cleanup complete!');
}

await main();

