import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const mkdirAsync = promisify(fs.mkdir);
const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const unlinkAsync = promisify(fs.unlink);
const statAsync = promisify(fs.stat);
const readdirAsync = promisify(fs.readdir);

export interface FileStats {
  totalFiles: number;
  totalSize: number;
  averageSize: number;
}

export class FileStorage {
  private basePath: string;

  constructor(basePath: string = './audio_files') {
    this.basePath = basePath;
    this.ensureDirectory();
  }

  private async ensureDirectory(): Promise<void> {
    try {
      await statAsync(this.basePath);
    } catch (error) {
      await mkdirAsync(this.basePath, { recursive: true });
    }
  }

  public async setBasePath(newPath: string): Promise<void> {
    this.basePath = newPath;
    await this.ensureDirectory();
  }

  public async saveAudioFile(buffer: Buffer, fileName: string): Promise<string> {
    await this.ensureDirectory();
    
    const filePath = path.join(this.basePath, fileName);
    await writeFileAsync(filePath, buffer);
    
    return filePath;
  }

  public async getAudioFile(fileName: string): Promise<Buffer> {
    const filePath = path.join(this.basePath, fileName);
    
    try {
      // Check if file exists first
      await statAsync(filePath);
      
      // Try to read the file
      const fileBuffer = await readFileAsync(filePath);
      
      if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error(`Audio file exists but is empty: ${fileName}`);
      }
      
      console.log(`Successfully read audio file: ${fileName}, size: ${fileBuffer.length} bytes`);
      return fileBuffer;
    } catch (error: unknown) {
      // TypeScript error handling
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        console.error(`Audio file not found: ${fileName}`);
        throw new Error(`Audio file not found: ${fileName}`);
      }
      
      console.error(`Error reading audio file ${fileName}:`, error);
      throw error;
    }
  }

  public async deleteAudioFile(fileName: string): Promise<void> {
    const filePath = path.join(this.basePath, fileName);
    await unlinkAsync(filePath);
  }

  public async getStorageStats(): Promise<FileStats> {
    await this.ensureDirectory();
    
    const files = await readdirAsync(this.basePath);
    let totalSize = 0;
    
    for (const file of files) {
      const filePath = path.join(this.basePath, file);
      const stats = await statAsync(filePath);
      totalSize += stats.size;
    }
    
    return {
      totalFiles: files.length,
      totalSize: totalSize,
      averageSize: files.length > 0 ? totalSize / files.length : 0
    };
  }

  public getFilePath(fileName: string): string {
    return path.join(this.basePath, fileName);
  }
}

// Create and export a default instance with the default path
export const fileStorage = new FileStorage();
